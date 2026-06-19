import { describe, expect, it } from 'vitest'
import type { ApiRequest } from '../../src/api/client'
import { pauseMonitor, resumeMonitor } from '../../src/tools/monitors/pause-resume'
import { ctxWith } from '../helpers'

describe('pause_monitor / resume_monitor', () => {
  it('pause POSTs to the pause endpoint', async () => {
    const calls: ApiRequest[] = []
    const result = await pauseMonitor(
      ctxWith(() => ({ monitor: { id: 'm1', name: 'x' } }), calls),
      { monitor_id: 'm1' }
    )
    expect(result.isError).toBeFalsy()
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe('/v1/monitors/m1/pause')
  })

  it('resume POSTs to the resume endpoint', async () => {
    const calls: ApiRequest[] = []
    await resumeMonitor(
      ctxWith(() => ({ monitor: { id: 'm1', name: 'x' } }), calls),
      { monitor_id: 'm1' }
    )
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe('/v1/monitors/m1/resume')
  })
})
