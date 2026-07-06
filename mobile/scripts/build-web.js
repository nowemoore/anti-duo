// Orchestrates the web/PWA build so the PWA head-patch always runs after the export:
//   sync shared logic → expo export → patch index.html
// Output dir comes from EXPO_WEB_OUTPUT (CI sets it to ../dist/app); defaults to ./dist locally.
const { execSync } = require('child_process')

const outDir = process.env.EXPO_WEB_OUTPUT || 'dist'
const run = (cmd) => execSync(cmd, { stdio: 'inherit', env: process.env })

run('node scripts/sync-shared.js')
run(`npx expo export --platform web --output-dir "${outDir}"`)
run(`node scripts/patch-pwa-html.js "${outDir}"`)
