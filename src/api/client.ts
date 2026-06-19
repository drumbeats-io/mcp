import { DrumbeatsApiError } from './errors.js'

/** How the REST client authenticates each request. */
export type ApiAuth =
  | { readonly kind: 'apiKey'; readonly apiKey: string }
  | { readonly kind: 'bearer'; readonly token: string }

export interface DrumbeatsApiClientOptions {
  readonly baseUrl: string
  readonly auth: ApiAuth
  /** Override the fetch implementation (used in tests). Defaults to global fetch. */
  readonly fetchImpl?: typeof fetch
}

export interface ApiRequest {
  readonly method?: string
  readonly path: string
  readonly query?: Record<string, string | number | boolean | undefined>
  readonly body?: unknown
  readonly signal?: AbortSignal
}

/**
 * Thin wrapper around the Drumbeats REST API, shared by both transports.
 *
 * Its only transport-specific knowledge is the auth header: `X-API-Key` for the
 * stdio account-key path, `Authorization: Bearer` for the hosted OAuth path.
 * Non-2xx responses are normalized into {@link DrumbeatsApiError}.
 *
 * Scaffold stub: exposes a generic `request` only — per-endpoint helpers arrive
 * with the tools.
 */
export class DrumbeatsApiClient {
  private readonly baseUrl: string
  private readonly auth: ApiAuth
  private readonly fetchImpl: typeof fetch

  constructor(options: DrumbeatsApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.auth = options.auth
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
  }

  private authHeaders(): Record<string, string> {
    return this.auth.kind === 'apiKey'
      ? { 'X-API-Key': this.auth.apiKey }
      : { Authorization: `Bearer ${this.auth.token}` }
  }

  /** Performs an authenticated JSON request, returning the parsed body. */
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

    const response = await this.fetchImpl(url, {
      method: req.method ?? 'GET',
      headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      signal: req.signal,
    })

    const text = await response.text()
    const payload: unknown = text.length > 0 ? JSON.parse(text) : undefined

    if (!response.ok) {
      throw new DrumbeatsApiError(response.status, response.statusText, payload)
    }

    return payload as T
  }
}
