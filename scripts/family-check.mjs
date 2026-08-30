import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { clickByText, closeBrowser, findChromeExecutable, waitForSelector } from './browser-utils.mjs'

const url = process.env.CHECK_URL || 'http://127.0.0.1:5173'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function waitForDownload(directory, suffix) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const files = await fs.readdir(directory)
    const match = files.find((file) => file.endsWith(suffix) && !file.endsWith('.crdownload'))
    if (match) return path.join(directory, match)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${suffix} download`)
}

const downloadDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'tracebuddy-family-check-'))
const browser = await puppeteer.launch({ executablePath: findChromeExecutable(), headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`) })

try {
  await page.setViewport({ width: 1180, height: 900, deviceScaleFactor: 1 })
  const client = await page.createCDPSession()
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDirectory })
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await clickByText(page, 'Play together')
  await waitForSelector(page, '.family-screen')
  await page.waitForFunction(() => window.scrollY === 0)
  assert(await page.$$eval('[data-family-activity-id]', (cards) => cards.length) === 12, 'Together library did not render all 12 activities')

  await page.click('[data-family-activity-id="guam-memory-map"]')
  assert(await page.$eval('.family-feature h2', (node) => node.textContent?.trim()) === 'Guam Memory Map', 'Selecting an activity did not update the feature')
  assert(await page.$$eval('.family-feature ol li', (steps) => steps.length) === 3, 'Selected activity did not show three steps')
  await clickByText(page, 'Download SVG')
  const worksheetPath = await waitForDownload(downloadDirectory, '.svg')
  const worksheet = await fs.readFile(worksheetPath, 'utf8')
  assert(worksheet.includes('Guam Memory Map') && worksheet.includes('TRACEBUDDY WORKSHEET'), 'Downloaded worksheet did not contain the selected activity')

  await clickByText(page, 'Practice together')
  await waitForSelector(page, '.practice-screen')
  assert(await page.$eval('.practice-header h1', (node) => node.textContent?.trim()) === 'Guam Outline', 'Activity did not open its starter drawing')
  await clickByText(page, 'Save image')
  const keepsakePath = await waitForDownload(downloadDirectory, '.png')
  const keepsake = await fs.readFile(keepsakePath)
  assert(keepsake.length > 10_000, 'PNG keepsake was unexpectedly small')

  assert(pageErrors.length === 0, `Family flow emitted page errors: ${pageErrors.join(' | ')}`)
  console.log('Family activities, worksheet download, and PNG keepsake flow passed')
} finally {
  await page.close().catch(() => undefined)
  await closeBrowser(browser)
  await fs.rm(downloadDirectory, { recursive: true, force: true })
}
