import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ApiRequest } from '../../src/api/client'
import { checkSsl, checkSslInputShape } from '../../src/tools/diagnostics/check-ssl'
import { ctxWith, dataOf } from '../helpers'

describe('check_ssl', () => {
  it('requires a hostname and validates the port range', () => {
    const schema = z.object(checkSslInputShape)
    expect(() => schema.parse({})).toThrow()
    expect(() => schema.parse({ hostname: 'example.com', port: 70000 })).toThrow()
    expect(schema.parse({ hostname: 'example.com', port: 8443 }).port).toBe(8443)
  })

  it('POSTs hostname and port to the check-ssl endpoint', async () => {
    const calls: ApiRequest[] = []
    const ctx = ctxWith(() => ({ ok: true, valid: true, days_remaining: 60 }), calls)
    const data = dataOf<{ ok: boolean }>(await checkSsl(ctx, { hostname: 'example.com', port: 443 }))
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe('/v1/tools/check-ssl')
    expect(calls[0]?.body).toMatchObject({ hostname: 'example.com', port: 443 })
    expect(data.ok).toBe(true)
  })
})
