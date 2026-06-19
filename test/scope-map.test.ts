import { describe, expect, it } from 'vitest'
import { isScope, SCOPES, toolsForScopes } from '../src/auth/scope-map'

describe('scope-map', () => {
  it('exposes the ADR-0015 scope vocabulary', () => {
    expect([...SCOPES]).toEqual(['read', 'manage_monitors'])
  })

  it('recognizes known scopes and rejects unknown ones', () => {
    expect(isScope('read')).toBe(true)
    expect(isScope('manage_monitors')).toBe(true)
    expect(isScope('destroy')).toBe(false)
  })

  it('returns an empty tool set until tools are registered', () => {
    expect(toolsForScopes(['read', 'manage_monitors']).size).toBe(0)
  })
})
