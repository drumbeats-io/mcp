import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'

const HOSTED = {
  MCP_RESOURCE_URL: 'https://api.drumbeats.io/mcp',
  MCP_AUTH_SERVER: 'https://api.drumbeats.io',
  JWT_SECRET: 'a-shared-secret-at-least-thirty-two-chars',
}

describe('loadConfig hosted triad validation', () => {
  it('accepts stdio mode (no hosted vars set)', () => {
    const config = loadConfig({ DRUMBEATS_API_KEY: 'dk_test' } as NodeJS.ProcessEnv)
    expect(config.resourceUrl).toBeUndefined()
    expect(config.jwtSecret).toBeUndefined()
  })

  it('accepts a fully-configured hosted triad', () => {
    const config = loadConfig(HOSTED as unknown as NodeJS.ProcessEnv)
    expect(config.resourceUrl).toBe(HOSTED.MCP_RESOURCE_URL)
    expect(config.authServer).toBe(HOSTED.MCP_AUTH_SERVER)
    expect(config.jwtSecret).toBe(HOSTED.JWT_SECRET)
  })

  it('rejects a half-configured hosted triad (missing JWT_SECRET)', () => {
    expect(() =>
      loadConfig({
        MCP_RESOURCE_URL: HOSTED.MCP_RESOURCE_URL,
        MCP_AUTH_SERVER: HOSTED.MCP_AUTH_SERVER,
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(/must all be set together/)
  })

  it('rejects a lone JWT_SECRET', () => {
    expect(() => loadConfig({ JWT_SECRET: HOSTED.JWT_SECRET } as unknown as NodeJS.ProcessEnv)).toThrow(
      /must all be set together/
    )
  })
})
