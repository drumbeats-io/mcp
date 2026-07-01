import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ApiClient, ApiRequest } from '../../src/api/client'
import { DrumbeatsApiError } from '../../src/api/errors'
import { listProjects, listProjectsInputShape } from '../../src/tools/context/list-projects'
import type { ToolContext } from '../../src/tools/types'

function ctxWith(handler: (req: ApiRequest) => unknown, calls?: ApiRequest[]): ToolContext {
  const api: ApiClient = {
    request: async <T>(req: ApiRequest): Promise<T> => {
      calls?.push(req)
      return handler(req) as T
    },
  }
  return { api }
}

function textOf(result: CallToolResult): string {
  const first = result.content[0]
  return first && first.type === 'text' ? first.text : ''
}

describe('list_projects input schema', () => {
  const schema = z.object(listProjectsInputShape)

  it('accepts empty input', () => {
    expect(schema.parse({})).toEqual({})
  })

  it('accepts channels and groups', () => {
    expect(schema.parse({ include: ['channels', 'groups'] }).include).toEqual(['channels', 'groups'])
  })

  it('rejects unknown include values', () => {
    expect(() => schema.parse({ include: ['bogus'] })).toThrow()
  })
})

describe('list_projects handler', () => {
  it('maps projects to a concise result and does not leak raw fields', async () => {
    const ctx = ctxWith((req) => {
      if (req.path === '/v1/projects') {
        return {
          projects: [
            {
              id: 'p1',
              name: 'Prod',
              description: 'main',
              plan: 'PRO',
              created_at: '2026-01-01T00:00:00.000Z',
              owner: { email: 'owner@example.com' },
              _count: { members: 3 },
              dodo_customer_id: 'should_not_leak',
            },
          ],
        }
      }
      throw new Error(`unexpected path ${req.path}`)
    })

    const result = await listProjects(ctx, {})
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(textOf(result)) as { projects: Array<Record<string, unknown>> }
    expect(data.projects).toHaveLength(1)
    expect(data.projects[0]).toMatchObject({
      id: 'p1',
      name: 'Prod',
      plan: 'PRO',
      member_count: 3,
      owner_email: 'owner@example.com',
    })
    expect(textOf(result)).not.toContain('dodo_customer_id')
  })

  it('folds channels and groups per project when include is set', async () => {
    const calls: ApiRequest[] = []
    const ctx = ctxWith((req) => {
      if (req.path === '/v1/projects') return { projects: [{ id: 'p1', name: 'Prod' }] }
      if (req.path === '/v1/notification-channels') {
        return [{ id: 'c1', name: 'Email', channel: 'EMAIL', enabled: true, is_default: true }]
      }
      if (req.path === '/v1/notification-groups') {
        return [{ id: 'g1', name: 'On-Call', description: null }]
      }
      throw new Error(`unexpected path ${req.path}`)
    }, calls)

    const result = await listProjects(ctx, { include: ['channels', 'groups'] })
    const data = JSON.parse(textOf(result)) as {
      projects: Array<{ notification_channels: unknown; notification_groups: unknown }>
    }

    expect(calls.find((c) => c.path === '/v1/notification-channels')?.query?.project_id).toBe('p1')
    expect(calls.find((c) => c.path === '/v1/notification-groups')?.query?.project_id).toBe('p1')
    // /v1/projects is on id; notification-channels/groups are on alerts.
    expect(calls.find((c) => c.path === '/v1/projects')?.service).toBe('id')
    expect(calls.find((c) => c.path === '/v1/notification-channels')?.service).toBe('alerts')
    expect(calls.find((c) => c.path === '/v1/notification-groups')?.service).toBe('alerts')
    expect(data.projects[0]?.notification_channels).toEqual([
      { id: 'c1', name: 'Email', type: 'EMAIL', enabled: true, is_default: true },
    ])
    expect(data.projects[0]?.notification_groups).toEqual([{ id: 'g1', name: 'On-Call', description: null }])
  })

  it('maps an API error to a clean, scoped tool error', async () => {
    const ctx = ctxWith(() => {
      throw new DrumbeatsApiError(403, 'Forbidden', { error: 'missing required scope' })
    })
    const result = await listProjects(ctx, {})
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('403')
    expect(textOf(result)).toContain('scope')
  })

  it('maps a timeout to a clean tool error', async () => {
    const ctx = ctxWith(() => {
      const err = new Error('aborted')
      err.name = 'TimeoutError'
      throw err
    })
    const result = await listProjects(ctx, {})
    expect(result.isError).toBe(true)
    expect(textOf(result).toLowerCase()).toContain('timed out')
  })
})
