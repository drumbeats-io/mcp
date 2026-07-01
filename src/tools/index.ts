import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerListProjects } from './context/list-projects.js'
import { registerCheckDns } from './diagnostics/check-dns.js'
import { registerCheckHttp } from './diagnostics/check-http.js'
import { registerCheckSsl } from './diagnostics/check-ssl.js'
import { registerListIncidents } from './incidents/list-incidents.js'
import { registerManageIncident } from './incidents/manage-incident.js'
import { registerCreateMonitor } from './monitors/create-monitor.js'
import { registerGetMonitor } from './monitors/get-monitor.js'
import { registerGetMonitorHistory } from './monitors/get-monitor-history.js'
import { registerListMonitors } from './monitors/list-monitors.js'
import { registerPauseMonitor, registerResumeMonitor } from './monitors/pause-resume.js'
import { registerUpdateMonitor } from './monitors/update-monitor.js'
import type { NamedTool, ToolContext } from './types.js'
import { registerGetUptimeSummary } from './uptime/get-uptime-summary.js'

/**
 * The shared tool layer — the single registration point consumed by both
 * transports (one definition, two transports). Add a tool by appending its
 * `{ name, register }` entry here. `name` MUST match the tool's registered
 * name so the hosted transport can scope-gate by it (see auth/scope-map).
 */
const registry: readonly NamedTool[] = [
  // Context
  { name: 'list_projects', register: registerListProjects },
  // Monitor lifecycle
  { name: 'create_monitor', register: registerCreateMonitor },
  { name: 'list_monitors', register: registerListMonitors },
  { name: 'get_monitor', register: registerGetMonitor },
  { name: 'update_monitor', register: registerUpdateMonitor },
  { name: 'pause_monitor', register: registerPauseMonitor },
  { name: 'resume_monitor', register: registerResumeMonitor },
  // Observation & triage
  { name: 'get_monitor_history', register: registerGetMonitorHistory },
  { name: 'get_uptime_summary', register: registerGetUptimeSummary },
  { name: 'list_incidents', register: registerListIncidents },
  { name: 'manage_incident', register: registerManageIncident },
  // Diagnostics (no account required)
  { name: 'check_http', register: registerCheckHttp },
  { name: 'check_ssl', register: registerCheckSsl },
  { name: 'check_dns', register: registerCheckDns },
]

/**
 * Registers tools against the given MCP server using `ctx`.
 *
 * When `allowedNames` is provided (the hosted, scope-gated path), only tools
 * whose name is in the set are registered. When omitted (the stdio path),
 * every tool is registered — unchanged behavior.
 */
export function registerTools(server: McpServer, ctx: ToolContext, allowedNames?: ReadonlySet<string>): void {
  for (const tool of registry) {
    if (allowedNames === undefined || allowedNames.has(tool.name)) {
      tool.register(server, ctx)
    }
  }
}
