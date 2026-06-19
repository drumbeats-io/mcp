# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/drumbeats-io/mcp/commits/main
