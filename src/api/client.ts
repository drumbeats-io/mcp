import { DrumbeatsApiError } from './errors.js'

/** How the REST client authenticates each request. */
export type ApiAuth =
  | { readonly kind: 'apiKey'; readonly apiKey: string }
  | { readonly kind: 'bearer'; readonly token: string }

export interface ApiRequest {
  readonly method?: string
  readonly path: string
  readonly query?: Record<string, string | number | boolean | undefined>
  readonly body?: unknown
  /** Optional caller signal, combined with the client's timeout. */
  readonly signal?: AbortSignal
}

/**
 * Abstraction the tool layer depends on. Tools only ever touch this — never the
 * concrete client or the transport — which keeps handlers testable without a
 * network and transport-agnostic.
 */
export interface ApiClient {
  request<T = unknown>(req: ApiRequest): Promise<T>
}

export interface DrumbeatsApiClientOptions {
  readonly baseUrl: string
  readonly auth: ApiAuth
  /** Per-request timeout in milliseconds. Defaults to 15s. */
  readonly requestTimeoutMs?: number
  /** Override fetch (used in tests). Defaults to the global fetch. */
  readonly fetchImpl?: typeof fetch
}

const DEFAULT_TIMEOUT_MS = 15_000

/**
 * Thin REST client for the Drumbeats API, shared by both transports. It injects
 * the auth header (X-API-Key for stdio account keys, Bearer for hosted OAuth),
 * applies a timeout, parses JSON, and normalizes non-2xx into DrumbeatsApiError.
 */
export class DrumbeatsApiClient implements ApiClient {
  private readonly baseUrl: string
  private readonly auth: ApiAuth
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(options: DrumbeatsApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.auth = options.auth
    this.timeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
  }

  private authHeaders(): Record<string, string> {
    return this.auth.kind === 'apiKey'
      ? { 'X-API-Key': this.auth.apiKey }
      : { Authorization: `Bearer ${this.auth.token}` }
  }

  async request<T = unknown>(req: ApiRequest): Promise<T> {
    const url = new URL(`${this.baseUrl}${req.path}`)
    for (const [key, value] of Object.entries(req.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }

    const headers: Record<string, string> = { Accept: 'application/json', ...this.authHeaders() }
    if (req.body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }

    const timeoutSignal = AbortSignal.timeout(this.timeoutMs)
    const signal = req.signal ? AbortSignal.any([req.signal, timeoutSignal]) : timeoutSignal

    const response = await this.fetchImpl(url, {
      method: req.method ?? 'GET',
      headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      signal,
    })

    const text = await response.text()
    let payload: unknown
    try {
      payload = text.length > 0 ? JSON.parse(text) : undefined
    } catch {
      payload = text
    }

    if (!response.ok) {
      throw new DrumbeatsApiError(response.status, response.statusText, payload)
    }

    return payload as T
  }
}
