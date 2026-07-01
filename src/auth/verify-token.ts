import jwt from 'jsonwebtoken'
import { isScope, type Scope } from './scope-map.js'

/** A successfully verified OAuth 2.1 bearer token. */
export interface VerifiedToken {
  readonly subject: string
  readonly scopes: readonly Scope[]
  readonly audience: string
  readonly expiresAt: number
  /** The raw token, forwarded as the Bearer credential to the REST API. */
  readonly raw: string
}

export interface VerifyTokenOptions {
  /** The MCP resource identifier the token's `aud` MUST match (RFC 8707). */
  readonly expectedAudience: string
  /** The HS256 secret shared with the id service (from `config.jwtSecret`). */
  readonly secret: string
}

/** Raised when a bearer token is missing, malformed, expired, or mis-audienced. */
export class TokenVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenVerificationError'
  }
}

/**
 * Validates an inbound OAuth 2.1 bearer token minted by the id service:
 * HS256 signature, expiry, audience (RFC 8707) and the `oauth` token type,
 * then extracts subject and scopes. Hosted transport only.
 *
 * This is a fast local gate — the REST API still enforces real authz on every
 * forwarded request. Scopes here drive which tools are *visible* to the agent.
 *
 * Every underlying failure is mapped to a terse `TokenVerificationError`; the
 * raw jwt error is never surfaced.
 */
export function verifyBearerToken(token: string, options: VerifyTokenOptions): Promise<VerifiedToken> {
  if (token.length === 0) {
    return Promise.reject(new TokenVerificationError('missing bearer token'))
  }

  let decoded: jwt.JwtPayload
  try {
    const result = jwt.verify(token, options.secret, {
      algorithms: ['HS256'],
      audience: options.expectedAudience,
    })
    if (typeof result === 'string') {
      return Promise.reject(new TokenVerificationError('token payload is not a JSON object'))
    }
    decoded = result
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return Promise.reject(new TokenVerificationError('token expired'))
    }
    // JsonWebTokenError covers bad signature, wrong audience, malformed token, etc.
    return Promise.reject(new TokenVerificationError('invalid token'))
  }

  if (decoded.type !== 'oauth') {
    return Promise.reject(new TokenVerificationError('token is not an OAuth access token'))
  }
  if (typeof decoded.sub !== 'string' || decoded.sub.length === 0) {
    return Promise.reject(new TokenVerificationError('token is missing a subject'))
  }
  if (typeof decoded.aud !== 'string' || decoded.aud.length === 0) {
    return Promise.reject(new TokenVerificationError('token is missing an audience'))
  }
  if (typeof decoded.exp !== 'number') {
    return Promise.reject(new TokenVerificationError('token is missing an expiry'))
  }

  const scopes = parseScopes(decoded.scope)

  return Promise.resolve({
    subject: decoded.sub,
    scopes,
    audience: decoded.aud,
    expiresAt: decoded.exp * 1000,
    raw: token,
  })
}

/** Splits the OAuth space-delimited `scope` string, keeping only known scopes. */
function parseScopes(scope: unknown): readonly Scope[] {
  if (typeof scope !== 'string') {
    return []
  }
  return scope.split(' ').filter((value) => value.length > 0 && isScope(value)) as Scope[]
}
