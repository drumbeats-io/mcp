import type { Scope } from './scope-map.js'

/** A successfully verified OAuth 2.1 bearer token. */
export interface VerifiedToken {
  readonly subject: string
  readonly scopes: readonly Scope[]
  readonly audience: string
  readonly expiresAt: number
  /** The raw token, forwarded as the Bearer credential to the REST API (§3.3-α). */
  readonly raw: string
}

export interface VerifyTokenOptions {
  /** The MCP resource identifier the token's `aud` MUST match (RFC 8707). */
  readonly expectedAudience: string
}

/** Raised when a bearer token is missing, malformed, expired, or mis-audienced. */
export class TokenVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenVerificationError'
  }
}

/**
 * Validates an inbound OAuth 2.1 bearer token: signature, expiry, audience
 * (RFC 8707) and scope. Hosted transport only.
 *
 * Scaffold stub — intentionally not implemented. The hosted path is gated on
 * the `id`-service OAuth upgrades (audience + scope claims, public-client PKCE,
 * discovery metadata). Until those land this fails closed, so the hosted
 * transport never accepts an unverified token.
 */
export function verifyBearerToken(token: string, options: VerifyTokenOptions): Promise<VerifiedToken> {
  if (token.length === 0) {
    return Promise.reject(new TokenVerificationError('missing bearer token'))
  }
  return Promise.reject(
    new TokenVerificationError(
      `token verification not implemented in scaffold (expected audience: ${options.expectedAudience})`
    )
  )
}
