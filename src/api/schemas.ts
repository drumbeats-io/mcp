import { z } from 'zod'

/**
 * Shared zod schemas mirroring the Drumbeats REST API contract.
 *
 * Scaffold stub: only the error envelope is modelled today. Per-resource
 * request/response schemas (monitors, incidents, projects, diagnostics) are
 * added alongside the tools that use them, one file per tool.
 */
export const apiErrorBodySchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
})

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>
