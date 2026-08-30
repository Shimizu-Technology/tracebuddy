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

  assert(await page.$$eval('[data-drawing-id]', (cards) => cards.length) === 73, 'The unfiltered picker should show all 73 templates')

  await page.type('.drawing-search input', 'Guam')
  await waitForSelector(page, '[data-drawing-id="guam-outline"]')
  const searchNames = await page.$$eval('[data-drawing-id] .drawing-meta strong', (names) => names.map((name) => name.textContent?.trim()))
  assert(searchNames.includes('Guam Outline'), `Searching Guam did not show Guam Outline: ${searchNames.join(', ')}`)
  assert(searchNames.length < 73, 'Search did not narrow the template library')

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
  await page.waitForFunction(() => document.querySelectorAll('[data-drawing-id]').length === 73)

  await clickByText(page, 'Island')
  await clickByText(page, 'Starter')
  const combinedFilterValid = await page.$$eval('[data-drawing-id]', (cards) => cards.length > 0 && cards.every((card) => {
    const difficulty = card.querySelector('.difficulty-badge')?.textContent?.trim()
    return difficulty === 'Starter'
  }))
  assert(combinedFilterValid, 'Combined category and difficulty filters returned an invalid result')

  assert(pageErrors.length === 0, `Discovery flow emitted page errors: ${pageErrors.join(' | ')}`)
  console.log('Discovery, favorites, recent picks, persistence, empty state, and combined filters passed')
} finally {
  await page.close().catch(() => undefined)
  await closeBrowser(browser)
}
