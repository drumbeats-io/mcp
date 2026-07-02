import { z } from 'zod'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
export const uuid = () => z.string().regex(UUID_RE, 'must be a UUID')

/** Raw project shape returned by the id service; only the fields we surface are modelled. */
export interface RawProject {
  id: string
  name: string
  description?: string | null
  plan?: string | null
  created_at?: string | null
  owner?: { email?: string | null } | null
  members?: unknown[] | null
  _count?: { members?: number | null } | null
}

/** Concise, model-facing project view. Mirrors list_projects' summary shape. */
export interface ProjectSummary {
  id: string
  name: string
  description: string | null
  plan: string | null
  created_at: string | null
  member_count: number | null
  owner_email: string | null
}

export function toProjectSummary(project: RawProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? null,
    plan: project.plan ?? null,
    created_at: project.created_at ?? null,
    member_count: project._count?.members ?? (Array.isArray(project.members) ? project.members.length : null),
    owner_email: project.owner?.email ?? null,
  }
}
