import { z } from 'zod'

// Raw incident wire shape (snake_case); only the fields we surface are modelled.
export interface RawIncident {
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

/** Concise, model-facing incident view. */
export interface IncidentSummary {
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

export function toIncidentSummary(incident: RawIncident): IncidentSummary {
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

/** Output shape mirroring IncidentSummary above, for every incident-returning tool. */
export const incidentSummaryOutputShape = {
  id: z.string(),
  monitor_id: z.string().nullable(),
  project_id: z.string().nullable(),
  event: z.string().nullable(),
  status: z.string().nullable(),
  started_at: z.string().nullable(),
  acknowledged_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  reopened_at: z.string().nullable(),
}

export const incidentSummarySchema = z.object(incidentSummaryOutputShape)
