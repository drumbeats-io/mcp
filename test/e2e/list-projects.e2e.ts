import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { describe, expect, it } from 'vitest'

// Smoke test against the real API over the built stdio server.
// Requires a real account key; SKIPS when DRUMBEATS_API_KEY is unset so CI
// without secrets stays green. Run `npm run build` first (spawns dist/stdio.js).
const apiKey = process.env.DRUMBEATS_API_KEY
const suite = apiKey ? describe : describe.skip

suite('list_projects e2e (stdio)', () => {
  it('lists tools and returns a projects array over stdio', async () => {
    const serverPath = fileURLToPath(new URL('../../dist/stdio.js', import.meta.url))
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
      env: {
        PATH: process.env.PATH ?? '',
        DRUMBEATS_API_KEY: apiKey ?? '',
        DRUMBEATS_API_BASE_URL: process.env.DRUMBEATS_API_BASE_URL ?? 'https://api.drumbeats.io',
      },
    })

    const client = new Client({ name: 'drumbeats-mcp-e2e', version: '0.0.0' })
    await client.connect(transport)
    try {
      const { tools } = await client.listTools()
      expect(tools.map((tool) => tool.name)).toContain('list_projects')

      const result = await client.callTool({ name: 'list_projects', arguments: {} })
      expect(result.isError ?? false).toBe(false)

      const content = result.content as Array<{ type: string; text?: string }>
      const text = content.find((block) => block.type === 'text')?.text ?? ''
      const parsed = JSON.parse(text) as { projects: unknown }
      expect(Array.isArray(parsed.projects)).toBe(true)
    } finally {
      await client.close()
    }
  }, 30_000)
})
