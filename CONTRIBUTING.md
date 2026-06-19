# Contributing to Drumbeats MCP

Thanks for your interest in improving the Drumbeats MCP server. This document
covers the development setup, the contribution workflow, and the conventions we
enforce in CI.

## Development setup

Use the Node version pinned in [`.nvmrc`](./.nvmrc) (e.g. via `nvm use`).

```bash
npm ci          # install exact, locked dependencies
npm run build   # compile TypeScript to dist/
npm run typecheck
npm run lint    # Biome: lint + format check
npm run lint:fix
npm test        # run the test suite (Vitest)
```

All of `lint`, `typecheck`, `test`, and `build` must pass before a PR can merge —
CI runs them on every pull request.

## How the code is organized

The design rule is **one tool definition, two transports**. The tool layer in
`src/tools/` is transport-agnostic and imported by both entrypoints:

- `src/tools/index.ts` — `registerTools(server, ctx)`, the single registration point.
- `src/tools/types.ts` — `ToolContext`, which carries an authenticated API client.
- `src/api/` — the shared Drumbeats REST client and error mapping.
- `src/auth/` — hosted-only OAuth 2.1 resource-server glue.
- `src/server-http.ts` / `src/stdio.ts` — the two thin transport entrypoints.

### Adding a tool

Add one file under `src/tools/<area>/<tool>.ts` exporting a `ToolRegistration`,
then list it in the `registry` array in `src/tools/index.ts`. A tool only ever
touches `ctx.api`; it must not know which transport invoked it. Include input
schema validation and map REST errors to tool results (never leak a raw 5xx).
Add unit tests alongside.

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`,
`fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`. This drives changelog and
release reasoning. Keep the [CHANGELOG](./CHANGELOG.md) `Unreleased` section
updated in the same PR as any user-facing change.

### Developer Certificate of Origin (DCO)

Sign off every commit to certify you have the right to submit it under the
project license:

```bash
git commit -s -m "feat: add get_uptime_summary tool"
```

This adds a `Signed-off-by:` trailer with your name and email.

### Authorship policy — no AI attribution

This repository does **not** carry AI co-authorship or generation trailers. Do
**not** add `Co-Authored-By: Claude …`, `Generated with …` lines, or robot-emoji
attribution to commit messages, PR descriptions, the changelog, or file headers.
A CI guard inspects every commit in a PR and **fails the build** if such an
attribution is found. Human contributors author commits as themselves (with DCO
sign-off); AI tooling, if used, is not credited as an author.

## Pull requests

- Use a Conventional Commit style title.
- Ensure lint, typecheck, tests, and build pass locally.
- Update docs and the changelog when behavior changes.
- Complete the checklist in the PR template.

## Code of Conduct

By participating you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).
