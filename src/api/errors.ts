import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/** Raised when the Drumbeats REST API returns a non-2xx response. */
export class DrumbeatsApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'DrumbeatsApiError'
    this.status = status
    this.body = body
  }
}

// Short, model-facing hints per status. We never echo a raw 5xx body or stack.
const STATUS_HINTS: Record<number, string> = {
  400: 'The request was rejected as invalid.',
  401: 'Authentication failed — check that DRUMBEATS_API_KEY is set and valid.',
  403: 'The API key lacks the scope required for this action.',
  404: 'The requested resource was not found.',
  409: 'The request conflicts with the current state.',
  429: 'Rate limit exceeded — slow down and retry shortly.',
}

/** Extracts a short, safe detail string from an API error body, if present. */
function extractDetail(body: unknown): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    const candidate = record.message ?? record.error
    if (typeof candidate === 'string' && candidate.length > 0 && candidate.length <= 200) {
      return candidate
    }
  }
  return ''
}

function humanMessage(error: unknown): string {
  if (error instanceof DrumbeatsApiError) {
    const hint =
      STATUS_HINTS[error.status] ?? (error.status >= 500 ? 'The Drumbeats API is temporarily unavailable.' : '')
    const detail = extractDetail(error.body)
    return [`Drumbeats API request failed (HTTP ${error.status}).`, hint, detail].filter(Boolean).join(' ')
  }
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return 'The request to the Drumbeats API timed out.'
  }
  if (error instanceof Error && error.name === 'TypeError') {
    return 'Could not reach the Drumbeats API (network error).'
  }
  return error instanceof Error ? `Unexpected error: ${error.message}` : 'Unexpected error.'
}

/**
 * Maps any thrown error (non-2xx, network, timeout) into a clean MCP tool-result.
 * Tool handlers return this instead of throwing, so a raw stack or 500 body never
 * reaches the model.
 */
export function toToolErrorResult(error: unknown): CallToolResult {
  return { content: [{ type: 'text', text: humanMessage(error) }], isError: true }
}
