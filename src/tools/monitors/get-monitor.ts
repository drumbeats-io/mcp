import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'
import { type RawMonitor, toMonitorSummary } from './shared.js'

export const getMonitorInputShape = {
  monitor_id: z.string().min(1).describe('The monitor id (from list_monitors).'),
}

export type GetMonitorArgs = { monitor_id: string }

const DESCRIPTION = 'Get a single Drumbeats monitor by id, including its type, status, schedule, and alerting metadata.'

export async function getMonitor(ctx: ToolContext, args: GetMonitorArgs): Promise<CallToolResult> {
  try {
    const { monitor } = await ctx.api.request<{ monitor: RawMonitor }>({
      path: `/v1/monitors/${encodeURIComponent(args.monitor_id)}`,
    })
    return jsonResult({ monitor: toMonitorSummary(monitor) })
  } catch (error) {
    return toToolErrorResult(error)
  }
}

export function registerGetMonitor(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'get_monitor',
    { title: 'Get monitor', description: DESCRIPTION, inputSchema: getMonitorInputShape },
    (args) => getMonitor(ctx, args)
  )
}
