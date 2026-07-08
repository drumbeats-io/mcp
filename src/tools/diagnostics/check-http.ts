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

// Mirrors core's CheckHttpResponse (packages/beats/src/services/tool-check-http.ts),
// plus the ok/checked_at/check_region envelope the route adds on a 200.
interface CheckHttpResult {
  ok: true
  status: 'up' | 'down'
  status_code: number | null
  method_used: 'GET' | 'HEAD'
  response_time_ms: number
  timing: {
    dns_ms: number | null
    connect_ms: number | null
    tls_ms: number | null
    ttfb_ms: number | null
    download_ms: number | null
  }
  final_url: string
  redirect_chain: string[]
  tls_error: string | null
  error: string | null
  checked_at: string
  check_region: string
}

export const checkHttpOutputShape = {
  ok: z.literal(true),
  status: z.enum(['up', 'down']),
  status_code: z.number().int().nullable(),
  method_used: z.enum(['GET', 'HEAD']),
  response_time_ms: z.number(),
  timing: z.object({
    dns_ms: z.number().nullable(),
    connect_ms: z.number().nullable(),
    tls_ms: z.number().nullable(),
    ttfb_ms: z.number().nullable(),
    download_ms: z.number().nullable(),
  }),
  final_url: z.string(),
  redirect_chain: z.array(z.string()),
  tls_error: z.string().nullable(),
  error: z.string().nullable(),
  checked_at: z.string(),
  check_region: z.string(),
}

const DESCRIPTION =
  'Check whether an http(s) URL is reachable and report its status code and response time. ' +
  'Works with no Drumbeats account or API key — handy for a quick "is this site up?" before signing up.'

export async function checkHttp(ctx: ToolContext, args: CheckHttpArgs): Promise<CallToolResult> {
  try {
    const result = await ctx.api.request<CheckHttpResult>({
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
    {
      title: 'Check HTTP',
      description: DESCRIPTION,
      inputSchema: checkHttpInputShape,
      outputSchema: checkHttpOutputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    (args) => checkHttp(ctx, args)
  )
}
