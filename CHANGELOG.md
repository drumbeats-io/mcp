# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Two project write tools, bringing the tool count to sixteen. `create_project` (name + optional description) creates a project and returns its id for use with `create_monitor`; `update_project` applies a partial patch to a project's name and/or description. Both are additive, non-destructive writes (`readOnlyHint: false`, `destructiveHint: false`; `update_project` is also idempotent) that route to the id service (`POST` / `PATCH /v1/projects`). A new `manage_projects` scope gates them: the hosted transport exposes them only to tokens carrying that scope, while stdio registers them as usual. Hitting a plan's project limit returns an upgrade prompt rather than a hard error.

## [0.2.1] - 2026-07-02

### Added

- `mcpName` field (`io.github.drumbeats-io/mcp`) in `package.json` and a `server.json` manifest, enabling publication to the [Official MCP Registry](https://registry.modelcontextprotocol.io). The manifest lists both the npm/stdio package and the hosted streamable-HTTP remote at `https://api.drumbeats.io/mcp`. No runtime changes.

## [0.2.0] - 2026-07-01

### Added

- Hosted HTTP transport is now functional end to end. Its routes (the JSON-RPC endpoint, RFC 9728 metadata, and a liveness probe) live on one router mounted at both `/` and `/mcp`, so the app answers whether or not the reverse proxy strips the `/mcp` prefix; `WWW-Authenticate` advertises the absolute external metadata URL, which resolves under either mount. The endpoint verifies inbound OAuth 2.1 bearer tokens minted by the Drumbeats id service: HS256 signature against the shared `JWT_SECRET`, audience (`https://api.drumbeats.io/mcp`, RFC 8707), expiry, and the `oauth` token type. The verified token is forwarded as the `Bearer` credential to the REST API, which remains the authority on authorization.
- Scope-gating: the tools a session exposes are filtered by the token's granted scopes. `read` unlocks the nine read/diagnostic tools; `manage_monitors` adds the five write/lifecycle tools. Unknown scopes are ignored. The stdio transport is unaffected and still registers every tool.
- Upgrade prompts on plan limits: when the REST API signals a plan/quota ceiling (HTTP 402/429, or a plan-limit body code), tools now return a human-readable, agent-actionable result pointing the user to https://drumbeats.io/pricing instead of failing as an auth error.

### Changed

- Per-service API routing. The Drumbeats REST API is split across three services by path prefix (`/id`, `/beats`, `/alerts`) with no unified `/v1` gateway, so each tool request now names its target service and the client resolves `${apex}${servicePrefix}${path}`. This fixes tool calls that 404'd under a single base and applies to both transports. `list_projects` reads from `id` (`/v1/projects`) and `alerts` (notification channels/groups); `get_uptime_summary` is on `beats` despite its `/v1/projects/{id}/…` path.
- **⚠️ Behavior change — `DRUMBEATS_API_BASE_URL` is now the API apex** (default `https://api.drumbeats.io`), with the per-service prefix applied internally per request. Previously it was used as a single base for all routes. **If you are a stdio user who set `DRUMBEATS_API_BASE_URL` to a service-specific base (e.g. `…/beats`), change it to the apex** — otherwise requests resolve to a doubled prefix like `…/beats/beats/…`. New optional `DRUMBEATS_ID_BASE_URL` / `DRUMBEATS_BEATS_BASE_URL` / `DRUMBEATS_ALERTS_BASE_URL` overrides support self-hosting each service on an independent host.
- Strip-tolerant hosted routing: the hosted JSON-RPC endpoint, RFC 9728 metadata, and liveness probe are mounted at both `/` and `/mcp`, so the app works whether or not the reverse proxy strips the `/mcp` path prefix.
- `MCP_RESOURCE_URL`, `MCP_AUTH_SERVER` and the new `JWT_SECRET` form an all-or-nothing hosted triad, validated at boot: a half-configured hosted app fails fast rather than per request. stdio mode (none set) stays valid.

## [0.1.1]

### Added

- Claude Desktop bundle icon: the `.mcpb` and npm package now ship `icon.png`,
  referenced from `manifest.json`, so the connector shows the Drumbeats badge
  instead of a placeholder.
- Tool annotations on all 14 tools (`readOnlyHint`, `idempotentHint`,
  `openWorldHint`) so AI clients can tell read-only queries, idempotent writes,
  and external-reaching diagnostics apart.
- Server-level `instructions`, shared by both transports, telling clients to
  call `list_projects` first and summarising when each tool applies.

## [0.1.0]

### Added

- Initial repository scaffold: strict TypeScript (ESM) build config, Biome
  linting matching `core`, Node version pin, and a committed lockfile.
- Shared tool-layer skeleton (`registerTools` with an empty registry) consumed by
  both transports, plus the Drumbeats REST client and error-mapping plumbing.
- Both transport entrypoints — hosted Streamable HTTP (`server-http.ts`) and local
  stdio (`stdio.ts`) — wired to the shared tool layer.
- Hosted OAuth 2.1 resource-server stubs: protected-resource metadata, bearer
  token verification, and the scope → tool map.
- OSS standards: README, Apache-2.0 license + NOTICE, security policy, contributing
  guide, Contributor Covenant code of conduct, issue/PR templates, CI (lint,
  typecheck, test, build, and an AI-authorship guard), CodeQL, and Dependabot.
- Container build (multi-stage `Dockerfile`) and `.mcpb` bundle manifest stub.

[Unreleased]: https://github.com/drumbeats-io/mcp/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/drumbeats-io/mcp/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/drumbeats-io/mcp/releases/tag/v0.1.0
