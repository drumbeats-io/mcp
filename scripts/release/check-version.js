// Fails when the version fields disagree. Run on every PR (CI) and by the
// release workflow after the bump.
//
//   node scripts/release/check-version.js            all fields must match package.json
//   node scripts/release/check-version.js 0.6.0      ...and equal 0.6.0, with a CHANGELOG section for it
import { changelogSection, readText, SEMVER, versionSpots } from './lib.js'

const expected = process.argv[2]
if (expected && !SEMVER.test(expected)) {
  console.error(`Not an X.Y.Z version: ${expected}`)
  process.exit(1)
}

const spots = versionSpots()
const want = expected ?? spots[0][1]
const wrong = spots.filter(([, value]) => value !== want)
for (const [label, value] of spots) console.log(`${value === want ? 'ok ' : 'BAD'} ${label}: ${value}`)

let failed = wrong.length > 0
if (wrong.length) console.error(`\n${wrong.length} version field(s) differ from ${want}.`)

if (expected) {
  const body = changelogSection(readText('CHANGELOG.md'), expected)
  if (!body) {
    console.error(`CHANGELOG.md has no non-empty "## [${expected}]" section.`)
    failed = true
  }
}

process.exit(failed ? 1 : 0)
