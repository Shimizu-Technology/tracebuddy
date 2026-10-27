import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { closeBrowser, findChromeExecutable } from './browser-utils.mjs'

// Chromium runs in CI without another dependency. For the Safari-engine pass,
// install Playwright outside the repo and set PRACTICE_PLAYWRIGHT to its module.
const webkit = process.env.PRACTICE_ENGINE === 'webkit'
const url = process.env.CHECK_URL || 'http://127.0.0.1:4173'
const output = process.env.PRACTICE_EVIDENCE
if (output) mkdirSync(output, { recursive: true })
const fixture = JSON.parse(readFileSync(new URL('./fixtures/practice-legacy.json', import.meta.url)))
const results = []
const errors = []
let server
const browser = webkit ? await (async () => {
  const { webkit } = await import(process.env.PRACTICE_PLAYWRIGHT || 'playwright')
  server = await webkit.launchServer({ headless: true })
  return webkit.connect(server.wsEndpoint())
})() : await puppeteer.launch({ executablePath: findChromeExecutable(), headless: true, protocolTimeout: 30_000, args: ['--no-sandbox'] })
const pid = webkit ? server.process().pid : browser.process().pid
const lifecycle = (action) => {
  if (process.env.DEV_LIFECYCLE_SESSION) execFileSync('dev-lifecycle', [action, '--session', process.env.DEV_LIFECYCLE_SESSION, ...(action === 'claim' ? ['--owner', 'tracebuddy-w1', 'process', String(pid)] : ['process', String(pid)])])
}
lifecycle('claim')
const pause = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms))
const click = async (page, selector) => { await page.$eval(selector, (el) => el.click()); await pause() }
async function textButton(page, text, selector = 'button') {
  await page.evaluate(({ text, selector }) => {
    const button = [...document.querySelectorAll(selector)].find((el) => el.textContent.trim() === text)
    if (!button) throw new Error(`Missing button ${text}`)
    button.click()
  }, { text, selector }); await pause()
}
async function setup(width = 360, height = 640) {
  const context = webkit ? await browser.newContext({ viewport: { width, height }, hasTouch: true }) : await browser.createBrowserContext()
  const page = await context.newPage()
  if (!webkit) await page.setViewport({ width, height, isMobile: true, hasTouch: true })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${url}/#home`)
  await page.waitForSelector('.hero-screen')
  return { context, page }
}
async function parent(page, open) {
  if (await page.$eval('.practice-toolbar-more', (el) => el.open) !== open) await click(page, '.practice-toolbar-more > summary')
}
async function zoom(page, scale) {
  await parent(page, true)
  await click(page, '.studio-tool.mode')
  for (let i = 1; i < scale; i += 0.35) await click(page, '[aria-label="Zoom in"]')
  await click(page, '.studio-tool.mode')
  await parent(page, false)
}
// Independent oracle: rendered viewport bounds + SVG viewBox's meet algebra +
// explicit pan/scale attributes. Neither expected point nor width uses a CTM.
async function geometry(page, x = 500, y = 500) {
  return page.$eval('.practice-transform-layer', (outer, { x, y }) => {
    const r = outer.getBoundingClientRect()
    const svg = outer.querySelector('.practice-document')
    const box = svg.viewBox.baseVal
    const parts = outer.firstElementChild.getAttribute('transform').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number)
    const [tx, ty, zoom] = parts
    const fit = Math.min(r.width / box.width, r.height / box.height)
    return { x: r.left + tx + zoom * ((r.width - box.width * fit) / 2 + x * fit),
      y: r.top + ty + zoom * ((r.height - box.height * fit) / 2 + y * fit), fit, zoom, side: Math.min(r.width, r.height) }
  }, { x, y })
}
async function draw(page, p, length = 16) {
  const x = Math.round(p.x), y = Math.round(p.y)
  await page.mouse.move(x, y); await page.mouse.down()
  await page.mouse.move(x + length, y, { steps: 4 }); await page.mouse.up(); await pause()
}
async function saved(page) {
  await pause(650)
  return page.evaluate(() => JSON.parse(localStorage.getItem(`tracebuddy.previousWork.v1.session.${localStorage.getItem('tracebuddy.practice.active.v1')}`)))
}
async function canonical(page, selector = '.practice-document') {
  return page.$eval(selector, (svg) => {
    const clone = svg.cloneNode(true)
    clone.setAttribute('width', '1000'); clone.setAttribute('height', '1000')
    clone.removeAttribute('class')
    return new XMLSerializer().serializeToString(clone)
  })
}
async function rasterDelta(page, a, b, png = false) {
  return page.evaluate(async ({ a, b, png }) => {
    async function pixels(src, isPng) {
      const image = new Image()
      image.src = isPng ? src : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`
      await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1000
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, 1000, 1000)
      return ctx.getImageData(0, 0, 1000, 1000).data
    }
    const [left, right] = await Promise.all([pixels(a), pixels(b, png)])
    let delta = 0
    for (let i = 0; i < left.length; i++) delta = Math.max(delta, Math.abs(left[i] - right[i]))
    return delta
  }, { a, b, png })
}
async function exportPng(page) {
  await page.evaluate(() => {
    window.__png = null
    HTMLAnchorElement.prototype.click = function () {
      if (!this.download.endsWith('.png')) return
      void fetch(this.href).then((r) => r.blob()).then((blob) => {
        const reader = new FileReader(); reader.onload = () => { window.__png = reader.result }; reader.readAsDataURL(blob)
      })
    }
  })
  await parent(page, true); await click(page, '.practice-toolbar-more .primary-button')
  await page.waitForFunction(() => Boolean(window.__png))
  return page.evaluate(() => window.__png)
}
try {
  {
    const { context, page } = await setup(390, 844)
    try {
      await page.goto(`${url}/#practice`)
      await page.waitForSelector('.practice-document')
      await pause(700)
      assert.equal(await page.evaluate(() => localStorage.getItem('tracebuddy.previousWork.v1.index')), null, 'Untouched drafts must not create gallery entries')
      assert.equal(await page.evaluate(() => localStorage.getItem('tracebuddy.practice.active.v1')), null)
      await draw(page, await geometry(page))
      const original = await saved(page)
      assert.equal(original.strokes.length, 1)
      await click(page, '.action-tool button')
      assert.equal((await saved(page)).strokes.length, 0, 'Undo must persist empty ink for an existing session')
      await textButton(page, 'Pictures', 'nav button')
      await textButton(page, 'Copy', '.previous-work-card button')
      await page.waitForFunction(() => document.querySelectorAll('.previous-work-card').length === 2)
      page.once('dialog', (dialog) => dialog.accept())
      await textButton(page, 'Delete', '.previous-work-card button')
      await page.waitForFunction(() => document.querySelectorAll('.previous-work-card').length === 1)
      assert.equal(await page.evaluate(() => localStorage.getItem('tracebuddy.practice.active.v1')), original.sessionId, 'Deleting another work must retain the active pointer')
      page.once('dialog', (dialog) => dialog.accept())
      await textButton(page, 'Delete', '.previous-work-card button')
      await page.waitForFunction(() => document.querySelectorAll('.previous-work-card').length === 0)
      assert.equal(await page.evaluate(() => localStorage.getItem('tracebuddy.practice.active.v1')), null, 'Deleting active work clears its pointer')

      await textButton(page, 'Learn', 'nav button')
      await click(page, '.lesson-library button:nth-of-type(2)')
      const lesson = await page.evaluate(() => localStorage.getItem('tracebuddy.learning.active.v1'))
      assert(lesson)
      await textButton(page, 'Pictures', 'nav button')
      await page.evaluate(() => {
        const original = IDBDatabase.prototype.transaction
        window.__restoreClearTransaction = () => { IDBDatabase.prototype.transaction = original }
        IDBDatabase.prototype.transaction = function (...args) {
          const tx = original.apply(this, args)
          if (args[1] !== 'readwrite') return tx
          return new Proxy(tx, {
            get(target, property) {
              const value = Reflect.get(target, property, target)
              return typeof value === 'function' ? value.bind(target) : value
            },
            set(target, property, value) {
              return Reflect.set(target, property, property === 'oncomplete' && typeof value === 'function'
                ? (event) => { window.__finishClear = () => value.call(target, event) } : value, target)
            },
          })
        }
      })
      page.once('dialog', (dialog) => dialog.accept())
      await textButton(page, 'Clear local work')
      await page.waitForFunction(() => Boolean(window.__finishClear))
      await textButton(page, 'Learn', 'nav button')
      await click(page, '.lesson-library button:nth-of-type(3)')
      assert.equal(await page.evaluate(() => localStorage.getItem('tracebuddy.learning.active.v1')), null, 'Lesson selection cannot recreate keys during clear')
      assert.equal(await page.$eval('.lesson-library button[aria-current="true"]', (el) => el.dataset.lessonId), lesson, 'Clear guard must also preserve selection state')
      await page.evaluate(() => { window.__restoreClearTransaction(); window.__finishClear() })
      await pause(200)
      assert.equal(await page.evaluate(() => localStorage.getItem('tracebuddy.learning.active.v1')), null)
      await click(page, '.lesson-library button:nth-of-type(3)')
      assert(await page.evaluate(() => localStorage.getItem('tracebuddy.learning.active.v1')), 'Lesson selection recovers after clear')
      results.push({ scenario: 'draft-save-delete-and-clear-lesson-guard', result: 'passed' })
    } finally { await context.close() }
  }
  for (const scale of (process.env.PRACTICE_RACE_ONLY ? [] : [1, 2.4, 5])) {
    const { context, page } = await setup()
    try {
      await page.goto(`${url}/#practice`); await page.waitForSelector('.practice-document')
      await zoom(page, scale)
      await page.$eval('.practice-canvas', (el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
      await pause(150)
      await textButton(page, 'Fill', '.size-buttons button')
      await textButton(page, 'Paint', '.brush-type-buttons button')
      await click(page, '[aria-label="Pink"]')
      // Center of the 420x420 guide is document (500,500). A second point
      // independently checks position away from the zoom center after scrolling.
      const p = await geometry(page)
      assert(Math.abs(p.side - 208) <= 0.1, `Smallest supported 210px bordered page must have 208px content: ${p.side}`)
      await draw(page, p)
      const ink = await page.$eval('.practice-ink > g > path', (el) => {
        const start = el.getPointAtLength(0)
        return { x: start.x, y: start.y, width: Number(el.getAttribute('stroke-width')), color: getComputedStyle(el).stroke, cssWidth: parseFloat(getComputedStyle(el).strokeWidth) }
      })
      assert(Math.hypot(ink.x - 500, ink.y - 500) * p.fit * p.zoom < 1, JSON.stringify({ p, ink }))
      assert(Math.abs(ink.width * p.fit * p.zoom - 22 * 2.05) < 0.01, JSON.stringify(ink))
      assert(Math.abs(ink.cssWidth - ink.width) < 0.001, 'Legacy CSS must not override saved widths')
      assert.equal(ink.color, 'rgb(255, 79, 163)', 'Legacy CSS must not override saved colors')
      // Flower Head's berry center is (238,204) in the source 420-unit guide.
      const guidePoint = { x: 60 + 880 * 238 / 420, y: 60 + 880 * 204 / 420 }
      const q = await geometry(page, guidePoint.x, guidePoint.y)
      await draw(page, q, 5)
      const start = await page.$$eval('.practice-ink > g > path', (els) => { const p = els.at(-1).getPointAtLength(0); return { x: p.x, y: p.y } })
      assert(Math.hypot(start.x - guidePoint.x, start.y - guidePoint.y) * p.fit * p.zoom < 1, JSON.stringify({ q, start }))
      await textButton(page, 'Eraser', '.brush-type-buttons button')
      await draw(page, p, 2)
      const before = await saved(page)
      assert(Math.abs(before.strokes.at(-1).width * p.fit * p.zoom - 22 * 2.2) < 0.01)
      const original = await canonical(page)
      const png = await exportPng(page)
      assert.equal(await rasterDelta(page, original, png, true), 0, 'Zoom must never enter the PNG')
      if (output) await page.screenshot({ path: join(output, `${webkit ? 'webkit' : 'chromium'}-widths-${scale}.png`), fullPage: true })
      await page.reload(); await page.waitForSelector('.practice-document')
      assert.deepEqual((await saved(page)).strokes, before.strokes, 'Reload preserves every emitted width')
      assert.equal(await rasterDelta(page, original, await canonical(page)), 0, 'Reload preserves erased pixels')
      await textButton(page, 'Pictures', 'nav[aria-label="Main navigation"] button')
      await page.waitForSelector('.previous-work-preview svg')
      assert.equal(await rasterDelta(page, original, await canonical(page, '.previous-work-preview svg')), 0, 'Previous Work preserves thick ink/erasing')
      await textButton(page, 'Resume', '.previous-work-card button')
      await page.waitForSelector('.practice-document')
      assert.deepEqual((await saved(page)).strokes, before.strokes)
      assert.equal(await rasterDelta(page, original, await canonical(page)), 0)
      assert.equal(await rasterDelta(page, original, await exportPng(page), true), 0, 'Resumed PNG must match original')
      results.push({ scenario: 'width-save-reload-previous-work-export-independent-geometry', scale, actualZoom: p.zoom, pageSide: p.side, widths: before.strokes.map((s) => s.width), pixelDelta: 0, pointError: Math.hypot(start.x - guidePoint.x, start.y - guidePoint.y) * p.fit * p.zoom })
    } finally { await context.close() }
  }

  for (const scenario of ['pictures-new-guide', 'practice-new-guide', 'practice-leave-hydration', 'practice-leave-source-write']) {
    const { context, page } = await setup(390, 844)
    try {
      await page.evaluate(async (fixture) => {
        const image = { imageId: 'delayed-upload', fileName: 'Old upload', originalSrc: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="420" height="420"/%3E', processedSrc: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="420" height="420"/%3E' }
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('tracebuddy-uploaded-images', 1)
          request.onupgradeneeded = () => request.result.createObjectStore('uploaded-images', { keyPath: 'imageId' })
          request.onsuccess = () => resolve(request.result); request.onerror = reject
        })
        await new Promise((resolve) => { const tx = db.transaction('uploaded-images', 'readwrite'); tx.objectStore('uploaded-images').put(image); tx.oncomplete = resolve })
        db.close()
        const session = { ...fixture, document: { width: 1000, height: 1000 }, source: { ...fixture.source, kind: 'upload', uploadedImage: { imageId: image.imageId, fileName: image.fileName } } }
        localStorage.setItem('tracebuddy.previousWork.v1.index', JSON.stringify({ version: 1, ids: [session.sessionId, 'missing-record'] }))
        localStorage.setItem(`tracebuddy.previousWork.v1.session.${session.sessionId}`, JSON.stringify(session))
        localStorage.setItem('tracebuddy.practice.active.v1', session.sessionId)
      }, fixture)
      const installDelays = () => {
        window.__reads = []; window.__writes = []; window.__holdReads = true; window.__holdWrites = true
        const get = IDBObjectStore.prototype.get
        IDBObjectStore.prototype.get = function (...args) {
          const request = get.apply(this, args)
          if (args[0] === 'delayed-upload') Object.defineProperty(request, 'onsuccess', { set(fn) {
            request.addEventListener('success', (event) => {
              const run = () => fn.call(request, event)
              if (window.__holdReads) window.__reads.push(run); else run()
            })
          } })
          return request
        }
        const transaction = IDBDatabase.prototype.transaction
        IDBDatabase.prototype.transaction = function (...args) {
          const tx = transaction.apply(this, args)
          if (args[1] === 'readwrite') Object.defineProperty(tx, 'oncomplete', { set(fn) {
            tx.addEventListener('complete', (event) => {
              const run = () => fn.call(tx, event)
              if (window.__holdWrites) window.__writes.push(run); else run()
            })
          } })
          return tx
        }
      }
      if (webkit) await page.addInitScript(installDelays); else await page.evaluateOnNewDocument(installDelays)
      await page.goto(`${url}/?race=${scenario}#${scenario.startsWith('pictures') ? 'pictures' : 'practice'}`)
      await page.waitForFunction(() => window.__reads.length > 0)
      if (scenario.endsWith('source-write')) {
        await page.evaluate(() => { window.__holdReads = false; window.__reads.splice(0).forEach((run) => run()) })
        await page.waitForFunction(() => window.__writes.length > 0)
      }
      await textButton(page, 'Pictures', 'nav[aria-label="Main navigation"] button')
      if (scenario.includes('new-guide')) {
        await page.waitForSelector('.drawing-card')
        await click(page, '.surface-switch button:nth-child(2)')
        // Choose a different guide through its real card action.
        await page.$$eval('.drawing-card', (cards) => cards[1].querySelector('.drawing-card-action').click())
        await page.waitForSelector('.practice-document')
        const title = await page.$eval('.practice-header h1', (el) => el.textContent)
        await draw(page, await geometry(page))
        const selected = await saved(page)
        await page.evaluate(() => {
          window.__holdReads = window.__holdWrites = false
          window.__reads.splice(0).forEach((run) => run()); window.__writes.splice(0).forEach((run) => run())
        }); await pause(800)
        assert.equal(await page.$eval('.practice-header h1', (el) => el.textContent), title)
        assert.deepEqual((await saved(page)).strokes, selected.strokes)
        assert.equal((await saved(page)).source.drawingId, selected.source.drawingId)
        assert(await page.evaluate((id) => JSON.parse(localStorage.getItem('tracebuddy.previousWork.v1.index')).ids.includes(id), selected.sessionId), 'Stale index cleanup must not drop newer saved work')
        await textButton(page, 'Pictures', 'nav[aria-label="Main navigation"] button')
        assert((await page.$$eval('.previous-work-card > strong', (els) => els.map((el) => el.textContent))).includes(selected.title), 'Hydration must retain the newer gallery record')
      } else {
        await page.evaluate(() => {
          window.__holdReads = window.__holdWrites = false
          window.__reads.splice(0).forEach((run) => run()); window.__writes.splice(0).forEach((run) => run())
        }); await pause(800)
        assert.equal(await page.evaluate(() => location.hash), '#pictures')
        assert.equal(await page.$('.practice-document'), null)
      }
      results.push({ scenario, result: 'passed' })
    } finally { await context.close() }
  }
  assert.deepEqual(errors, [])
  console.log(`${webkit ? 'WebKit' : 'Chromium'} practice regressions passed (${results.length} batches)`)
} finally {
  if (output) writeFileSync(join(output, `${webkit ? 'webkit' : 'chromium'}-regressions.json`), JSON.stringify(results, null, 2))
  if (webkit) { await browser.close(); await server.close() } else await closeBrowser(browser)
  lifecycle('release')
}
