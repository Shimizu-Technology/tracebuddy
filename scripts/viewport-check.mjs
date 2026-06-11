import puppeteer from 'puppeteer-core'

const url = process.env.CHECK_URL || 'http://127.0.0.1:5173'
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
})

async function checkViewport(name, width, height, action) {
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: width < 600 ? 2 : 1, isMobile: width < 600 })
  await page.goto(url, { waitUntil: 'networkidle0' })
  if (action) await action(page)
  await new Promise((resolve) => setTimeout(resolve, 250))
  const metrics = await page.evaluate(() => {
    const offenders = [...document.querySelectorAll('*')]
      .map((el) => {
        const r = el.getBoundingClientRect()
        return { tag: el.tagName, cls: String(el.className), text: el.textContent?.trim().slice(0, 80), left: r.left, right: r.right, width: r.width }
      })
      .filter((x) => x.right > window.innerWidth + 1 || x.left < -1)
    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      offenders: offenders.slice(0, 20),
    }
  })
  console.log(name, JSON.stringify(metrics, null, 2))
  if (metrics.scrollWidth > metrics.innerWidth + 1 || metrics.offenders.length) {
    await browser.close()
    process.exit(1)
  }
  await page.close()
}

await checkViewport('desktop-home', 1440, 1100)
await checkViewport('mobile-home', 390, 950)
await checkViewport('desktop-trace', 1440, 1100, async (page) => {
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Try trace mode'))?.click())
})
await checkViewport('mobile-trace', 390, 950, async (page) => {
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Try trace mode'))?.click())
})

await browser.close()
