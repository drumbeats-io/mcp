import { z } from 'zod'

const DEFAULT_API_BASE_URL = 'https://api.drumbeats.io'
const DEFAULT_PORT = 3000
const DEFAULT_TIMEOUT_MS = 15_000

const urlString = z.string().refine((value) => URL.canParse(value), { message: 'must be a valid URL' })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  DRUMBEATS_API_BASE_URL: urlString.default(DEFAULT_API_BASE_URL),
  DRUMBEATS_API_TIMEOUT_MS: z.coerce.number().int().positive().default(DEFAULT_TIMEOUT_MS),
  // stdio transport: an account-scoped Drumbeats API key (dk_…), see ADR-0015.
  DRUMBEATS_API_KEY: z.string().min(1).optional(),
  // hosted transport: OAuth 2.1 resource-server identifiers, see src/auth.
  MCP_RESOURCE_URL: urlString.optional(),
  MCP_AUTH_SERVER: urlString.optional(),
})

export interface AppConfig {
  readonly nodeEnv: 'development' | 'production' | 'test'
  readonly logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'
  readonly port: number
  readonly apiBaseUrl: string
  readonly requestTimeoutMs: number
  /** Present only for the stdio transport. */
  readonly apiKey?: string
  /** Present only for the hosted transport (canonical MCP resource URL). */
  readonly resourceUrl?: string
  /** Present only for the hosted transport (authorization server base URL). */
  readonly authServer?: string
}

/** Parses and validates process environment into a typed, immutable config. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env)
  return {
    nodeEnv: parsed.NODE_ENV,
    logLevel: parsed.LOG_LEVEL,
    port: parsed.PORT,
    apiBaseUrl: parsed.DRUMBEATS_API_BASE_URL,
    requestTimeoutMs: parsed.DRUMBEATS_API_TIMEOUT_MS,
    apiKey: parsed.DRUMBEATS_API_KEY,
    resourceUrl: parsed.MCP_RESOURCE_URL,
    authServer: parsed.MCP_AUTH_SERVER,
  }
}
