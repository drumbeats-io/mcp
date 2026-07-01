import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AppConfig } from '../src/config'
import { createApp } from '../src/server-http'

const config: AppConfig = {
  nodeEnv: 'test',
  logLevel: 'info',
  port: 0,
  apiBaseUrl: 'https://api.drumbeats.io/beats',
  requestTimeoutMs: 15_000,
  resourceUrl: 'https://api.drumbeats.io/mcp',
  authServer: 'https://api.drumbeats.io/id',
  jwtSecret: 'a-shared-secret-at-least-thirty-two-chars',
}

let server: Server
let base: string

beforeAll(async () => {
  const app = createApp(config)
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo
      base = `http://127.0.0.1:${port}`
      resolve()
    })
  })
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe('hosted routing under the /mcp base path (Traefik forwards the prefix un-stripped)', () => {
  it('serves liveness at root /healthz for the container HEALTHCHECK', async () => {
    const res = await fetch(`${base}/healthz`)
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('ok')
  })

  it('also serves liveness at the prefixed /mcp/healthz for a proxy check', async () => {
    const res = await fetch(`${base}/mcp/healthz`)
    expect(res.status).toBe(200)
  })

  it('serves protected-resource metadata under /mcp so the advertised URL resolves', async () => {
    const res = await fetch(`${base}/mcp/.well-known/oauth-protected-resource`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.resource).toBe('https://api.drumbeats.io/mcp')
    expect(body.authorization_servers).toEqual(['https://api.drumbeats.io/id'])
  })

  it('does NOT serve metadata at the un-prefixed root path', async () => {
    const res = await fetch(`${base}/.well-known/oauth-protected-resource`)
    expect(res.status).toBe(404)
  })

  it('accepts POST at both /mcp and /mcp/ (trailing-slash robustness)', async () => {
    for (const path of ['/mcp', '/mcp/']) {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      // No bearer → 401 (proves the route exists; a 404 would mean it is unmounted).
      expect(res.status).toBe(401)
    }
  })

  it('advertises the /mcp-prefixed metadata URL in WWW-Authenticate (advertised == served)', async () => {
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toBe(
      'Bearer resource_metadata="https://api.drumbeats.io/mcp/.well-known/oauth-protected-resource"'
    )
  })
})
