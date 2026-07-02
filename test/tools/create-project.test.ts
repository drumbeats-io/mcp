import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ApiRequest } from '../../src/api/client'
import { DrumbeatsApiError } from '../../src/api/errors'
import { createProject, createProjectInputShape } from '../../src/tools/projects/create-project'
import { ctxWith, dataOf, textOf } from '../helpers'

function ctxOk(calls: ApiRequest[]) {
  return ctxWith((req) => {
    if (req.method === 'POST' && req.path === '/v1/projects') {
      return { project: { id: 'p1', ...(req.body as Record<string, unknown>) } }
    }
    throw new Error(`unexpected ${req.method ?? 'GET'} ${req.path}`)
  }, calls)
}

describe('create_project input schema', () => {
  const schema = z.object(createProjectInputShape)

  it('accepts a name only', () => {
    expect(schema.parse({ name: 'Prod' })).toEqual({ name: 'Prod' })
  })

  it('accepts name + description', () => {
    expect(schema.parse({ name: 'Prod', description: 'main' }).description).toBe('main')
  })

  it('rejects a missing name', () => {
    expect(() => schema.parse({ description: 'x' })).toThrow()
  })
})

describe('create_project handler', () => {
  it('POSTs to /v1/projects on the id service', async () => {
    const calls: ApiRequest[] = []
    const result = await createProject(ctxOk(calls), { name: 'Prod', description: 'main' })
    expect(result.isError).toBeFalsy()
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe('/v1/projects')
    expect(calls[0]?.service).toBe('id')
    expect(calls[0]?.body).toEqual({ name: 'Prod', description: 'main' })
  })

  it('rejects an empty name before calling the API', async () => {
    const calls: ApiRequest[] = []
    const result = await createProject(ctxOk(calls), { name: '' })
    expect(result.isError).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('rejects unknown fields before calling the API', async () => {
    const calls: ApiRequest[] = []
    const result = await createProject(ctxOk(calls), { name: 'Prod', plan: 'PRO' })
    expect(result.isError).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('returns a concise project view', async () => {
    const data = dataOf<{ project: { id: string; name: string } }>(await createProject(ctxOk([]), { name: 'Prod' }))
    expect(data.project).toMatchObject({ id: 'p1', name: 'Prod' })
  })

  it('surfaces a plan-limit 403 as an upgrade prompt, not a scope error', async () => {
    const ctx = ctxWith(() => {
      throw new DrumbeatsApiError(403, 'Forbidden', {
        status: 'error',
        message: 'Your FREE tier is limited to 3 projects. Upgrade to create more.',
      })
    })
    const result = await createProject(ctx, { name: 'Prod' })
    expect(result.isError).toBe(true)
    expect(textOf(result).toLowerCase()).toContain('plan limit')
    expect(textOf(result)).toContain('drumbeats.io/pricing')
  })

  it('maps an insufficient-scope 403 to a clean tool error', async () => {
    const ctx = ctxWith(() => {
      throw new DrumbeatsApiError(403, 'Forbidden', {
        status: 'error',
        message: "This API key lacks the 'manage_projects' scope required for this operation",
        code: 'INSUFFICIENT_API_KEY_SCOPE',
      })
    })
    const result = await createProject(ctx, { name: 'Prod' })
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('scope')
  })
})
