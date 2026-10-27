// Bumps every version field to the given X.Y.Z and turns the CHANGELOG's
// Unreleased section into the release section. Refuses to run when the version
// does not go up or when Unreleased is empty, so a release always says what changed.
//
//   node scripts/release/bump.js 0.6.0
import { execFileSync } from 'node:child_process'
import { changelogSection, compareSemver, readJson, readText, SEMVER, writeText } from './lib.js'

const next = process.argv[2]
if (!next || !SEMVER.test(next)) {
  console.error('Usage: node scripts/release/bump.js X.Y.Z')
  process.exit(1)
}

const current = readJson('package.json').version
if (compareSemver(next, current) <= 0) {
  console.error(`${next} is not higher than the current version ${current}.`)
  process.exit(1)
}

const changelog = readText('CHANGELOG.md')
if (!changelogSection(changelog, 'Unreleased')) {
  console.error('CHANGELOG.md has nothing under ## [Unreleased]. Describe the release there first.')
  process.exit(1)
}

// package.json + both package-lock.json fields, the way npm itself writes them.
execFileSync('npm', ['version', next, '--no-git-tag-version'], { stdio: 'inherit' })

// manifest.json and server.json: replace the old version string in place to keep their tab formatting.
const quoted = (v) => `"version": "${v}"`
for (const file of ['manifest.json', 'server.json']) {
  const text = readText(file)
  if (!text.includes(quoted(current))) {
    console.error(`${file} does not contain ${quoted(current)}.`)
    process.exit(1)
  }
  writeText(file, text.replaceAll(quoted(current), quoted(next)))
}

// CHANGELOG: a fresh empty Unreleased on top, the release section under it, and the footer links.
const today = new Date().toISOString().slice(0, 10)
const repo = 'https://github.com/drumbeats-io/mcp'
let out = changelog.replace('## [Unreleased]', `## [Unreleased]\n\n## [${next}] - ${today}`)
const unreleasedLink = /^\[Unreleased\]: .*$/m
if (!unreleasedLink.test(out)) {
  console.error('CHANGELOG.md has no [Unreleased]: footer link.')
  process.exit(1)
}
out = out.replace(
  unreleasedLink,
  `[Unreleased]: ${repo}/compare/v${next}...HEAD\n[${next}]: ${repo}/compare/v${current}...v${next}`
)
writeText('CHANGELOG.md', out)

console.log(`Bumped ${current} -> ${next}.`)
