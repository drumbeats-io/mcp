import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express, { type Request, type Response } from 'express'
import { DrumbeatsApiClient } from './api/client.js'
import { buildProtectedResourceMetadata, PROTECTED_RESOURCE_METADATA_PATH } from './auth/resource-metadata.js'
import { TokenVerificationError, verifyBearerToken } from './auth/verify-token.js'
import { loadConfig } from './config.js'
import { registerTools } from './tools/index.js'
import type { ToolContext } from './tools/types.js'
import { SERVER_NAME, SERVER_VERSION } from './version.js'

const config = loadConfig()

const app = express()
app.use(express.json())

// Liveness probe for Coolify on its own unprefixed path (build-plan §3.5).
app.get('/healthz', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: SERVER_NAME, version: SERVER_VERSION })
})

// RFC 9728 discovery document, pointing clients at the authorization server.
app.get(PROTECTED_RESOURCE_METADATA_PATH, (_req: Request, res: Response) => {
  if (config.resourceUrl === undefined || config.authServer === undefined) {
    res.status(501).json({ error: 'hosted OAuth metadata is not configured' })
    return
  }
  res.json(buildProtectedResourceMetadata({ resourceUrl: config.resourceUrl, authServerUrl: config.authServer }))
})

function bearerFrom(req: Request): string | undefined {
  const header = req.header('authorization')
  if (header === undefined) {
    return undefined
  }
  const [scheme, value] = header.split(' ')
  return scheme?.toLowerCase() === 'bearer' ? value : undefined
}

/**
 * The single MCP endpoint. Per request: verify the OAuth bearer, build a
 * per-session authenticated REST client, register the (currently empty) tool
 * layer, then let the Streamable HTTP transport handle the JSON-RPC exchange.
 */
async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  const token = bearerFrom(req)
  if (token === undefined) {
    const base = config.resourceUrl ?? ''
    res
      .status(401)
      .set('WWW-Authenticate', `Bearer resource_metadata="${base}${PROTECTED_RESOURCE_METADATA_PATH}"`)
      .json({ error: 'missing bearer token' })
    return
  }

  try {
    const verified = await verifyBearerToken(token, { expectedAudience: config.resourceUrl ?? '' })
    const ctx: ToolContext = {
      api: new DrumbeatsApiClient({
        baseUrl: config.apiBaseUrl,
        auth: { kind: 'bearer', token: verified.raw },
        requestTimeoutMs: config.requestTimeoutMs,
      }),
    }

    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION })
    registerTools(server, ctx)

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on('close', () => {
      void transport.close()
      void server.close()
    })

    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (error) {
    if (!res.headersSent) {
      const status = error instanceof TokenVerificationError ? 401 : 500
      res.status(status).json({ error: status === 401 ? 'unauthorized' : 'internal error' })
    }
  }
}

app.post('/mcp', (req: Request, res: Response) => {
  void handleMcpRequest(req, res)
})

function main(): void {
  app.listen(config.port, () => {
    process.stdout.write(`${SERVER_NAME} (http) listening on :${config.port}\n`)
  })
}

main()
