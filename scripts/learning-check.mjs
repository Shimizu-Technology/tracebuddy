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
  await clickByText(page, 'Learn step by step')
  await waitForSelector(page, '.learning-screen')

  assert(await page.$$eval('.lesson-library [data-lesson-id]', (cards) => cards.length) === 8, 'Learning library should show eight guided lessons')
  assert(await page.$eval('.lesson-instruction h3', (heading) => heading.textContent?.includes('slow line across')), 'First lesson did not start on its first prompt')

  await clickByText(page, 'Next step')
  await page.waitForFunction(() => document.querySelector('.lesson-step-dots button.active')?.textContent === '2')
  const storedStep = await page.evaluate(() => JSON.parse(localStorage.getItem('tracebuddy.learningProgress.v1') || 'null')?.stepByLessonId?.['line-control'])
  assert(storedStep === 1, `Lesson step was not persisted: ${storedStep}`)

  await page.click('.lesson-step-dots button:last-child')
  await clickByText(page, 'Finish lesson')
  await page.waitForFunction(() => document.querySelector('.lesson-finished-badge')?.textContent?.includes('Finished'))
  const storedCompletion = await page.evaluate(() => JSON.parse(localStorage.getItem('tracebuddy.learningProgress.v1') || 'null')?.completedLessonIds)
  assert(storedCompletion?.includes('line-control'), 'Finished lesson was not persisted')

  await page.reload({ waitUntil: 'networkidle0' })
  await clickByText(page, 'Learn')
  await waitForSelector(page, '.learning-screen')
  assert(await page.$eval('.lesson-finished-badge', (badge) => badge.textContent?.includes('Finished')), 'Finished lesson did not survive reload')

  await clickByText(page, 'Practice this step on screen')
  await waitForSelector(page, '.practice-screen')
  const canvasBox = await page.$eval('.practice-canvas', (canvas) => {
    const rect = canvas.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.35, canvasBox.y + canvasBox.height * 0.45)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.55, canvasBox.y + canvasBox.height * 0.55, { steps: 8 })
  await page.mouse.up()
  await clickByText(page, 'Pictures')
  await waitForSelector(page, '.picker-screen')
  const storedGuidedSource = await page.evaluate(() => Object.keys(localStorage)
    .filter((key) => key.startsWith('tracebuddy.previousWork.v1.session.'))
    .map((key) => JSON.parse(localStorage.getItem(key) || 'null')?.source)
    .find((source) => source?.drawingId?.startsWith('lesson-line-control-step-')))
  assert(storedGuidedSource?.drawingSvg?.includes('<svg'), 'Saved guided work did not embed its generated lesson guide')

  await clickByText(page, 'Learn')
  await waitForSelector(page, '.learning-screen')

  await page.type('.handwriting-card input', 'Stassie')
  await clickByText(page, 'Practice these words')
  await waitForSelector(page, '.practice-screen')
  assert(await page.$eval('.practice-header h1', (heading) => heading.textContent?.includes('Stassie')), 'Handwriting practice did not open the custom word guide')

  const storageFailurePage = await browser.newPage()
  try {
    await storageFailurePage.evaluateOnNewDocument(() => {
      const originalGetItem = Storage.prototype.getItem
      Storage.prototype.getItem = function getItemWithLearningFailure(key) {
        if (key === 'tracebuddy.learningProgress.v1') throw new DOMException('Simulated lesson progress failure', 'SecurityError')
        return originalGetItem.call(this, key)
      }
    })
    await storageFailurePage.goto(url, { waitUntil: 'networkidle0' })
    await clickByText(storageFailurePage, 'Learn step by step')
    await storageFailurePage.waitForFunction(() => document.querySelector('.preference-message')?.textContent?.includes('Lesson progress will last for this visit only'))
  } finally {
    await storageFailurePage.close().catch(() => undefined)
  }

  assert(pageErrors.length === 0, `Guided learning flow emitted page errors: ${pageErrors.join(' | ')}`)
  console.log('Guided lessons, progress persistence, handwriting practice, and storage fallback passed')
} finally {
  await page.close().catch(() => undefined)
  await closeBrowser(browser)
}
