import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { errorResult, jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'
import { monitorSummaryOutputShape, type RawMonitor, toMonitorSummary } from './shared.js'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const uuid = () => z.string().regex(UUID_RE, 'must be a UUID')
const httpUrl = z.string().refine((value) => URL.canParse(value), { message: 'must be a valid URL' })

export const updateMonitorInputShape = {
  monitor_id: z.string().min(1).describe('The monitor id to update (from list_monitors).'),
  name: z.string().min(1).max(100).optional().describe('New display name for the monitor.'),
  type: z
    .enum(['JOB_BASIC', 'JOB_CRON', 'JOB_HEARTBEAT', 'UPTIME_HTTP'])
    .optional()
    .describe(
      "Change the monitor's type. Switching type recalculates the schedule (next_expected_at) and gates which " +
        'fields apply — uptime_* fields become required/rejected based on the resulting type. Rarely changed ' +
        'after creation.'
    ),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, and hyphens only')
    .max(50)
    .nullable()
    .optional()
    .describe(
      'New URL-safe identifier, unique within the project (lowercase letters, numbers, hyphens; max 50 chars). ' +
        'Pass null to clear.'
    ),
  description: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .describe('New description (max 500 chars). Pass null to clear.'),
  tags: z
    .array(z.string().max(50))
    .max(10)
    .optional()
    .describe(
      'New tag list (max 10 tags, 50 chars each). Fully replaces the existing tags, not merged — include every ' +
        'tag you want kept.'
    ),
  schedule: z
    .string()
    .min(1)
    .optional()
    .describe(
      "New schedule expression; format depends on the (possibly also-updated) type — see create_monitor's " +
        'schedule field for the per-type format. Changing it recalculates next_expected_at and resets the ' +
        'schedule anchor for JOB_HEARTBEAT/UPTIME_HTTP.'
    ),
  timezone: z
    .string()
    .optional()
    .describe('New IANA timezone (e.g. "UTC", "America/New_York"). Only affects JOB_CRON schedule interpretation.'),
  grace_period_seconds: z
    .number()
    .int()
    .min(15)
    .optional()
    .describe(
      'Seconds to wait after the expected check-in time before counting a miss (must be at least 15). Ignored ' +
        'for JOB_BASIC.'
    ),
  schedule_tolerance: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'Number of consecutive missed check-ins before transitioning to DOWN (1 = alert on the very first miss). ' +
        'Ignored for JOB_BASIC.'
    ),
  failure_tolerance: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'Number of consecutive FAILURE pings before transitioning to DOWN (1 = alert on the very first failure). ' +
        'Applies to every monitor type, including JOB_BASIC.'
    ),
  min_duration_seconds: z
    .number()
    .int()
    .min(1)
    .nullable()
    .optional()
    .describe(
      'If set, a job (not UPTIME_HTTP) reporting a shorter duration than this creates a DURATION_LOW incident ' +
        '(informational only). Must be less than max_duration_seconds if both are set. Pass null to clear.'
    ),
  max_duration_seconds: z
    .number()
    .int()
    .min(1)
    .nullable()
    .optional()
    .describe(
      'If set, a job (not UPTIME_HTTP) reporting a longer duration than this creates a DURATION_HIGH incident ' +
        '(informational only). Must be greater than min_duration_seconds if both are set. For JOB_BASIC this also ' +
        'acts as a hard timeout on started-but-unfinished runs. Pass null to clear.'
    ),
  alert_surge_threshold: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'After this many consecutive alert notifications, Drumbeats auto-pauses further notifications for 1 hour ' +
        '(incidents keep recording regardless).'
    ),
  alert_enabled: z.boolean().optional().describe('Whether this monitor sends alert notifications at all.'),
  retention_count: z
    .number()
    .int()
    .min(10)
    .max(1000)
    .optional()
    .describe('Number of most-recent pings/check-results to retain (10-1000); older ones are pruned.'),
  notification_group_ids: z
    .array(uuid())
    .optional()
    .describe(
      'Notification group ids to alert on incidents (ids from list_projects include=groups). Fully replaces ' +
        "the existing list, not merged — omitted or empty falls back to the project's default group."
    ),
  notification_channel_ids: z
    .array(uuid())
    .optional()
    .describe(
      'Individual notification channel ids to alert directly (ids from list_projects include=channels). Fully ' +
        'replaces the existing list, not merged.'
    ),
  status: z
    .enum(['UP', 'PAUSED'])
    .optional()
    .describe(
      'Manually set status. UP forces recovery — resets consecutive_failures, consecutive_misses, and ' +
        'consecutive_alerts to 0, even if the monitor has not actually recovered. PAUSED stops checks/alerts ' +
        'without resetting counters. For the common pause/resume flow, prefer pause_monitor / resume_monitor.'
    ),
  uptime_url: httpUrl
    .optional()
    .describe(
      "New URL to poll. Only allowed when the monitor's type is (or is being changed to) UPTIME_HTTP. Must be " +
        'http(s) and must not embed credentials (user:pass@host) — put auth in uptime_headers instead.'
    ),
  uptime_method: z
    .enum(['GET', 'HEAD', 'POST'])
    .optional()
    .describe('HTTP method for the check (UPTIME_HTTP only). HEAD is lighter-weight; POST allows uptime_request_body.'),
  uptime_expected_status: z
    .array(z.number().int().min(100).max(599))
    .optional()
    .describe('HTTP status codes considered "up" (UPTIME_HTTP only). Empty means the default: any 2xx response is up.'),
  uptime_keyword: z
    .string()
    .max(1024)
    .nullable()
    .optional()
    .describe('Substring to search for in the response body (UPTIME_HTTP only, max 1024 chars). Pass null to clear.'),
  uptime_keyword_absent: z
    .boolean()
    .optional()
    .describe("Flips uptime_keyword's check: true means the check fails if the keyword IS found (UPTIME_HTTP only)."),
  uptime_headers: z
    .record(z.string(), z.string())
    .nullable()
    .optional()
    .describe(
      'Custom request headers (UPTIME_HTTP only). Stripped on cross-origin redirects; hop-by-hop/connection ' +
        'headers are rejected by the API. Pass null to clear.'
    ),
  uptime_timeout_ms: z
    .number()
    .int()
    .min(1000)
    .max(30000)
    .optional()
    .describe('Per-check timeout in milliseconds, 1000-30000 (UPTIME_HTTP only).'),
  uptime_follow_redirects: z
    .boolean()
    .optional()
    .describe('Whether to follow HTTP redirects, up to 10 hops (UPTIME_HTTP only).'),
  uptime_request_body: z
    .string()
    .max(10000)
    .nullable()
    .optional()
    .describe('Request body sent when uptime_method is POST (UPTIME_HTTP only, max 10000 chars). Pass null to clear.'),
  uptime_verify_ssl: z
    .boolean()
    .optional()
    .describe('Whether to reject invalid/self-signed TLS certificates during the check (UPTIME_HTTP only).'),
}

export const updateMonitorOutputShape = {
  monitor: z.object(monitorSummaryOutputShape),
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
    {
      title: 'Update monitor',
      description: DESCRIPTION,
      inputSchema: updateMonitorInputShape,
      outputSchema: updateMonitorOutputShape,
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    (args) => updateMonitor(ctx, args)
  )
}
