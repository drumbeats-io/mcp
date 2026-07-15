import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'
import { zodErrorResult } from '../validation.js'
import { monitorSummaryOutputShape, type RawMonitor, toMonitorSummary } from './shared.js'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const uuid = () => z.string().regex(UUID_RE, 'must be a UUID')
const httpUrl = z.string().refine((value) => URL.canParse(value), { message: 'must be a valid URL' })

// Fields common to every monitor type.
const commonFields = {
  project_id: uuid().describe('The project this monitor belongs to (id from list_projects).'),
  name: z
    .string()
    .min(1)
    .max(100)
    .describe('Display name for the monitor, shown in the dashboard and in alert notifications.'),
  schedule: z
    .string()
    .min(1)
    .describe(
      'Schedule expression; format depends on type. JOB_CRON: a cron expression (e.g. "0 2 * * *"). ' +
        'JOB_HEARTBEAT and UPTIME_HTTP: an interval string "<number><unit>" with unit s/m/h/d/w (e.g. "5m", "1h") — ' +
        'for JOB_HEARTBEAT this is how often your job must ping in, for UPTIME_HTTP this is the poll interval. ' +
        'JOB_BASIC: required but ignored for timing (JOB_BASIC is event-driven and never goes overdue on a ' +
        'schedule) — pass any non-empty placeholder such as "@event".'
    ),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, and hyphens only')
    .max(50)
    .optional()
    .describe(
      'Optional URL-safe identifier, unique within the project (lowercase letters, numbers, hyphens; max 50 ' +
        'chars). Not auto-generated from name — omit to leave unset. Lets you reference the monitor by a stable ' +
        'slug instead of its id.'
    ),
  description: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .describe(
      'Optional human-readable description of what this monitor checks, shown in the dashboard and in alert ' +
        'notifications.'
    ),
  tags: z
    .array(z.string().max(50))
    .max(10)
    .optional()
    .describe('Freeform labels for filtering and grouping monitors in the dashboard (max 10 tags, 50 chars each).'),
  timezone: z
    .string()
    .optional()
    .describe(
      'IANA timezone (e.g. "UTC", "America/New_York") used to interpret the schedule. Only affects JOB_CRON ' +
        '(cron-tick calculation) — interval-based types (JOB_BASIC, JOB_HEARTBEAT, UPTIME_HTTP) ignore it. ' +
        'Defaults to UTC.'
    ),
  grace_period_seconds: z
    .number()
    .int()
    .min(15)
    .optional()
    .describe(
      'Seconds to wait after the expected check-in time before counting a miss (must be at least 15 — a lower ' +
        'value can trap a monitor in DOWN, since a ping arriving even slightly late would never count as ' +
        "on-time). Doesn't apply to JOB_BASIC (event-driven, no schedule to be late against). Defaults to 300 " +
        '(5 minutes).'
    ),
  schedule_tolerance: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'Number of consecutive missed check-ins that transitions the monitor to DOWN and opens a MISSED incident. ' +
        "1 = alert on the very first miss; 3 = allow 2 misses before alerting. Doesn't apply to JOB_BASIC. " +
        'Defaults to 1.'
    ),
  failure_tolerance: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'Number of consecutive FAILURE pings (or non-zero exit codes) that transitions the monitor to DOWN and ' +
        'opens a FAILED incident. 1 = alert on the very first failure; 3 = allow 2 failures before alerting. ' +
        'Applies to every monitor type, including JOB_BASIC. Defaults to 1.'
    ),
  min_duration_seconds: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'If set, a job (not UPTIME_HTTP) that reports a shorter duration than this many seconds creates a ' +
        'DURATION_LOW incident — informational only, does not affect UP/DOWN status. Must be less than ' +
        'max_duration_seconds if both are set.'
    ),
  max_duration_seconds: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'If set, a job (not UPTIME_HTTP) that reports a longer duration than this many seconds creates a ' +
        'DURATION_HIGH incident — informational only, does not affect UP/DOWN status. Must be greater than ' +
        'min_duration_seconds if both are set. For JOB_BASIC specifically this also acts as a hard timeout: a run ' +
        'that started (a START ping) but never finished within this many seconds is automatically marked FAILED.'
    ),
  alert_surge_threshold: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'After this many consecutive alert notifications for this monitor, Drumbeats auto-pauses further ' +
        'notifications for 1 hour (surge protection). Incidents are still recorded either way — this only gates ' +
        'whether a notification is sent. Defaults to 10.'
    ),
  alert_enabled: z
    .boolean()
    .optional()
    .describe(
      'Whether this monitor sends alert notifications at all. Incidents are always recorded regardless. ' +
        'Defaults to true.'
    ),
  retention_count: z
    .number()
    .int()
    .min(10)
    .max(1000)
    .optional()
    .describe(
      'Number of most-recent pings (or uptime check results) to retain for this monitor; older ones are pruned. ' +
        'Range 10-1000, defaults to 200.'
    ),
  notification_group_ids: z
    .array(uuid())
    .optional()
    .describe(
      'Notification group ids to alert on incidents (ids from list_projects include=groups). Omitted or empty ' +
        "uses the project's default notification group."
    ),
  notification_channel_ids: z
    .array(uuid())
    .optional()
    .describe(
      'Individual notification channel ids to alert directly, in addition to notification_group_ids (ids from ' +
        'list_projects include=channels).'
    ),
}

// Uptime-only fields (besides the required uptime_url). Valid only for UPTIME_HTTP.
const uptimeOptionalFields = {
  uptime_method: z
    .enum(['GET', 'HEAD', 'POST'])
    .optional()
    .describe(
      'HTTP method for the check. HEAD is lighter-weight; POST allows sending uptime_request_body. Defaults to GET.'
    ),
  uptime_expected_status: z
    .array(z.number().int().min(100).max(599))
    .optional()
    .describe(
      'HTTP status codes considered "up" (e.g. [200, 201]). Omit or leave empty to use the default: any 2xx ' +
        'response is up.'
    ),
  uptime_keyword: z
    .string()
    .max(1024)
    .nullable()
    .optional()
    .describe(
      'Substring to search for in the response body (max 1024 chars). If set (and uptime_keyword_absent is ' +
        'false), the check fails when the keyword is missing from an otherwise-successful response.'
    ),
  uptime_keyword_absent: z
    .boolean()
    .optional()
    .describe(
      "Flips uptime_keyword's check: when true, the check fails if the keyword IS found. Defaults to false " +
        '(keyword must be present).'
    ),
  uptime_headers: z
    .record(z.string(), z.string())
    .nullable()
    .optional()
    .describe(
      'Custom request headers to send (e.g. an API key). Sent on the initial request and on same-origin ' +
        "redirect hops only — stripped on cross-origin redirects so credentials don't leak. Hop-by-hop and " +
        'connection-control headers (Host, Content-Length, Connection, Transfer-Encoding, etc.) are rejected by ' +
        'the API.'
    ),
  uptime_timeout_ms: z
    .number()
    .int()
    .min(1000)
    .max(30000)
    .optional()
    .describe('Per-check timeout in milliseconds (1000-30000). Defaults to 10000.'),
  uptime_follow_redirects: z
    .boolean()
    .optional()
    .describe(
      'Whether to follow HTTP redirects (up to 10 hops; an https→http downgrade redirect is always ' +
        'refused). Defaults to true.'
    ),
  uptime_request_body: z
    .string()
    .max(10000)
    .nullable()
    .optional()
    .describe('Request body to send when uptime_method is POST (max 10000 chars). Ignored for GET/HEAD.'),
  uptime_verify_ssl: z
    .boolean()
    .optional()
    .describe(
      'Whether to reject invalid or self-signed TLS certificates during the check. Set false to allow checking ' +
        'a host with a known-bad cert. Defaults to true.'
    ),
  uptime_locations: z
    .array(z.enum(['eu-central', 'us-east']))
    .min(1)
    .max(2)
    .optional()
    .describe(
      'Check locations for this monitor (beta, all plans — each location consumes 1 beat per check cycle, so a ' +
        '2-location monitor costs double the beats of a 1-location one). Must include "eu-central"; the API ' +
        'rejects an array missing it, and rejects "us-east" outright if multi-location checking is not enabled ' +
        'for this project. Defaults to ["eu-central"] (today\'s single-vantage behavior).'
    ),
}

// Flat shape advertised to clients. The cross-field rules (uptime_* only for
// UPTIME_HTTP, uptime_url required there) are enforced by the validator below.
export const createMonitorInputShape = {
  ...commonFields,
  type: z
    .enum(['JOB_BASIC', 'JOB_CRON', 'JOB_HEARTBEAT', 'UPTIME_HTTP'])
    .describe(
      'Monitor type — determines how "schedule" is interpreted and what triggers a DOWN transition. JOB_CRON: ' +
        'cron schedule. JOB_BASIC: event-driven, no schedule expectation. JOB_HEARTBEAT: passive endpoint your ' +
        'job pings on an interval. UPTIME_HTTP: Drumbeats polls uptime_url on an interval. See the tool ' +
        'description for details on each.'
    ),
  uptime_url: httpUrl
    .optional()
    .describe(
      'The URL Drumbeats polls on the schedule interval. Required when type is UPTIME_HTTP, rejected for job ' +
        'types. Must be http(s) and must not embed credentials (user:pass@host) — put auth in uptime_headers ' +
        'instead.'
    ),
  ...uptimeOptionalFields,
}

export const createMonitorOutputShape = {
  monitor: z.object(monitorSummaryOutputShape),
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
  '- JOB_BASIC: an event-driven job with no fixed schedule (e.g. triggered by user action). "schedule" is ' +
    'required but ignored for timing — pass any placeholder like "@event". grace_period_seconds and ' +
    "schedule_tolerance don't apply; only failure_tolerance (and, if max_duration_seconds is set, a run-timeout) " +
    'count against it.',
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
    {
      title: 'Create monitor',
      description: DESCRIPTION,
      inputSchema: createMonitorInputShape,
      outputSchema: createMonitorOutputShape,
      annotations: { readOnlyHint: false },
    },
    (args) => createMonitor(ctx, args)
  )
}
