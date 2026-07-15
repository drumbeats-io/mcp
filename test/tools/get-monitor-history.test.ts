import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ApiRequest } from '../../src/api/client'
import { DrumbeatsApiError } from '../../src/api/errors'
import { getMonitorHistory, getMonitorHistoryOutputShape } from '../../src/tools/monitors/get-monitor-history'
import { ctxWith, dataOf, structuredOf } from '../helpers'

const outputSchema = z.object(getMonitorHistoryOutputShape)

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

  describe('structuredContent validates against the declared outputSchema for every kind', () => {
    it('pings', async () => {
      const ctx = ctxWith(() => ({
        data: [
          {
            id: 'p1',
            run_id: null,
            event: 'SUCCESS',
            exit_code: 0,
            duration_ms: 1234,
            duration_assertion: 'PASS',
            message: null,
            payload: null,
            payload_truncated: false,
            payload_bytes: null,
            request_ip: '203.0.113.10',
            request_ua: 'curl/8.6.0',
            started_at: null,
            created_at: '2026-01-26T02:00:00.000Z',
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, total_pages: 1, has_next: false, has_prev: false },
      }))
      const result = await getMonitorHistory(ctx, { monitor_id: 'm1', kind: 'pings' })
      expect(outputSchema.safeParse(structuredOf(result)).success).toBe(true)
    })

    it('warnings', async () => {
      const ctx = ctxWith(() => ({
        warnings: [
          {
            type: 'MISSING_RUN_ID',
            message: '5 of 10 recent pings are missing a run_id',
            affected_count: 5,
            recommendation: 'Add a unique run_id to each job execution.',
          },
        ],
        analyzed_period: { from: '2026-01-14T00:00:00.000Z', to: '2026-01-21T00:00:00.000Z', total_pings: 10 },
      }))
      const result = await getMonitorHistory(ctx, { monitor_id: 'm1', kind: 'warnings' })
      expect(outputSchema.safeParse(structuredOf(result)).success).toBe(true)
    })

    it('checks', async () => {
      const ctx = ctxWith(() => ({
        id: 'c1',
        monitor_id: 'm1',
        status_code: 200,
        response_time_ms: 123,
        is_up: true,
        error: null,
        ssl_expires_at: null,
        ssl_issuer: null,
        check_region: 'us-east',
        check_status: 'ok',
        cycle_id: 'cyc-1',
        created_at: '2026-01-26T02:00:00.000Z',
      }))
      const result = await getMonitorHistory(ctx, { monitor_id: 'm1', kind: 'checks' })
      expect(outputSchema.safeParse(structuredOf(result)).success).toBe(true)
    })

    it('checks with a probe_error result and a null cycle_id (legacy row)', async () => {
      const ctx = ctxWith(() => ({
        id: 'c2',
        monitor_id: 'm1',
        status_code: null,
        response_time_ms: 0,
        is_up: false,
        error: 'Probe unreachable: connect ETIMEDOUT',
        ssl_expires_at: null,
        ssl_issuer: null,
        check_region: 'us-east',
        check_status: 'probe_error',
        cycle_id: null,
        created_at: '2026-01-26T02:00:00.000Z',
      }))
      const result = await getMonitorHistory(ctx, { monitor_id: 'm1', kind: 'checks' })
      expect(outputSchema.safeParse(structuredOf(result)).success).toBe(true)
    })

    it('rejects a checks result with an unknown check_status value', () => {
      const parsed = outputSchema.safeParse({
        monitor_id: 'm1',
        kind: 'checks',
        data: {
          id: 'c1',
          monitor_id: 'm1',
          status_code: 200,
          response_time_ms: 123,
          is_up: true,
          error: null,
          ssl_expires_at: null,
          ssl_issuer: null,
          check_region: 'us-east',
          check_status: 'weird_value',
          created_at: '2026-01-26T02:00:00.000Z',
        },
      })
      expect(parsed.success).toBe(false)
    })

    it('response_times', async () => {
      const ctx = ctxWith(() => ({
        avg_ms: 120,
        min_ms: 80,
        max_ms: 300,
        p95_ms: 250,
        total_checks: 100,
        up_count: 99,
        down_count: 1,
        uptime_percentage: 99,
      }))
      const result = await getMonitorHistory(ctx, { monitor_id: 'm1', kind: 'response_times' })
      expect(outputSchema.safeParse(structuredOf(result)).success).toBe(true)
    })

    it('rejects a malformed payload (proves the schema is not a rubber stamp)', () => {
      const parsed = outputSchema.safeParse({ monitor_id: 'm1', kind: 'pings', data: { nonsense: true } })
      expect(parsed.success).toBe(false)
    })
  })
})
