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

const DESCRIPTION =
  'Resolve a hostname and report its DNS records (what the domain points to). ' +
  'Works with no Drumbeats account or API key — useful for "what does this domain resolve to?".'

export async function checkDns(ctx: ToolContext, args: CheckDnsArgs): Promise<CallToolResult> {
  try {
    const result = await ctx.api.request({
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
    { title: 'Check DNS', description: DESCRIPTION, inputSchema: checkDnsInputShape },
    (args) => checkDns(ctx, args)
  )
}
