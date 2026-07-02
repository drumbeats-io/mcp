import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AppConfig } from '../src/config'
import { createApp } from '../src/server-http'

const config: AppConfig = {
  nodeEnv: 'test',
  logLevel: 'info',
  port: 0,
  apiBaseUrl: 'https://api.drumbeats.io',
  serviceBaseUrls: {},
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

/**
 * The router is mounted at both `/` and `/mcp`, so the app answers whether the
 * reverse proxy strips the `/mcp` prefix (Coolify's default) or forwards it.
 */
describe('hosted routing is tolerant of both strip and no-strip proxying', () => {
  it('serves liveness at both /healthz and /mcp/healthz', async () => {
    for (const path of ['/healthz', '/mcp/healthz']) {
      const res = await fetch(`${base}${path}`)
      expect(res.status).toBe(200)
      expect((await res.json()).status).toBe('ok')
    }
  })

  it('serves protected-resource metadata at both root and /mcp', async () => {
    for (const path of ['/.well-known/oauth-protected-resource', '/mcp/.well-known/oauth-protected-resource']) {
      const res = await fetch(`${base}${path}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.resource).toBe('https://api.drumbeats.io/mcp')
      expect(body.authorization_servers).toEqual(['https://api.drumbeats.io/id'])
    }
  })

  it('serves the static server card in both proxy shapes', async () => {
    for (const path of ['/.well-known/mcp/server-card.json', '/server-card.json']) {
      const res = await fetch(`${base}${path}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.serverInfo.name).toBeTruthy()
      expect(body.serverInfo.version).toBeTruthy()
    }
  })

  it('serves the RFC 9728 canonical path-inserted metadata URL in both proxy shapes', async () => {
    // No-strip: the proxy forwards the full inserted path; strip: only the
    // resource path remains after the well-known prefix is removed.
    for (const path of ['/.well-known/oauth-protected-resource/mcp', '/mcp']) {
      const res = await fetch(`${base}${path}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.resource).toBe('https://api.drumbeats.io/mcp')
      expect(body.authorization_servers).toEqual(['https://api.drumbeats.io/id'])
    }
  })

  it('accepts POST at /, /mcp and /mcp/ (401 without a bearer proves the route exists)', async () => {
    for (const path of ['/', '/mcp', '/mcp/']) {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      expect(res.status).toBe(401)
    }
  })

  it('advertises the absolute external metadata URL in WWW-Authenticate (served under either mount)', async () => {
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
