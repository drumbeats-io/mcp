import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { ZodError } from 'zod'
import { errorResult } from './result.js'

/** Formats a zod validation failure into a clear, model-facing tool error. */
export function zodErrorResult(toolName: string, error: ZodError): CallToolResult {
  const detail = error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ')
  return errorResult(`Invalid ${toolName} arguments: ${detail}`)
}
