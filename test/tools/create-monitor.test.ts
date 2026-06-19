import { describe, expect, it } from 'vitest'
import type { ApiRequest } from '../../src/api/client'
import { createMonitor } from '../../src/tools/monitors/create-monitor'
import { ctxWith, dataOf } from '../helpers'

const PROJECT = '00000000-0000-4000-8000-000000000000'

function ctxOk(calls: ApiRequest[]) {
  return ctxWith((req) => {
    if (req.method === 'POST' && req.path === '/v1/monitors') {
      return { monitor: { id: 'm1', ...(req.body as Record<string, unknown>) } }
    }
    throw new Error(`unexpected ${req.method ?? 'GET'} ${req.path}`)
  }, calls)
}

describe('create_monitor — valid combinations', () => {
  it.each(['JOB_BASIC', 'JOB_CRON', 'JOB_HEARTBEAT'])('accepts %s with name + schedule', async (type) => {
    const calls: ApiRequest[] = []
    const result = await createMonitor(ctxOk(calls), {
      project_id: PROJECT,
      type,
      name: 'Nightly job',
      schedule: '0 3 * * *',
    })
    expect(result.isError).toBeFalsy()
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe('/v1/monitors')
    expect((calls[0]?.body as { type: string }).type).toBe(type)
  })

  it('accepts UPTIME_HTTP with uptime_url and uptime fields', async () => {
    const calls: ApiRequest[] = []
    const result = await createMonitor(ctxOk(calls), {
      project_id: PROJECT,
      type: 'UPTIME_HTTP',
      name: 'Marketing site',
      schedule: '60s',
      uptime_url: 'https://example.com',
      uptime_method: 'GET',
      uptime_expected_status: [200],
    })
    expect(result.isError).toBeFalsy()
    expect((calls[0]?.body as { uptime_url: string }).uptime_url).toBe('https://example.com')
  })

  it('passes notification wiring through to the API', async () => {
    const calls: ApiRequest[] = []
    await createMonitor(ctxOk(calls), {
      project_id: PROJECT,
      type: 'JOB_CRON',
      name: 'Backup',
      schedule: '0 3 * * *',
      notification_channel_ids: ['11111111-1111-4111-8111-111111111111'],
    })
    expect((calls[0]?.body as { notification_channel_ids: string[] }).notification_channel_ids).toEqual([
      '11111111-1111-4111-8111-111111111111',
    ])
  })
})

describe('create_monitor — invalid combinations are rejected before the API', () => {
  it('rejects UPTIME_HTTP without uptime_url', async () => {
    const calls: ApiRequest[] = []
    const result = await createMonitor(ctxOk(calls), {
      project_id: PROJECT,
      type: 'UPTIME_HTTP',
      name: 'Site',
      schedule: '60s',
    })
    expect(result.isError).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('rejects uptime_url on a job type (forbidden unless UPTIME_HTTP)', async () => {
    const calls: ApiRequest[] = []
    const result = await createMonitor(ctxOk(calls), {
      project_id: PROJECT,
      type: 'JOB_CRON',
      name: 'Nightly',
      schedule: '0 3 * * *',
      uptime_url: 'https://example.com',
    })
    expect(result.isError).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('rejects uptime_method on JOB_BASIC', async () => {
    const calls: ApiRequest[] = []
    const result = await createMonitor(ctxOk(calls), {
      project_id: PROJECT,
      type: 'JOB_BASIC',
      name: 'Worker',
      schedule: '5m',
      uptime_method: 'GET',
    })
    expect(result.isError).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('rejects a missing name', async () => {
    const result = await createMonitor(ctxOk([]), { project_id: PROJECT, type: 'JOB_CRON', schedule: '0 3 * * *' })
    expect(result.isError).toBe(true)
  })

  it('rejects a non-UUID project_id', async () => {
    const result = await createMonitor(ctxOk([]), {
      project_id: 'not-a-uuid',
      type: 'JOB_CRON',
      name: 'N',
      schedule: '* * * * *',
    })
    expect(result.isError).toBe(true)
  })

  it('rejects an unknown type', async () => {
    const result = await createMonitor(ctxOk([]), {
      project_id: PROJECT,
      type: 'NOPE',
      name: 'N',
      schedule: '* * * * *',
    })
    expect(result.isError).toBe(true)
  })
})

describe('create_monitor — success mapping', () => {
  it('returns a concise monitor view', async () => {
    const data = dataOf<{ monitor: { id: string; name: string } }>(
      await createMonitor(ctxOk([]), { project_id: PROJECT, type: 'JOB_CRON', name: 'Backup', schedule: '0 3 * * *' })
    )
    expect(data.monitor).toMatchObject({ id: 'm1', name: 'Backup' })
  })
})
