import puppeteer from 'puppeteer-core'
import { clickByText, closeBrowser, findChromeExecutable, waitForSelector } from './browser-utils.mjs'

const url = process.env.CHECK_URL || 'http://127.0.0.1:5173'

const browser = await puppeteer.launch({
  executablePath: findChromeExecutable(),
  headless: true,
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
})

async function checkViewport(name, width, height, expectedSelector, action) {
  const page = await browser.newPage()
  try {
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`)
    })
    page.on('requestfailed', (request) => {
      const errorText = request.failure()?.errorText ?? 'unknown'
      if (errorText === 'net::ERR_ABORTED') return
      pageErrors.push(`request failed: ${request.url()} (${errorText})`)
    })
    const isMobile = Math.min(width, height) < 600
    await page.setViewport({ width, height, deviceScaleFactor: isMobile ? 2 : 1, isMobile })
    await page.goto(url, { waitUntil: 'networkidle0' })
    if (action) await action(page)
    await waitForSelector(page, expectedSelector)
    await new Promise((resolve) => setTimeout(resolve, 250))
    const metrics = await page.evaluate(() => {
    const isInsideHorizontalScroller = (element) => {
      let parent = element.parentElement
      while (parent) {
        const style = getComputedStyle(parent)
        if (['auto', 'scroll'].includes(style.overflowX) && parent.scrollWidth > parent.clientWidth + 1) return true
        parent = parent.parentElement
      }
      return false
    }
    const offenders = [...document.querySelectorAll('*')]
      .map((el) => {
        const r = el.getBoundingClientRect()
        return { element: el, tag: el.tagName, cls: String(el.className), text: el.textContent?.trim().slice(0, 80), left: r.left, right: r.right, width: r.width }
      })
      .filter((x) => (x.right > window.innerWidth + 1 || x.left < -1) && !isInsideHorizontalScroller(x.element))
      .map((offender) => ({ tag: offender.tag, cls: offender.cls, text: offender.text, left: offender.left, right: offender.right, width: offender.width }))
    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      offenders: offenders.slice(0, 20),
    }
    })
    console.log(name, JSON.stringify(metrics, null, 2))
    if (pageErrors.length || metrics.scrollWidth > metrics.innerWidth + 1 || metrics.offenders.length) {
      if (pageErrors.length) console.error(`${name} page errors`, pageErrors)
      throw new Error(`${name} failed its browser checks`)
    }
  } finally {
    await page.close().catch(() => undefined)
  }
}

try {
  await checkViewport('desktop-home', 1440, 1100, '.hero-screen')
  await checkViewport('mobile-home', 390, 950, '.hero-screen')
  await checkViewport('desktop-picker', 1440, 1100, '.picker-screen', (page) => clickByText(page, 'Pick a picture'))
  await checkViewport('mobile-picker', 390, 950, '.picker-screen', (page) => clickByText(page, 'Pick a picture'))
  await checkViewport('desktop-learning', 1440, 1100, '.learning-screen', (page) => clickByText(page, 'Learn step by step'))
  await checkViewport('mobile-learning', 390, 950, '.learning-screen', (page) => clickByText(page, 'Learn step by step'))
  await checkViewport('phone-landscape-learning', 844, 390, '.learning-screen', (page) => clickByText(page, 'Learn step by step'))
  await checkViewport('tablet-portrait-learning', 820, 1180, '.learning-screen', (page) => clickByText(page, 'Learn step by step'))
  await checkViewport('tablet-landscape-learning', 1180, 820, '.learning-screen', (page) => clickByText(page, 'Learn step by step'))
  await checkViewport('desktop-trace', 1440, 1100, '.trace-screen', (page) => clickByText(page, 'Try camera trace'))
  await checkViewport('mobile-trace', 390, 950, '.trace-screen', (page) => clickByText(page, 'Try camera trace'))
  await checkViewport('phone-landscape-trace', 844, 390, '.trace-screen', (page) => clickByText(page, 'Try camera trace'))
  await checkViewport('tablet-portrait-trace', 820, 1180, '.trace-screen', (page) => clickByText(page, 'Try camera trace'))
  await checkViewport('tablet-landscape-trace', 1180, 820, '.trace-screen', (page) => clickByText(page, 'Try camera trace'))
  await checkViewport('desktop-practice', 1440, 1100, '.practice-screen', (page) => clickByText(page, 'Practice on screen'))
  await checkViewport('mobile-practice', 390, 950, '.practice-screen', (page) => clickByText(page, 'Practice on screen'))
  await checkViewport('phone-landscape-practice', 844, 390, '.practice-screen', (page) => clickByText(page, 'Practice on screen'))
  await checkViewport('tablet-portrait-practice', 820, 1180, '.practice-screen', (page) => clickByText(page, 'Practice on screen'))
  await checkViewport('tablet-landscape-practice', 1180, 820, '.practice-screen', (page) => clickByText(page, 'Practice on screen'))
} finally {
  await closeBrowser(browser)
}
