import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ApiRequest } from '../../src/api/client'
import { DrumbeatsApiError } from '../../src/api/errors'
import {
  updateMonitor,
  updateMonitorInputShape,
  updateMonitorOutputShape,
} from '../../src/tools/monitors/update-monitor'
import { ctxWith, structuredOf } from '../helpers'

const inputSchema = z.object(updateMonitorInputShape)
const outputSchema = z.object(updateMonitorOutputShape)

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

  it('structuredContent validates against the declared outputSchema', async () => {
    const ctx = ctxWith(() => ({ monitor: { id: 'm1', name: 'New name' } }))
    const result = await updateMonitor(ctx, { monitor_id: 'm1', name: 'New name' })
    expect(outputSchema.safeParse(structuredOf(result)).success).toBe(true)
  })

  describe('input shape (validated by the SDK, not the handler)', () => {
    it('accepts a null slug (matches the API, which allows clearing it on update)', () => {
      const parsed = inputSchema.safeParse({ monitor_id: 'm1', slug: null })
      expect(parsed.success).toBe(true)
    })

    it('accepts grace_period_seconds at the API floor of 15', () => {
      const parsed = inputSchema.safeParse({ monitor_id: 'm1', grace_period_seconds: 15 })
      expect(parsed.success).toBe(true)
    })

    it('rejects grace_period_seconds below the API floor of 15 (was min 0, tightened to match core)', () => {
      const parsed = inputSchema.safeParse({ monitor_id: 'm1', grace_period_seconds: 5 })
      expect(parsed.success).toBe(false)
    })

    it('accepts a valid uptime_locations array', () => {
      const parsed = inputSchema.safeParse({ monitor_id: 'm1', uptime_locations: ['eu-central', 'us-east'] })
      expect(parsed.success).toBe(true)
    })

    it('rejects an uptime_locations entry outside the region registry', () => {
      const parsed = inputSchema.safeParse({ monitor_id: 'm1', uptime_locations: ['ap-south'] })
      expect(parsed.success).toBe(false)
    })

    it('rejects uptime_locations with more than 2 entries', () => {
      const parsed = inputSchema.safeParse({
        monitor_id: 'm1',
        uptime_locations: ['eu-central', 'us-east', 'eu-central'],
      })
      expect(parsed.success).toBe(false)
    })
  })
})
