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
for (const [from, to] of dirs) {
  fs.rmSync(to, { recursive: true, force: true })
  fs.cpSync(from, to, { recursive: true })
}

fs.mkdirSync(path.join(mobileRoot, 'assets'), { recursive: true })
fs.copyFileSync(
  path.join(repoRoot, 'public', 'content.json'),
  path.join(mobileRoot, 'assets', 'content.json'),
)

console.log('[sync-shared] vendored shared/ + src/lib + content.json into mobile/')
