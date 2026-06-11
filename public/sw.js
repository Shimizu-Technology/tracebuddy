const CACHE_NAME = 'tracebuddy-app-shell-v1'
const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.svg']

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TraceBuddy offline</title>
    <style>
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 2rem;
        color: #142033;
        background: #fff8ef;
        font-family: ui-rounded, "SF Pro Rounded", "Avenir Next", system-ui, sans-serif;
      }
      main {
        max-width: 32rem;
        border: 1px solid rgba(20, 32, 51, 0.1);
        border-radius: 2rem;
        padding: 2rem;
        background: rgba(255, 255, 255, 0.84);
        box-shadow: rgba(20, 32, 51, 0.14) 0 32px 70px -42px;
      }
      h1 { margin: 0 0 0.75rem; font-size: clamp(2rem, 9vw, 3.5rem); line-height: 0.95; letter-spacing: -0.06em; }
      p { margin: 0; color: #687386; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <h1>TraceBuddy is offline.</h1>
      <p>The app shell was not available in the cache yet. Reconnect once, open TraceBuddy again, then it can load offline.</p>
    </main>
  </body>
</html>`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (shouldCacheAsset(request, url)) {
    event.respondWith(staleWhileRevalidate(request))
  }
})

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME)

  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put('/', response.clone())
    }
    return response
  } catch {
    return (await cache.match('/')) || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
}

function shouldCacheAsset(request, url) {
  return (
    ['script', 'style', 'image', 'font', 'manifest'].includes(request.destination) ||
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/favicon.svg'
  )
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)

  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => undefined)

  if (cached) {
    void refresh
    return cached
  }

  return (await refresh) || new Response('', { status: 504, statusText: 'Offline' })
}
