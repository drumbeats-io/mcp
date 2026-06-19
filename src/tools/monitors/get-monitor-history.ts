import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'

const KINDS = ['pings', 'warnings', 'checks', 'response_times'] as const
type HistoryKind = (typeof KINDS)[number]

const MAX_PING_LIMIT = 100

export const getMonitorHistoryInputShape = {
  monitor_id: z.string().min(1).describe('The monitor id (from list_monitors).'),
  kind: z
    .enum(KINDS)
    .default('pings')
    .describe(
      'Which history to fetch: pings (job check-ins, paginated), warnings (JOB_BASIC ping-hygiene issues), ' +
        'checks (latest uptime check result), response_times (uptime response-time statistics).'
    ),
  page: z.number().int().positive().optional().describe('Page number for kind=pings (default 1).'),
  limit: z
    .number()
    .int()
    .positive()
    .max(MAX_PING_LIMIT)
    .optional()
    .describe('Page size for kind=pings (max 100, default 20).'),
  period_hours: z
    .number()
    .int()
    .positive()
    .max(720)
    .optional()
    .describe('Look-back window in hours for kind=response_times (default 24).'),
}

export type GetMonitorHistoryArgs = {
  monitor_id: string
  kind?: HistoryKind
  page?: number
  limit?: number
  period_hours?: number
}

const DESCRIPTION =
  'Fetch a monitor\'s recent history. One tool with a "kind" argument: pings | warnings | checks | ' +
  'response_times. Defaults to pings. Use it to answer "what happened with this monitor lately?".'

export async function getMonitorHistory(ctx: ToolContext, args: GetMonitorHistoryArgs): Promise<CallToolResult> {
  const kind: HistoryKind = args.kind ?? 'pings'
  const base = `/v1/monitors/${encodeURIComponent(args.monitor_id)}`
  try {
    let data: unknown
    switch (kind) {
      case 'pings':
        data = await ctx.api.request({
          path: `${base}/pings`,
          query: {
            page: args.page,
            limit: args.limit === undefined ? undefined : Math.min(args.limit, MAX_PING_LIMIT),
          },
        })
        break
      case 'warnings':
        data = await ctx.api.request({ path: `${base}/warnings` })
        break
      case 'checks':
        data = await ctx.api.request({ path: `${base}/check-results/latest` })
        break
      case 'response_times':
        data = await ctx.api.request({
          path: `${base}/response-time-stats`,
          query: { period_hours: args.period_hours },
        })
        break
    }
    return jsonResult({ monitor_id: args.monitor_id, kind, data })
  } catch (error) {
    return toToolErrorResult(error)
  }
}

export function registerGetMonitorHistory(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'get_monitor_history',
    {
      title: 'Get monitor history',
      description: DESCRIPTION,
      inputSchema: getMonitorHistoryInputShape,
      annotations: { readOnlyHint: true },
    },
    (args) => getMonitorHistory(ctx, args)
  )
}
