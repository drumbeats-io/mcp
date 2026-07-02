# Drumbeats MCP

[![CI](https://github.com/drumbeats-io/mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/drumbeats-io/mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@drumbeats/mcp.svg)](https://www.npmjs.com/package/@drumbeats/mcp)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![drumbeats-io/mcp MCP server](https://glama.ai/mcp/servers/drumbeats-io/mcp/badges/score.svg)](https://glama.ai/mcp/servers/drumbeats-io/mcp)

The official [Model Context Protocol](https://modelcontextprotocol.io) server for
**[Drumbeats](https://drumbeats.io)** — run your monitoring from any AI client.
Create monitors, triage incidents, and run HTTP / SSL / DNS checks in plain language
from Claude, Cursor, VS Code, or any MCP-capable tool.

## What is Drumbeats?

Drumbeats is heartbeat and uptime monitoring for background jobs and services —
cron jobs, queues, scheduled tasks, and HTTP endpoints. If a job stops checking in
or a site goes down, Drumbeats alerts you. Create a free account at
**[drumbeats.io](https://drumbeats.io)**.

## Install

Add the server to your AI client and set one environment variable — your Drumbeats
account API key:

```jsonc
{
  "mcpServers": {
    "drumbeats": {
      "command": "npx",
      "args": ["-y", "@drumbeats/mcp"],
      "env": { "DRUMBEATS_API_KEY": "dk_your_key" }
    }
  }
}
```

1. **Get a key** — at [drumbeats.io](https://drumbeats.io) → **Account → API keys**. An
   account-scoped key (`dk_…`) works across every project you own or belong to.
2. **Add the config** — paste the block above into your client's MCP config and
   restart it.
3. **Ask** — *"List my monitors."*

**Claude Desktop:** prefer a one-click install — download the latest `.mcpb` bundle
from the [Releases page](https://github.com/drumbeats-io/mcp/releases/latest),
double-click it, and paste your key when prompted.

Requires Node.js 22 when running via `npx`.

## Tools

Sixteen tools over one shared layer. The HTTP / SSL / DNS diagnostics work with **no
account and no API key** — point any client at the server and start checking.

**Projects & monitors**
| Tool | What it does |
| --- | --- |
| `list_projects` | List the projects your key can access (with notification channels and groups). |
| `create_project` | Create a new project (account-scoped key with `manage_projects`). |
| `update_project` | Update a project's name or description (partial patch). |
| `create_monitor` | Create a monitor — cron, heartbeat, or HTTP uptime. |
| `list_monitors` | List a project's monitors with type, status, and schedule. |
| `get_monitor` | Fetch one monitor by id, with its full configuration. |
| `update_monitor` | Update an existing monitor (partial patch). |
| `pause_monitor` | Pause a monitor (stops checks and alerts). |
| `resume_monitor` | Resume a paused monitor. |

**Observe & triage**
| Tool | What it does |
| --- | --- |
| `get_monitor_history` | Recent pings, checks, and response times for a monitor. |
| `get_uptime_summary` | Project-wide uptime / SLA rollup across monitors. |
| `list_incidents` | List incidents (downtime and missed runs), filterable by status or monitor. |
| `manage_incident` | Get, acknowledge, or resolve an incident. |

**Diagnostics — no account required**
| Tool | What it does |
| --- | --- |
| `check_http` | Check a URL's reachability, status code, and response time. |
| `check_ssl` | Inspect a TLS certificate — validity, expiry, and issuer. |
| `check_dns` | Resolve a hostname and report its DNS records. |

## Example prompts

```text
List all my monitors and their current status.
Create a cron monitor for my nightly backup that runs every day at 02:00 UTC.
What's my uptime this month?
Show me open incidents and acknowledge the most recent one.
Is https://example.com up right now?            # no account needed
Is the SSL certificate for example.com about to expire?   # no account needed
```

## Try it with zero setup

The `check_http`, `check_ssl`, and `check_dns` tools need no Drumbeats account or API
key. Add the server, leave `DRUMBEATS_API_KEY` unset, and ask *"Is my site up?"* before
you sign up. When you're ready for continuous monitoring and alerts,
[create a free account](https://drumbeats.io).

## Configuration

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DRUMBEATS_API_KEY` | For the monitoring tools | — | Account-scoped key (`dk_…`). Not needed for the diagnostics tools. |
| `DRUMBEATS_API_BASE_URL` | No | `https://api.drumbeats.io` | The apex REST URL. The Drumbeats API is split across services by path prefix (`/id`, `/beats`, `/alerts`); the client appends the per-service prefix to this apex per request. |
| `DRUMBEATS_ID_BASE_URL` | No | `${apex}/id` | Self-host override: full base URL for the `id` service. |
| `DRUMBEATS_BEATS_BASE_URL` | No | `${apex}/beats` | Self-host override: full base URL for the `beats` service. |
| `DRUMBEATS_ALERTS_BASE_URL` | No | `${apex}/alerts` | Self-host override: full base URL for the `alerts` service. |

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

## Links

- **Product:** [drumbeats.io](https://drumbeats.io) · [sign up](https://drumbeats.io)
- **Issues:** [github.com/drumbeats-io/mcp/issues](https://github.com/drumbeats-io/mcp/issues)

## License

[Apache-2.0](./LICENSE) © Lucky S Software. See [NOTICE](./NOTICE).

---

A product by **[Lucky S Software](https://luckys.dev)**.
