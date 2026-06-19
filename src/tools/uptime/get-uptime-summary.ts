import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { textResult } from '../result.js'
import type { ToolContext } from '../types.js'

const MAX_PERIOD_HOURS = 2160 // 90 days

export const getUptimeSummaryInputShape = {
  project_id: z.string().min(1).describe('The project to summarize uptime for (from list_projects).'),
  period_hours: z
    .number()
    .int()
    .positive()
    .max(MAX_PERIOD_HOURS)
    .optional()
    .describe('Look-back window in hours (default 24). Use 720 for roughly "this month".'),
}

export type GetUptimeSummaryArgs = { project_id: string; period_hours?: number }

interface UptimeMonitorRow {
  monitor_id?: string
  name?: string
  uptime_percentage?: number
  total_checks?: number
  up_count?: number
  down_count?: number
  avg_ms?: number | null
  p95_ms?: number | null
}

interface UptimeSummary {
  period_hours?: number
  monitors?: UptimeMonitorRow[]
  overall?: {
    uptime_percentage?: number
    total_checks?: number
    up_count?: number
    down_count?: number
  }
}

const DESCRIPTION =
  "Get the project-level uptime / SLA summary across all of a project's uptime monitors: overall uptime " +
  'percentage plus per-monitor uptime, check counts, and response times over a look-back window. ' +
  'The answer to "what is my uptime this month?".'

function formatPercent(value: number | undefined): string {
  return typeof value === 'number' ? `${value}%` : 'n/a'
}

/** Renders the rollup as a short, readable answer rather than raw JSON. */
function formatUptimeSummary(summary: UptimeSummary): string {
  const periodHours = summary.period_hours ?? 24
  const lines: string[] = []

  const overall = summary.overall
  if (overall) {
    lines.push(
      `Overall uptime over the last ${periodHours}h: ${formatPercent(overall.uptime_percentage)} ` +
        `(${overall.up_count ?? 0} of ${overall.total_checks ?? 0} checks up, ${overall.down_count ?? 0} down).`
    )
  } else {
    lines.push(`Uptime over the last ${periodHours}h:`)
  }

  const monitors = summary.monitors ?? []
  if (monitors.length === 0) {
    lines.push('This project has no uptime monitors.')
    return lines.join('\n')
  }

  lines.push('Per monitor:')
  for (const monitor of monitors) {
    const parts = [
      formatPercent(monitor.uptime_percentage),
      `${monitor.up_count ?? 0}/${monitor.total_checks ?? 0} checks`,
    ]
    if (typeof monitor.avg_ms === 'number') {
      parts.push(`avg ${monitor.avg_ms}ms`)
    }
    if (typeof monitor.p95_ms === 'number') {
      parts.push(`p95 ${monitor.p95_ms}ms`)
    }
    lines.push(`- ${monitor.name ?? monitor.monitor_id ?? 'monitor'}: ${parts.join(', ')}`)
  }
  return lines.join('\n')
}

export async function getUptimeSummary(ctx: ToolContext, args: GetUptimeSummaryArgs): Promise<CallToolResult> {
  try {
    const summary = await ctx.api.request<UptimeSummary>({
      path: `/v1/projects/${encodeURIComponent(args.project_id)}/uptime-summary`,
      query: { period_hours: args.period_hours },
    })
    return textResult(formatUptimeSummary(summary))
  } catch (error) {
    return toToolErrorResult(error)
  }
}

export function registerGetUptimeSummary(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'get_uptime_summary',
    { title: 'Get uptime summary', description: DESCRIPTION, inputSchema: getUptimeSummaryInputShape },
    (args) => getUptimeSummary(ctx, args)
  )
}
