import { DrumbeatsApiError } from './errors.js'

/** How the REST client authenticates each request. */
export type ApiAuth =
  | { readonly kind: 'apiKey'; readonly apiKey: string }
  | { readonly kind: 'bearer'; readonly token: string }

/**
 * The Drumbeats REST API is split across three services by path prefix — there
 * is no unified `/v1` gateway. Each request must name its target service; the
 * client resolves `${base}${servicePrefix[service]}${path}`.
 */
export type Service = 'id' | 'beats' | 'alerts'

/** Default apex-relative prefix per service. */
export const DEFAULT_SERVICE_PREFIX: Readonly<Record<Service, string>> = {
  id: '/id',
  beats: '/beats',
  alerts: '/alerts',
}

export interface ApiRequest {
  readonly method?: string
  readonly path: string
  /** Which Drumbeats service owns this route. Defaults to `beats`. */
  readonly service?: Service
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
  /** The apex REST URL, e.g. https://api.drumbeats.io (service prefix is appended). */
  readonly baseUrl: string
  readonly auth: ApiAuth
  /**
   * Optional per-service base overrides for self-hosting (each may point at a
   * fully independent host). When a service is absent here, the client falls
   * back to `${baseUrl}${DEFAULT_SERVICE_PREFIX[service]}`.
   */
  readonly serviceBaseUrls?: Partial<Record<Service, string>>
  /** Per-request timeout in milliseconds. Defaults to 15s. */
  readonly requestTimeoutMs?: number
  /** Override fetch (used in tests). Defaults to the global fetch. */
  readonly fetchImpl?: typeof fetch
}

const DEFAULT_TIMEOUT_MS = 15_000

/**
 * Thin REST client for the Drumbeats API, shared by both transports. It routes
 * each request to its named service (apex + prefix, or a per-service override),
 * injects the auth header (X-API-Key for stdio account keys, Bearer for hosted
 * OAuth), applies a timeout, parses JSON, and normalizes non-2xx into
 * DrumbeatsApiError.
 */
export class DrumbeatsApiClient implements ApiClient {
  private readonly baseUrl: string
  private readonly serviceBaseUrls: Partial<Record<Service, string>>
  private readonly auth: ApiAuth
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(options: DrumbeatsApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.serviceBaseUrls = options.serviceBaseUrls ?? {}
    this.auth = options.auth
    this.timeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
  }

  /** Resolves the absolute origin+prefix for a service, honoring overrides. */
  private serviceBase(service: Service): string {
    const override = this.serviceBaseUrls[service]
    if (override !== undefined) {
      return override.replace(/\/+$/, '')
    }
    return `${this.baseUrl}${DEFAULT_SERVICE_PREFIX[service]}`
  }

  private authHeaders(): Record<string, string> {
    return this.auth.kind === 'apiKey'
      ? { 'X-API-Key': this.auth.apiKey }
      : { Authorization: `Bearer ${this.auth.token}` }
  }

  async request<T = unknown>(req: ApiRequest): Promise<T> {
    const service = req.service ?? 'beats'
    const url = new URL(`${this.serviceBase(service)}${req.path}`)
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
