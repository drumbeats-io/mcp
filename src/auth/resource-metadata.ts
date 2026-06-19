import { SCOPES } from './scope-map.js'

/**
 * RFC 9728 Protected Resource Metadata, served by the MCP at the well-known
 * path below. It advertises which authorization server (the Drumbeats `id`
 * service) can mint tokens for this MCP and which scopes those tokens may
 * carry — this is how MCP clients discover where to authorize. Hosted only.
 */
export const PROTECTED_RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource'

export interface ProtectedResourceMetadata {
  readonly resource: string
  readonly authorization_servers: readonly string[]
  readonly scopes_supported: readonly string[]
  readonly bearer_methods_supported: readonly string[]
}

export interface ResourceMetadataOptions {
  /** Canonical MCP resource identifier, e.g. https://mcp.drumbeats.io */
  readonly resourceUrl: string
  /** Authorization server base URL, e.g. https://api.drumbeats.io */
  readonly authServerUrl: string
}

/** Builds the RFC 9728 metadata document for this MCP resource. */
export function buildProtectedResourceMetadata(options: ResourceMetadataOptions): ProtectedResourceMetadata {
  return {
    resource: options.resourceUrl,
    authorization_servers: [options.authServerUrl],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ['header'],
  }
}
