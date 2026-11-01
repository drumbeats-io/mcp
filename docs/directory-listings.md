# Directory listings

Where the Drumbeats MCP server is listed, how each listing is kept current, and
what a maintainer has to do by hand. Checked on 2 November 2026.

| Directory | State on 2 Nov 2026 | How it updates | Manual step |
|---|---|---|---|
| [MCP Registry](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.drumbeats-io/mcp) | 0.5.2 listed as latest, status active | `release.yml` publishes `server.json` on every `v*.*.*` tag and checks the registry answers with the new version | none |
| [npm](https://www.npmjs.com/package/@drumbeats/mcp) | 0.5.2 | `release.yml` publishes on every tag | none |
| [Glama](https://glama.ai/mcp/servers/drumbeats-io/mcp) | Listed as "Official", 19 tools, changelog shows v0.5.1. No "pre-release scaffold" text any more | Glama inspects the npm package and the GitHub repo on its own | Claim the listing once `glama.json` is on `main`: open the listing, click **Claim**, sign in with GitHub. Organization repos are claimed through `glama.json` (`maintainers`), not through a personal GitHub login |
| [mcp.so](https://mcp.so/servers/mcp-drumbeats-io) | Listed ("Drumbeats MCP Server", submitted by Samed about 4 months ago). Short description is the old one | Snapshot taken at submission; no sync from GitHub | Click **Claim** ("Verify ownership via GitHub to manage this listing"), then edit the description to the current npm one |
| [mcpservers.org](https://mcpservers.org/servers/drumbeats-io/mcp) | Listed under Development, shows the current README. Short description is older | Re-reads the README on request | Click **Request update** on the listing when the README or description changes |
| Smithery | Not listed. Smithery became part of Arcade and shut down its MCP proxy on 31 Oct 2026; its search returns 0 servers for "drumbeats" | n/a | Nothing. The README badge was removed |
| PulseMCP | Not listed. "New server submissions and listing changes are still paused" | n/a | Try again when submissions reopen |

## Current description

Use the same text everywhere:

> Official MCP server for Drumbeats. Create and manage cron, heartbeat and uptime
> monitors, report job runs and handle incidents from Claude, Cursor or VS Code.

## Automation

Only npm and the MCP Registry can be pushed to from CI, and both already are.
Glama pulls from npm and GitHub by itself. mcp.so and mcpservers.org have no API,
so their listings are updated by hand (a claim, then an edit or a "Request update"
click). A release-time check that compares each directory's visible version with
the tag is possible and would turn "is the listing stale?" into a line in the
release summary.
