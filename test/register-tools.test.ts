import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it } from 'vitest'
import type { ApiClient, ApiRequest } from '../src/api/client'
import { toolsForScopes } from '../src/auth/scope-map'
import { registerTools } from '../src/tools/index'
import type { ToolContext } from '../src/tools/types'

/** A stub MCP server that records every registered tool name. */
function recordingServer(): { server: McpServer; names: string[] } {
  const names: string[] = []
  const server = {
    registerTool(name: string) {
      names.push(name)
    },
  } as unknown as McpServer
  return { server, names }
}

const ctx: ToolContext = {
  api: { request: async <T>(_req: ApiRequest): Promise<T> => undefined as T } as ApiClient,
}

const ALL_TOOLS = [
  'list_projects',
  'create_monitor',
  'list_monitors',
  'get_monitor',
  'update_monitor',
  'pause_monitor',
  'resume_monitor',
  'get_monitor_history',
  'get_uptime_summary',
  'list_incidents',
  'manage_incident',
  'check_http',
  'check_ssl',
  'check_dns',
]

describe('registerTools scope-gating', () => {
  it('registers every tool when no allow-set is given (stdio path)', () => {
    const { server, names } = recordingServer()
    registerTools(server, ctx)
    expect(names.sort()).toEqual([...ALL_TOOLS].sort())
  })

  it('a read-only token exposes only read tools', () => {
    const { server, names } = recordingServer()
    registerTools(server, ctx, toolsForScopes(['read']))
    expect(names.sort()).toEqual(
      [
        'list_projects',
        'list_monitors',
        'get_monitor',
        'get_monitor_history',
        'get_uptime_summary',
        'list_incidents',
        'check_http',
        'check_ssl',
        'check_dns',
      ].sort()
    )
    expect(names).not.toContain('create_monitor')
    expect(names).not.toContain('manage_incident')
  })

  it('a manage token adds the write tools', () => {
    const { server, names } = recordingServer()
    registerTools(server, ctx, toolsForScopes(['read', 'manage_monitors']))
    expect(names.sort()).toEqual([...ALL_TOOLS].sort())
    expect(names).toContain('create_monitor')
    expect(names).toContain('manage_incident')
  })

  it('an empty allow-set registers nothing', () => {
    const { server, names } = recordingServer()
    registerTools(server, ctx, new Set())
    expect(names).toEqual([])
  })
})
