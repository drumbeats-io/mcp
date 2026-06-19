# Drumbeats MCP

[![CI](https://github.com/drumbeats-io/mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/drumbeats-io/mcp/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

The official [Model Context Protocol](https://modelcontextprotocol.io) server for
**[Drumbeats](https://drumbeats.io)** — operate your monitoring from any AI client.
Create monitors, triage incidents, and run HTTP / SSL / DNS checks in natural language.

> **Status: pre-release scaffold.** This repository currently contains the project
> skeleton — build tooling, the shared tool-layer plumbing, both transports, and
> OSS standards. The 13 v1 tools and the full onboarding funnel land in upcoming
> milestones. Interfaces may change before the first tagged release.

## What is Drumbeats?

Drumbeats is heartbeat and uptime monitoring for background jobs and services —
cron jobs, queues, scheduled tasks, and HTTP endpoints. If a job stops checking in
or a site goes down, Drumbeats alerts you. Learn more and sign up at
**[drumbeats.io](https://drumbeats.io)**.

## Three ways to connect

This server is designed around one shared tool layer exposed over two transports,
so the same tools work everywhere. At launch you will be able to connect in three
ways, in order of recommendation:

1. **Hosted (recommended, zero setup).** Add the hosted server as a remote
   connector in your AI client and authorize in the browser via OAuth — no API
   keys to manage. _Coming at launch._
2. **Self-host.** Run the exact same server yourself with Docker (see
   [`Dockerfile`](./Dockerfile)) and point your client at your own instance.
   _Setup guide coming at launch._
3. **Local (stdio).** Run the published npm package locally with a Drumbeats
   account API key, for IDE and offline use:

   ```jsonc
   {
     "mcpServers": {
       "drumbeats": {
         "command": "npx",
         "args": ["-y", "@drumbeats/mcp"],
         "env": { "DRUMBEATS_API_KEY": "dk_your_account_key" }
       }
     }
   }
   ```

   _Published to npm at launch._

## Tools

The v1 tool set (13 tools — the natural-language monitoring loop plus the
HTTP/SSL/DNS diagnostics) is documented here once implemented. Not yet available
in this scaffold.

## Development

Requires the Node version in [`.nvmrc`](./.nvmrc).

```bash
npm ci          # install dependencies
npm run build   # compile TypeScript to dist/
npm run lint    # Biome lint + format check
npm test        # run the test suite
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the contribution workflow and
[SECURITY.md](./SECURITY.md) for the security policy. This is a security product —
please report vulnerabilities privately.

## License

[Apache-2.0](./LICENSE) © Lucky S Software. See [NOTICE](./NOTICE).

---

A product by **[Lucky S Software](https://luckys.dev)**.
