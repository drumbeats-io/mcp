import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ApiRequest } from '../../src/api/client'
import { DrumbeatsApiError } from '../../src/api/errors'
import { checkHttp, checkHttpInputShape } from '../../src/tools/diagnostics/check-http'
import { ctxWith, dataOf, textOf } from '../helpers'

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
})
