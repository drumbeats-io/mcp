import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'

export const checkSslInputShape = {
  hostname: z.string().min(1).describe('The hostname to inspect, e.g. example.com (no scheme).'),
  port: z.number().int().min(1).max(65535).optional().describe('TLS port (default 443).'),
}

export type CheckSslArgs = { hostname: string; port?: number }

const DESCRIPTION =
  "Inspect a host's TLS/SSL certificate — validity, expiry date, and issuer. " +
  'Works with no Drumbeats account or API key — useful for "is my SSL certificate about to expire?".'

export async function checkSsl(ctx: ToolContext, args: CheckSslArgs): Promise<CallToolResult> {
  try {
    const result = await ctx.api.request({
      method: 'POST',
      path: '/v1/tools/check-ssl',
      body: { hostname: args.hostname, port: args.port },
    })
    return jsonResult(result)
  } catch (error) {
    return toToolErrorResult(error)
  }
}

export function registerCheckSsl(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'check_ssl',
    {
      title: 'Check SSL',
      description: DESCRIPTION,
      inputSchema: checkSslInputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    (args) => checkSsl(ctx, args)
  )
}
