// Release scenario: drives the server over stdio the way an MCP client would and
// checks 18 of the 19 tools in about 20 calls. Only create_project is left out,
// because there is no tool to delete a project again.
//
// Without an API key it runs the three diagnostics only (a quick local check).
// With DRUMBEATS_API_KEY + SCENARIO_PROJECT_ID it runs the full account scenario
// against that project: one temporary JOB_BASIC monitor, start/success/failure
// pings, a paused ping, and a test incident that it resolves. The monitor is
// deleted at the end through the REST API, whatever happened.
//
// The project must have no notification channels, or the scenario stops before
// the failure ping, so a release check can never alert anyone.
//
//   node scripts/scenario/run.js                                  # against dist/stdio.js
//   node scripts/scenario/run.js --server "npx -y ./drumbeats-mcp-0.6.0.tgz"
//
// Environment: DRUMBEATS_API_KEY, SCENARIO_PROJECT_ID, DRUMBEATS_API_BASE_URL
// (default https://api.drumbeats.io), SCENARIO_LABEL (shown in names), GITHUB_STEP_SUMMARY.
import { appendFileSync } from 'node:fs'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const argServer = process.argv.indexOf('--server')
const serverCmd = (argServer > -1 ? process.argv[argServer + 1] : 'node dist/stdio.js').split(' ')
const apiKey = process.env.DRUMBEATS_API_KEY
const projectId = process.env.SCENARIO_PROJECT_ID
const apex = (process.env.DRUMBEATS_API_BASE_URL || 'https://api.drumbeats.io').replace(/\/$/, '')
const label = process.env.SCENARIO_LABEL || 'local'
const full = Boolean(apiKey && projectId)

const results = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class StepError extends Error {}
const expect = (cond, message) => {
  if (!cond) throw new StepError(message)
}

const client = new Client({ name: 'drumbeats-release-scenario', version: '1.0.0' })
const transport = new StdioClientTransport({
  command: serverCmd[0],
  args: serverCmd.slice(1),
  // stdio refuses to start without a key; the diagnostics never use it, so a placeholder is enough for them.
  env: { ...process.env, DRUMBEATS_API_KEY: apiKey || 'diagnostics-only' },
  stderr: 'inherit',
})

/** Calls a tool and returns its structured result; a tool error fails the step. */
async function call(name, args) {
  const res = await client.callTool({ name, arguments: args })
  const text = (res.content ?? []).map((c) => c.text ?? '').join(' ')
  if (res.isError) throw new StepError(`${name} returned an error: ${text.slice(0, 300)}`)
  return res.structuredContent ?? JSON.parse(text)
}

/** Runs one step, records it, and rethrows so later steps that depend on it do not run. */
async function step(title, tool, fn) {
  const started = Date.now()
  try {
    const detail = await fn()
    results.push({ title, tool, ok: true, ms: Date.now() - started, detail: detail ?? '' })
  } catch (error) {
    results.push({ title, tool, ok: false, ms: Date.now() - started, detail: String(error.message ?? error) })
    throw error
  }
}

/** Retries a read until `check` passes; pings and incidents are processed asynchronously. */
async function poll(read, check, { tries = 12, every = 2500 } = {}) {
  let last
  for (let i = 0; i < tries; i++) {
    last = await read()
    if (check(last)) return last
    await sleep(every)
  }
  return last
}

async function deleteMonitor(id) {
  const res = await fetch(`${apex}/beats/v1/monitors/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-API-Key': apiKey },
  })
  return res.ok || res.status === 404
}

let monitorId = null
let failed = false
try {
  await client.connect(transport)
  const server = client.getServerVersion()
  const tools = (await client.listTools()).tools.map((t) => t.name)
  results.push({
    title: `Connected to ${server?.name} ${server?.version}`,
    tool: 'tools/list',
    ok: tools.length > 0,
    ms: 0,
    detail: `${tools.length} tools`,
  })

  await step('Check a website', 'check_http', async () => {
    const r = await call('check_http', { url: 'https://drumbeats.io' })
    expect(r.status === 'up', `drumbeats.io is ${r.status} (HTTP ${r.status_code})`)
    return `up, HTTP ${r.status_code}, ${r.response_time_ms} ms`
  })
  await step('Check a certificate', 'check_ssl', async () => {
    const r = await call('check_ssl', { hostname: 'drumbeats.io' })
    expect(r.valid, 'certificate is not valid')
    return `valid, ${r.days_remaining} days left`
  })
  await step('Check DNS', 'check_dns', async () => {
    const r = await call('check_dns', { hostname: 'drumbeats.io' })
    expect(!r.all_failed, 'every lookup failed')
    return 'resolved'
  })

  if (full) {
    await step('Find the test project, with no alert channels', 'list_projects', async () => {
      const r = await call('list_projects', { include: ['channels'] })
      const p = r.projects.find((x) => x.id === projectId)
      expect(p, `project ${projectId} is not visible to this API key`)
      const channels = p.notification_channels ?? []
      expect(channels.length === 0, `project has ${channels.length} notification channel(s); remove them first`)
      return p.name
    })
    await step('Note the run on the project', 'update_project', async () => {
      await call('update_project', {
        project_id: projectId,
        description: `Release checks for the Drumbeats MCP. Last run: ${label} at ${new Date().toISOString()}. Keep this project without notification channels.`,
      })
    })
    await step('Create a temporary monitor', 'create_monitor', async () => {
      const r = await call('create_monitor', {
        project_id: projectId,
        type: 'JOB_BASIC',
        name: `release check ${label}`,
        schedule: '@event',
      })
      monitorId = r.monitor.id
      expect(monitorId, 'no monitor id returned')
      return monitorId
    })

    let runId
    await step('Report a run start', 'ping_start', async () => {
      const r = await call('ping_start', { monitor_id: monitorId, message: 'release check' })
      expect(r.recorded && r.run_id, 'start was not recorded')
      runId = r.run_id
      return `run ${runId}`
    })
    await step('Report the run succeeded', 'ping_success', async () => {
      const r = await call('ping_success', { monitor_id: monitorId, run_id: runId, payload: `scenario ${label}` })
      expect(r.recorded, 'success was not recorded')
    })
    await step('Read the monitor', 'get_monitor', async () => {
      const r = await call('get_monitor', { monitor_id: monitorId })
      expect(r.monitor.id === monitorId, 'wrong monitor returned')
      return `status ${r.monitor.status}`
    })
    await step('Read its ping history', 'get_monitor_history', async () => {
      const events = (r) => (r.data?.data ?? []).map((p) => p.event)
      const r = await poll(
        () => call('get_monitor_history', { monitor_id: monitorId, kind: 'pings' }),
        (x) => events(x).includes('START') && events(x).includes('SUCCESS')
      )
      expect(events(r).includes('SUCCESS'), `history shows ${events(r).join(', ') || 'no pings'}`)
      return events(r).join(', ')
    })
    await step('Rename the monitor', 'update_monitor', async () => {
      const r = await call('update_monitor', { monitor_id: monitorId, name: `release check ${label} (renamed)` })
      expect(r.monitor.name.endsWith('(renamed)'), 'name did not change')
    })
    await step('Pause it', 'pause_monitor', async () => {
      await call('pause_monitor', { monitor_id: monitorId })
    })
    await step('A ping to a paused monitor is not recorded', 'ping_failure', async () => {
      const r = await call('ping_failure', { monitor_id: monitorId })
      expect(r.recorded === false, 'ping on a paused monitor was recorded')
    })
    await step('Resume it', 'resume_monitor', async () => {
      await call('resume_monitor', { monitor_id: monitorId })
    })

    let failRun
    await step('Start a second run', 'ping_start', async () => {
      failRun = (await call('ping_start', { monitor_id: monitorId })).run_id
    })
    await step('Report it failed (opens a test incident)', 'ping_failure', async () => {
      const r = await call('ping_failure', {
        monitor_id: monitorId,
        run_id: failRun,
        payload: 'Expected failure from the release check.',
      })
      expect(r.recorded, 'failure was not recorded')
    })

    let incidentId
    await step('Find the incident', 'list_incidents', async () => {
      const r = await poll(
        () => call('list_incidents', { project_id: projectId, monitor_id: monitorId }),
        (x) => x.incidents.length > 0
      )
      expect(r.incidents.length > 0, 'no incident opened within 30 s')
      incidentId = r.incidents[0].id
      return `${r.incidents[0].status} ${incidentId}`
    })
    await step('Resolve it', 'manage_incident', async () => {
      const r = await call('manage_incident', { incident_id: incidentId, action: 'resolve' })
      expect(r.incident.status === 'RESOLVED', `incident is ${r.incident.status}`)
    })
    await step('Read the uptime summary', 'get_uptime_summary', async () => {
      await call('get_uptime_summary', { project_id: projectId })
    })
    await step('List the monitors', 'list_monitors', async () => {
      const r = await call('list_monitors', { project_id: projectId })
      expect(
        r.monitors.some((m) => m.id === monitorId),
        'temporary monitor missing from the list'
      )
      return `${r.monitors.length} monitor(s)`
    })
  }
} catch (error) {
  failed = true
  if (!(error instanceof StepError))
    results.push({ title: 'Scenario stopped', tool: '', ok: false, ms: 0, detail: String(error) })
} finally {
  if (monitorId) {
    const ok = await deleteMonitor(monitorId).catch(() => false)
    results.push({ title: 'Delete the temporary monitor (REST)', tool: 'cleanup', ok, ms: 0, detail: monitorId })
    if (!ok) failed = true
  }
  await client.close().catch(() => {})
}

const covered = new Set(results.filter((r) => r.ok).map((r) => r.tool))
const rows = results.map((r) => `| ${r.ok ? '✅' : '❌'} | ${r.title} | \`${r.tool}\` | ${r.detail} |`)
const report = [
  `### MCP scenario (${label})${full ? '' : ' — diagnostics only, no API key'}`,
  '',
  '| | Step | Tool | Result |',
  '| --- | --- | --- | --- |',
  ...rows,
  '',
  `${results.filter((r) => r.ok).length}/${results.length} steps passed. Tools exercised: ${[...covered].filter((t) => t && !t.includes('/') && t !== 'cleanup').length}.`,
].join('\n')

console.log(report)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n\n`)
process.exit(failed ? 1 : 0)
