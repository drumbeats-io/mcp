/**
 * Minimal MCP tool-result error shape, kept decoupled from the SDK types so the
 * api layer has no transport dependency. Tool handlers return this rather than
 * throwing, so a raw 5xx or stack trace never reaches the model.
 */
export interface ToolErrorResult {
  readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>
  readonly isError: true
}

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

/**
 * Maps any thrown error into a safe MCP tool-result.
 *
 * Scaffold stub: per-status, model-friendly messaging is refined in the tool
 * phase. For now it surfaces the status and message without leaking internals.
 */
export function toToolErrorResult(error: unknown): ToolErrorResult {
  let message: string
  if (error instanceof DrumbeatsApiError) {
    message = `Drumbeats API error (${error.status}): ${error.message}`
  } else if (error instanceof Error) {
    message = error.message
  } else {
    message = 'Unknown error'
  }
  return { content: [{ type: 'text', text: message }], isError: true }
}
