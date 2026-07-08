import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it } from 'vitest'
import type { ApiClient, ApiRequest } from '../../src/api/client'
import { registerTools } from '../../src/tools/index'
import type { ToolContext } from '../../src/tools/types'

// Wire-level smoke test: connects a real MCP Client to a real McpServer over an
// in-memory transport (no network, no API key — the SDK's own request/response
// machinery, not a reimplementation of it). Proves two things every other test
// in this repo can only prove indirectly:
//  1. tools/list actually serializes an outputSchema (as JSON Schema) for every
//     tool — a raw-shape/union construction mistake that breaks JSON Schema
//     generation would show up here even if the shape parses fine standalone.
//  2. The SDK's own validateToolOutput (server/mcp.js) accepts the
//     structuredContent our handlers return — including get_monitor_history's
//     union-typed `data`, the one tool where a naive discriminated union would
//     have crashed this exact call (see get-monitor-history.ts's comment).
function stubCtx(handler: (req: ApiRequest) => unknown): ToolContext {
  const api: ApiClient = { request: async <T>(req: ApiRequest): Promise<T> => handler(req) as T }
  return { api }
}

async function connectedClient(ctx: ToolContext): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = new McpServer({ name: 'test', version: '0.0.0' })
  registerTools(server, ctx)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'drumbeats-mcp-wire-test', version: '0.0.0' })
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)])
  return { client, close: async () => client.close() }
}

describe('output schema wire format (in-memory MCP protocol)', () => {
  it('tools/list reports an outputSchema for all sixteen tools', async () => {
    const { client, close } = await connectedClient(stubCtx(() => ({})))
    try {
      const { tools } = await client.listTools()
      expect(tools).toHaveLength(16)
      for (const tool of tools) {
        expect(tool.outputSchema, `${tool.name} is missing outputSchema on the wire`).toBeDefined()
      }
    } finally {
      await close()
    }
  })

  it('a plain jsonResult tool (check_dns) round-trips structuredContent through real SDK validation', async () => {
    const { client, close } = await connectedClient(
      stubCtx(() => ({
        ok: true,
        hostname_checked: 'example.com',
        records: { A: ['203.0.113.10'], AAAA: [], CNAME: [], MX: [], NS: [] },
        resolution_errors: {},
        all_failed: false,
        checked_at: '2026-01-26T02:00:00.000Z',
        check_region: 'us-east',
      }))
    )
    try {
      const result = await client.callTool({ name: 'check_dns', arguments: { hostname: 'example.com' } })
      expect(result.isError ?? false).toBe(false)
      expect(result.structuredContent).toMatchObject({ ok: true, hostname_checked: 'example.com' })
    } finally {
      await close()
    }
  })

  it('the union-typed tool (get_monitor_history) round-trips structuredContent through real SDK validation', async () => {
    const { client, close } = await connectedClient(
      stubCtx(() => ({
        avg_ms: 120,
        min_ms: 80,
        max_ms: 300,
        p95_ms: 250,
        total_checks: 100,
        up_count: 99,
        down_count: 1,
        uptime_percentage: 99,
      }))
    )
    try {
      const result = await client.callTool({
        name: 'get_monitor_history',
        arguments: { monitor_id: 'm1', kind: 'response_times' },
      })
      expect(result.isError ?? false).toBe(false)
      expect(result.structuredContent).toMatchObject({ monitor_id: 'm1', kind: 'response_times' })
    } finally {
      await close()
    }
  })
})
