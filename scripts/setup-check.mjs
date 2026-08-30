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
  await page.evaluate(() => {
    localStorage.removeItem('tracebuddy.parentSetupSeen.v1')
    localStorage.removeItem('tracebuddy.savedAlignment.v1')
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await clickByText(page, 'Try camera trace')
  await waitForSelector(page, '.setup-coach-backdrop')

  assert(await page.evaluate(() => document.activeElement?.textContent?.includes('Stand is stable')), 'Setup did not move keyboard focus into the dialog')
  await page.keyboard.down('Shift')
  await page.keyboard.press('Tab')
  await page.keyboard.up('Shift')
  assert(await page.evaluate(() => document.activeElement?.textContent?.includes('Close for now')), 'Shift+Tab escaped the setup dialog')
  await page.keyboard.press('Tab')
  assert(await page.evaluate(() => document.activeElement?.textContent?.includes('Stand is stable')), 'Tab did not wrap inside the setup dialog')
  assert(await page.$eval('.setup-coach .primary-button', (button) => button.disabled), 'Setup should require all three safety checks')
  await clickByText(page, 'Stand is stable')
  await clickByText(page, 'Whole page is visible')
  await clickByText(page, 'Light is even')
  assert(!await page.$eval('.setup-coach .primary-button', (button) => button.disabled), 'Setup did not become ready after all three checks')
  await clickByText(page, 'Ready to align')
  await page.waitForSelector('.setup-coach-backdrop', { hidden: true })
  assert(await page.evaluate(() => localStorage.getItem('tracebuddy.parentSetupSeen.v1')) === '1', 'Setup completion was not remembered locally')

  await clickByText(page, 'Save alignment')
  const storedAlignment = await page.evaluate(() => JSON.parse(localStorage.getItem('tracebuddy.savedAlignment.v1') || 'null'))
  assert(storedAlignment?.version === 1 && storedAlignment?.scale === 1, 'Current alignment was not saved')
  await page.click('button[aria-label="Move overlay right"]')
  const movedTransform = await page.$eval('.overlay-layer', (overlay) => overlay.style.transform)
  await clickByText(page, 'Resume saved')
  const restoredTransform = await page.$eval('.overlay-layer', (overlay) => overlay.style.transform)
  assert(movedTransform !== restoredTransform && restoredTransform.includes('0px'), 'Saved alignment did not restore the overlay')

  await clickByText(page, 'Start child trace')
  await waitForSelector(page, '.trace-screen.child-trace-mode')
  assert(await page.$eval('.overlay-layer', (overlay) => overlay.classList.contains('locked')), 'Child trace mode did not lock the overlay')
  assert(await page.$eval('.topbar', (topbar) => getComputedStyle(topbar).display === 'none'), 'Child trace mode did not hide the global navigation')
  await clickByText(page, 'Exit child mode')
  await page.waitForFunction(() => !document.querySelector('.trace-screen')?.classList.contains('child-trace-mode'))

  await page.$eval('.trace-header .secondary-button', (button) => {
    button.focus()
    button.click()
  })
  await waitForSelector(page, '.setup-coach-backdrop')
  await clickByText(page, 'Close for now')
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Parent setup')
  await page.reload({ waitUntil: 'networkidle0' })
  await clickByText(page, 'Try camera trace')
  await waitForSelector(page, '.trace-screen')
  assert(await page.$('.setup-coach-backdrop') === null, 'Completed parent setup reopened automatically after reload')

  assert(pageErrors.length === 0, `Parent setup flow emitted page errors: ${pageErrors.join(' | ')}`)
  console.log('Parent setup coach, saved alignment, child trace mode, and setup persistence passed')
} finally {
  await page.close().catch(() => undefined)
  await closeBrowser(browser)
}
