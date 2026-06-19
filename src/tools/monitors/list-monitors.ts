import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'
import { type RawMonitor, toMonitorSummary } from './shared.js'

export const listMonitorsInputShape = {
  project_id: z
    .string()
    .min(1)
    .describe(
      'The project to list monitors for. Obtain the id from list_projects (an account key spans many projects).'
    ),
}

export type ListMonitorsArgs = { project_id: string }

const DESCRIPTION =
  'List all monitors in a Drumbeats project (jobs and uptime checks), with their type, status, and ' +
  'schedule metadata. Requires a project_id from list_projects. Use it to find a monitor id before ' +
  'fetching details, history, or incidents.'

export async function listMonitors(ctx: ToolContext, args: ListMonitorsArgs): Promise<CallToolResult> {
  try {
    const { monitors } = await ctx.api.request<{ monitors: RawMonitor[] }>({
      path: '/v1/monitors',
      query: { project_id: args.project_id },
    })
    return jsonResult({ monitors: (monitors ?? []).map(toMonitorSummary) })
  } catch (error) {
    return toToolErrorResult(error)
  }
}

export function registerListMonitors(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'list_monitors',
    {
      title: 'List monitors',
      description: DESCRIPTION,
      inputSchema: listMonitorsInputShape,
      annotations: { readOnlyHint: true },
    },
    (args) => listMonitors(ctx, args)
  )
}
