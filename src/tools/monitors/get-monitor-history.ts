import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { paginationOutputShape } from '../pagination.js'
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

// --- Per-kind `data` shapes, one union member per `kind`. Not a discriminated
// union: the installed SDK's outputSchema normalization (zod-compat.js
// normalizeObjectSchema) only recognizes plain object schemas at the outputSchema
// root, and calling safeParseAsync on an unrecognized (e.g. discriminated-union)
// root throws rather than validating — verified against the SDK's shipped
// zod-compat.js. Nesting a plain z.union inside a raw-shape field (as done here)
// does not hit that path and validates correctly. The one gap versus a true
// discriminated union: this doesn't cross-check that `data`'s shape actually
// matches the sibling `kind` field — acceptable since the handler below is the
// only thing that ever produces this pairing.
const pingHistoryItemSchema = z.object({
  id: z.string(),
  run_id: z.string().nullable(),
  event: z.enum(['START', 'SUCCESS', 'FAILURE', 'LOG']),
  exit_code: z.number().int().nullable(),
  duration_ms: z.number().int().nullable(),
  duration_assertion: z.enum(['PASS', 'TOO_FAST', 'TOO_SLOW']).nullable(),
  message: z.string().nullable(),
  payload: z.string().nullable(),
  payload_truncated: z.boolean(),
  payload_bytes: z.number().int().nullable(),
  request_ip: z.string().nullable(),
  request_ua: z.string().nullable(),
  started_at: z.string().nullable(),
  created_at: z.string(),
})

const pingsDataSchema = z.object({
  data: z.array(pingHistoryItemSchema),
  pagination: z.object(paginationOutputShape),
})

const warningsDataSchema = z.object({
  warnings: z.array(
    z.object({
      type: z.enum(['MISSING_RUN_ID', 'MISSING_START']),
      message: z.string(),
      affected_count: z.number().int(),
      recommendation: z.string(),
    })
  ),
  analyzed_period: z.object({
    from: z.string(),
    to: z.string(),
    total_pings: z.number().int(),
  }),
})

// getLatestCheckResult's 200 response — a "no result yet" case is a 404 from the
// API (thrown as a tool error before this schema is ever validated), so this is
// never null on the success path.
const checksDataSchema = z.object({
  id: z.string(),
  monitor_id: z.string(),
  status_code: z.number().int().nullable(),
  response_time_ms: z.number(),
  is_up: z.boolean(),
  error: z.string().nullable(),
  ssl_expires_at: z.string().nullable(),
  ssl_issuer: z.string().nullable(),
  check_region: z.string(),
  created_at: z.string(),
})

const responseTimesDataSchema = z.object({
  avg_ms: z.number().nullable(),
  min_ms: z.number().nullable(),
  max_ms: z.number().nullable(),
  p95_ms: z.number().nullable(),
  total_checks: z.number().int(),
  up_count: z.number().int(),
  down_count: z.number().int(),
  uptime_percentage: z.number(),
})

export const getMonitorHistoryOutputShape = {
  monitor_id: z.string(),
  kind: z.enum(KINDS),
  data: z.union([pingsDataSchema, warningsDataSchema, checksDataSchema, responseTimesDataSchema]),
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
      outputSchema: getMonitorHistoryOutputShape,
      annotations: { readOnlyHint: true },
    },
    (args) => getMonitorHistory(ctx, args)
  )
}
