/**
 * Web-only PWA wiring. Expo's Metro web export doesn't emit a manifest link, the iOS home-screen
 * meta tags, or a service worker, so we inject them at runtime (only ever called on web, guarded by
 * Platform.OS). All paths are relative so it works whether hosted at a domain root or a subpath.
 */
export function setupPwa() {
  if (typeof document === 'undefined') return
  const head = document.head

  const addOnce = (selector: string, make: () => HTMLElement) => {
    if (!document.querySelector(selector)) head.appendChild(make())
  }
  const linkEl = (rel: string, href: string) => {
    const el = document.createElement('link')
    el.rel = rel
    el.href = href
    return el
  }
  const metaEl = (name: string, content: string) => {
    const el = document.createElement('meta')
    el.setAttribute('name', name)
    el.setAttribute('content', content)
    return el
  }

  // Opt the viewport into the safe areas so content fills the notch/home-indicator regions and
  // env(safe-area-inset-*) is non-zero (matches the build-time patch; helps dev + in-browser).
  const viewport = document.querySelector('meta[name="viewport"]')
  if (viewport) {
    const content = viewport.getAttribute('content') ?? ''
    if (!content.includes('viewport-fit')) viewport.setAttribute('content', `${content}, viewport-fit=cover`)
  }
  // Dark page background so there's no white strip behind the status bar.
  document.documentElement.style.backgroundColor = '#2f2f2f'
  document.body.style.backgroundColor = '#2f2f2f'

  addOnce('link[rel="manifest"]', () => linkEl('manifest', 'manifest.webmanifest'))
  addOnce('meta[name="theme-color"]', () => metaEl('theme-color', '#2f2f2f'))
  addOnce('meta[name="apple-mobile-web-app-capable"]', () => metaEl('apple-mobile-web-app-capable', 'yes'))
  addOnce('meta[name="mobile-web-app-capable"]', () => metaEl('mobile-web-app-capable', 'yes'))
  addOnce('meta[name="apple-mobile-web-app-status-bar-style"]', () =>
    metaEl('apple-mobile-web-app-status-bar-style', 'black-translucent'),
  )
  addOnce('meta[name="apple-mobile-web-app-title"]', () => metaEl('apple-mobile-web-app-title', 'Anti-Duo'))
  addOnce('link[rel="apple-touch-icon"]', () => linkEl('apple-touch-icon', 'icons/apple-touch-icon.png'))

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {})
    })
  }
}
