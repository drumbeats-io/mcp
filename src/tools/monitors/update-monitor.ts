import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { errorResult, jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'
import { type RawMonitor, toMonitorSummary } from './shared.js'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const uuid = () => z.string().regex(UUID_RE, 'must be a UUID')
const httpUrl = z.string().refine((value) => URL.canParse(value), { message: 'must be a valid URL' })

export const updateMonitorInputShape = {
  monitor_id: z.string().min(1).describe('The monitor id to update (from list_monitors).'),
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['JOB_BASIC', 'JOB_CRON', 'JOB_HEARTBEAT', 'UPTIME_HTTP']).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, and hyphens only')
    .max(50)
    .optional(),
  description: z.string().max(500).nullable().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  schedule: z.string().min(1).optional(),
  timezone: z.string().optional(),
  grace_period_seconds: z.number().int().min(0).optional(),
  schedule_tolerance: z.number().int().min(1).optional(),
  failure_tolerance: z.number().int().min(1).optional(),
  min_duration_seconds: z.number().int().min(1).nullable().optional(),
  max_duration_seconds: z.number().int().min(1).nullable().optional(),
  alert_surge_threshold: z.number().int().min(1).optional(),
  alert_enabled: z.boolean().optional(),
  retention_count: z.number().int().min(10).max(1000).optional(),
  notification_group_ids: z.array(uuid()).optional(),
  notification_channel_ids: z.array(uuid()).optional(),
  status: z.enum(['UP', 'PAUSED']).optional(),
  uptime_url: httpUrl.optional(),
  uptime_method: z.enum(['GET', 'HEAD', 'POST']).optional(),
  uptime_expected_status: z.array(z.number().int().min(100).max(599)).optional(),
  uptime_keyword: z.string().max(1024).nullable().optional(),
  uptime_keyword_absent: z.boolean().optional(),
  uptime_headers: z.record(z.string(), z.string()).nullable().optional(),
  uptime_timeout_ms: z.number().int().min(1000).max(30000).optional(),
  uptime_follow_redirects: z.boolean().optional(),
  uptime_request_body: z.string().max(10000).nullable().optional(),
  uptime_verify_ssl: z.boolean().optional(),
}

const DESCRIPTION =
  'Update an existing Drumbeats monitor. Provide monitor_id plus only the fields to change. Set status to ' +
  'PAUSED or UP to pause/resume (or use pause_monitor / resume_monitor). The uptime_* fields apply to UPTIME_HTTP monitors.'

export async function updateMonitor(ctx: ToolContext, args: Record<string, unknown>): Promise<CallToolResult> {
  const monitorId = typeof args.monitor_id === 'string' ? args.monitor_id : ''
  if (monitorId.length === 0) {
    return errorResult('monitor_id is required.')
  }

  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (key !== 'monitor_id' && value !== undefined) {
      patch[key] = value
    }
  }
  if (Object.keys(patch).length === 0) {
    return errorResult('Provide at least one field to update.')
  }

  try {
    const body = await ctx.api.request<{ monitor?: RawMonitor }>({
      method: 'PATCH',
      path: `/v1/monitors/${encodeURIComponent(monitorId)}`,
      body: patch,
    })
    const monitor = body.monitor ?? (body as unknown as RawMonitor)
    return jsonResult({ monitor: toMonitorSummary(monitor) })
  } catch (error) {
    return toToolErrorResult(error)
  }
}

export function registerUpdateMonitor(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'update_monitor',
    { title: 'Update monitor', description: DESCRIPTION, inputSchema: updateMonitorInputShape },
    (args) => updateMonitor(ctx, args)
  )
}
