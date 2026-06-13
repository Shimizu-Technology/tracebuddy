import puppeteer from 'puppeteer-core'

const url = process.env.CHECK_URL || 'http://127.0.0.1:5173'
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
})

async function pause(ms = 350) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function click(page, text) {
  const ok = await page.evaluate((target) => {
    const node = [...document.querySelectorAll('button, label')].find((el) => el.textContent?.includes(target))
    if (!node) return false
    node.click()
    return true
  }, text)
  if (!ok) throw new Error(`Could not click ${text}`)
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
  await page.close()
}

async function mobile() {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 950, deviceScaleFactor: 2, isMobile: true })
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.screenshot({ path: '/tmp/tracebuddy-04-home-mobile.png', fullPage: true })
  await click(page, 'Try camera trace')
  await page.screenshot({ path: '/tmp/tracebuddy-05-trace-mobile.png', fullPage: true })
  const metrics = await page.evaluate(() => ({ innerWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth }))
  console.log(JSON.stringify(metrics, null, 2))
  await page.close()
}

await desktop()
await mobile()
await browser.close()
console.log('TraceBuddy screenshots saved to /tmp/tracebuddy-*.png')
