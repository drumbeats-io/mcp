import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { DrumbeatsApiClient } from '../api/client.js'

/**
 * Everything a tool handler needs, independent of how the request arrived
 * (stdio vs hosted HTTP) or how the user authenticated. Handlers only ever
 * touch `ctx.api` — the already-authenticated Drumbeats REST client.
 */
export interface ToolContext {
  readonly api: DrumbeatsApiClient
}

/** A single tool's self-registration against the MCP server. */
export type ToolRegistration = (server: McpServer, ctx: ToolContext) => void
