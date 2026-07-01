import jwt from 'jsonwebtoken'
import { describe, expect, it } from 'vitest'
import { TokenVerificationError, verifyBearerToken } from '../src/auth/verify-token'

const SECRET = 'test-secret-at-least-thirty-two-chars-long'
const AUDIENCE = 'https://api.drumbeats.io/mcp'
const ISSUER = 'https://api.drumbeats.io'

/** Mints a token matching the id service's `generateOAuthAccessToken` contract. */
function mintToken(overrides: Record<string, unknown> = {}, secret = SECRET): string {
  const claims = {
    sub: 'user_123',
    email: 'alice@example.com',
    type: 'oauth',
    client_id: 'client_abc',
    jti: 'jti_xyz',
    iss: ISSUER,
    aud: AUDIENCE,
    scope: 'read manage_monitors',
    ...overrides,
  }
  return jwt.sign(claims, secret, { algorithm: 'HS256', expiresIn: '1h' })
}

const opts = { expectedAudience: AUDIENCE, secret: SECRET }

describe('verifyBearerToken', () => {
  it('accepts a valid token and returns subject, scopes, audience, expiry, raw', async () => {
    const token = mintToken()
    const verified = await verifyBearerToken(token, opts)

    expect(verified.subject).toBe('user_123')
    expect([...verified.scopes]).toEqual(['read', 'manage_monitors'])
    expect(verified.audience).toBe(AUDIENCE)
    expect(verified.raw).toBe(token)
    expect(verified.expiresAt).toBeGreaterThan(Date.now())
  })

  it('rejects an empty token', async () => {
    await expect(verifyBearerToken('', opts)).rejects.toBeInstanceOf(TokenVerificationError)
  })

  it('rejects an expired token', async () => {
    const token = jwt.sign({ sub: 'u', type: 'oauth', aud: AUDIENCE, scope: 'read' }, SECRET, {
      algorithm: 'HS256',
      expiresIn: '-1h',
    })
    await expect(verifyBearerToken(token, opts)).rejects.toThrow('token expired')
  })

  it('rejects a wrong audience', async () => {
    const token = mintToken({ aud: 'https://api.drumbeats.io/other' })
    await expect(verifyBearerToken(token, opts)).rejects.toThrow('invalid token')
  })

  it('rejects a bad signature', async () => {
    const token = mintToken({}, 'a-completely-different-secret-value-here')
    await expect(verifyBearerToken(token, opts)).rejects.toThrow('invalid token')
  })

  it('rejects a token whose type is not oauth', async () => {
    const token = mintToken({ type: 'access' })
    await expect(verifyBearerToken(token, opts)).rejects.toThrow('not an OAuth access token')
  })

  it('rejects a token missing the type claim', async () => {
    const token = mintToken({ type: undefined })
    await expect(verifyBearerToken(token, opts)).rejects.toThrow('not an OAuth access token')
  })

  it('parses a single scope', async () => {
    const token = mintToken({ scope: 'read' })
    const verified = await verifyBearerToken(token, opts)
    expect([...verified.scopes]).toEqual(['read'])
  })

  it('filters out unknown scopes, keeping only known ones', async () => {
    const token = mintToken({ scope: 'read destroy admin manage_monitors' })
    const verified = await verifyBearerToken(token, opts)
    expect([...verified.scopes]).toEqual(['read', 'manage_monitors'])
  })

  it('yields no scopes when the scope claim is absent', async () => {
    const token = mintToken({ scope: undefined })
    const verified = await verifyBearerToken(token, opts)
    expect(verified.scopes).toEqual([])
  })
})
