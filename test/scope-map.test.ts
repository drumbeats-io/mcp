import { describe, expect, it } from 'vitest'
import { isScope, SCOPES, TOOLS_BY_SCOPE, toolsForScopes } from '../src/auth/scope-map'

const READ_TOOLS = [
  'list_projects',
  'list_monitors',
  'get_monitor',
  'get_monitor_history',
  'get_uptime_summary',
  'list_incidents',
  'check_http',
  'check_ssl',
  'check_dns',
]
const MONITOR_TOOLS = ['create_monitor', 'update_monitor', 'pause_monitor', 'resume_monitor', 'manage_incident']
const PROJECT_TOOLS = ['create_project', 'update_project']

describe('scope-map', () => {
  it('exposes the scope vocabulary', () => {
    expect([...SCOPES]).toEqual(['read', 'manage_monitors', 'manage_projects'])
  })

  it('recognizes known scopes and rejects unknown ones', () => {
    expect(isScope('read')).toBe(true)
    expect(isScope('manage_monitors')).toBe(true)
    expect(isScope('manage_projects')).toBe(true)
    expect(isScope('destroy')).toBe(false)
  })

  it('maps each scope to its exact tool names', () => {
    expect([...TOOLS_BY_SCOPE.read]).toEqual(READ_TOOLS)
    expect([...TOOLS_BY_SCOPE.manage_monitors]).toEqual(MONITOR_TOOLS)
    expect([...TOOLS_BY_SCOPE.manage_projects]).toEqual(PROJECT_TOOLS)
  })

  it('a read-only token exposes only read tools', () => {
    const tools = toolsForScopes(['read'])
    expect([...tools].sort()).toEqual([...READ_TOOLS].sort())
    for (const write of [...MONITOR_TOOLS, ...PROJECT_TOOLS]) {
      expect(tools.has(write)).toBe(false)
    }
  })

  it('manage_monitors adds only the monitor write tools', () => {
    const tools = toolsForScopes(['read', 'manage_monitors'])
    for (const name of [...READ_TOOLS, ...MONITOR_TOOLS]) {
      expect(tools.has(name)).toBe(true)
    }
    for (const name of PROJECT_TOOLS) {
      expect(tools.has(name)).toBe(false)
    }
    expect(tools.size).toBe(READ_TOOLS.length + MONITOR_TOOLS.length)
  })

  it('manage_projects adds only the project write tools', () => {
    const tools = toolsForScopes(['read', 'manage_projects'])
    for (const name of [...READ_TOOLS, ...PROJECT_TOOLS]) {
      expect(tools.has(name)).toBe(true)
    }
    for (const name of MONITOR_TOOLS) {
      expect(tools.has(name)).toBe(false)
    }
    expect(tools.size).toBe(READ_TOOLS.length + PROJECT_TOOLS.length)
  })

  it('all scopes together expose every tool', () => {
    const tools = toolsForScopes(['read', 'manage_monitors', 'manage_projects'])
    for (const name of [...READ_TOOLS, ...MONITOR_TOOLS, ...PROJECT_TOOLS]) {
      expect(tools.has(name)).toBe(true)
    }
    expect(tools.size).toBe(READ_TOOLS.length + MONITOR_TOOLS.length + PROJECT_TOOLS.length)
  })

  it('an empty scope set exposes no tools', () => {
    expect(toolsForScopes([]).size).toBe(0)
  })
})
