const CACHE_PREFIX = 'tracebuddy-app-shell-'
const CACHE_METADATA = 'tracebuddy-cache-metadata'
const CURRENT_CACHE_KEY = '/__tracebuddy_current_cache__'
const CANDIDATE_CACHE_KEY = '/__tracebuddy_candidate_cache__'
const STATIC_SHELL = ['/manifest.webmanifest', '/favicon.svg']
const VITE_ASSET_PREFIX = '/assets/'
const EMBEDDED_BUILD_ID = '__TRACEBUDDY_BUILD_ID__'
const LOCAL_TEST_BUILD_ID = new URL(self.location.href).searchParams.get('build')?.replace(/[^a-zA-Z0-9_-]/g, '')
const BUILD_ID = self.location.hostname === '127.0.0.1' && LOCAL_TEST_BUILD_ID?.startsWith('offline-upgrade-') ? LOCAL_TEST_BUILD_ID : EMBEDDED_BUILD_ID
const BUILD_CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`

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
  event.waitUntil(installCompleteAppShell())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(promoteInstalledAppShell().then(() => self.clients.claim()))
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'TRACEBUDDY_ACTIVATE_UPDATE') void self.skipWaiting()
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
  try {
    return await fetch(request)
  } catch {
    const cache = await openCurrentAppShellCache()
    return (await cache?.match('/')) || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
}

async function installCompleteAppShell() {
  const htmlResponse = await fetch('/', { cache: 'reload' })
  if (!htmlResponse.ok || !isHtmlResponse(htmlResponse)) throw new Error('Could not fetch the TraceBuddy app shell')
  const html = await htmlResponse.clone().text()
  const viteAssetUrls = [...extractViteAssets(html)]
  if (viteAssetUrls.length === 0) throw new Error('TraceBuddy app-shell assets were not found')

  const cacheName = BUILD_CACHE_NAME
  const cache = await caches.open(cacheName)

  try {
    const shellUrls = [...STATIC_SHELL, ...viteAssetUrls]
    const shellResponses = await Promise.all(shellUrls.map(async (assetUrl) => {
      const response = await fetch(assetUrl, { cache: 'reload' })
      if (!response.ok) throw new Error(`Could not cache ${assetUrl}`)
      return [assetUrl, response]
    }))
    await Promise.all(shellResponses.map(([assetUrl, response]) => cache.put(assetUrl, response)))
    await cache.put('/', htmlResponse)
    await cache.put(CANDIDATE_CACHE_KEY, new Response(cacheName))
  } catch (error) {
    await caches.delete(cacheName)
    throw error
  }
}

async function promoteInstalledAppShell() {
  const names = await caches.keys()
  const nextCacheName = BUILD_CACHE_NAME
  if (!names.includes(nextCacheName)) throw new Error('The installed TraceBuddy cache is unavailable')
  const nextCache = await caches.open(nextCacheName)
  if (!await nextCache.match(CANDIDATE_CACHE_KEY)) throw new Error('The installed TraceBuddy cache is incomplete')

  const previousCacheName = await readCurrentCacheName()
  const metadataCache = await caches.open(CACHE_METADATA)
  await metadataCache.put(CURRENT_CACHE_KEY, new Response(nextCacheName))
  await nextCache.delete(CANDIDATE_CACHE_KEY)

  const retainedNames = new Set([nextCacheName, previousCacheName].filter(Boolean))
  await Promise.all(names
    .filter((name) => name.startsWith(CACHE_PREFIX) && !retainedNames.has(name))
    .map((name) => caches.delete(name)))
}

async function readCurrentCacheName() {
  const metadataCache = await caches.open(CACHE_METADATA)
  const response = await metadataCache.match(CURRENT_CACHE_KEY)
  return response ? response.text() : null
}

async function openCurrentAppShellCache() {
  const currentCacheName = await readCurrentCacheName()
  return currentCacheName ? caches.open(currentCacheName) : null
}

function isHtmlResponse(response) {
  return response.headers.get('content-type')?.includes('text/html')
}

function extractViteAssets(html) {
  const matches = html.match(/\/assets\/[^"'<>\s)]+/g) || []
  return new Set(matches.map((assetPath) => new URL(assetPath, self.location.origin).href))
}

function shouldCacheAsset(request, url) {
  return (
    ['script', 'style', 'image', 'font', 'manifest'].includes(request.destination) ||
    url.pathname.startsWith(VITE_ASSET_PREFIX) ||
    url.pathname === '/favicon.svg'
  )
}

function staleWhileRevalidate(request) {
  const cachePromise = openCurrentAppShellCache()
  const refreshResponse = cachePromise
    .then((cache) => fetch(request)
      .then(async (fetchResponse) => {
        if (fetchResponse.ok && cache) {
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
      const cached = await cache?.match(request)
      if (cached) return cached

      return (await refreshResponse) || new Response('', { status: 504, statusText: 'Offline' })
    })
    .catch(async () => (await refreshResponse) || new Response('', { status: 504, statusText: 'Offline' }))

  return {
    response,
    refresh: refreshResponse.then(() => undefined),
  }
}
