// Injects PWA + iOS-standalone meta tags into the exported index.html.
//
// Expo's Metro web export doesn't emit these, and iOS reads them from the *static* HTML at the moment
// you "Add to Home Screen" — so they must be in the file, not injected at runtime. This is what makes
// the app fill the screen edge-to-edge (dark behind the status bar, tab bar clear of the home
// indicator) instead of showing a white strip / cut-off nav.
const fs = require('fs')
const path = require('path')

const outDir = process.argv[2] || 'dist'
const file = path.join(outDir, 'index.html')

const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />'

let html = fs.readFileSync(file, 'utf8')

// 1. Ensure the viewport opts into the safe areas (viewport-fit=cover). This is what makes
//    env(safe-area-inset-*) — and therefore react-native-safe-area-context on web — non-zero.
if (/<meta\s+name="viewport"[^>]*>/i.test(html)) {
  html = html.replace(/<meta\s+name="viewport"[^>]*>/i, VIEWPORT)
} else {
  html = html.replace('</head>', `    ${VIEWPORT}\n  </head>`)
}

// 2. iOS home-screen tags, a dark page background (kills the white status-bar strip), the manifest,
//    and the service-worker registration — inserted once, right before </head>.
if (!html.includes('apple-mobile-web-app-capable')) {
  const inject = [
    '<meta name="theme-color" content="#2f2f2f" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
    '<meta name="apple-mobile-web-app-title" content="Anti-Duo" />',
    '<link rel="manifest" href="manifest.webmanifest" />',
    '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />',
    '<style>html,body{margin:0;background-color:#2f2f2f}#root{min-height:100vh;background-color:#2f2f2f}' +
      // No iOS long-press "Copy" callout / text selection on the app UI (hold-to-reveal must not
      // trigger selection); text inputs keep normal selection.
      '*{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}' +
      'input,textarea{-webkit-user-select:text;user-select:text}</style>',
    "<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})})}</script>",
  ].join('\n    ')
  html = html.replace('</head>', `    ${inject}\n  </head>`)
}

fs.writeFileSync(file, html)
console.log('Patched PWA head →', file)
