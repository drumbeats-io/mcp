import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'
import { zodErrorResult } from '../validation.js'
import { type RawMonitor, toMonitorSummary } from './shared.js'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const uuid = () => z.string().regex(UUID_RE, 'must be a UUID')
const httpUrl = z.string().refine((value) => URL.canParse(value), { message: 'must be a valid URL' })

// Fields common to every monitor type.
const commonFields = {
  project_id: uuid(),
  name: z.string().min(1).max(100),
  schedule: z.string().min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, and hyphens only')
    .max(50)
    .optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  timezone: z.string().optional(),
  grace_period_seconds: z.number().int().min(0).optional(),
  schedule_tolerance: z.number().int().min(1).optional(),
  failure_tolerance: z.number().int().min(1).optional(),
  min_duration_seconds: z.number().int().min(1).optional(),
  max_duration_seconds: z.number().int().min(1).optional(),
  alert_surge_threshold: z.number().int().min(1).optional(),
  alert_enabled: z.boolean().optional(),
  retention_count: z.number().int().min(10).max(1000).optional(),
  notification_group_ids: z.array(uuid()).optional(),
  notification_channel_ids: z.array(uuid()).optional(),
}

// Uptime-only fields (besides the required uptime_url). Valid only for UPTIME_HTTP.
const uptimeOptionalFields = {
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

// Flat shape advertised to clients. The cross-field rules (uptime_* only for
// UPTIME_HTTP, uptime_url required there) are enforced by the validator below.
export const createMonitorInputShape = {
  ...commonFields,
  type: z.enum(['JOB_BASIC', 'JOB_CRON', 'JOB_HEARTBEAT', 'UPTIME_HTTP']),
  uptime_url: httpUrl.optional(),
  ...uptimeOptionalFields,
}

// Strict, type-discriminated validator: job types reject any uptime_* field,
// and UPTIME_HTTP requires uptime_url. An invalid combination is rejected here
// with a clear message rather than reaching the API as a raw 400.
const jobMember = (type: 'JOB_BASIC' | 'JOB_CRON' | 'JOB_HEARTBEAT') =>
  z.object({ ...commonFields, type: z.literal(type) }).strict()

const uptimeMember = z
  .object({ ...commonFields, type: z.literal('UPTIME_HTTP'), uptime_url: httpUrl, ...uptimeOptionalFields })
  .strict()

const createMonitorValidator = z.discriminatedUnion('type', [
  jobMember('JOB_BASIC'),
  jobMember('JOB_CRON'),
  jobMember('JOB_HEARTBEAT'),
  uptimeMember,
])

const DESCRIPTION = [
  'Create a Drumbeats monitor. One tool for all four types, chosen via "type":',
  '- JOB_CRON: a job that should run on a cron schedule (schedule = cron expression).',
  '- JOB_BASIC: a job expected on a fixed interval (schedule = interval, e.g. "5m").',
  '- JOB_HEARTBEAT: a passive endpoint your job pings (schedule = expected interval).',
  '- UPTIME_HTTP: Drumbeats polls a URL (schedule = poll interval; requires uptime_url).',
  'All uptime_* fields are only valid when type is UPTIME_HTTP.',
  'Wire alerts at create time with notification_channel_ids / notification_group_ids',
  '(UUIDs discoverable via list_projects include=channels,groups).',
  'Notification channel types: EMAIL, SLACK, TELEGRAM, DISCORD, WEBHOOK, PAGERDUTY, SMS, PUSH.',
].join('\n')

export async function createMonitor(ctx: ToolContext, args: unknown): Promise<CallToolResult> {
  const parsed = createMonitorValidator.safeParse(args)
  if (!parsed.success) {
    return zodErrorResult('create_monitor', parsed.error)
  }
  try {
    const body = await ctx.api.request<{ monitor?: RawMonitor }>({
      method: 'POST',
      path: '/v1/monitors',
      body: parsed.data,
    })
    const monitor = body.monitor ?? (body as unknown as RawMonitor)
    return jsonResult({ monitor: toMonitorSummary(monitor) })
  } catch (error) {
    return toToolErrorResult(error)
  }
}

export function registerCreateMonitor(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'create_monitor',
    { title: 'Create monitor', description: DESCRIPTION, inputSchema: createMonitorInputShape },
    (args) => createMonitor(ctx, args)
  )
}
