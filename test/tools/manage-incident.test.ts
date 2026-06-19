import { describe, expect, it } from 'vitest'
import type { ApiRequest } from '../../src/api/client'
import { manageIncident } from '../../src/tools/incidents/manage-incident'
import { ctxWith, dataOf } from '../helpers'

describe('manage_incident', () => {
  it('defaults to get (reads the incident)', async () => {
    const calls: ApiRequest[] = []
    const data = dataOf<{ action: string; incident: { id: string } }>(
      await manageIncident(
        ctxWith(() => ({ incident: { id: 'i1', status: 'OPEN' } }), calls),
        { incident_id: 'i1' }
      )
    )
    expect(calls[0]?.method ?? 'GET').toBe('GET')
    expect(calls[0]?.path).toBe('/v1/incidents/i1')
    expect(data.action).toBe('get')
    expect(data.incident.id).toBe('i1')
  })

  it('acknowledge POSTs to the acknowledge endpoint', async () => {
    const calls: ApiRequest[] = []
    await manageIncident(
      ctxWith(() => ({ incident: { id: 'i1', status: 'ACKNOWLEDGED' } }), calls),
      {
        incident_id: 'i1',
        action: 'acknowledge',
      }
    )
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe('/v1/incidents/i1/acknowledge')
  })

  it('resolve POSTs to the resolve endpoint', async () => {
    const calls: ApiRequest[] = []
    await manageIncident(
      ctxWith(() => ({ incident: { id: 'i1', status: 'RESOLVED' } }), calls),
      {
        incident_id: 'i1',
        action: 'resolve',
      }
    )
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe('/v1/incidents/i1/resolve')
  })
})
