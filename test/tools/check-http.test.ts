import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ApiRequest } from '../../src/api/client'
import { DrumbeatsApiError } from '../../src/api/errors'
import { checkHttp, checkHttpInputShape, checkHttpOutputShape } from '../../src/tools/diagnostics/check-http'
import { ctxWith, dataOf, structuredOf, textOf } from '../helpers'

const outputSchema = z.object(checkHttpOutputShape)

describe('check_http', () => {
  it('validates the url', () => {
    const schema = z.object(checkHttpInputShape)
    expect(() => schema.parse({ url: 'not a url' })).toThrow()
    expect(schema.parse({ url: 'https://example.com' }).url).toBe('https://example.com')
  })

  it('POSTs to the check-http endpoint with the body', async () => {
    const calls: ApiRequest[] = []
    const ctx = ctxWith(() => ({ ok: true, status: 'up', status_code: 200 }), calls)
    const data = dataOf<{ ok: boolean }>(await checkHttp(ctx, { url: 'https://example.com', method: 'GET' }))
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe('/v1/tools/check-http')
    expect(calls[0]?.body).toMatchObject({ url: 'https://example.com', method: 'GET' })
    expect(data.ok).toBe(true)
  })

  it('surfaces a nested error message on failure', async () => {
    const ctx = ctxWith(() => {
      throw new DrumbeatsApiError(400, 'Bad Request', { ok: false, error: { code: 'INVALID_URL', message: 'bad url' } })
    })
    const result = await checkHttp(ctx, { url: 'https://example.com' })
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('bad url')
  })

  it('a full 200 response validates against the declared outputSchema', async () => {
    const ctx = ctxWith(() => ({
      ok: true,
      status: 'up',
      status_code: 200,
      method_used: 'HEAD',
      response_time_ms: 87,
      timing: { dns_ms: 5, connect_ms: 10, tls_ms: 20, ttfb_ms: 50, download_ms: 2 },
      final_url: 'https://example.com/',
      redirect_chain: [],
      tls_error: null,
      error: null,
      checked_at: '2026-01-26T02:00:00.000Z',
      check_region: 'us-east',
    }))
    const result = await checkHttp(ctx, { url: 'https://example.com' })
    expect(outputSchema.safeParse(structuredOf(result)).success).toBe(true)
  })
})
