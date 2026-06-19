import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerListProjects } from './context/list-projects.js'
import type { ToolContext, ToolRegistration } from './types.js'

/**
 * The shared tool layer — the single registration point consumed by both
 * transports (one definition, two transports). Add a tool by appending its
 * registration function here.
 */
const registry: readonly ToolRegistration[] = [registerListProjects]

/** Registers every tool against the given MCP server using `ctx`. */
export function registerTools(server: McpServer, ctx: ToolContext): void {
  for (const register of registry) {
    register(server, ctx)
  }
}
