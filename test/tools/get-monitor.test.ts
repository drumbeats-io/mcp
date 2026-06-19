import { describe, expect, it } from 'vitest'
import type { ApiRequest } from '../../src/api/client'
import { DrumbeatsApiError } from '../../src/api/errors'
import { getMonitor } from '../../src/tools/monitors/get-monitor'
import { ctxWith, dataOf } from '../helpers'

describe('get_monitor', () => {
  it('fetches by id with an encoded path and maps the monitor', async () => {
    const calls: ApiRequest[] = []
    const ctx = ctxWith(() => ({ monitor: { id: 'm1', name: 'Backup', type: 'JOB_CRON', status: 'UP' } }), calls)

    const data = dataOf<{ monitor: Record<string, unknown> }>(await getMonitor(ctx, { monitor_id: 'm 1' }))
    expect(calls[0]?.path).toBe('/v1/monitors/m%201')
    expect(data.monitor).toMatchObject({ id: 'm1', name: 'Backup', type: 'JOB_CRON', status: 'UP' })
  })

  it('maps a 404 to a tool error', async () => {
    const ctx = ctxWith(() => {
      throw new DrumbeatsApiError(404, 'Not Found')
    })
    const result = await getMonitor(ctx, { monitor_id: 'missing' })
    expect(result.isError).toBe(true)
  })
})
