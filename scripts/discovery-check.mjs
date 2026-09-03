import puppeteer from 'puppeteer-core'
import { clickByText, closeBrowser, findChromeExecutable, waitForSelector } from './browser-utils.mjs'

const url = process.env.CHECK_URL || 'http://127.0.0.1:5173'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const browser = await puppeteer.launch({
  executablePath: findChromeExecutable(),
  headless: true,
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
})

const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`)
})

try {
  await page.setViewport({ width: 1180, height: 900, deviceScaleFactor: 1 })
  await page.goto(url, { waitUntil: 'networkidle0' })
  await clickByText(page, 'Pick a picture')
  await waitForSelector(page, '.picker-screen')

  assert(await page.$$eval('[data-drawing-id]', (cards) => cards.length) === 64, 'The unfiltered picker should show all 64 templates')

  const drawingsTouchingCanvasEdge = await page.$$eval('[data-drawing-id]', async (cards) => {
    const failures = []
    for (const card of cards) {
      const image = card.querySelector('img')
      if (!image) {
        failures.push(card.getAttribute('data-drawing-id'))
        continue
      }
      if (!image.complete) await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = 420
      canvas.height = 420
      const context = canvas.getContext('2d')
      context?.drawImage(image, 0, 0, 420, 420)
      const pixels = context?.getImageData(0, 0, 420, 420).data
      if (!pixels) {
        failures.push(card.getAttribute('data-drawing-id'))
        continue
      }
      const safetyEdges = [0, 1, 418, 419]
      const edgeHasInk = Array.from({ length: 420 }, (_, offset) => offset).some((offset) => (
        safetyEdges.some((edge) => {
          const horizontal = (((edge * 420) + offset) * 4) + 3
          const vertical = (((offset * 420) + edge) * 4) + 3
          return pixels[horizontal] > 0 || pixels[vertical] > 0
        })
      ))
      if (edgeHasInk) failures.push(card.getAttribute('data-drawing-id'))
    }
    return failures
  })
  assert(drawingsTouchingCanvasEdge.length === 0, `Drawings touch the canvas edge: ${drawingsTouchingCanvasEdge.join(', ')}`)

  async function assertFavoriteControlsClearArtwork(viewportLabel) {
    const layout = await page.$$eval('[data-drawing-id]', (cards) => cards.map((card) => {
      const artwork = card.querySelector('img')?.getBoundingClientRect()
      const favorite = card.querySelector('[data-favorite-button]')?.getBoundingClientRect()
      if (!artwork || !favorite) return { id: card.getAttribute('data-drawing-id'), missing: true }
      const overlaps = favorite.left < artwork.right && favorite.right > artwork.left
        && favorite.top < artwork.bottom && favorite.bottom > artwork.top
      return {
        id: card.getAttribute('data-drawing-id'),
        missing: false,
        overlaps,
        width: favorite.width,
        height: favorite.height,
      }
    }))
    const invalid = layout.filter(({ missing, overlaps, width, height }) => missing || overlaps || width < 44 || height < 44)
    assert(invalid.length === 0, `${viewportLabel} favorite controls obscure artwork or miss the 44px target: ${JSON.stringify(invalid)}`)
  }

  await assertFavoriteControlsClearArtwork('Desktop')
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await assertFavoriteControlsClearArtwork('Mobile')
  await page.setViewport({ width: 1180, height: 900, deviceScaleFactor: 1 })

  await page.type('.drawing-search input', 'Guam')
  await waitForSelector(page, '[data-drawing-id="guam-outline"]')
  const searchNames = await page.$$eval('[data-drawing-id] .drawing-meta strong', (names) => names.map((name) => name.textContent?.trim()))
  assert(searchNames.includes('Guam Outline'), `Searching Guam did not show Guam Outline: ${searchNames.join(', ')}`)
  assert(searchNames.length < 64, 'Search did not narrow the template library')

  await page.click('[data-favorite-button="guam-outline"]')
  await page.click('.favorites-filter')
  await page.waitForFunction(() => document.querySelectorAll('[data-drawing-id]').length === 1)
  assert(await page.$eval('[data-drawing-id]', (card) => card.getAttribute('data-drawing-id')) === 'guam-outline', 'Favorites-only did not show the saved favorite')

  const storedPreferences = await page.evaluate(() => JSON.parse(localStorage.getItem('tracebuddy.drawingPreferences.v1') || 'null'))
  assert(storedPreferences?.favoriteIds?.includes('guam-outline'), 'Favorite was not persisted to local storage')

  await page.reload({ waitUntil: 'networkidle0' })
  await clickByText(page, 'Pictures')
  await waitForSelector(page, '.picker-screen')
  assert(await page.$eval('.favorites-filter small', (count) => count.textContent?.trim()) === '1', 'Favorite count did not survive reload')
  await page.click('.favorites-filter')
  await page.waitForFunction(() => document.querySelectorAll('[data-drawing-id]').length === 1)

  await page.click('[data-drawing-id="guam-outline"] .drawing-card-action')
  await waitForSelector(page, '.trace-screen')
  await clickByText(page, 'Pictures')
  await waitForSelector(page, '.picker-screen')
  const recentLabels = await page.$$eval('.recent-picks button', (buttons) => buttons.map((button) => button.textContent?.trim()))
  assert(recentLabels.includes('Guam Outline'), `Recent picks did not record Guam Outline: ${recentLabels.join(', ')}`)

  await page.type('.drawing-search input', 'no-such-tracebuddy-picture')
  await waitForSelector(page, '.drawing-empty-state')
  await clickByText(page, 'Show all pictures')
  await page.waitForFunction(() => document.querySelectorAll('[data-drawing-id]').length === 64)

  await clickByText(page, 'Island')
  await clickByText(page, 'Starter')
  const combinedFilterValid = await page.$$eval('[data-drawing-id]', (cards) => cards.length > 0 && cards.every((card) => {
    const difficulty = card.querySelector('.difficulty-badge')?.textContent?.trim()
    return difficulty === 'Starter' && card.getAttribute('data-drawing-category') === 'island'
  }))
  assert(combinedFilterValid, 'Combined category and difficulty filters returned an invalid result')

  const storageFailurePage = await browser.newPage()
  try {
    await storageFailurePage.evaluateOnNewDocument(() => {
      const originalGetItem = Storage.prototype.getItem
      Storage.prototype.getItem = function getItemWithPreferenceFailure(key) {
        if (key === 'tracebuddy.drawingPreferences.v1') throw new DOMException('Simulated preference read failure', 'SecurityError')
        return originalGetItem.call(this, key)
      }
    })
    await storageFailurePage.goto(url, { waitUntil: 'networkidle0' })
    await clickByText(storageFailurePage, 'Pick a picture')
    await storageFailurePage.waitForFunction(() => document.querySelector('.preference-message')?.textContent?.includes('will last for this visit only'))
  } finally {
    await storageFailurePage.close().catch(() => undefined)
  }

  assert(pageErrors.length === 0, `Discovery flow emitted page errors: ${pageErrors.join(' | ')}`)
  console.log('Discovery, favorites, recent picks, persistence fallback, empty state, and combined filters passed')
} finally {
  await page.close().catch(() => undefined)
  await closeBrowser(browser)
}
