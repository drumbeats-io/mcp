import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { jsonResult } from '../result.js'
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
    .describe('Look-back window in hours (default 24). Use e.g. 720 for "this month".'),
}

export type GetUptimeSummaryArgs = { project_id: string; period_hours?: number }

const DESCRIPTION =
  "Get the project-level uptime / SLA rollup across all of a project's uptime monitors: overall uptime " +
  'percentage plus per-monitor uptime, check counts, and response-time stats over a look-back window. ' +
  'The answer to "what is my uptime this month?".'

export async function getUptimeSummary(ctx: ToolContext, args: GetUptimeSummaryArgs): Promise<CallToolResult> {
  try {
    const summary = await ctx.api.request({
      path: `/v1/projects/${encodeURIComponent(args.project_id)}/uptime-summary`,
      query: { period_hours: args.period_hours },
    })
    return jsonResult(summary)
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
