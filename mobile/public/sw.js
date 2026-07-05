/* Anti-Duo service worker — makes the installed PWA work offline.
 *
 * Strategy: runtime caching. The first online visit caches the app shell + JS bundle + fonts as they
 * load; after that the app opens with no network. Content is compiled into the JS bundle, so there's
 * no separate data file to cache. Cross-origin requests (Supabase) bypass the cache and just fail
 * gracefully offline — sync is best-effort and resumes when you're back online.
 */
const CACHE = 'anti-duo-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // let Supabase & other hosts hit the network directly

  // App launches (navigations): network first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match('index.html') || caches.match('./')),
        ),
    )
    return
  }

  // Everything else (JS, fonts, images): serve cache if we have it, and refresh it in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
