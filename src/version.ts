import { createRequire } from 'node:module'

interface PackageManifest {
  readonly name: string
  readonly version: string
}

// Read name/version from the package manifest so they never drift from npm.
// At runtime this file lives in dist/, so ../package.json is the package root.
const pkg = createRequire(import.meta.url)('../package.json') as PackageManifest

export const SERVER_NAME = pkg.name
export const SERVER_VERSION = pkg.version

// Server-level guidance surfaced to MCP clients at initialize. Defined once and
// shared by both transports so the stdio and hosted servers stay in lockstep.
export const SERVER_INSTRUCTIONS =
  'Drumbeats MCP — operate Drumbeats uptime, cron, and heartbeat monitoring from your AI client. ' +
  'Most monitor and incident tools need a projectId, so call list_projects first to see the projects ' +
  'this key can access. Then: create_monitor to add a monitor (cron, heartbeat, or HTTP uptime); ' +
  'list_monitors / get_monitor / get_monitor_history to inspect; pause_monitor / resume_monitor to mute ' +
  'or restore; get_uptime_summary for a project SLA rollup; list_incidents / manage_incident to triage ' +
  'downtime. The check_http, check_ssl, and check_dns diagnostics need no account or API key — use them ' +
  'for ad-hoc checks anytime.'
