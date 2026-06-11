const CACHE_NAME = 'tracebuddy-app-shell-v2'
const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.svg']
const VITE_ASSET_PREFIX = '/assets/'

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
    const { response, refresh } = staleWhileRevalidate(request)
    event.respondWith(response)
    event.waitUntil(refresh)
  }
})

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME)

  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put('/', response.clone())

      if (isHtmlResponse(response)) {
        const html = await response.clone().text()
        await pruneStaleViteAssets(cache, extractViteAssets(html))
      }
    }
    return response
  } catch {
    return (await cache.match('/')) || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
}

function isHtmlResponse(response) {
  return response.headers.get('content-type')?.includes('text/html')
}

function extractViteAssets(html) {
  const matches = html.match(/\/assets\/[^"'<>\s)]+/g) || []
  return new Set(matches.map((assetPath) => new URL(assetPath, self.location.origin).href))
}

async function pruneStaleViteAssets(cache, currentAssetUrls) {
  if (!currentAssetUrls.size) return

  const cachedRequests = await cache.keys()
  await Promise.all(
    cachedRequests
      .filter((cachedRequest) => {
        const cachedUrl = new URL(cachedRequest.url)
        return cachedUrl.pathname.startsWith(VITE_ASSET_PREFIX) && !currentAssetUrls.has(cachedUrl.href)
      })
      .map((cachedRequest) => cache.delete(cachedRequest)),
  )
}

function shouldCacheAsset(request, url) {
  return (
    ['script', 'style', 'image', 'font', 'manifest'].includes(request.destination) ||
    url.pathname.startsWith(VITE_ASSET_PREFIX) ||
    url.pathname === '/favicon.svg'
  )
}

function staleWhileRevalidate(request) {
  const cachePromise = caches.open(CACHE_NAME)
  const refreshResponse = cachePromise
    .then((cache) => fetch(request)
      .then(async (fetchResponse) => {
        if (fetchResponse.ok) {
          try {
            await cache.put(request, fetchResponse.clone())
          } catch {
            // The network response is still valid even if the cache write fails.
          }
        }
        return fetchResponse
      }))
    .catch(() => undefined)

  const response = cachePromise
    .then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) return cached

      return (await refreshResponse) || new Response('', { status: 504, statusText: 'Offline' })
    })
    .catch(async () => (await refreshResponse) || new Response('', { status: 504, statusText: 'Offline' }))

  return {
    response,
    refresh: refreshResponse.then(() => undefined),
  }
}
