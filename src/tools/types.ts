import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ApiClient } from '../api/client.js'

/**
 * Everything a tool handler needs, independent of how the request arrived
 * (stdio vs hosted HTTP) or how the user authenticated. Handlers only ever
 * touch `ctx.api` — the already-authenticated Drumbeats REST client.
 */
export interface ToolContext {
  readonly api: ApiClient
}

/** A single tool's self-registration against the MCP server. */
export type ToolRegistration = (server: McpServer, ctx: ToolContext) => void

/** A named tool registration, so the registry can be gated by tool name. */
export interface NamedTool {
  readonly name: string
  readonly register: ToolRegistration
}
