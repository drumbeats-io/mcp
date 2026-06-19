import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'

// --- Raw wire shapes (snake_case); only the fields we read are modelled. ---
interface RawProject {
  id: string
  name: string
  description?: string | null
  plan?: string | null
  created_at?: string | null
  owner?: { email?: string | null } | null
  _count?: { members?: number | null } | null
}

interface RawChannel {
  id: string
  name?: string | null
  // The notification channel type lives in the `channel` field (not `type`).
  channel?: string | null
  enabled?: boolean | null
  is_default?: boolean | null
}

interface RawGroup {
  id: string
  name: string
  description?: string | null
}

// --- Concise, model-facing result shapes. ---
interface ChannelSummary {
  id: string
  name: string | null
  type: string | null
  enabled: boolean | null
  is_default: boolean | null
}

interface GroupSummary {
  id: string
  name: string
  description: string | null
}

interface ProjectSummary {
  id: string
  name: string
  description: string | null
  plan: string | null
  created_at: string | null
  member_count: number | null
  owner_email: string | null
  notification_channels?: ChannelSummary[]
  notification_groups?: GroupSummary[]
}

export const listProjectsInputShape = {
  include: z
    .array(z.enum(['channels', 'groups']))
    .optional()
    .describe(
      'Optionally also fetch, per project, its notification channels and/or groups. Their ids are needed to wire alerts when creating a monitor.'
    ),
}

export type ListProjectsArgs = { include?: Array<'channels' | 'groups'> }

const DESCRIPTION =
  'List all Drumbeats projects the configured account API key can access. Returns each project id, ' +
  'name, plan, and basic metadata — use it to find the target project id before creating or querying ' +
  'monitors. Pass include=["channels","groups"] to also return each project\'s notification channels ' +
  'and groups, whose ids are needed to wire alerts when creating a monitor.'

function toProjectSummary(project: RawProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? null,
    plan: project.plan ?? null,
    created_at: project.created_at ?? null,
    member_count: project._count?.members ?? null,
    owner_email: project.owner?.email ?? null,
  }
}

/**
 * Core handler, kept separate from registration so it can be unit-tested with a
 * mocked ApiClient and no network.
 */
export async function listProjects(ctx: ToolContext, args: ListProjectsArgs): Promise<CallToolResult> {
  try {
    const { projects } = await ctx.api.request<{ projects: RawProject[] }>({ path: '/v1/projects' })
    const include = new Set(args.include ?? [])
    const wantChannels = include.has('channels')
    const wantGroups = include.has('groups')

    const summaries = await Promise.all(
      (projects ?? []).map(async (project) => {
        const summary = toProjectSummary(project)
        if (wantChannels) {
          const channels = await ctx.api.request<RawChannel[]>({
            path: '/v1/notification-channels',
            query: { project_id: project.id },
          })
          summary.notification_channels = (channels ?? []).map((channel) => ({
            id: channel.id,
            name: channel.name ?? null,
            type: channel.channel ?? null,
            enabled: channel.enabled ?? null,
            is_default: channel.is_default ?? null,
          }))
        }
        if (wantGroups) {
          const groups = await ctx.api.request<RawGroup[]>({
            path: '/v1/notification-groups',
            query: { project_id: project.id },
          })
          summary.notification_groups = (groups ?? []).map((group) => ({
            id: group.id,
            name: group.name,
            description: group.description ?? null,
          }))
        }
        return summary
      })
    )

    return jsonResult({ projects: summaries })
  } catch (error) {
    return toToolErrorResult(error)
  }
}

/** Registers the `list_projects` tool against the MCP server. */
export function registerListProjects(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'list_projects',
    { title: 'List projects', description: DESCRIPTION, inputSchema: listProjectsInputShape },
    (args) => listProjects(ctx, args)
  )
}
