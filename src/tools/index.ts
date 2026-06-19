import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerListProjects } from './context/list-projects.js'
import { registerListIncidents } from './incidents/list-incidents.js'
import { registerManageIncident } from './incidents/manage-incident.js'
import { registerCreateMonitor } from './monitors/create-monitor.js'
import { registerGetMonitor } from './monitors/get-monitor.js'
import { registerGetMonitorHistory } from './monitors/get-monitor-history.js'
import { registerListMonitors } from './monitors/list-monitors.js'
import { registerPauseMonitor, registerResumeMonitor } from './monitors/pause-resume.js'
import { registerUpdateMonitor } from './monitors/update-monitor.js'
import type { ToolContext, ToolRegistration } from './types.js'
import { registerGetUptimeSummary } from './uptime/get-uptime-summary.js'

/**
 * The shared tool layer — the single registration point consumed by both
 * transports (one definition, two transports). Add a tool by appending its
 * registration function here.
 */
const registry: readonly ToolRegistration[] = [
  // Context
  registerListProjects,
  // Monitor lifecycle
  registerCreateMonitor,
  registerListMonitors,
  registerGetMonitor,
  registerUpdateMonitor,
  registerPauseMonitor,
  registerResumeMonitor,
  // Observation & triage
  registerGetMonitorHistory,
  registerGetUptimeSummary,
  registerListIncidents,
  registerManageIncident,
]

/** Registers every tool against the given MCP server using `ctx`. */
export function registerTools(server: McpServer, ctx: ToolContext): void {
  for (const register of registry) {
    register(server, ctx)
  }
}
