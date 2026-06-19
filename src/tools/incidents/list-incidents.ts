import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'

const MAX_LIMIT = 200

interface RawIncident {
  id: string
  monitor_id?: string | null
  project_id?: string | null
  event?: string | null
  status?: string | null
  started_at?: string | null
  acknowledged_at?: string | null
  resolved_at?: string | null
  reopened_at?: string | null
}

interface IncidentSummary {
  id: string
  monitor_id: string | null
  project_id: string | null
  event: string | null
  status: string | null
  started_at: string | null
  acknowledged_at: string | null
  resolved_at: string | null
  reopened_at: string | null
}

export const listIncidentsInputShape = {
  project_id: z.string().min(1).describe('The project to list incidents for (from list_projects).'),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).optional().describe('Filter by incident status.'),
  monitor_id: z.string().optional().describe('Filter to a single monitor.'),
  page: z.number().int().positive().optional().describe('Page number (default 1).'),
  limit: z.number().int().positive().max(MAX_LIMIT).optional().describe('Page size (max 200, default 20).'),
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

function toIncidentSummary(incident: RawIncident): IncidentSummary {
  return {
    id: incident.id,
    monitor_id: incident.monitor_id ?? null,
    project_id: incident.project_id ?? null,
    event: incident.event ?? null,
    status: incident.status ?? null,
    started_at: incident.started_at ?? null,
    acknowledged_at: incident.acknowledged_at ?? null,
    resolved_at: incident.resolved_at ?? null,
    reopened_at: incident.reopened_at ?? null,
  }
}

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
    { title: 'List incidents', description: DESCRIPTION, inputSchema: listIncidentsInputShape },
    (args) => listIncidents(ctx, args)
  )
}
