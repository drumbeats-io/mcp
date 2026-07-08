import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { errorResult, jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'
import { projectSummaryOutputShape, type RawProject, toProjectSummary } from './shared.js'

export const updateProjectOutputShape = {
  project: z.object(projectSummaryOutputShape),
}

export const updateProjectInputShape = {
  project_id: z.string().min(1).describe('The project id to update (from list_projects).'),
  name: z.string().min(1).max(100).optional().describe('New project name.'),
  description: z.string().max(500).nullable().optional().describe('New project description (null to clear).'),
}

const DESCRIPTION =
  'Update an existing Drumbeats project. Provide project_id plus only the fields to change (name and/or ' +
  'description). Requires an API key with the manage_projects scope and MANAGER or OWNER role on the project.'

export async function updateProject(ctx: ToolContext, args: Record<string, unknown>): Promise<CallToolResult> {
  const projectId = typeof args.project_id === 'string' ? args.project_id : ''
  if (projectId.length === 0) {
    return errorResult('project_id is required.')
  }

  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (key !== 'project_id' && value !== undefined) {
      patch[key] = value
    }
  }
  if (Object.keys(patch).length === 0) {
    return errorResult('Provide at least one field to update.')
  }

  try {
    const body = await ctx.api.request<{ project?: RawProject }>({
      service: 'id',
      method: 'PATCH',
      path: `/v1/projects/${encodeURIComponent(projectId)}`,
      body: patch,
    })
    const project = body.project ?? (body as unknown as RawProject)
    return jsonResult({ project: toProjectSummary(project) })
  } catch (error) {
    return toToolErrorResult(error)
  }
}

export function registerUpdateProject(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'update_project',
    {
      title: 'Update project',
      description: DESCRIPTION,
      inputSchema: updateProjectInputShape,
      outputSchema: updateProjectOutputShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    (args) => updateProject(ctx, args)
  )
}
