import { describe, expect, it } from 'vitest'
import type { ApiRequest } from '../../src/api/client'
import { DrumbeatsApiError } from '../../src/api/errors'
import { getMonitorHistory } from '../../src/tools/monitors/get-monitor-history'
import { ctxWith, dataOf } from '../helpers'

describe('get_monitor_history', () => {
  it('defaults to pings', async () => {
    const calls: ApiRequest[] = []
    const ctx = ctxWith(() => ({ data: [] }), calls)
    const data = dataOf<{ kind: string }>(await getMonitorHistory(ctx, { monitor_id: 'm1' }))
    expect(calls[0]?.path).toBe('/v1/monitors/m1/pings')
    expect(data.kind).toBe('pings')
  })

  it('routes each kind to the right endpoint', async () => {
    const cases = [
      ['warnings', '/v1/monitors/m1/warnings'],
      ['checks', '/v1/monitors/m1/check-results/latest'],
      ['response_times', '/v1/monitors/m1/response-time-stats'],
    ] as const
    for (const [kind, path] of cases) {
      const calls: ApiRequest[] = []
      const ctx = ctxWith(() => ({}), calls)
      await getMonitorHistory(ctx, { monitor_id: 'm1', kind })
      expect(calls[0]?.path).toBe(path)
    }
  })

  it('caps the ping limit at 100 and passes period_hours for response_times', async () => {
    const pingCalls: ApiRequest[] = []
    await getMonitorHistory(
      ctxWith(() => ({}), pingCalls),
      { monitor_id: 'm1', kind: 'pings', limit: 5000 }
    )
    expect(pingCalls[0]?.query?.limit).toBe(100)

    const rtCalls: ApiRequest[] = []
    await getMonitorHistory(
      ctxWith(() => ({}), rtCalls),
      { monitor_id: 'm1', kind: 'response_times', period_hours: 720 }
    )
    expect(rtCalls[0]?.query?.period_hours).toBe(720)
  })

  it('maps errors to a tool error', async () => {
    const ctx = ctxWith(() => {
      throw new DrumbeatsApiError(404, 'Not Found')
    })
    const result = await getMonitorHistory(ctx, { monitor_id: 'm1', kind: 'checks' })
    expect(result.isError).toBe(true)
  })
})
