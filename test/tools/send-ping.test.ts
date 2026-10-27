import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ApiRequest } from '../../src/api/client'
import { DrumbeatsApiError } from '../../src/api/errors'
import {
  pingInputShape,
  pingOutputShape,
  registerPingFailure,
  registerPingStart,
  registerPingSuccess,
  sendPing,
} from '../../src/tools/ping/send-ping'
import { ctxWith, structuredOf, textOf } from '../helpers'

const MONITOR = '3f2b8c1e-9d4a-4b7e-8f6a-1c2d3e4f5a6b'
const RECORDED = { ok: true, ping_id: 'p1', event: 'success', timestamp: '2026-10-27T02:00:00.000Z' }

describe('ping_start / ping_success / ping_failure', () => {
  it.each(['start', 'success', 'failure'] as const)('%s POSTs to the beats ping route', async (event) => {
    const calls: ApiRequest[] = []
    const result = await sendPing(
      ctxWith(() => RECORDED, calls),
      event,
      { monitor_id: MONITOR, run_id: 'r1' }
    )
    expect(result.isError).toBeFalsy()
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.service).toBe('beats')
    expect(calls[0]?.path).toBe(`/v1/ping/${MONITOR}/${event}`)
    expect(z.object(pingOutputShape).safeParse(result.structuredContent).success).toBe(true)
  })

  it('sends run_id, message and payload in the JSON body', async () => {
    const calls: ApiRequest[] = []
    await sendPing(
      ctxWith(() => RECORDED, calls),
      'failure',
      { monitor_id: MONITOR, run_id: 'r1', message: 'exit 2', payload: 'stack trace' }
    )
    expect(calls[0]?.body).toEqual({ run_id: 'r1', message: 'exit 2', payload: 'stack trace' })
  })

  it('always sends an explicit payload key so the API does not store the raw JSON body', async () => {
    const calls: ApiRequest[] = []
    await sendPing(
      ctxWith(() => RECORDED, calls),
      'success',
      { monitor_id: MONITOR }
    )
    expect(calls[0]?.body).toEqual({ run_id: undefined, message: undefined, payload: '' })
  })

  it('start generates a run_id when none is given and returns it', async () => {
    const calls: ApiRequest[] = []
    const result = await sendPing(
      ctxWith(() => RECORDED, calls),
      'start',
      { monitor_id: MONITOR }
    )
    const runId = structuredOf<{ run_id: string }>(result).run_id
    expect(runId).toMatch(/^[0-9a-f-]{36}$/)
    expect((calls[0]?.body as { run_id?: string } | undefined)?.run_id).toBe(runId)
  })

  it('success and failure do not invent a run_id', async () => {
    const result = await sendPing(
      ctxWith(() => RECORDED),
      'success',
      { monitor_id: MONITOR }
    )
    expect(structuredOf(result)).toMatchObject({ run_id: null, recorded: true, ping_id: 'p1' })
  })

  it('reports a paused monitor as not recorded', async () => {
    const result = await sendPing(
      ctxWith(() => ({ ok: true, message: 'Monitor is paused', status: 'ok', code: 'MONITOR_PAUSED' })),
      'success',
      { monitor_id: MONITOR }
    )
    expect(result.isError).toBeFalsy()
    expect(structuredOf(result)).toMatchObject({ recorded: false, ping_id: null })
    expect(structuredOf<{ note: string }>(result).note).toContain('paused')
  })

  it('maps a 404 to a clear unknown-monitor error', async () => {
    const result = await sendPing(
      ctxWith(() => {
        throw new DrumbeatsApiError(404, 'Not Found', { ok: false, code: 'MONITOR_NOT_FOUND' })
      }),
      'success',
      { monitor_id: MONITOR }
    )
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain(MONITOR)
  })

  it('tells a rate-limited caller to slow down, not to upgrade', async () => {
    const result = await sendPing(
      ctxWith(() => {
        throw new DrumbeatsApiError(429, 'Too Many Requests', { ok: false, code: 'RATE_LIMITED' })
      }),
      'success',
      { monitor_id: MONITOR }
    )
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('Too many pings')
  })

  it('surfaces a quota 429 with the upgrade hint', async () => {
    const result = await sendPing(
      ctxWith(() => {
        throw new DrumbeatsApiError(429, 'Too Many Requests', { ok: false, code: 'QUOTA_EXCEEDED' })
      }),
      'success',
      { monitor_id: MONITOR }
    )
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('pricing')
  })

  it('rejects a monitor_id that is not a UUID', () => {
    expect(z.object(pingInputShape).safeParse({ monitor_id: 'not-a-uuid' }).success).toBe(false)
    expect(z.object(pingInputShape).safeParse({ monitor_id: MONITOR }).success).toBe(true)
  })

  it('registers three tools whose descriptions mention the curl replacement', () => {
    const registered: { name: string; description: string }[] = []
    const server = {
      registerTool(name: string, config: { description: string }) {
        registered.push({ name, description: config.description })
      },
    } as unknown as McpServer
    const ctx = ctxWith(() => RECORDED)
    registerPingStart(server, ctx)
    registerPingSuccess(server, ctx)
    registerPingFailure(server, ctx)
    expect(registered.map((tool) => tool.name)).toEqual(['ping_start', 'ping_success', 'ping_failure'])
    for (const tool of registered) {
      expect(tool.description).toContain('curl')
    }
  })
})
