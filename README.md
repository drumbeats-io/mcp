<p align="center">
  <a href="https://drumbeats.io">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/drumbeats-io/mcp/main/docs/banner-dark.svg">
      <img alt="Drumbeats MCP: cron, heartbeat and uptime monitoring from your AI assistant" src="https://raw.githubusercontent.com/drumbeats-io/mcp/main/docs/banner-light.svg" width="100%">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://github.com/drumbeats-io/mcp/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/drumbeats-io/mcp/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/@drumbeats/mcp"><img alt="npm" src="https://img.shields.io/npm/v/@drumbeats/mcp.svg"></a>
  <a href="./LICENSE"><img alt="License: Apache-2.0" src="https://img.shields.io/badge/License-Apache_2.0-blue.svg"></a>
  <a href="https://glama.ai/mcp/servers/drumbeats-io/mcp"><img alt="drumbeats-io/mcp MCP server" src="https://glama.ai/mcp/servers/drumbeats-io/mcp/badges/score.svg"></a>
  <a href="https://smithery.ai/servers/drumbeats/drumbeats-mcp"><img alt="Smithery" src="https://img.shields.io/badge/Smithery-listed-orange"></a>
</p>

[Drumbeats](https://drumbeats.io) watches cron jobs, background workers and websites.
When a job misses its schedule, reports a failure or a site stops answering, it opens
an incident and alerts you.

This is the official [Model Context Protocol](https://modelcontextprotocol.io) server
for Drumbeats. It lets Claude, Cursor, VS Code and other MCP clients work with your
account: create monitors, read their history, report job runs and handle incidents.
Three of its tools check a website, a certificate or a DNS name and work without an
account.

## Connect

There are two ways to run it. Both give you the same 19 tools.

### Hosted server

Add `https://api.drumbeats.io/mcp` to your client and sign in with your Drumbeats
account when it asks. Nothing to install and no API key to store.

<details open>
<summary><b>Claude</b> (web, Desktop and Claude Code)</summary>

In Claude, open **Settings → Connectors → Add custom connector**, paste the URL above
and sign in.

In Claude Code:

```bash
claude mcp add --transport http drumbeats https://api.drumbeats.io/mcp
```

</details>

<details>
<summary><b>Cursor</b></summary>

Add this to `.cursor/mcp.json` in your project, or to the global config, and approve
the sign-in on first connect:

```json
{
  "mcpServers": {
    "drumbeats": {
      "url": "https://api.drumbeats.io/mcp"
    }
  }
}
```

</details>

<details>
<summary><b>VS Code</b></summary>

Add this to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "drumbeats": {
      "type": "http",
      "url": "https://api.drumbeats.io/mcp"
    }
  }
}
```

</details>

<details>
<summary><b>Other clients</b></summary>

Any client that supports Streamable HTTP with OAuth can connect. Give it the URL and
it runs the sign-in (OAuth 2.1 with PKCE).

</details>

### On your machine, with an API key

Create a key at [drumbeats.io/account/api-keys](https://drumbeats.io/account/api-keys).
An account key covers every project you own or belong to. A project key limits the
server to one project.

<details open>
<summary><b>Claude Desktop</b></summary>

Download `drumbeats-mcp-vX.Y.Z.mcpb` from the
[latest release](https://github.com/drumbeats-io/mcp/releases/latest), open it, and
paste your key when Claude Desktop asks.

</details>

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add drumbeats -e DRUMBEATS_API_KEY=dk_your_key -- npx -y @drumbeats/mcp
```

</details>

<details>
<summary><b>Cursor and other clients</b></summary>

```json
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

</details>

<details>
<summary><b>VS Code</b></summary>

Add this to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "drumbeats": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@drumbeats/mcp"],
      "env": { "DRUMBEATS_API_KEY": "dk_your_key" }
    }
  }
}
```

</details>

Running it with `npx` needs Node.js 22.

## Tools

The "Needs" column is the permission the tool requires: the scope of your API key, or
what you approve when you sign in to the hosted server.

<details open>
<summary><b>Monitors and projects</b> (9 tools)</summary>

| Tool | What it does | Needs |
| --- | --- | --- |
| `list_projects` | Lists the projects you can access, with their alert channels and groups. | read |
| `create_project` | Creates a project. Needs an account key. | manage_projects |
| `update_project` | Changes a project's name or description. | manage_projects |
| `create_monitor` | Creates a cron, heartbeat or HTTP uptime monitor. | manage_monitors |
| `list_monitors` | Lists a project's monitors with their type, status and schedule. | read |
| `get_monitor` | Shows one monitor and its full settings. | read |
| `update_monitor` | Changes some settings of a monitor and keeps the rest. | manage_monitors |
| `pause_monitor` | Stops a monitor's checks and alerts. | manage_monitors |
| `resume_monitor` | Starts a paused monitor again. | manage_monitors |

</details>

<details>
<summary><b>Report job runs</b> (3 tools)</summary>

| Tool | What it does | Needs |
| --- | --- | --- |
| `ping_start` | Reports that a job started and returns a `run_id` for its finish. | manage_monitors |
| `ping_success` | Reports that a job finished. This is the ping that keeps a monitor up. | manage_monitors |
| `ping_failure` | Reports that a job failed, which can open an incident and alert. | manage_monitors |

Each takes the monitor's id plus an optional `run_id`, `message` and `payload`. They
do the same as calling the monitor's ping URL, which helps when an agent can't make
outbound HTTP requests, as in Claude Code cloud scheduled tasks.

</details>

<details>
<summary><b>History and incidents</b> (4 tools)</summary>

| Tool | What it does | Needs |
| --- | --- | --- |
| `get_monitor_history` | Shows a monitor's recent pings, checks and response times. | read |
| `get_uptime_summary` | Shows uptime for every monitor in a project. | read |
| `list_incidents` | Lists incidents, filtered by status or monitor. | read |
| `manage_incident` | Shows, acknowledges or resolves an incident. | manage_monitors |

</details>

<details>
<summary><b>Checks that need no account</b> (3 tools)</summary>

| Tool | What it does |
| --- | --- |
| `check_http` | Requests a URL and reports the status code and response time. |
| `check_ssl` | Reads a site's TLS certificate: whether it is valid, when it expires, who issued it. |
| `check_dns` | Looks up a hostname's DNS records. |

These work with no Drumbeats account or key. Add the server through `npx` without
`DRUMBEATS_API_KEY` and ask whether your site is up.

</details>

## Things to ask

```text
List my monitors and tell me which ones are down.
Create a cron monitor for my nightly backup, every day at 02:00 UTC.
What was my uptime over the last 30 days?
Show open incidents and acknowledge the newest one.
Is https://example.com up right now?
When does the certificate for example.com expire?
```

## Configuration

These apply when you run the server with `npx`. The hosted server needs none of them.

| Variable | Default | What it does |
| --- | --- | --- |
| `DRUMBEATS_API_KEY` | none | Your API key (`dk_…`). Needed for every tool except the three checks. |
| `DRUMBEATS_API_TIMEOUT_MS` | `15000` | How long to wait for the Drumbeats API, in milliseconds. |
| `DRUMBEATS_API_BASE_URL` | `https://api.drumbeats.io` | The API the server talks to. |

## Development

Use the Node.js version in [`.nvmrc`](./.nvmrc).

```bash
npm ci          # install dependencies
npm run build   # compile to dist/
npm run lint    # Biome lint and format check
npm test        # run the tests
```

[CONTRIBUTING.md](./CONTRIBUTING.md) covers pull requests and
[RELEASING.md](./RELEASING.md) covers releases. Please report security problems
privately, as described in [SECURITY.md](./SECURITY.md).

## License

[Apache-2.0](./LICENSE). Copyright 2026 Lucky S Software, see [NOTICE](./NOTICE).
Drumbeats is made by [Lucky S Software](https://luckys.dev).
