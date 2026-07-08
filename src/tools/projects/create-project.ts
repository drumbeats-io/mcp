import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'
import { zodErrorResult } from '../validation.js'
import { projectSummaryOutputShape, type RawProject, toProjectSummary } from './shared.js'

export const createProjectOutputShape = {
  project: z.object(projectSummaryOutputShape),
}

export const createProjectInputShape = {
  name: z.string().min(1).max(100).describe('The project name.'),
  description: z.string().max(500).optional().describe('Optional project description.'),
}

const createProjectValidator = z.object(createProjectInputShape).strict()

const DESCRIPTION =
  'Create a new Drumbeats project. A project groups monitors, incidents, and notification settings. ' +
  'Requires an account-scoped API key with the manage_projects scope. Returns the created project id, ' +
  "which you can then pass to create_monitor. Creating a project may hit your plan's project limit — " +
  'the result will say so and point to the upgrade path.'

export async function createProject(ctx: ToolContext, args: unknown): Promise<CallToolResult> {
  const parsed = createProjectValidator.safeParse(args)
  if (!parsed.success) {
    return zodErrorResult('create_project', parsed.error)
  }
  try {
    const body = await ctx.api.request<{ project?: RawProject }>({
      service: 'id',
      method: 'POST',
      path: '/v1/projects',
      body: parsed.data,
    })
    const project = body.project ?? (body as unknown as RawProject)
    return jsonResult({ project: toProjectSummary(project) })
  } catch (error) {
    return toToolErrorResult(error)
  }
}

export function registerCreateProject(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'create_project',
    {
      title: 'Create project',
      description: DESCRIPTION,
      inputSchema: createProjectInputShape,
      outputSchema: createProjectOutputShape,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (args) => createProject(ctx, args)
  )
}
