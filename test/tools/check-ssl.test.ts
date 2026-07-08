import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ApiRequest } from '../../src/api/client'
import { checkSsl, checkSslInputShape, checkSslOutputShape } from '../../src/tools/diagnostics/check-ssl'
import { ctxWith, dataOf, structuredOf } from '../helpers'

const outputSchema = z.object(checkSslOutputShape)

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

  it('a full 200 response validates against the declared outputSchema', async () => {
    const ctx = ctxWith(() => ({
      ok: true,
      valid: true,
      issuer: "Let's Encrypt",
      subject: 'example.com',
      sans: ['example.com', 'www.example.com'],
      expires_at: '2026-04-01T00:00:00.000Z',
      valid_from: '2026-01-01T00:00:00.000Z',
      days_remaining: 60,
      chain_valid: true,
      self_signed: false,
      hostname_match: true,
      signature_algorithm: 'sha256WithRSAEncryption',
      error: null,
      hostname_checked: 'example.com',
      port_checked: 443,
      checked_at: '2026-01-26T02:00:00.000Z',
      check_region: 'us-east',
    }))
    const result = await checkSsl(ctx, { hostname: 'example.com' })
    expect(outputSchema.safeParse(structuredOf(result)).success).toBe(true)
  })
})
