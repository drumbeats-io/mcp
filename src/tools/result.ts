import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/** Wraps a value as a successful MCP tool-result with a single JSON text block. */
export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}
