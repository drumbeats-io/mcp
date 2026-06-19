import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { ApiClient, ApiRequest } from '../src/api/client'
import type { ToolContext } from '../src/tools/types'

/** Builds a ToolContext backed by a fake ApiClient. `calls` (if given) records every request. */
export function ctxWith(handler: (req: ApiRequest) => unknown, calls?: ApiRequest[]): ToolContext {
  const api: ApiClient = {
    request: async <T>(req: ApiRequest): Promise<T> => {
      calls?.push(req)
      return handler(req) as T
    },
  }
  return { api }
}

export function textOf(result: CallToolResult): string {
  const first = result.content[0]
  return first && first.type === 'text' ? first.text : ''
}

export function dataOf<T = unknown>(result: CallToolResult): T {
  return JSON.parse(textOf(result)) as T
}
