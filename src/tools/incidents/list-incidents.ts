import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { paginationOutputShape } from '../pagination.js'
import { jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'
import { incidentSummaryOutputShape, type RawIncident, toIncidentSummary } from './shared.js'

const MAX_LIMIT = 200

export const listIncidentsInputShape = {
  project_id: z.string().min(1).describe('The project to list incidents for (from list_projects).'),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).optional().describe('Filter by incident status.'),
  monitor_id: z.string().optional().describe('Filter to a single monitor.'),
  page: z.number().int().positive().optional().describe('Page number (default 1).'),
  limit: z.number().int().positive().max(MAX_LIMIT).optional().describe('Page size (max 200, default 20).'),
}

export const listIncidentsOutputShape = {
  incidents: z.array(z.object(incidentSummaryOutputShape)),
  pagination: z.object(paginationOutputShape).nullable(),
}

export type ListIncidentsArgs = {
  project_id: string
  status?: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
  monitor_id?: string
  page?: number
  limit?: number
}

const DESCRIPTION =
  'List incidents for a Drumbeats project (downtime / missed-run events), newest first and paginated. ' +
  'Requires a project_id from list_projects. Filter by status (OPEN, ACKNOWLEDGED, RESOLVED) or a single monitor.'

export async function listIncidents(ctx: ToolContext, args: ListIncidentsArgs): Promise<CallToolResult> {
  try {
    const result = await ctx.api.request<{ data?: RawIncident[]; pagination?: unknown }>({
      path: '/v1/incidents',
      query: {
        project_id: args.project_id,
        status: args.status,
        monitor_id: args.monitor_id,
        page: args.page,
        limit: args.limit === undefined ? undefined : Math.min(args.limit, MAX_LIMIT),
      },
    })
    return jsonResult({
      incidents: (result.data ?? []).map(toIncidentSummary),
      pagination: result.pagination ?? null,
    })
  } catch (error) {
    return toToolErrorResult(error)
  }
}

export function registerListIncidents(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'list_incidents',
    {
      title: 'List incidents',
      description: DESCRIPTION,
      inputSchema: listIncidentsInputShape,
      outputSchema: listIncidentsOutputShape,
      annotations: { readOnlyHint: true },
    },
    (args) => listIncidents(ctx, args)
  )
}
