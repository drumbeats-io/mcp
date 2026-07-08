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

// Mirrors core's SslCheckResponse (packages/beats/src/services/tool-check-ssl.ts),
// plus the hostname_checked/port_checked/ok/checked_at/check_region envelope the
// route adds on a 200.
interface CheckSslResult {
  ok: true
  valid: boolean
  issuer: string | null
  subject: string | null
  sans: string[]
  expires_at: string | null
  valid_from: string | null
  days_remaining: number | null
  chain_valid: boolean
  self_signed: boolean
  hostname_match: boolean
  signature_algorithm: string | null
  error: string | null
  hostname_checked: string
  port_checked: number
  checked_at: string
  check_region: string
}

export const checkSslOutputShape = {
  ok: z.literal(true),
  valid: z.boolean(),
  issuer: z.string().nullable(),
  subject: z.string().nullable(),
  sans: z.array(z.string()),
  expires_at: z.string().nullable(),
  valid_from: z.string().nullable(),
  days_remaining: z.number().int().nullable(),
  chain_valid: z.boolean(),
  self_signed: z.boolean(),
  hostname_match: z.boolean(),
  signature_algorithm: z.string().nullable(),
  error: z.string().nullable(),
  hostname_checked: z.string(),
  port_checked: z.number().int(),
  checked_at: z.string(),
  check_region: z.string(),
}

const DESCRIPTION =
  "Inspect a host's TLS/SSL certificate — validity, expiry date, and issuer. " +
  'Works with no Drumbeats account or API key — useful for "is my SSL certificate about to expire?".'

export async function checkSsl(ctx: ToolContext, args: CheckSslArgs): Promise<CallToolResult> {
  try {
    const result = await ctx.api.request<CheckSslResult>({
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
      outputSchema: checkSslOutputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    (args) => checkSsl(ctx, args)
  )
}
