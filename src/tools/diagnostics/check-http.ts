import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'

export const checkHttpInputShape = {
  url: z
    .string()
    .refine((value) => URL.canParse(value), { message: 'must be a valid URL' })
    .describe('The http(s) URL to check, e.g. https://example.com'),
  method: z.enum(['GET', 'HEAD']).optional().describe('Request method (default HEAD).'),
  follow_redirects: z.boolean().optional().describe('Whether to follow redirects (default true).'),
}

export type CheckHttpArgs = { url: string; method?: 'GET' | 'HEAD'; follow_redirects?: boolean }

const DESCRIPTION =
  'Check whether an http(s) URL is reachable and report its status code and response time. ' +
  'Works with no Drumbeats account or API key — handy for a quick "is this site up?" before signing up.'

export async function checkHttp(ctx: ToolContext, args: CheckHttpArgs): Promise<CallToolResult> {
  try {
    const result = await ctx.api.request({
      method: 'POST',
      path: '/v1/tools/check-http',
      body: { url: args.url, method: args.method, follow_redirects: args.follow_redirects },
    })
    return jsonResult(result)
  } catch (error) {
    return toToolErrorResult(error)
  }
}

export function registerCheckHttp(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'check_http',
    { title: 'Check HTTP', description: DESCRIPTION, inputSchema: checkHttpInputShape },
    (args) => checkHttp(ctx, args)
  )
}
