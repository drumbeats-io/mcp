/**
 * OAuth token scope ↔ tool availability (the Drumbeats API key-scope model), reused
 * verbatim from the stdio account-key model. The hosted transport reads these
 * scopes from the verified OAuth token; stdio reads them from the account key.
 */

export const SCOPES = ['read', 'manage_monitors'] as const
export type Scope = (typeof SCOPES)[number]

/**
 * Tools unlocked by each scope. `read` is always granted; `manage_monitors`
 * adds the write/lifecycle tools. Names are the exact tool `name` strings
 * registered under `src/tools/**`.
 */
export const TOOLS_BY_SCOPE: Readonly<Record<Scope, readonly string[]>> = {
  read: [
    'list_projects',
    'list_monitors',
    'get_monitor',
    'get_monitor_history',
    'get_uptime_summary',
    'list_incidents',
    'check_http',
    'check_ssl',
    'check_dns',
  ],
  manage_monitors: ['create_monitor', 'update_monitor', 'pause_monitor', 'resume_monitor', 'manage_incident'],
}

/** Returns the set of tool names available for a set of granted scopes. */
export function toolsForScopes(scopes: readonly Scope[]): ReadonlySet<string> {
  const tools = new Set<string>()
  for (const scope of scopes) {
    for (const tool of TOOLS_BY_SCOPE[scope]) {
      tools.add(tool)
    }
  }
  return tools
}

/** Type guard: is an arbitrary string one of the known scopes? */
export function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value)
}
