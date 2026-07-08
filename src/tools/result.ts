import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/**
 * Wraps a value as a successful MCP tool-result with a JSON text block, plus
 * `structuredContent` for tools that declare an `outputSchema` (the SDK
 * validates `structuredContent` against it; callers without an outputSchema
 * simply ignore the extra field). Every caller passes a plain JSON object.
 */
export function jsonResult(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  }
}

/** A successful tool-result carrying a single plain-text block. */
export function textResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }] }
}

/**
 * A successful tool-result carrying a human-readable text block as the primary
 * content, plus the underlying data as `structuredContent` for outputSchema
 * validation. For tools like get_uptime_summary that render prose rather than
 * raw JSON but still declare an outputSchema.
 */
export function structuredTextResult(message: string, data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: message }], structuredContent: data as Record<string, unknown> }
}

/** A tool-result carrying a short human-readable error message. */
export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}
