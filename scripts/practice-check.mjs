import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { closeBrowser, findChromeExecutable } from './browser-utils.mjs'

const url = process.env.CHECK_URL || 'http://127.0.0.1:4173'
const output = process.env.PRACTICE_EVIDENCE || mkdtempSync(join(tmpdir(), 'tracebuddy-practice-'))
mkdirSync(output, { recursive: true })
const fixture = JSON.parse(readFileSync(new URL('./fixtures/practice-legacy.json', import.meta.url), 'utf8'))
const browser = await puppeteer.launch({ executablePath: findChromeExecutable(), headless: true, args: ['--no-sandbox'] })
const results = []
const errors = []
const pause = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms))

async function point(page, x = 500, y = 60 + 880 * 80 / 420) {
  return page.$eval('.practice-document', (svg, p) => {
    const r = new DOMPoint(p.x, p.y).matrixTransform(svg.getScreenCTM())
    return { x: r.x, y: r.y }
  }, { x, y })
}
async function stroke(page, p) {
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.mouse.move(p.x + 18, p.y, { steps: 5 })
  await page.mouse.up()
  await pause()
}
async function firstInk(page, last = false) {
  return page.$$eval('.practice-ink > g > path', (paths, useLast) => {
    const path = useLast ? paths.at(-1) : paths[0]
    const local = path.getPointAtLength(0)
    const p = new DOMPoint(local.x, local.y).matrixTransform(path.getScreenCTM())
    return { x: p.x, y: p.y }
  }, last)
}
const delta = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
async function parentTools(page, open = true) {
  if (await page.$eval('.practice-toolbar-more', (el) => el.open) !== open) await page.click('.practice-toolbar-more > summary')
}
async function click(page, selector) { await page.$eval(selector, (el) => el.click()); await pause(40) }
async function newPage(width = 390, height = 844) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('dialog', async (dialog) => { errors.push(`dialog: ${dialog.message()}`); await dialog.dismiss() })
  await page.setViewport({ width, height, isMobile: width < 1440, hasTouch: width < 1440, deviceScaleFactor: 1 })
  await page.goto(`${url}/#practice`, { waitUntil: 'networkidle0' })
  return { context, page }
}
async function touch(client, type, points) {
  await client.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([id, x, y]) => ({ id, x, y })) })
  await pause(40)
}

try {
  for (const [width, height] of (process.env.PRACTICE_FOCUS ? [] : [[390, 844], [360, 740], [820, 1180], [1180, 820], [1440, 900]])) {
    const { context, page } = await newPage(width, height)
    try {
      const layout = await page.evaluate(() => {
        const canvas = document.querySelector('.practice-canvas').getBoundingClientRect()
        const tools = document.querySelector('.practice-toolbar-ribbon').getBoundingClientRect()
        const targets = [...document.querySelectorAll('.practice-toolbar-ribbon button')].map((el) => ({ name: el.getAttribute('aria-label') || el.textContent.trim(), w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }))
        return { canvasTop: canvas.top, canvasBottom: canvas.bottom, toolsBottom: tools.bottom, coarse: matchMedia('(pointer: coarse)').matches, targets, overflow: document.documentElement.scrollWidth > innerWidth }
      })
      assert(layout.canvasTop < height / 2 && layout.canvasBottom <= height, `Canvas must be visible first: ${JSON.stringify(layout)}`)
      assert(layout.toolsBottom <= height, `Child tools must remain with the page: ${layout.toolsBottom}/${height}`)
      assert(!layout.overflow)
      if (layout.coarse) assert(layout.targets.every((t) => t.w >= 44 && t.h >= 44), JSON.stringify(layout.targets))
      assert(await page.$('button[aria-label="Pink"]'))
      const target = await point(page)
      await stroke(page, target)
      const error = delta(target, await firstInk(page))
      assert(error <= 1, `Guide alignment ${width}: ${error}`)
      await page.screenshot({ path: join(output, `after-${width}x${height}.png`), fullPage: true })
      const rotations = width === 390 ? [[844, 390], [390, 844]] : width === 820 ? [[1180, 820], [820, 1180]] : [[width + 30, height - 20], [width, height]]
      const rotationErrors = []
      for (const [w, h] of rotations) {
        await page.setViewport({ width: w, height: h, isMobile: width < 1440, hasTouch: width < 1440 })
        await pause()
        const error = delta(await point(page), await firstInk(page))
        rotationErrors.push({ width: w, height: h, error })
        assert(error <= 1, `Rotation error: ${error}`)
      }
      // Exercise the real zoom controls and pan gestures, then return to Draw.
      await parentTools(page)
      await click(page, '.studio-tool.mode')
      const zoomErrors = []
      for (const count of [1, 3, 9]) {
        for (let i = 0; i < count; i++) await click(page, 'button[aria-label="Zoom in"]')
        await parentTools(page, false)
        await page.$eval('.practice-canvas', (el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
        const center = await page.$eval('.practice-canvas', (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
        await page.mouse.move(center.x, center.y); await page.mouse.down(); await page.mouse.move(center.x + 17, center.y + 11); await page.mouse.up()
        await parentTools(page)
        await click(page, '.studio-tool.mode')
        await parentTools(page, false)
        await page.$eval('.practice-canvas', (el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
        const p = await page.$eval('.practice-canvas', (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
        await stroke(page, p)
        const error = delta(p, await firstInk(page, true))
        const transform = await page.$eval('.practice-transform-layer', (el) => el.style.transform)
        zoomErrors.push({ transform, error })
        assert(error <= 1, `Zoom/pan input error: ${error}`)
        await parentTools(page)
        await click(page, '.studio-tool.mode')
      }
      results.push({ scenario: 'geometry-layout', viewport: [width, height], error, rotationErrors, zoomErrors, layout })
      // Reload must retain source, strokes and tools.
      await pause(600)
      const before = await page.evaluate(() => { const id = localStorage.getItem('tracebuddy.practice.active.v1'); return JSON.parse(localStorage.getItem(`tracebuddy.previousWork.v1.session.${id}`)) })
      await page.reload({ waitUntil: 'networkidle0' })
      const afterCount = await page.$$eval('.practice-ink > g > path', (paths) => paths.length)
      assert.equal(afterCount, before.strokes.length)
      results.push({ scenario: 'template-reload', viewport: [width, height], strokes: afterCount })
    } finally { await context.close() }
  }

  const { context, page } = await newPage()
  try {
    const client = await page.createCDPSession()
    await page.evaluate(() => {
      window.__pointerLog = []
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) document.querySelector('.practice-canvas').addEventListener(type, (e) => window.__pointerLog.push([type, e.pointerId, e.pointerType, e.clientX, e.clientY]))
    })
    const p = await point(page, 400, 500)
    await touch(client, 'touchStart', [[1, p.x, p.y]])
    await touch(client, 'touchMove', [[1, p.x + 10, p.y]])
    await touch(client, 'touchStart', [[1, p.x + 10, p.y], [2, p.x + 80, p.y + 70]])
    await touch(client, 'touchMove', [[1, p.x + 18, p.y], [2, p.x + 100, p.y + 90]])
    await touch(client, 'touchEnd', [[2, p.x + 100, p.y + 90]])
    await touch(client, 'touchMove', [[1, p.x + 24, p.y]])
    await touch(client, 'touchEnd', [])
    assert.equal(await page.$$eval('.practice-ink > g > path', (paths) => paths.length), 1, JSON.stringify(await page.evaluate(() => ({ events: window.__pointerLog, paths: [...document.querySelectorAll('.practice-ink > g > path')].map((p) => p.getAttribute('d')) }))))
    const bounds = await page.$eval('.practice-ink > g > path', (path) => ({ x: path.getBBox().x, y: path.getBBox().y, width: path.getBBox().width, height: path.getBBox().height }))
    assert(bounds.height < 1, `Extra touch added a diagonal: ${JSON.stringify(bounds)}`)
    await touch(client, 'touchStart', [[3, p.x, p.y + 20]])
    await touch(client, 'touchCancel', [])
    await stroke(page, { x: p.x, y: p.y + 40 })
    assert.equal(await page.$$eval('.practice-ink > g > path', (paths) => paths.length), 3, 'Cancel must release pointer ownership')
    // Lost capture commits the partial stroke and releases ownership.
    await touch(client, 'touchStart', [[6, p.x, p.y + 50]])
    await page.evaluate(() => {
      const id = window.__pointerLog.filter((event) => event[0] === 'pointerdown').at(-1)[1]
      document.querySelector('.practice-canvas').releasePointerCapture(id)
    })
    await touch(client, 'touchMove', [[6, p.x + 10, p.y + 50]])
    await touch(client, 'touchEnd', [])
    await stroke(page, { x: p.x, y: p.y + 55 })
    assert.equal(await page.$$eval('.practice-ink > g > path', (paths) => paths.length), 5, 'Lost capture must release pointer ownership')
    // Pen takes over a touch stroke, discarding the palm mark.
    const beforePen = await page.$$eval('.practice-ink > g > path', (paths) => paths.length)
    await page.evaluate(({ x, y }) => {
      const canvas = document.querySelector('.practice-canvas')
      // Synthetic pointer events cannot capture; keep real capture behavior for all CDP tests above.
      const original = canvas.setPointerCapture.bind(canvas)
      canvas.setPointerCapture = () => {}
      for (const [type, id, pointerType, px] of [['pointerdown', 30, 'touch', x], ['pointerdown', 31, 'pen', x + 10], ['pointermove', 30, 'touch', x + 100], ['pointermove', 31, 'pen', x + 20], ['pointerup', 31, 'pen', x + 20]]) {
        canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, pointerType, clientX: px, clientY: y, button: 0 }))
      }
      canvas.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true, pointerType: 'pen' }))
      canvas.setPointerCapture = original
    }, { x: p.x, y: p.y + 60 })
    assert.equal(await page.$$eval('.practice-ink > g > path', (paths) => paths.length), beforePen + 1, 'Pen should replace an in-progress palm stroke')
    await parentTools(page)
    await click(page, '.studio-tool.mode')
    await parentTools(page, false)
    await touch(client, 'touchStart', [[4, p.x - 20, p.y], [5, p.x + 20, p.y]])
    await touch(client, 'touchMove', [[4, p.x - 40, p.y], [5, p.x + 40, p.y]])
    await touch(client, 'touchEnd', [])
    assert.match(await page.$eval('.practice-transform-layer', (el) => el.style.transform), /scale\(2\)/)
    results.push({ scenario: 'single-pointer-cancel-pen-pinch', result: 'passed', bounds })

    // Custom words through the handwriting UI, including all accepted characters.
    for (const value of ['Aleksandra Wiśniewska-Kowalczyk', 'Wiśniewska', 'å ñ ʼ', 'åñʼ'.repeat(16), '名字をなぞって練習しましょう'.repeat(4).slice(0, 48), 'W'.repeat(48)]) {
      await page.goto(`${url}/#learn`, { waitUntil: 'networkidle0' })
      await page.$eval('.handwriting-card input', (input) => { input.value = '' })
      await page.type('.handwriting-card input', value)
      await page.$eval('.handwriting-card form', (form) => form.requestSubmit())
      await page.waitForSelector('.practice-document')
      const text = await page.$eval('.practice-guide-image', async (image) => {
        const xml = await (await fetch(image.getAttribute('href'))).text()
        const holder = document.createElement('div'); holder.innerHTML = xml; document.body.append(holder)
        const nodes = [...holder.querySelectorAll('text')].map((el) => { const b = el.getBBox(); return { text: el.textContent, x: b.x, y: b.y, width: b.width, height: b.height } })
        holder.remove(); return nodes
      })
      assert(text.length > 0 && text.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.width <= 420 && b.y + b.height <= 420), JSON.stringify(text))
      await stroke(page, await point(page, 500, 500))
      await pause(600)
      const svgBefore = await page.$eval('.practice-guide-image', (el) => el.getAttribute('href'))
      await page.reload({ waitUntil: 'networkidle0' })
      assert.equal(await page.$eval('.practice-guide-image', (el) => el.getAttribute('href')), svgBefore)
      assert.equal(await page.$$eval('.practice-ink > g > path', (paths) => paths.length), 1)
      results.push({ scenario: 'custom-text-fit-reload', value, text })
    }
    // Non-first lesson and its current step survive reload.
    await page.goto(`${url}/#learn`, { waitUntil: 'networkidle0' })
    await click(page, '.lesson-library [data-lesson-id]:nth-child(3)')
    await click(page, '.lesson-step-dots button:nth-child(3)')
    const lessonBefore = await page.$eval('.lesson-title-row h2', (el) => el.textContent)
    await page.reload({ waitUntil: 'networkidle0' })
    assert.equal(await page.$eval('.lesson-title-row h2', (el) => el.textContent), lessonBefore)
    assert.equal(await page.$eval('.lesson-step-dots button.active', (el) => el.textContent), '3')
    results.push({ scenario: 'lesson-context', lesson: lessonBefore, step: 3 })

    // Legacy fixture uses actual audited phone geometry, not a new-format approximation.
    await page.evaluate((saved) => {
      localStorage.clear()
      localStorage.setItem('tracebuddy.previousWork.v1.index', JSON.stringify({ version: 1, ids: [saved.sessionId] }))
      localStorage.setItem(`tracebuddy.previousWork.v1.session.${saved.sessionId}`, JSON.stringify(saved))
      localStorage.setItem('tracebuddy.practice.active.v1', saved.sessionId)
    }, fixture)
    await page.goto(`${url}/?legacy-fixture#practice`, { waitUntil: 'networkidle0' })
    let legacyFeature = await page.$eval('.practice-document', (svg) => {
      const height = svg.viewBox.baseVal.height
      const p = new DOMPoint(500, height / 2 + (80 / 420 - 0.5) * 880).matrixTransform(svg.getScreenCTM())
      return { x: p.x, y: p.y }
    })
    let legacyError = delta(legacyFeature, await firstInk(page))
    assert(legacyError <= 1, `Old fixture misplaced: ${legacyError}`)
    await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true })
    await page.reload({ waitUntil: 'networkidle0' })
    legacyFeature = await page.$eval('.practice-document', (svg) => {
      const p = new DOMPoint(500, svg.viewBox.baseVal.height / 2 + (80 / 420 - 0.5) * 880).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y }
    })
    legacyError = delta(legacyFeature, await firstInk(page))
    assert(legacyError <= 1, `Migrated fixture changed on rotated reload: ${legacyError}`)
    results.push({ scenario: 'legacy-fixture', error: legacyError })

    // Full thumbnail compositing, including >18 strokes, partial/dashed erasing,
    // later repaint, and export pixel comparison against the same SVG document.
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
    const compositing = { ...fixture, sessionId: 'compositing', title: 'Compositing', document: { width: 1000, height: 1000 }, strokes: [
      { path: 'M 100 100 L 900 100', width: 30, color: '#FF4FA3', mode: 'draw', opacity: 1 },
      ...Array.from({ length: 24 }, (_, i) => ({ path: `M 100 ${200 + i * 25} L 900 ${200 + i * 25}`, width: 12, color: '#2F80ED', mode: 'draw', opacity: 0.9 })),
      { path: 'M 500 60 L 500 900', width: 80, color: '#000000', mode: 'erase', opacity: 1 },
      { path: 'M 600 60 L 600 900', width: 40, color: '#000000', mode: 'erase', opacity: 0.5, dasharray: '40 40' },
      { path: 'M 450 500 L 650 500', width: 15, color: '#27AE60', mode: 'draw', opacity: 1 },
    ], guideOnTop: false }
    await page.goto(`${url}/#home`, { waitUntil: 'networkidle0' })
    await page.evaluate((saved) => {
      localStorage.setItem('tracebuddy.previousWork.v1.index', JSON.stringify({ version: 1, ids: [saved.sessionId] }))
      localStorage.setItem(`tracebuddy.previousWork.v1.session.${saved.sessionId}`, JSON.stringify(saved))
      localStorage.setItem('tracebuddy.practice.active.v1', saved.sessionId)
    }, compositing)
    await page.goto(`${url}/?compositing-fixture#practice`, { waitUntil: 'networkidle0' })
    assert.equal(await page.$eval('.practice-header h1', (el) => el.textContent), 'Flower Head')
    assert.equal(await page.$$eval('.practice-ink > g > path', (paths) => paths.length), 26)
    const canonical = await page.$eval('.practice-document', (svg) => {
      const clone = svg.cloneNode(true); clone.setAttribute('width', '1000'); clone.setAttribute('height', '1000'); return new XMLSerializer().serializeToString(clone)
    })
    const downloads = mkdtempSync(join(output, 'downloads-'))
    await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads })
    await parentTools(page)
    await page.click('.practice-toolbar-more .primary-button')
    for (let i = 0; i < 40 && !existsSync(join(downloads, 'compositing-tracebuddy.png')); i++) await pause(100)
    const exported = readFileSync(join(downloads, 'compositing-tracebuddy.png')).toString('base64')
    await page.goto(`${url}/#pictures`, { waitUntil: 'networkidle0' })
    const thumbnail = await page.$eval('.previous-work-preview svg', (svg) => {
      const clone = svg.cloneNode(true); clone.setAttribute('width', '1000'); clone.setAttribute('height', '1000'); return new XMLSerializer().serializeToString(clone)
    })
    const raster = await page.evaluate(async ({ canonical, thumbnail, exported }) => {
      async function pixels(src) {
        const image = new Image(); image.src = src; await image.decode()
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1000
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, 1000, 1000)
        return ctx.getImageData(0, 0, 1000, 1000).data
      }
      const svg = (text) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`
      const [a, b, c] = await Promise.all([pixels(svg(canonical)), pixels(svg(thumbnail)), pixels(`data:image/png;base64,${exported}`)])
      let thumbnailDelta = 0, exportDelta = 0
      for (let i = 0; i < a.length; i++) { thumbnailDelta = Math.max(thumbnailDelta, Math.abs(a[i] - b[i])); exportDelta = Math.max(exportDelta, Math.abs(a[i] - c[i])) }
      const at = (x, y) => [...a.slice((y * 1000 + x) * 4, (y * 1000 + x) * 4 + 4)]
      return { thumbnailDelta, exportDelta, earlyInk: at(200, 100), erasedInk: at(500, 100), repaint: at(500, 500) }
    }, { canonical, thumbnail, exported })
    assert.equal(raster.thumbnailDelta, 0)
    assert.equal(raster.exportDelta, 0)
    assert.deepEqual(raster.erasedInk, [255, 255, 255, 255])
    assert.notDeepEqual(raster.earlyInk, raster.erasedInk)
    assert.notDeepEqual(raster.repaint, raster.erasedInk)
    results.push({ scenario: 'thumbnail-export-compositing', ...raster })
    await page.screenshot({ path: join(output, 'previous-work.png'), fullPage: true })

    // An upload is selected through the file control, drawn on, and restored from IndexedDB.
    await page.goto(`${url}/#practice`, { waitUntil: 'networkidle0' })
    await parentTools(page)
    const upload = await page.$('.practice-screen input[type="file"]')
    await upload.uploadFile(new URL('../public/favicon.svg', import.meta.url).pathname)
    await page.waitForFunction(() => document.querySelector('.practice-header h1')?.textContent === 'favicon.svg')
    await parentTools(page, false)
    await stroke(page, await point(page, 500, 500))
    await pause(600)
    await page.reload({ waitUntil: 'networkidle0' })
    assert.equal(await page.$eval('.practice-header h1', (el) => el.textContent), 'favicon.svg')
    assert.equal(await page.$$eval('.practice-ink > g > path', (paths) => paths.length), 1)
    results.push({ scenario: 'upload-reload', result: 'passed' })

    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.addStyleTag({ content: 'html {font-size:200%}' })
    await parentTools(page)
    const enlarged = await page.$eval('.practice-screen', (el) => ({ width: el.getBoundingClientRect().width, scrollWidth: el.scrollWidth }))
    assert(enlarged.scrollWidth <= enlarged.width + 1, JSON.stringify(enlarged))
    await page.screenshot({ path: join(output, 'text-200-reduced-motion.png'), fullPage: true })
    results.push({ scenario: 'enlarged-text-reduced-motion', result: 'passed', enlarged })
  } finally { await context.close() }
  assert.deepEqual(errors, [])
  writeFileSync(join(output, 'geometry-results.json'), JSON.stringify(results, null, 2))
  console.log(`Practice browser checks passed (${results.length} dimensions/batches); evidence: ${output}`)
} finally {
  writeFileSync(join(output, 'partial-results.json'), JSON.stringify({ results, errors }, null, 2))
  await closeBrowser(browser)
}
