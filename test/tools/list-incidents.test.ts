import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ApiRequest } from '../../src/api/client'
import { DrumbeatsApiError } from '../../src/api/errors'
import { listIncidents, listIncidentsInputShape } from '../../src/tools/incidents/list-incidents'
import { ctxWith, dataOf } from '../helpers'

describe('list_incidents', () => {
  it('requires project_id and validates status', () => {
    const schema = z.object(listIncidentsInputShape)
    expect(() => schema.parse({})).toThrow()
    expect(() => schema.parse({ project_id: 'p1', status: 'BOGUS' })).toThrow()
    expect(schema.parse({ project_id: 'p1', status: 'OPEN' }).status).toBe('OPEN')
  })

  it('passes filters (capping limit) and maps incidents + pagination', async () => {
    const calls: ApiRequest[] = []
    const ctx = ctxWith(
      () => ({
        data: [
          {
            id: 'i1',
            monitor_id: 'm1',
            project_id: 'p1',
            event: 'DOWN',
            status: 'OPEN',
            started_at: '2026-01-01T00:00:00Z',
          },
        ],
        pagination: { page: 1, limit: 20, total: 1 },
      }),
      calls
    )

    const data = dataOf<{ incidents: Array<Record<string, unknown>>; pagination: Record<string, unknown> }>(
      await listIncidents(ctx, { project_id: 'p1', status: 'OPEN', monitor_id: 'm1', limit: 5000 })
    )

    expect(calls[0]?.query).toMatchObject({ project_id: 'p1', status: 'OPEN', monitor_id: 'm1', limit: 200 })
    expect(data.incidents[0]).toMatchObject({ id: 'i1', monitor_id: 'm1', status: 'OPEN', event: 'DOWN' })
    expect(data.pagination).toMatchObject({ page: 1, limit: 20, total: 1 })
  })

  it('maps errors to a tool error', async () => {
    const ctx = ctxWith(() => {
      throw new DrumbeatsApiError(403, 'Forbidden')
    })
    const result = await listIncidents(ctx, { project_id: 'p1' })
    expect(result.isError).toBe(true)
  })
})
