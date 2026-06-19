import { describe, expect, it } from 'vitest'
import type { ApiRequest } from '../../src/api/client'
import { DrumbeatsApiError } from '../../src/api/errors'
import { getUptimeSummary } from '../../src/tools/uptime/get-uptime-summary'
import { ctxWith, dataOf } from '../helpers'

describe('get_uptime_summary', () => {
  it('hits the project uptime-summary endpoint and returns the rollup', async () => {
    const calls: ApiRequest[] = []
    const ctx = ctxWith(() => ({ period_hours: 720, overall: { uptime_percentage: 99.9 }, monitors: [] }), calls)

    const data = dataOf<{ overall: { uptime_percentage: number } }>(
      await getUptimeSummary(ctx, { project_id: 'p1', period_hours: 720 })
    )
    expect(calls[0]?.path).toBe('/v1/projects/p1/uptime-summary')
    expect(calls[0]?.query?.period_hours).toBe(720)
    expect(data.overall.uptime_percentage).toBe(99.9)
  })

  it('maps errors to a tool error', async () => {
    const ctx = ctxWith(() => {
      throw new DrumbeatsApiError(403, 'Forbidden')
    })
    const result = await getUptimeSummary(ctx, { project_id: 'p1' })
    expect(result.isError).toBe(true)
  })
})
