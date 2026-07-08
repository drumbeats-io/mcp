import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'
import { incidentSummaryOutputShape, type RawIncident, toIncidentSummary } from './shared.js'

export const manageIncidentOutputShape = {
  action: z.enum(['get', 'acknowledge', 'resolve']),
  incident: z.object(incidentSummaryOutputShape),
}

export const manageIncidentInputShape = {
  incident_id: z.string().min(1).describe('The incident id (from list_incidents).'),
  action: z
    .enum(['get', 'acknowledge', 'resolve'])
    .default('get')
    .describe('get = fetch incident details; acknowledge = mark it as being worked on; resolve = close it.'),
}

export type ManageIncidentArgs = { incident_id: string; action?: 'get' | 'acknowledge' | 'resolve' }

const DESCRIPTION =
  'Triage a Drumbeats incident: get its details, acknowledge it, or resolve it. One tool with an "action" argument.'

export async function manageIncident(ctx: ToolContext, args: ManageIncidentArgs): Promise<CallToolResult> {
  const action = args.action ?? 'get'
  const base = `/v1/incidents/${encodeURIComponent(args.incident_id)}`
  try {
    const body =
      action === 'get'
        ? await ctx.api.request<{ incident?: RawIncident }>({ path: base })
        : await ctx.api.request<{ incident?: RawIncident }>({ method: 'POST', path: `${base}/${action}` })
    const incident = body.incident ?? (body as unknown as RawIncident)
    return jsonResult({ action, incident: toIncidentSummary(incident) })
  } catch (error) {
    return toToolErrorResult(error)
  }
}

export function registerManageIncident(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'manage_incident',
    {
      title: 'Manage incident',
      description: DESCRIPTION,
      inputSchema: manageIncidentInputShape,
      outputSchema: manageIncidentOutputShape,
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    (args) => manageIncident(ctx, args)
  )
}
