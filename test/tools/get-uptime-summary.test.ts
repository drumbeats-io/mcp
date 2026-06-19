import { describe, expect, it } from 'vitest'
import type { ApiRequest } from '../../src/api/client'
import { DrumbeatsApiError } from '../../src/api/errors'
import { getUptimeSummary } from '../../src/tools/uptime/get-uptime-summary'
import { ctxWith, textOf } from '../helpers'

describe('get_uptime_summary', () => {
  it('renders a readable rollup and passes period_hours', async () => {
    const calls: ApiRequest[] = []
    const ctx = ctxWith(
      () => ({
        period_hours: 720,
        overall: { uptime_percentage: 99.9, total_checks: 1000, up_count: 999, down_count: 1 },
        monitors: [
          {
            monitor_id: 'm1',
            name: 'Marketing site',
            uptime_percentage: 99.9,
            total_checks: 1000,
            up_count: 999,
            down_count: 1,
            avg_ms: 230,
            p95_ms: 450,
          },
        ],
      }),
      calls
    )

    const text = textOf(await getUptimeSummary(ctx, { project_id: 'p1', period_hours: 720 }))
    expect(calls[0]?.path).toBe('/v1/projects/p1/uptime-summary')
    expect(calls[0]?.query?.period_hours).toBe(720)
    expect(text).toContain('720h')
    expect(text).toContain('99.9%')
    expect(text).toContain('Marketing site')
    expect(text).toContain('p95 450ms')
  })

  it('handles a project with no uptime monitors', async () => {
    const ctx = ctxWith(() => ({
      period_hours: 24,
      overall: { uptime_percentage: 100, total_checks: 0, up_count: 0, down_count: 0 },
      monitors: [],
    }))
    const text = textOf(await getUptimeSummary(ctx, { project_id: 'p1' }))
    expect(text).toContain('no uptime monitors')
  })

  it('maps errors to a tool error', async () => {
    const ctx = ctxWith(() => {
      throw new DrumbeatsApiError(403, 'Forbidden')
    })
    const result = await getUptimeSummary(ctx, { project_id: 'p1' })
    expect(result.isError).toBe(true)
  })
})
