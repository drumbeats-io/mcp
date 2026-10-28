# Releasing

Merging to `main` releases nothing. A release starts only when someone pushes a
version tag (`v0.6.0`). From then on the [Release workflow](.github/workflows/release.yml)
does everything and stops at the first failure:

1. **Verify.** The tag must be on `main`, and every version field must equal the tag.
   Lint, typecheck, tests and build run, then `npm pack` makes the exact tarball
   npm will get, and the [scenario](#the-scenario) runs against that tarball and the
   production API. The Claude Desktop bundle (`.mcpb`) is built from the same
   tarball and must start and report the version.
2. **Hosted server.** Once verify has passed, a maintainer deploys the hosted
   server (the workflow holds no deploy credentials). The job waits up to an hour
   until `https://api.drumbeats.io/mcp/healthz` reports the new version, then
   checks the server card and the OAuth challenge.
3. **npm.** Publishes the verified tarball with trusted publishing (no npm token)
   and provenance, then waits until npm serves it.
4. **GitHub release.** Notes come from the version's CHANGELOG section; the title
   is the tag's message. The `.mcpb` bundle is attached, which is what the README
   and drumbeats.io/connect link to for Claude Desktop.
5. **MCP Registry.** Publishes `server.json` with GitHub's OIDC login (no personal
   token) and checks the registry lists the version.
6. **Report.** The run summary shows the version live on the hosted server, npm
   and the registry, and the result of each job.

Hosted first, npm second, registry last: a broken npm release cannot be pulled
back from caches, and the registry should only claim a version once both the
package and the hosted server serve it.

## Cutting a release

1. Make sure `## [Unreleased]` in the CHANGELOG says what changed.
2. On a branch from an up-to-date `main`:
   ```bash
   npm run release:bump -- 0.6.0
   ```
   This bumps `package.json`, `package-lock.json`, `manifest.json`, `server.json`
   and moves Unreleased into `## [0.6.0] - <date>` with its compare link. It refuses
   a version that does not go up, or an empty Unreleased section.
3. Commit as `chore(release): 0.6.0 — <short summary>` (signed off), open a PR,
   let CI pass, rebase-merge.
4. Tag the merged commit on `main` and push the tag. The message becomes the
   GitHub release title:
   ```bash
   git fetch origin && git tag -a v0.6.0 -m "v0.6.0 — <short summary>" origin/main && git push origin v0.6.0
   ```
5. When the **Verify** job has passed, deploy the hosted server from `main`
   (`main` must still be at the tagged commit). The run continues by itself once
   `/healthz` shows the new version.
6. Watch the run under **Actions → Release**. Then do the
   [hosted check](#hosted-check-as-a-user) in a Claude session.

### Picking the version

The tool contract (tool names, parameters, output fields, and which scope unlocks
a tool) is the API. Hosted users get every release at once, and most npm users run
`npx @drumbeats/mcp`, so compatibility matters more than the number.

- **Patch:** fixes with no contract change.
- **Minor:** new tools or new optional fields.
- **Breaking:** renaming or removing a tool or field, tightening validation, or
  moving a tool to another scope. Before 1.0 this is a minor bump, but deprecate
  first: keep the old name working and say so in its description for a few weeks.
- If a tool needs a new core endpoint, promote core to production first.

### When something fails

Fix the cause, then use **Re-run failed jobs** on the same run; finished jobs are
not repeated. Never re-tag a version that reached npm: publish the next patch
instead. If the hosted server misbehaves after the deploy, roll it back to the
previous release before re-running anything.

## The scenario

[`scripts/scenario/run.js`](scripts/scenario/run.js) drives the server over stdio
like a client and covers 18 of the 19 tools in about 20 calls. Only
`create_project` is left out, because no tool can delete a project afterwards.

| Step | Tools |
| --- | --- |
| Diagnostics on drumbeats.io | `check_http`, `check_ssl`, `check_dns` |
| Find the test project, and refuse to go on if it has alert channels | `list_projects` |
| Note the run on the project | `update_project` |
| Temporary JOB_BASIC monitor, a run that succeeds | `create_monitor`, `ping_start`, `ping_success`, `get_monitor`, `get_monitor_history` |
| Rename, pause, a ping while paused is not recorded, resume | `update_monitor`, `pause_monitor`, `ping_failure`, `resume_monitor` |
| A run that fails, its incident, resolved | `ping_start`, `ping_failure`, `list_incidents`, `manage_incident` |
| Summaries | `get_uptime_summary`, `list_monitors` |
| Delete the temporary monitor (REST API, always) | — |

Locally, `npm run build && npm run scenario` runs the diagnostics only. With
`DRUMBEATS_API_KEY` and `SCENARIO_PROJECT_ID` set, it runs everything.

## Hosted check as a user

The workflow cannot sign in to the hosted server the way Claude does, so after a
release, run this in a Claude session with the Drumbeats connector. Use the
**MCP release checks** project.

1. `list_projects`: the project is there, with no notification channels.
2. `create_monitor` (JOB_BASIC, schedule `@event`), then `ping_start` and
   `ping_success` with the returned `run_id`.
3. `get_monitor_history`: shows START and SUCCESS.
4. `ping_start`, then `ping_failure`; `list_incidents` shows an incident;
   `manage_incident` resolves it.
5. Any new tool in this release, once.
6. Delete the monitor in the dashboard.

## One-time setup

- **npm:** on npmjs.com, `@drumbeats/mcp` → Settings → Trusted publishing → GitHub
  Actions: organization `drumbeats-io`, repository `mcp`, workflow `release.yml`,
  environment `release`.
- **GitHub environment `release`** (Settings → Environments):
  - secret `DRUMBEATS_SCENARIO_API_KEY`: a project API key for **MCP release checks**
    with `read`, `manage_monitors` and `manage_projects`.
  - variables `SCENARIO_PROJECT_ID`, and optionally `RELEASE_MONITOR_ID`: a Drumbeats JOB_BASIC monitor that gets a start
    and a success or failure ping for every release run.
- **MCP Registry:** nothing. GitHub OIDC proves the `io.github.drumbeats-io` namespace.
- Limit the `release` environment to tags matching `v*.*.*`, so no other run can
  read its secrets.
