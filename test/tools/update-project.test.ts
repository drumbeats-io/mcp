import { describe, expect, it } from 'vitest'
import type { ApiRequest } from '../../src/api/client'
import { DrumbeatsApiError } from '../../src/api/errors'
import { updateProject } from '../../src/tools/projects/update-project'
import { ctxWith, dataOf } from '../helpers'

describe('update_project', () => {
  it('PATCHes only the provided fields on the id service', async () => {
    const calls: ApiRequest[] = []
    const ctx = ctxWith(() => ({ project: { id: 'p1', name: 'New name' } }), calls)
    const result = await updateProject(ctx, { project_id: 'p1', name: 'New name' })
    expect(result.isError).toBeFalsy()
    expect(calls[0]?.method).toBe('PATCH')
    expect(calls[0]?.path).toBe('/v1/projects/p1')
    expect(calls[0]?.service).toBe('id')
    expect(calls[0]?.body).toEqual({ name: 'New name' })
  })

  it('forwards a null description to clear it', async () => {
    const calls: ApiRequest[] = []
    const ctx = ctxWith(() => ({ project: { id: 'p1' } }), calls)
    await updateProject(ctx, { project_id: 'p1', description: null })
    expect(calls[0]?.body).toEqual({ description: null })
  })

  it('url-encodes the project id in the path', async () => {
    const calls: ApiRequest[] = []
    const ctx = ctxWith(() => ({ project: { id: 'a/b' } }), calls)
    await updateProject(ctx, { project_id: 'a/b', name: 'x' })
    expect(calls[0]?.path).toBe('/v1/projects/a%2Fb')
  })

  it('rejects a missing project_id without calling the API', async () => {
    const calls: ApiRequest[] = []
    const result = await updateProject(
      ctxWith(() => ({}), calls),
      { name: 'x' }
    )
    expect(result.isError).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('rejects an empty patch without calling the API', async () => {
    const calls: ApiRequest[] = []
    const result = await updateProject(
      ctxWith(() => ({}), calls),
      { project_id: 'p1' }
    )
    expect(result.isError).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('returns a concise project view', async () => {
    const ctx = ctxWith(() => ({ project: { id: 'p1', name: 'Renamed', description: 'd' } }))
    const data = dataOf<{ project: { id: string; name: string } }>(
      await updateProject(ctx, { project_id: 'p1', name: 'Renamed' })
    )
    expect(data.project).toMatchObject({ id: 'p1', name: 'Renamed' })
  })

  it('maps API errors to a tool error', async () => {
    const ctx = ctxWith(() => {
      throw new DrumbeatsApiError(404, 'Not Found')
    })
    const result = await updateProject(ctx, { project_id: 'missing', name: 'x' })
    expect(result.isError).toBe(true)
  })
})
