import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'

export const checkDnsInputShape = {
  hostname: z.string().min(1).describe('The hostname to resolve, e.g. example.com (a domain, not an IP).'),
}

export type CheckDnsArgs = { hostname: string }

// Mirrors core's DnsCheckResponse (packages/beats/src/services/tool-check-dns.ts),
// plus the ok/checked_at/check_region envelope the route adds on a 200.
interface CheckDnsResult {
  ok: true
  hostname_checked: string
  records: {
    A: string[]
    AAAA: string[]
    CNAME: string[]
    MX: Array<{ exchange: string; priority: number }>
    NS: string[]
  }
  resolution_errors: {
    A?: string
    AAAA?: string
    CNAME?: string
    MX?: string
    NS?: string
  }
  all_failed: boolean
  checked_at: string
  check_region: string
}

export const checkDnsOutputShape = {
  ok: z.literal(true),
  hostname_checked: z.string(),
  records: z.object({
    A: z.array(z.string()),
    AAAA: z.array(z.string()),
    CNAME: z.array(z.string()),
    MX: z.array(z.object({ exchange: z.string(), priority: z.number().int() })),
    NS: z.array(z.string()),
  }),
  resolution_errors: z.object({
    A: z.string().optional(),
    AAAA: z.string().optional(),
    CNAME: z.string().optional(),
    MX: z.string().optional(),
    NS: z.string().optional(),
  }),
  all_failed: z.boolean(),
  checked_at: z.string(),
  check_region: z.string(),
}

const DESCRIPTION =
  'Resolve a hostname and report its DNS records (what the domain points to). ' +
  'Works with no Drumbeats account or API key — useful for "what does this domain resolve to?".'

export async function checkDns(ctx: ToolContext, args: CheckDnsArgs): Promise<CallToolResult> {
  try {
    const result = await ctx.api.request<CheckDnsResult>({
      method: 'POST',
      path: '/v1/tools/check-dns',
      body: { hostname: args.hostname },
    })
    return jsonResult(result)
  } catch (error) {
    return toToolErrorResult(error)
  }
}

export function registerCheckDns(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'check_dns',
    {
      title: 'Check DNS',
      description: DESCRIPTION,
      inputSchema: checkDnsInputShape,
      outputSchema: checkDnsOutputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    (args) => checkDns(ctx, args)
  )
}
