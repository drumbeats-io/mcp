import { createRequire } from 'node:module'

interface PackageManifest {
  readonly name: string
  readonly version: string
}

// Read name/version from the package manifest so they never drift from npm.
// At runtime this file lives in dist/, so ../package.json is the package root.
const pkg = createRequire(import.meta.url)('../package.json') as PackageManifest

export const SERVER_NAME = pkg.name
export const SERVER_VERSION = pkg.version
