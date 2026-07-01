import { z } from 'zod'
import type { Service } from './api/client.js'

const DEFAULT_API_BASE_URL = 'https://api.drumbeats.io'
const DEFAULT_PORT = 3000
const DEFAULT_TIMEOUT_MS = 15_000

const urlString = z.string().refine((value) => URL.canParse(value), { message: 'must be a valid URL' })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  // The apex REST URL. The Drumbeats API is split across services by path
  // prefix (`/id`, `/beats`, `/alerts`) with no unified `/v1` gateway; the
  // client appends the per-service prefix to this apex for each request.
  DRUMBEATS_API_BASE_URL: urlString.default(DEFAULT_API_BASE_URL),
  DRUMBEATS_API_TIMEOUT_MS: z.coerce.number().int().positive().default(DEFAULT_TIMEOUT_MS),
  // Optional per-service base overrides for self-hosting (each a full origin).
  // When unset, the client uses `${DRUMBEATS_API_BASE_URL}${servicePrefix}`.
  DRUMBEATS_ID_BASE_URL: urlString.optional(),
  DRUMBEATS_BEATS_BASE_URL: urlString.optional(),
  DRUMBEATS_ALERTS_BASE_URL: urlString.optional(),
  // stdio transport: an account-scoped Drumbeats API key (dk_…).
  DRUMBEATS_API_KEY: z.string().min(1).optional(),
  // hosted transport: OAuth 2.1 resource-server identifiers, see src/auth.
  MCP_RESOURCE_URL: urlString.optional(),
  MCP_AUTH_SERVER: urlString.optional(),
  // hosted transport: HS256 secret shared with the id service to verify bearer tokens.
  JWT_SECRET: z.string().min(1).optional(),
})

export interface AppConfig {
  readonly nodeEnv: 'development' | 'production' | 'test'
  readonly logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'
  readonly port: number
  /** The apex REST URL; per-service prefixes are appended by the API client. */
  readonly apiBaseUrl: string
  /** Optional per-service base overrides (self-hosting); empty in the default deploy. */
  readonly serviceBaseUrls: Partial<Record<Service, string>>
  readonly requestTimeoutMs: number
  /** Present only for the stdio transport. */
  readonly apiKey?: string
  /** Present only for the hosted transport (canonical MCP resource URL). */
  readonly resourceUrl?: string
  /** Present only for the hosted transport (authorization server base URL). */
  readonly authServer?: string
  /** Present only for the hosted transport (HS256 secret shared with the id service). */
  readonly jwtSecret?: string
}

/**
 * Parses and validates process environment into a typed, immutable config.
 *
 * The hosted triad `{ resourceUrl, authServer, jwtSecret }` is all-or-nothing:
 * a half-configured hosted app must fail fast at boot rather than per-request.
 * stdio mode (none set) stays valid.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env)

  const hosted = [parsed.MCP_RESOURCE_URL, parsed.MCP_AUTH_SERVER, parsed.JWT_SECRET]
  const setCount = hosted.filter((value) => value !== undefined).length
  if (setCount > 0 && setCount < hosted.length) {
    throw new Error(
      'Incomplete hosted transport config: MCP_RESOURCE_URL, MCP_AUTH_SERVER and JWT_SECRET must all be set together (or all be unset for stdio mode).'
    )
  }

  const serviceBaseUrls: Partial<Record<Service, string>> = {}
  if (parsed.DRUMBEATS_ID_BASE_URL !== undefined) {
    serviceBaseUrls.id = parsed.DRUMBEATS_ID_BASE_URL
  }
  if (parsed.DRUMBEATS_BEATS_BASE_URL !== undefined) {
    serviceBaseUrls.beats = parsed.DRUMBEATS_BEATS_BASE_URL
  }
  if (parsed.DRUMBEATS_ALERTS_BASE_URL !== undefined) {
    serviceBaseUrls.alerts = parsed.DRUMBEATS_ALERTS_BASE_URL
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    logLevel: parsed.LOG_LEVEL,
    port: parsed.PORT,
    apiBaseUrl: parsed.DRUMBEATS_API_BASE_URL,
    serviceBaseUrls,
    requestTimeoutMs: parsed.DRUMBEATS_API_TIMEOUT_MS,
    apiKey: parsed.DRUMBEATS_API_KEY,
    resourceUrl: parsed.MCP_RESOURCE_URL,
    authServer: parsed.MCP_AUTH_SERVER,
    jwtSecret: parsed.JWT_SECRET,
  }
}
