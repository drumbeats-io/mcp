import { describe, expect, it } from 'vitest'
import { DrumbeatsApiClient } from '../../src/api/client'

const APEX = 'https://api.drumbeats.io'

/** A fake fetch that records the resolved URL and returns an empty 200. */
function recordingFetch(): { fetchImpl: typeof fetch; urls: string[] } {
  const urls: string[] = []
  const fetchImpl = (async (input: string | URL) => {
    urls.push(input.toString())
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
  return { fetchImpl, urls }
}

function clientWith(fetchImpl: typeof fetch, serviceBaseUrls?: Record<string, string>) {
  return new DrumbeatsApiClient({
    baseUrl: APEX,
    serviceBaseUrls,
    auth: { kind: 'bearer', token: 't' },
    fetchImpl,
  })
}

describe('DrumbeatsApiClient per-service routing', () => {
  it('defaults to the beats prefix when no service is given', async () => {
    const { fetchImpl, urls } = recordingFetch()
    await clientWith(fetchImpl).request({ path: '/v1/monitors' })
    expect(urls[0]).toBe('https://api.drumbeats.io/beats/v1/monitors')
  })

  it('routes the bare project list to id', async () => {
    const { fetchImpl, urls } = recordingFetch()
    await clientWith(fetchImpl).request({ service: 'id', path: '/v1/projects' })
    expect(urls[0]).toBe('https://api.drumbeats.io/id/v1/projects')
  })

  it('routes notification channels/groups to alerts', async () => {
    const { fetchImpl, urls } = recordingFetch()
    const client = clientWith(fetchImpl)
    await client.request({ service: 'alerts', path: '/v1/notification-channels' })
    await client.request({ service: 'alerts', path: '/v1/notification-groups' })
    expect(urls).toEqual([
      'https://api.drumbeats.io/alerts/v1/notification-channels',
      'https://api.drumbeats.io/alerts/v1/notification-groups',
    ])
  })

  it('routes the uptime-summary to beats even though its path is under /v1/projects', async () => {
    const { fetchImpl, urls } = recordingFetch()
    await clientWith(fetchImpl).request({ service: 'beats', path: '/v1/projects/p1/uptime-summary' })
    expect(urls[0]).toBe('https://api.drumbeats.io/beats/v1/projects/p1/uptime-summary')
  })

  it('appends query params after the resolved service URL', async () => {
    const { fetchImpl, urls } = recordingFetch()
    await clientWith(fetchImpl).request({
      service: 'alerts',
      path: '/v1/notification-channels',
      query: { project_id: 'p1' },
    })
    expect(urls[0]).toBe('https://api.drumbeats.io/alerts/v1/notification-channels?project_id=p1')
  })

  it('honors a per-service base override (self-host) over the apex+prefix default', async () => {
    const { fetchImpl, urls } = recordingFetch()
    const client = clientWith(fetchImpl, { id: 'https://id.internal.example' })
    await client.request({ service: 'id', path: '/v1/projects' })
    await client.request({ service: 'beats', path: '/v1/monitors' })
    expect(urls[0]).toBe('https://id.internal.example/v1/projects')
    // beats has no override → still apex + prefix.
    expect(urls[1]).toBe('https://api.drumbeats.io/beats/v1/monitors')
  })
})
