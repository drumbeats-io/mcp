/**
 * OAuth token scope ↔ tool availability (the ADR-0015 vocabulary), reused
 * verbatim from the stdio account-key model. The hosted transport reads these
 * scopes from the verified OAuth token; stdio reads them from the account key.
 */

export const SCOPES = ['read', 'manage_monitors'] as const
export type Scope = (typeof SCOPES)[number]

/**
 * Tools unlocked by each scope. `read` is always granted; `manage_monitors`
 * adds the write/lifecycle tools.
 *
 * Scaffold stub: the tool-name lists are populated in the tool phase. The
 * structure exists from day one so the least-privilege gate is real.
 */
export const TOOLS_BY_SCOPE: Readonly<Record<Scope, readonly string[]>> = {
  read: [],
  manage_monitors: [],
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
