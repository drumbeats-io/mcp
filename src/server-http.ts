import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express, { type Express, type Request, type Response } from 'express'
import { DrumbeatsApiClient } from './api/client.js'
import { buildProtectedResourceMetadata, PROTECTED_RESOURCE_METADATA_PATH } from './auth/resource-metadata.js'
import { toolsForScopes } from './auth/scope-map.js'
import { TokenVerificationError, verifyBearerToken } from './auth/verify-token.js'
import { type AppConfig, loadConfig } from './config.js'
import { registerTools } from './tools/index.js'
import type { ToolContext } from './tools/types.js'
import { SERVER_INSTRUCTIONS, SERVER_NAME, SERVER_VERSION } from './version.js'

/**
 * The base path the hosted routes mount under, derived from the resource URL's
 * path. Traefik path-routes `/mcp` to this container WITHOUT stripping the
 * prefix, so the container must serve everything under `/mcp` for the
 * advertised `resource_metadata` URL to actually resolve. Empty in stdio-less
 * misconfiguration (no resourceUrl) — the hosted routes then serve at root.
 */
function basePathFor(config: AppConfig): string {
  return config.resourceUrl ? new URL(config.resourceUrl).pathname.replace(/\/+$/, '') : ''
}

function bearerFrom(req: Request): string | undefined {
  const header = req.header('authorization')
  if (header === undefined) {
    return undefined
  }
  const [scheme, value] = header.split(' ')
  return scheme?.toLowerCase() === 'bearer' ? value : undefined
}

/**
 * Handles one MCP request: verify the OAuth bearer, build a per-session
 * authenticated REST client, register the scope-gated tool layer, then let the
 * Streamable HTTP transport handle the JSON-RPC exchange.
 */
async function handleMcpRequest(config: AppConfig, req: Request, res: Response): Promise<void> {
  const token = bearerFrom(req)
  if (token === undefined) {
    const metadataUrl = `${config.resourceUrl ?? ''}${PROTECTED_RESOURCE_METADATA_PATH}`
    res
      .status(401)
      .set('WWW-Authenticate', `Bearer resource_metadata="${metadataUrl}"`)
      .json({ error: 'missing bearer token' })
    return
  }

  if (config.resourceUrl === undefined || config.jwtSecret === undefined) {
    res.status(501).json({ error: 'hosted OAuth transport is not configured' })
    return
  }

  try {
    const verified = await verifyBearerToken(token, {
      expectedAudience: config.resourceUrl,
      secret: config.jwtSecret,
    })
    const ctx: ToolContext = {
      api: new DrumbeatsApiClient({
        baseUrl: config.apiBaseUrl,
        auth: { kind: 'bearer', token: verified.raw },
        requestTimeoutMs: config.requestTimeoutMs,
      }),
    }

    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions: SERVER_INSTRUCTIONS })
    registerTools(server, ctx, toolsForScopes(verified.scopes))

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

/**
 * Builds the Express app. Hosted routes mount under `basePath` (derived from
 * `config.resourceUrl`, e.g. `/mcp`) because Traefik forwards the prefix
 * un-stripped; advertised URLs therefore equal served paths. Liveness is
 * exposed BOTH at root `/healthz` (for the container's own localhost
 * HEALTHCHECK, which bypasses Traefik) and at `${basePath}/healthz` (for a
 * proxy-side healthcheck).
 */
export function createApp(config: AppConfig): Express {
  const app = express()
  app.use(express.json())

  const basePath = basePathFor(config)

  const liveness = (_req: Request, res: Response): void => {
    res.json({ status: 'ok', service: SERVER_NAME, version: SERVER_VERSION })
  }
  app.get('/healthz', liveness)
  if (basePath !== '') {
    app.get(`${basePath}/healthz`, liveness)
  }

  // RFC 9728 discovery document, mounted under the resource base path so the
  // advertised URL resolves through the un-stripped Traefik route.
  app.get(`${basePath}${PROTECTED_RESOURCE_METADATA_PATH}`, (_req: Request, res: Response) => {
    if (config.resourceUrl === undefined || config.authServer === undefined) {
      res.status(501).json({ error: 'hosted OAuth metadata is not configured' })
      return
    }
    res.json(buildProtectedResourceMetadata({ resourceUrl: config.resourceUrl, authServerUrl: config.authServer }))
  })

  // The single MCP endpoint. Accept the base path with and without a trailing
  // slash for client robustness (e.g. `/mcp` and `/mcp/`). When basePath is
  // empty (no resourceUrl), fall back to root `/`.
  const mcpPaths = basePath === '' ? ['/'] : [basePath, `${basePath}/`]
  app.post(mcpPaths, (req: Request, res: Response) => {
    void handleMcpRequest(config, req, res)
  })

  return app
}

function main(): void {
  const config = loadConfig()
  const app = createApp(config)
  app.listen(config.port, () => {
    process.stdout.write(`${SERVER_NAME} (http) listening on :${config.port}\n`)
  })
}

// Only boot the listener when run as the entrypoint (`node dist/server-http.js`),
// not when imported (e.g. by tests importing `createApp`).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main()
}
