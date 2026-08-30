import puppeteer from 'puppeteer-core'
import { closeBrowser, findChromeExecutable, waitForSelector } from './browser-utils.mjs'

const url = process.env.CHECK_URL || 'http://127.0.0.1:5173'
const browser = await puppeteer.launch({
  executablePath: findChromeExecutable(),
  headless: true,
  args: ['--no-sandbox'],
})
let page = await browser.newPage()

try {
  await page.goto(url, { waitUntil: 'networkidle0' })
  await waitForSelector(page, '.hero-screen')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await Promise.race([
        new Promise((resolveController) => navigator.serviceWorker.addEventListener('controllerchange', resolveController, { once: true })),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker did not take control')), 8_000)),
      ])
    }
  })

  const appUrl = new URL(url)
  const upgradePrefix = `offline-upgrade-${Date.now()}`
  const v2BuildId = `${upgradePrefix}-v2`
  const v3BuildId = `${upgradePrefix}-v3`
  const waitForWaitingWorker = (buildId) => page.evaluate(async ({ origin, targetBuildId }) => {
    const registration = await Promise.race([
      navigator.serviceWorker.register(`${origin}/sw.js?build=${targetBuildId}`),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Worker ${targetBuildId} registration timed out`)), 8_000)),
    ])
    if (registration.waiting?.scriptURL.includes(targetBuildId)) return
    await new Promise((resolveWaiting, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Worker ${targetBuildId} did not reach waiting state`)), 8_000)
      const inspect = () => {
        if (!registration.waiting?.scriptURL.includes(targetBuildId)) return
        clearTimeout(timeout)
        resolveWaiting()
      }
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', inspect)
        inspect()
      })
      registration.installing?.addEventListener('statechange', inspect)
      inspect()
    })
  }, { origin: appUrl.origin, targetBuildId: buildId })

  await waitForWaitingWorker(v2BuildId)
  console.log('Upgrade v2 reached waiting state')
  await waitForWaitingWorker(v3BuildId)
  console.log('Upgrade v3 replaced the waiting worker')
  await page.evaluate(async (targetBuildId) => {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration?.waiting?.scriptURL.includes(targetBuildId)) throw new Error('Expected upgrade worker is not waiting')
    const activated = new Promise((resolveActivated, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Worker ${targetBuildId} did not activate`)), 8_000)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!navigator.serviceWorker.controller?.scriptURL.includes(targetBuildId)) return
        clearTimeout(timeout)
        resolveActivated()
      })
    })
    registration.waiting.postMessage({ type: 'TRACEBUDDY_ACTIVATE_UPDATE' })
    await activated
  }, v3BuildId)
  await page.goto(`${appUrl.origin}/privacy.html`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('h1')
  await page.waitForFunction((targetBuildId) => navigator.serviceWorker.controller?.scriptURL.includes(targetBuildId), { timeout: 8_000 }, v3BuildId)
  console.log('Upgrade v3 activated after the explicit update signal')
  const cacheState = await page.evaluate(async ({ expectedCurrent, replacedCandidate }) => {
    const metadata = await caches.open('tracebuddy-cache-metadata')
    const currentResponse = await metadata.match('/__tracebuddy_current_cache__')
    return {
      current: currentResponse ? await currentResponse.text() : null,
      names: await caches.keys(),
      expectedCurrent,
      replacedCandidate,
    }
  }, { expectedCurrent: `tracebuddy-app-shell-${v3BuildId}-ready-`, replacedCandidate: `tracebuddy-app-shell-${v2BuildId}-candidate` })
  if (!cacheState.current?.startsWith(cacheState.expectedCurrent)) throw new Error(`Wrong app-shell cache promoted: ${cacheState.current}`)
  if (cacheState.names.includes(cacheState.replacedCandidate)) throw new Error('A replaced waiting worker left its candidate cache behind')
  await page.evaluate(async ({ origin, targetBuildId }) => {
    const registration = await navigator.serviceWorker.register(`${origin}/sw.js?build=${targetBuildId}&fail-install=1`)
    const worker = registration.installing
    if (!worker) throw new Error('The failed same-build worker did not begin installing')
    await new Promise((resolveFailure, reject) => {
      const timeout = setTimeout(() => reject(new Error('The simulated install failure did not settle')), 8_000)
      const inspect = () => {
        if (worker.state !== 'redundant') return
        clearTimeout(timeout)
        resolveFailure()
      }
      worker.addEventListener('statechange', inspect)
      inspect()
    })
  }, { origin: appUrl.origin, targetBuildId: v3BuildId })
  const failedReinstallState = await page.evaluate(async () => {
    const metadata = await caches.open('tracebuddy-cache-metadata')
    const currentResponse = await metadata.match('/__tracebuddy_current_cache__')
    return {
      current: currentResponse ? await currentResponse.text() : null,
      names: await caches.keys(),
    }
  })
  if (failedReinstallState.current !== cacheState.current) throw new Error('A failed same-build install replaced the promoted cache')
  if (!failedReinstallState.names.includes(cacheState.current)) throw new Error('A failed same-build install deleted the promoted cache')
  if (failedReinstallState.names.includes(`tracebuddy-app-shell-${v3BuildId}-candidate`)) throw new Error('A failed same-build install left a partial candidate cache')
  console.log('Failed same-build reinstall preserved the promoted app shell')
  await page.setOfflineMode(true)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10_000 })
  await waitForSelector(page, '.hero-screen')
  const title = await page.title()
  if (!title.includes('TraceBuddy')) throw new Error(`Unexpected offline page title: ${title}`)
  console.log('Offline check passed: rapid worker upgrades promote the exact build, retain a complete shell, and resist static-page cache poisoning.')
} finally {
  await page.setOfflineMode(false).catch(() => undefined)
  await closeBrowser(browser)
}
