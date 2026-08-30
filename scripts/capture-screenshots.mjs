import puppeteer from 'puppeteer-core'
import { clickByText, closeBrowser, findChromeExecutable } from './browser-utils.mjs'

const url = process.env.CHECK_URL || 'http://127.0.0.1:5173'

const browser = await puppeteer.launch({
  executablePath: findChromeExecutable(),
  headless: true,
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
})

async function pause(ms = 350) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function click(page, text) {
  await clickByText(page, text)
  await pause()
}

async function desktop() {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 })
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.screenshot({ path: '/tmp/tracebuddy-01-home-desktop.png', fullPage: true })
  await click(page, 'Pick a picture')
  await page.screenshot({ path: '/tmp/tracebuddy-02-picker-desktop.png', fullPage: true })
  await click(page, 'Island Turtle')
  await page.screenshot({ path: '/tmp/tracebuddy-03-trace-desktop.png', fullPage: true })
  await click(page, 'Practice')
  await page.screenshot({ path: '/tmp/tracebuddy-04-practice-desktop.png', fullPage: true })
  await page.close()
}

async function mobile() {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 950, deviceScaleFactor: 2, isMobile: true })
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.screenshot({ path: '/tmp/tracebuddy-05-home-mobile.png', fullPage: true })
  await click(page, 'Try camera trace')
  await page.screenshot({ path: '/tmp/tracebuddy-06-trace-mobile.png', fullPage: true })
  await click(page, 'Practice')
  await page.screenshot({ path: '/tmp/tracebuddy-07-practice-mobile.png', fullPage: true })
  const metrics = await page.evaluate(() => ({ innerWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth }))
  console.log(JSON.stringify(metrics, null, 2))
  await page.close()
}

try {
  await desktop()
  await mobile()
  console.log('TraceBuddy screenshots saved to /tmp/tracebuddy-*.png')
} finally {
  await closeBrowser(browser)
}
