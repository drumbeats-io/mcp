import { randomUUID } from 'node:crypto'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { DrumbeatsApiError, toToolErrorResult } from '../../api/errors.js'
import { errorResult, jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'

/**
 * Heartbeat ping tools — the MCP equivalent of `curl -X POST .../v1/ping/:monitorId/:event`.
 *
 * The ping route lives on the beats service (`POST /v1/ping/:monitorId/:event`,
 * public path `https://api.drumbeats.io/beats/v1/ping/...`). It is
 * unauthenticated — the monitor UUID is the secret — so the auth header the
 * shared client adds is simply ignored there. Going through `ctx.api` keeps the
 * service routing (and per-service base overrides) identical on both transports.
 */
export type PingEvent = 'start' | 'success' | 'failure'

// Mirrors the ping controller's `{ ok, ping_id, event, timestamp }` reply, or
// the paused reply `{ ok: true, message, status: 'ok', code: 'MONITOR_PAUSED' }`
// (core: packages/beats/src/controllers/ping.ts).
interface RawPingResponse {
  ok?: boolean
  ping_id?: string
  event?: string
  timestamp?: string
  code?: string
  message?: string
}

export const pingOutputShape = {
  monitor_id: z.string(),
  event: z.enum(['start', 'success', 'failure']),
  recorded: z.boolean(),
  ping_id: z.string().nullable(),
  run_id: z.string().nullable(),
  timestamp: z.string().nullable(),
  note: z.string().nullable(),
}

export const pingInputShape = {
  monitor_id: z.uuid().describe('The monitor UUID — the same id as in its ping URL (from list_monitors).'),
  run_id: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe(
      'Pairs a start with its success/failure so Drumbeats can time the run. Reuse the run_id ping_start returned.'
    ),
  message: z
    .string()
    .min(1)
    .max(1000)
    .optional()
    .describe('Optional short note stored with the ping, e.g. "processed 120 rows".'),
  payload: z
    .string()
    .min(1)
    .max(10_000)
    .optional()
    .describe('Optional longer text stored as the ping payload, e.g. a log tail or error output (first 10 KB kept).'),
}

export type PingArgs = { monitor_id: string; run_id?: string; message?: string; payload?: string }

export async function sendPing(ctx: ToolContext, event: PingEvent, args: PingArgs): Promise<CallToolResult> {
  // A start with no run_id gets one, so the agent can pass it to the matching
  // success/failure. Success/failure never invent one: without a run_id the API
  // falls back to the latest start (except JOB_BASIC, which requires a match).
  const runId = args.run_id ?? (event === 'start' ? randomUUID() : undefined)
  try {
    const body = await ctx.api.request<RawPingResponse | undefined>({
      method: 'POST',
      service: 'beats',
      path: `/v1/ping/${encodeURIComponent(args.monitor_id)}/${event}`,
      // An explicit `payload` key is what the API stores as the payload. Without
      // it the API falls back to storing the raw JSON body, so always send the
      // key; an empty string is stored as no payload.
      body: { run_id: runId, message: args.message, payload: args.payload ?? '' },
    })
    const paused = body?.code === 'MONITOR_PAUSED'
    return jsonResult({
      monitor_id: args.monitor_id,
      event,
      recorded: !paused,
      ping_id: body?.ping_id ?? null,
      run_id: runId ?? null,
      timestamp: body?.timestamp ?? null,
      note: paused ? 'Monitor is paused, so the ping was not recorded. Resume it with resume_monitor.' : null,
    })
  } catch (error) {
    if (error instanceof DrumbeatsApiError && error.status === 404) {
      return errorResult(`No monitor with id ${args.monitor_id}. Check the id with list_monitors.`)
    }
    if (error instanceof DrumbeatsApiError && (error.body as { code?: unknown } | undefined)?.code === 'RATE_LIMITED') {
      return errorResult('Too many pings for this monitor (600 per minute). Wait a minute and retry.')
    }
    return toToolErrorResult(error)
  }
}

const CURL_NOTE =
  'Replaces a curl to the ping URL, so it works where outbound HTTP needs an allowlist (e.g. Claude Code cloud scheduled tasks).'

const PING_TOOLS: Readonly<Record<PingEvent, { name: string; title: string; description: string }>> = {
  start: {
    name: 'ping_start',
    title: 'Ping: run started',
    description: `Tell Drumbeats a monitored job just started. Returns a run_id; pass it to ping_success or ping_failure when the job ends so the run is timed. ${CURL_NOTE}`,
  },
  success: {
    name: 'ping_success',
    title: 'Ping: run succeeded',
    description: `Tell Drumbeats a monitored job finished successfully. This is the heartbeat that keeps the monitor up. ${CURL_NOTE}`,
  },
  failure: {
    name: 'ping_failure',
    title: 'Ping: run failed',
    description: `Tell Drumbeats a monitored job failed. This marks the run failed and can open an incident and send alerts. ${CURL_NOTE}`,
  },
}

function registerPing(server: McpServer, ctx: ToolContext, event: PingEvent): void {
  const tool = PING_TOOLS[event]
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: pingInputShape,
      outputSchema: pingOutputShape,
      // Each call records a new ping, so not idempotent; nothing is deleted.
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    (args) => sendPing(ctx, event, args)
  )
}

export function registerPingStart(server: McpServer, ctx: ToolContext): void {
  registerPing(server, ctx, 'start')
}

export function registerPingSuccess(server: McpServer, ctx: ToolContext): void {
  registerPing(server, ctx, 'success')
}

export function registerPingFailure(server: McpServer, ctx: ToolContext): void {
  registerPing(server, ctx, 'failure')
}
