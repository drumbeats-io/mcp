import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/** Wraps a value as a successful MCP tool-result with a single JSON text block. */
export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

/** A successful tool-result carrying a single plain-text block. */
export function textResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }] }
}

/** A tool-result carrying a short human-readable error message. */
export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}
