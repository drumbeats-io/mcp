#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { DrumbeatsApiClient } from './api/client.js'
import { loadConfig } from './config.js'
import { registerTools } from './tools/index.js'
import type { ToolContext } from './tools/types.js'
import { SERVER_INSTRUCTIONS, SERVER_NAME, SERVER_VERSION } from './version.js'

/**
 * Local fallback entrypoint: stdio transport authenticated with a Drumbeats
 * account API key (dk_…) from DRUMBEATS_API_KEY. Same shared tool layer as the
 * hosted server — the only difference is how the API client is authenticated.
 */
async function main(): Promise<void> {
  const config = loadConfig()
  if (config.apiKey === undefined) {
    process.stderr.write('DRUMBEATS_API_KEY is required for the stdio transport.\n')
    process.exit(1)
  }

  const ctx: ToolContext = {
    api: new DrumbeatsApiClient({
      baseUrl: config.apiBaseUrl,
      serviceBaseUrls: config.serviceBaseUrls,
      auth: { kind: 'apiKey', apiKey: config.apiKey },
      requestTimeoutMs: config.requestTimeoutMs,
    }),
  }

  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions: SERVER_INSTRUCTIONS })
  registerTools(server, ctx)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error: unknown) => {
  process.stderr.write(`fatal: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
