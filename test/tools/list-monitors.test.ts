import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ApiRequest } from '../../src/api/client'
import { DrumbeatsApiError } from '../../src/api/errors'
import { listMonitors, listMonitorsInputShape } from '../../src/tools/monitors/list-monitors'
import { ctxWith, dataOf } from '../helpers'

describe('list_monitors', () => {
  it('requires project_id', () => {
    const schema = z.object(listMonitorsInputShape)
    expect(() => schema.parse({})).toThrow()
    expect(schema.parse({ project_id: 'p1' }).project_id).toBe('p1')
  })

  it('passes project_id and maps monitors concisely', async () => {
    const calls: ApiRequest[] = []
    const ctx = ctxWith((req) => {
      if (req.path === '/v1/monitors') {
        return {
          monitors: [
            { id: 'm1', name: 'Backup', type: 'JOB_CRON', status: 'UP', tags: ['nightly'], owner_secret: 'x' },
          ],
        }
      }
      throw new Error(`unexpected ${req.path}`)
    }, calls)

    const data = dataOf<{ monitors: Array<Record<string, unknown>> }>(await listMonitors(ctx, { project_id: 'p1' }))
    expect(calls[0]?.query?.project_id).toBe('p1')
    expect(data.monitors[0]).toMatchObject({
      id: 'm1',
      name: 'Backup',
      type: 'JOB_CRON',
      status: 'UP',
      tags: ['nightly'],
    })
    expect(data.monitors[0]).not.toHaveProperty('owner_secret')
  })

  it('maps API errors to a tool error', async () => {
    const ctx = ctxWith(() => {
      throw new DrumbeatsApiError(403, 'Forbidden', { error: 'missing scope' })
    })
    const result = await listMonitors(ctx, { project_id: 'p1' })
    expect(result.isError).toBe(true)
  })
})
