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

async function waitForRoute(hash, selector) {
  await page.waitForFunction((expectedHash) => window.location.hash === expectedHash, {}, hash)
  await waitForSelector(page, selector)
  await page.waitForFunction((expectedSelector) => document.activeElement === document.querySelector(`${expectedSelector} h1`), {}, selector)
}

try {
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true })
  await page.goto(url, { waitUntil: 'networkidle0' })
  await waitForRoute('#home', '.hero-screen')
  assert(await page.title() === 'Home · TraceBuddy', `Unexpected home title: ${await page.title()}`)

  await clickByText(page, 'Pick a picture')
  await waitForRoute('#pictures', '.picker-screen')
  assert(await page.$eval('.topbar nav', (nav) => nav.scrollWidth <= nav.clientWidth + 1), 'Mobile navigation overflows its container')

  await page.goBack()
  await waitForRoute('#home', '.hero-screen')
  await page.goForward()
  await waitForRoute('#pictures', '.picker-screen')

  await page.evaluate(() => { window.location.hash = '#together' })
  await waitForRoute('#together', '.family-screen')
  await page.evaluate(() => { window.location.hash = '#pictures' })
  await waitForRoute('#pictures', '.picker-screen')

  await clickByText(page, 'Help')
  await waitForSelector(page, '.parent-help-dialog')
  const helpState = await page.evaluate(() => ({
    activeLabel: document.activeElement?.getAttribute('aria-label'),
    bodyOverflow: document.body.style.overflow,
    supportHref: document.querySelector('.parent-help-links a')?.getAttribute('href'),
    privacyHref: document.querySelectorAll('.parent-help-links a')[1]?.getAttribute('href'),
    smallTargets: [...document.querySelectorAll('.parent-help-dialog button, .parent-help-dialog a')]
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width < 44 || rect.height < 44
      })
      .map((element) => element.textContent?.trim()),
  }))
  assert(helpState.activeLabel === 'Close parent help', `Help dialog did not receive focus: ${JSON.stringify(helpState)}`)
  assert(helpState.bodyOverflow === 'hidden', 'Help dialog did not lock background scrolling')
  assert(helpState.supportHref === '/support.html' && helpState.privacyHref === '/privacy.html', `Help links are incorrect: ${JSON.stringify(helpState)}`)
  assert(helpState.smallTargets.length === 0, `Help dialog has touch targets below 44px: ${JSON.stringify(helpState.smallTargets)}`)
  await page.$eval('.parent-help-backdrop', (backdrop) => backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
  await page.waitForSelector('.parent-help-dialog', { hidden: true })

  await clickByText(page, 'Help')
  await waitForSelector(page, '.parent-help-dialog')
  await page.keyboard.press('Escape')
  await page.waitForSelector('.parent-help-dialog', { hidden: true })

  await page.goto(`${url.replace(/#.*$/, '')}#learn`, { waitUntil: 'networkidle0' })
  await waitForRoute('#learn', '.learning-screen')
  assert(await page.title() === 'Guided learning · TraceBuddy', `Unexpected guided-learning title: ${await page.title()}`)

  await page.goto(`${url.replace(/#.*$/, '')}#home`, { waitUntil: 'networkidle0' })
  await waitForRoute('#home', '.hero-screen')
  await clickByText(page, 'Help')
  await clickByText(page, 'Draw on this screen')
  await waitForRoute('#practice', '.practice-screen')
  await page.evaluate(() => {
    window.__traceBuddyOriginalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function failPracticeHistorySave(key, value) {
      if (String(key).startsWith('tracebuddy.previousWork.v1.')) throw new DOMException('Simulated history save failure', 'QuotaExceededError')
      return window.__traceBuddyOriginalSetItem.call(this, key, value)
    }
  })
  await page.$eval('.practice-canvas', (canvas) => canvas.scrollIntoView({ block: 'start', behavior: 'instant' }))
  const canvasBox = await page.$eval('.practice-canvas', (canvas) => {
    const rect = canvas.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.35, canvasBox.y + canvasBox.height * 0.35)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.52, canvasBox.y + canvasBox.height * 0.48, { steps: 8 })
  await page.mouse.up()
  let leaveWarning = ''
  page.once('dialog', async (dialog) => {
    leaveWarning = dialog.message()
    await dialog.dismiss()
  })
  await page.goBack()
  await page.waitForFunction(() => window.location.hash === '#practice')
  assert(leaveWarning.includes('could not save'), `Browser Back did not protect unsaved work: ${leaveWarning}`)

  let hashWarning = ''
  page.once('dialog', async (dialog) => {
    hashWarning = dialog.message()
    await dialog.dismiss()
  })
  await page.evaluate(() => { window.location.hash = '#pictures' })
  await page.waitForFunction(() => window.location.hash === '#practice')
  assert(hashWarning.includes('could not save'), `Hash navigation did not protect unsaved work: ${hashWarning}`)
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__traceBuddyOriginalSetItem
    delete window.__traceBuddyOriginalSetItem
  })
  await page.evaluate(() => { window.location.hash = '#home' })
  await waitForRoute('#home', '.hero-screen')

  await page.evaluate(() => { window.location.hash = '#not-a-tracebuddy-screen' })
  await page.waitForFunction(() => window.location.hash === '#home')

  assert(pageErrors.length === 0, `Navigation and help flow emitted page errors: ${pageErrors.join(' | ')}`)
  console.log('Browser history, route focus, parent help, modal dismissal, touch targets, and policy links passed')
} finally {
  await page.close().catch(() => undefined)
  await closeBrowser(browser)
}
