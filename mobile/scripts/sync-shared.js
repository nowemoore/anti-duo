// Vendors the web app's pure logic into mobile/ so Metro (which struggles to crawl sibling folders
// outside the project root on Windows) bundles it as ordinary in-project files. The repo remains the
// single source of truth; these copies are generated build artifacts (gitignored) — run before
// start/export via the prestart/predev scripts. The layout mirrors the repo (vendor/shared +
// vendor/src/lib) so the shared files' own relative imports (../../shared/...) still resolve.
const fs = require('fs')
const path = require('path')

const mobileRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(mobileRoot, '..')

const dirs = [
  [path.join(repoRoot, 'shared'), path.join(mobileRoot, 'vendor', 'shared')],
  [path.join(repoRoot, 'src', 'lib'), path.join(mobileRoot, 'vendor', 'src', 'lib')],
]
// Clear the *contents* rather than the directory itself. Deleting and recreating the watched root
// leaves Metro's file map pointing at a directory that no longer exists, and it then fails to
// resolve everything inside it ("unable to resolve module ... from vendor/src/lib/content.ts") until
// the cache is cleared by hand. Keeping the root in place avoids that entirely.
for (const [from, to] of dirs) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(to)) {
    fs.rmSync(path.join(to, entry), { recursive: true, force: true })
  }
  fs.cpSync(from, to, { recursive: true })
}

fs.mkdirSync(path.join(mobileRoot, 'assets'), { recursive: true })
// Per-language payloads: the web app reads public/content.json (JA); mobile bundles one per language.
const contentFiles = [
  ['content.json', 'content.ja.json'],
  ['content.ar.json', 'content.ar.json'],
]
for (const [from, to] of contentFiles) {
  fs.copyFileSync(path.join(repoRoot, 'public', from), path.join(mobileRoot, 'assets', to))
}

console.log('[sync-shared] vendored shared/ + src/lib + content.{ja,ar}.json into mobile/')
