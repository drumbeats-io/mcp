import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it } from 'vitest'
import type { ZodTypeAny } from 'zod'
import type { ApiClient, ApiRequest } from '../src/api/client'
import { registerTools } from '../src/tools/index'
import type { ToolContext } from '../src/tools/types'

type RawShape = Record<string, ZodTypeAny>

interface CapturedTool {
  name: string
  title?: string
  description?: string
  inputSchema?: RawShape
  outputSchema?: RawShape
}

/**
 * A stub MCP server that records the full config object passed to
 * registerTool for every tool — not just the name (see register-tools.test.ts
 * for the name-only variant used by the scope-gating tests). This exercises
 * the real registration path, so it catches a tool that defines an
 * xOutputShape constant but forgets to actually wire it into registerTool.
 */
function recordingServer(): { server: McpServer; tools: CapturedTool[] } {
  const tools: CapturedTool[] = []
  const server = {
    registerTool(name: string, config: Omit<CapturedTool, 'name'>) {
      tools.push({ name, ...config })
    },
  } as unknown as McpServer
  return { server, tools }
}

const ctx: ToolContext = {
  api: { request: async <T>(_req: ApiRequest): Promise<T> => undefined as T } as ApiClient,
}

function fieldsMissingDescription(shape: RawShape | undefined): string[] {
  if (!shape) return []
  return Object.entries(shape)
    .filter(([, schema]) => !schema.description || schema.description.trim().length === 0)
    .map(([key]) => key)
}

describe('every registered tool declares an outputSchema', () => {
  const { server, tools } = recordingServer()
  registerTools(server, ctx)

  it('registered all sixteen tools', () => {
    expect(tools).toHaveLength(16)
  })

  it.each(tools.map((tool) => [tool.name, tool] as const))('%s has a non-empty outputSchema', (_name, tool) => {
    expect(tool.outputSchema).toBeDefined()
    expect(Object.keys(tool.outputSchema ?? {}).length).toBeGreaterThan(0)
  })
})

describe('every input parameter is described', () => {
  const { server, tools } = recordingServer()
  registerTools(server, ctx)

  it.each(tools.map((tool) => [tool.name, tool] as const))('%s has no undescribed input fields', (_name, tool) => {
    expect(fieldsMissingDescription(tool.inputSchema)).toEqual([])
  })
})
