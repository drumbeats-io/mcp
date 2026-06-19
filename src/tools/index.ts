import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolContext, ToolRegistration } from './types.js'

/**
 * The shared tool layer — the single registration point consumed by both
 * transports (one definition, two transports).
 *
 * Scaffold stub: the registry is intentionally empty. v1 ships 13 tools, added
 * one file per tool under src/tools/ and listed here in the tool phase.
 */
const registry: readonly ToolRegistration[] = []

/** Registers every tool against the given MCP server using `ctx`. */
export function registerTools(server: McpServer, ctx: ToolContext): void {
  for (const register of registry) {
    register(server, ctx)
  }
}
