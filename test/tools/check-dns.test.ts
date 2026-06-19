import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ApiRequest } from '../../src/api/client'
import { checkDns, checkDnsInputShape } from '../../src/tools/diagnostics/check-dns'
import { ctxWith, dataOf } from '../helpers'

describe('check_dns', () => {
  it('requires a hostname', () => {
    const schema = z.object(checkDnsInputShape)
    expect(() => schema.parse({})).toThrow()
    expect(schema.parse({ hostname: 'example.com' }).hostname).toBe('example.com')
  })

  it('POSTs the hostname to the check-dns endpoint', async () => {
    const calls: ApiRequest[] = []
    const ctx = ctxWith(() => ({ ok: true, records: { A: ['203.0.113.10'] } }), calls)
    const data = dataOf<{ ok: boolean }>(await checkDns(ctx, { hostname: 'example.com' }))
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe('/v1/tools/check-dns')
    expect(calls[0]?.body).toMatchObject({ hostname: 'example.com' })
    expect(data.ok).toBe(true)
  })
})
