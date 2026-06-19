import { describe, expect, it } from 'vitest'
import type { ApiRequest } from '../../src/api/client'
import { DrumbeatsApiError } from '../../src/api/errors'
import { updateMonitor } from '../../src/tools/monitors/update-monitor'
import { ctxWith } from '../helpers'

describe('update_monitor', () => {
  it('PATCHes only the provided fields', async () => {
    const calls: ApiRequest[] = []
    const ctx = ctxWith(() => ({ monitor: { id: 'm1', name: 'New name' } }), calls)
    const result = await updateMonitor(ctx, { monitor_id: 'm1', name: 'New name', alert_enabled: false })
    expect(result.isError).toBeFalsy()
    expect(calls[0]?.method).toBe('PATCH')
    expect(calls[0]?.path).toBe('/v1/monitors/m1')
    expect(calls[0]?.body).toEqual({ name: 'New name', alert_enabled: false })
  })

  it('rejects an empty patch without calling the API', async () => {
    const calls: ApiRequest[] = []
    const result = await updateMonitor(
      ctxWith(() => ({}), calls),
      { monitor_id: 'm1' }
    )
    expect(result.isError).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('maps API errors to a tool error', async () => {
    const ctx = ctxWith(() => {
      throw new DrumbeatsApiError(404, 'Not Found')
    })
    const result = await updateMonitor(ctx, { monitor_id: 'missing', name: 'x' })
    expect(result.isError).toBe(true)
  })
})
