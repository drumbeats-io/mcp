import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ApiRequest } from '../../src/api/client'
import { checkDns, checkDnsInputShape, checkDnsOutputShape } from '../../src/tools/diagnostics/check-dns'
import { ctxWith, dataOf, structuredOf } from '../helpers'

const outputSchema = z.object(checkDnsOutputShape)

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

  it('a full 200 response validates against the declared outputSchema', async () => {
    const ctx = ctxWith(() => ({
      ok: true,
      hostname_checked: 'example.com',
      records: {
        A: ['203.0.113.10'],
        AAAA: [],
        CNAME: [],
        MX: [{ exchange: 'mail.example.com', priority: 10 }],
        NS: ['ns1.example.com'],
      },
      resolution_errors: { AAAA: 'NODATA' },
      all_failed: false,
      checked_at: '2026-01-26T02:00:00.000Z',
      check_region: 'us-east',
    }))
    const result = await checkDns(ctx, { hostname: 'example.com' })
    expect(outputSchema.safeParse(structuredOf(result)).success).toBe(true)
  })
})
