// Prints the GitHub release notes for a version: its CHANGELOG section plus
// where it was published.
//
//   node scripts/release/notes.js 0.6.0
import { changelogSection, readJson, readText } from './lib.js'

const version = process.argv[2]
const body = version && changelogSection(readText('CHANGELOG.md'), version)
if (!body) {
  console.error(`No CHANGELOG section for ${version}.`)
  process.exit(1)
}
const { name } = readJson('package.json')
console.log(
  `${body}\n\nPublished to npm as \`${name}@${version}\` and live on the hosted server at \`https://api.drumbeats.io/mcp\`. For Claude Desktop, download \`drumbeats-mcp-v${version}.mcpb\` below and open it.`
)
