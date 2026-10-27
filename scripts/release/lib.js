// Shared helpers for the release scripts. Every place that carries the package
// version is listed here once, so the bump and the check can never disagree.
import { readFileSync, writeFileSync } from 'node:fs'

export const SEMVER = /^\d+\.\d+\.\d+$/

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
export const readText = (path) => readFileSync(path, 'utf8')
export const writeText = (path, text) => writeFileSync(path, text)

/** Every version field the release must keep in step, as [label, value]. */
export function versionSpots() {
  const pkg = readJson('package.json')
  const lock = readJson('package-lock.json')
  const manifest = readJson('manifest.json')
  const server = readJson('server.json')
  const npmEntry = (server.packages ?? []).find((p) => p.registryType === 'npm' && p.identifier === pkg.name)
  return [
    ['package.json version', pkg.version],
    ['package-lock.json version', lock.version],
    ['package-lock.json packages[""].version', lock.packages?.['']?.version],
    ['manifest.json version', manifest.version],
    ['server.json version', server.version],
    [`server.json packages[npm ${pkg.name}].version`, npmEntry?.version],
  ]
}

/** Compare two X.Y.Z versions: negative, zero or positive like a sort comparator. */
export function compareSemver(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
  return 0
}

/** The body of the `## [version]` (or `## [Unreleased]`) CHANGELOG section, trimmed. */
export function changelogSection(changelog, heading) {
  const lines = changelog.split('\n')
  const start = lines.findIndex((l) => l.startsWith(`## [${heading}]`))
  if (start === -1) return null
  let end = lines.findIndex((l, i) => i > start && (l.startsWith('## [') || /^\[[^\]]+\]: /.test(l)))
  if (end === -1) end = lines.length
  return lines
    .slice(start + 1, end)
    .join('\n')
    .trim()
}
