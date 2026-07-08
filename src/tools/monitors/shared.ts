import { z } from 'zod'

// Raw monitor wire shape (snake_case); only the fields we surface are modelled.
export interface RawMonitor {
  id: string
  project_id?: string | null
  type?: string | null
  name: string
  slug?: string | null
  description?: string | null
  tags?: string[] | null
  status?: string | null
  timezone?: string | null
  grace_period_seconds?: number | null
  alert_enabled?: boolean | null
  total_pings_received?: number | null
  consecutive_failures?: number | null
  last_success_at?: string | null
  next_expected_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/** Concise, model-facing monitor view. */
export interface MonitorSummary {
  id: string
  name: string
  type: string | null
  status: string | null
  slug: string | null
  project_id: string | null
  description: string | null
  tags: string[]
  timezone: string | null
  grace_period_seconds: number | null
  alert_enabled: boolean | null
  total_pings_received: number | null
  consecutive_failures: number | null
  last_success_at: string | null
  next_expected_at: string | null
  created_at: string | null
}

export function toMonitorSummary(monitor: RawMonitor): MonitorSummary {
  return {
    id: monitor.id,
    name: monitor.name,
    type: monitor.type ?? null,
    status: monitor.status ?? null,
    slug: monitor.slug ?? null,
    project_id: monitor.project_id ?? null,
    description: monitor.description ?? null,
    tags: monitor.tags ?? [],
    timezone: monitor.timezone ?? null,
    grace_period_seconds: monitor.grace_period_seconds ?? null,
    alert_enabled: monitor.alert_enabled ?? null,
    total_pings_received: monitor.total_pings_received ?? null,
    consecutive_failures: monitor.consecutive_failures ?? null,
    last_success_at: monitor.last_success_at ?? null,
    next_expected_at: monitor.next_expected_at ?? null,
    created_at: monitor.created_at ?? null,
  }
}

/** Output shape mirroring MonitorSummary above, for every monitor-returning tool. */
export const monitorSummaryOutputShape = {
  id: z.string(),
  name: z.string(),
  type: z.string().nullable(),
  status: z.string().nullable(),
  slug: z.string().nullable(),
  project_id: z.string().nullable(),
  description: z.string().nullable(),
  tags: z.array(z.string()),
  timezone: z.string().nullable(),
  grace_period_seconds: z.number().int().nullable(),
  alert_enabled: z.boolean().nullable(),
  total_pings_received: z.number().int().nullable(),
  consecutive_failures: z.number().int().nullable(),
  last_success_at: z.string().nullable(),
  next_expected_at: z.string().nullable(),
  created_at: z.string().nullable(),
}

export const monitorSummarySchema = z.object(monitorSummaryOutputShape)
