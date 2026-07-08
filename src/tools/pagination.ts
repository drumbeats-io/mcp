import { z } from 'zod'

/**
 * Shared output shape for the REST API's pagination envelope (page/limit/total
 * plus has_next/has_prev), returned alongside a `data` array by list_incidents
 * and get_monitor_history (kind=pings).
 */
export const paginationOutputShape = {
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  total_pages: z.number().int(),
  has_next: z.boolean(),
  has_prev: z.boolean(),
}

export const paginationSchema = z.object(paginationOutputShape)
