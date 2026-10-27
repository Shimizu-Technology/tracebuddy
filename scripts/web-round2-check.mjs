import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { browserLifecycle } from './browser-lifecycle.mjs'
import { chromium, webkit } from 'playwright'

// Reuses audit2/tools/{common,retests,cleanup-resume,extra,matrix}.mjs methods:
// isolated contexts, actual pointer input, saved-record reconciliation, text Ranges.
const engine = process.env.CHECK_ENGINE || 'chromium'
const output = process.env.CHECK_EVIDENCE
const url = process.env.CHECK_URL || 'http://127.0.0.1:4173'
const server = await ({ chromium, webkit }[engine]).launchServer({ headless: true, ...(engine === 'chromium' && process.env.CHECK_CHROME ? { executablePath: process.env.CHECK_CHROME } : {}) })
const pid = server.process().pid
const life = (action) => { browserLifecycle(action, pid) }
life('claim')
const browser = await ({ chromium, webkit }[engine]).connect(server.wsEndpoint())
const results = [], errors = []
if (output) mkdirSync(output, { recursive: true })
const pause = (ms = 100) => new Promise((r) => setTimeout(r, ms))
async function page(context, hash = 'practice') {
  const p = await context.newPage()
  p.on('pageerror', (e) => errors.push(e.message))
  p.setDefaultTimeout(8000)
  await p.goto(`${url}/#${hash}`)
  return p
}
async function draw(p, offset = 0, settle = 750) {
  await p.locator('.practice-document').waitFor()
  const r = await p.locator('.practice-document').boundingBox()
  await p.mouse.move(r.x + r.width * .3, r.y + r.height * (.4 + offset))
  await p.mouse.down()
  await p.mouse.move(r.x + r.width * .65, r.y + r.height * (.45 + offset), { steps: 6 })
  await p.mouse.up()
  await pause(settle)
}
async function button(p, name, scope = p) { await scope.getByRole('button', { name, exact: true }).filter({ visible: true }).first().click(); await pause() }
async function pictures(p) { // Gallery actions now live at the first-class destination.
  if (await p.locator('.nav-toggle').isVisible()) await button(p, 'Menu')
  await button(p, 'My drawings', p.locator('#main-nav'))
  await p.locator('.drawings-screen').waitFor()
}
async function work(p) { return p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('tracebuddy.previousWork.v1.session.')).map((k) => JSON.parse(localStorage.getItem(k)))) }
async function shot(p, name) { if (output) await p.screenshot({ path: `${output}/${engine}-${name}.png` }) }
async function test(id, run) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' })
  try { const detail = await run(context); results.push({ id, status: 'passed', detail }); console.log(`${engine}: ${id} passed`) }
  catch (e) { results.push({ id, status: 'failed', error: e.stack }); throw e }
  finally { await context.close() }
}
async function contain(p, selector) {
  const failures = await p.locator(selector).evaluateAll((elements) => elements.flatMap((e) => {
    const r = e.getBoundingClientRect()
    if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') return []
    const errors = []
    if (r.width < 43.5 || r.height < 43.5) errors.push('target <44')
    const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent.trim()) continue
      const range = document.createRange(); range.selectNodeContents(walker.currentNode)
      for (const t of range.getClientRects()) if (t.left < r.left - 1 || t.right > r.right + 1 || t.top < r.top - 1 || t.bottom > r.bottom + 1) errors.push('text outside target')
    }
    return errors.length ? [{ label: e.textContent, errors, rect: { x: r.x, y: r.y, width: r.width, height: r.height } }] : []
  }))
  assert.deepEqual(failures, [])
}
try {
  await test('B01 stale editor stops; clear cannot resurrect', async (c) => {
    const a = await page(c); await draw(a)
    const b = await page(c); await b.locator('.practice-document').waitFor(); await pause(600)
    await draw(a, .12)
    await b.getByText('This drawing changed in another tab.', { exact: false }).waitFor()
    await draw(b, .22)
    assert.equal((await work(a))[0].strokes.length, 2)
    await b.locator('.practice-toolbar-more > summary').click()
    assert.equal(await b.getByRole('button', { name: 'Clear all', exact: true }).isDisabled(), true)
    await b.locator('.practice-toolbar-more > summary').click()
    await shot(b, 'B01-stale')
    await button(b, 'Reload'); await b.locator('.practice-document').waitFor(); await pause(250)
    assert.equal(await b.locator('.practice-ink > g > path').count(), 2)
    await pictures(a); a.once('dialog', (d) => d.accept()); await button(a, 'Clear local work')
    await b.getByText('This drawing changed in another tab.', { exact: false }).waitFor()
    await draw(b, .2)
    assert.equal((await work(a)).length, 0)
    assert(await a.evaluate(() => Boolean(localStorage.getItem('tracebuddy.work.clearGeneration.v1'))))
    await shot(b, 'B01-cleared')
    return 'Two strokes survive; stale edit and clear-resurrection rejected; Reload recovers.'
  })
  await test('B01 simultaneous saves reject one whole history', async (c) => {
    const a = await page(c); await draw(a)
    const b = await page(c); await b.locator('.practice-document').waitFor(); await pause(200)
    await Promise.all([draw(a, .1), draw(b, .2)])
    const sessions = await work(a)
    assert.equal(sessions.length, 1); assert.equal(sessions[0].strokes.length, 2)
    assert.equal(await a.locator('text=This drawing changed in another tab.').count() + await b.locator('text=This drawing changed in another tab.').count(), 1)
    return 'Atomic revision check permits one winner; the other editor stops without merging eraser histories.'
  })
  await test('B01 close with a held lock recovers journal; clear rejects old journal', async (c) => {
    const a = await page(c); await draw(a)
    const blocker = await page(c, 'home')
    await blocker.evaluate(() => new Promise((started) => { navigator.locks.request('tracebuddy.local-work', () => new Promise((release) => { window.__releaseWorkLock = release; started() })) }))
    await draw(a, .2, 0)
    await a.close({ runBeforeUnload: true })
    await blocker.waitForFunction(() => Object.keys(localStorage).filter((key) => key.startsWith('tracebuddy.work.pending.v1.')).length === 1)
    const journal = await blocker.evaluate(() => { const key = Object.keys(localStorage).find((key) => key.startsWith('tracebuddy.work.pending.v1.')); return { key, value: localStorage.getItem(key) } })
    await blocker.evaluate(() => window.__releaseWorkLock())
    const restored = await page(c); await restored.locator('.practice-document').waitFor(); await pause(250)
    assert.equal(await restored.locator('.practice-ink > g > path').count(), 2)
    assert.equal((await work(restored))[0].strokes.length, 2)
    await pictures(restored); restored.once('dialog', (d) => d.accept()); await button(restored, 'Clear local work'); await pause(200)
    await restored.evaluate(({ key, value }) => localStorage.setItem(key, value), journal)
    await restored.reload(); await pause(300); assert.equal((await work(restored)).length, 0)
    assert.equal(await restored.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('tracebuddy.work.pending.v1.')).length), 0)
    const first = await page(c)
    await blocker.evaluate(() => new Promise((started) => { navigator.locks.request('tracebuddy.local-work', () => new Promise((release) => { window.__releaseWorkLock = release; started() })) }))
    await draw(first, .1, 0); await first.close({ runBeforeUnload: true })
    await blocker.waitForFunction(() => Object.keys(localStorage).some((key) => key.startsWith('tracebuddy.work.pending.v1.')))
    await blocker.evaluate(() => window.__releaseWorkLock())
    const firstRestored = await page(c); await firstRestored.locator('.practice-document').waitFor(); await pause(300)
    assert.equal(await firstRestored.locator('.practice-ink > g > path').count(), 1)
    assert.equal((await work(firstRestored)).length, 1)
    return 'Synchronous pagehide journals recover both an existing history and the first stroke of a new work; old-generation recovery cannot undo Clear.'
  })
  await test('B02 immutable cleanup on Resume, reload, Copy and Fresh', async (c) => {
    const p = await page(c, 'pictures')
    await p.locator('.picker-alternates > summary').click()
    await p.locator('input[type=file]').setInputFiles(process.env.CHECK_PHOTO || new URL('./fixtures/cleanup-photo.svg', import.meta.url).pathname)
    await p.locator('.trace-screen').waitFor()
    if (await p.locator('.setup-coach-backdrop').isVisible()) await button(p, 'Close for now')
    await p.locator('.sheet-toggle').click()
    await p.locator('.cleanup-mode-grid button').filter({ hasText: 'Line art' }).click()
    await p.waitForFunction(() => document.querySelector('.cleanup-status')?.textContent.includes('Line-art cleanup applied'))
    await button(p, 'Practice on screen'); await draw(p)
    const before = await p.locator('.practice-guide-image').first().getAttribute('href')
    assert(before.startsWith('data:image/png'))
    const original = (await work(p))[0]
    await shot(p, 'B02-lineart')
    await pictures(p); await button(p, 'Resume', p.locator('.previous-work-card').first())
    await p.locator('.practice-document').waitFor(); await pause(400)
    assert.equal(await p.locator('.practice-guide-image').first().getAttribute('href'), before)
    await p.reload(); await p.locator('.practice-document').waitFor(); await pause(400)
    assert.equal(await p.locator('.practice-guide-image').first().getAttribute('href'), before)
    await pictures(p); await button(p, 'Copy', p.locator('.previous-work-card').first())
    await p.locator('.previous-work-card').nth(1).waitFor()
    await button(p, 'Fresh', p.locator('.previous-work-card').first())
    await p.locator('.practice-document').waitFor(); await draw(p)
    assert.equal(await p.locator('.practice-guide-image').first().getAttribute('href'), before)
    await p.locator('.practice-toolbar-more > summary').click(); await button(p, 'Camera', p.locator('.practice-toolbar-more'))
    if (await p.locator('.setup-coach-backdrop').isVisible()) await button(p, 'Close for now')
    await p.locator('.sheet-toggle').click()
    await p.locator('.cleanup-mode-grid button').filter({ hasText: 'Original' }).click(); await pause(350)
    await button(p, 'Practice on screen'); await draw(p)
    const newer = (await work(p)).find((s) => s.source.uploadedImage.imageId !== original.source.uploadedImage.imageId)
    assert(newer, 'Changing cleanup must fork the image record')
    await pictures(p)
    const titles = await p.locator('.previous-work-card').count(); assert(titles >= 3)
    await p.locator('.previous-work-card').filter({ has: p.getByRole('button', { name: 'Resume', exact: true }) }).last().getByRole('button', { name: 'Resume', exact: true }).click()
    await p.locator('.practice-document').waitFor(); await pause(350)
    assert.equal(await p.locator('.practice-guide-image').first().getAttribute('href'), before)
    await shot(p, 'B02-restored')
    return { guideLength: before.length, savedWorks: titles, immutableGuideId: original.source.uploadedImage.imageId }
  })
  await test('B06 Together survives navigation and saved-work resume', async (c) => {
    const p = await page(c, 'together')
    await p.locator('[data-family-activity-id="mirror-my-marks"]').click()
    await button(p, 'Practice together'); await draw(p)
    assert.equal((await work(p))[0].activityId, 'mirror-my-marks')
    await pictures(p)
    if (await p.locator('.nav-toggle').isVisible()) await button(p, 'Menu')
    await button(p, 'Together', p.locator('#main-nav'))
    await p.locator('.family-feature h2').filter({ hasText: 'Mirror My Marks' }).waitFor()
    await pictures(p); await button(p, 'Resume', p.locator('.previous-work-card').first())
    await p.locator('.practice-document').waitFor()
    await p.locator('.practice-toolbar-more > summary').click(); await button(p, 'Return to activity')
    await p.locator('.family-feature h2').filter({ hasText: 'Mirror My Marks' }).waitFor()
    await p.locator('[data-family-activity-id]').first().click()
    await pictures(p); await button(p, 'Fresh', p.locator('.previous-work-card').first())
    await p.locator('.practice-document').waitFor(); await p.locator('.practice-toolbar-more > summary').click(); await button(p, 'Return to activity')
    await p.locator('.family-feature h2').filter({ hasText: 'Mirror My Marks' }).waitFor()
    await button(p, 'Practice together'); await p.locator('.practice-document').waitFor(); await p.locator('.practice-toolbar-more > summary').click()
    await p.locator('.practice-toolbar-more input[type=file]').setInputFiles(new URL('./fixtures/cleanup-photo.svg', import.meta.url).pathname)
    await p.locator('.practice-header h1').filter({ hasText: 'cleanup-photo.svg' }).waitFor(); await draw(p)
    assert.equal((await work(p)).find((s) => s.source.kind === 'upload').activityId, undefined)
    assert.equal(await p.getByRole('button', { name: 'Return to activity', exact: true }).count(), 0)
    return 'Resume and Fresh restore activity selection; a replacement upload clears inherited activity context.'
  })
  for (const [name, width, height] of [['phone',390,844],['small-phone',360,740],['ipad-portrait',820,1180],['ipad-landscape',1180,820],['desktop',1440,900]]) {
    await test(`B03 B04 B07 ${name} text200 reduced`, async (c) => {
      const p = await page(c); await p.setViewportSize({ width, height }); await p.emulateMedia({ reducedMotion: 'reduce' })
      await draw(p); await p.addStyleTag({ content: 'html{font-size:200% !important}' }); await pause(200)
      if (width <= 600) {
        await contain(p, '.compact-child-tools > button')
        const boxes = await p.evaluate(() => ['.practice-canvas','.compact-child-tools'].map((s) => { const r=document.querySelector(s).getBoundingClientRect();return { y:r.y,bottom:r.bottom,height:r.height } }))
        assert(boxes[1].y >= boxes[0].bottom, 'Tools must not cover the drawing: ' + JSON.stringify(boxes)); assert(boxes[0].height >= 140); assert(boxes[0].y >= 0); assert(boxes[1].bottom <= height + 1, JSON.stringify(boxes))
        await button(p, 'Color', p.locator('.compact-child-tools')); await button(p, 'Pink', p.locator('dialog[open]'))
        await button(p, 'Brush', p.locator('.compact-child-tools')); await contain(p, '.child-tool-dialog[open] button'); await button(p, 'Paint', p.locator('dialog[open]')); await button(p, 'Back to drawing')
        const undo = p.locator('.compact-child-tools').getByRole('button', { name: 'Undo', exact: true }); await undo.tap()
        await pause(700); assert.equal((await work(p))[0].strokes.length, 0)
      }
      await shot(p, `${name}-text200-practice`)
      await pictures(p); await p.locator('.previous-work-section').scrollIntoViewIfNeeded()
      await contain(p, '.previous-work-actions button, .previous-work-summary button')
      assert.equal(await p.locator('.previous-work-section').evaluate((e) => e.scrollWidth <= e.clientWidth + 1), true)
      await shot(p, `${name}-text200-gallery`)
      await p.goto(`${url}/#camera`)
      if (await p.locator('.setup-coach-backdrop').isVisible()) await button(p, 'Close for now')
      await p.addStyleTag({ content: 'html{font-size:200% !important}' }); await pause()
      if (width > height) {
        const panel = await p.locator('.controls-panel').evaluate((e) => ({ scroll: e.scrollWidth, client: e.clientWidth }))
        assert(panel.scroll <= panel.client + 1, JSON.stringify(panel))
        await contain(p, '.controls-body button')
      }
      await shot(p, `${name}-text200-camera`)
      return 'Text bounds, >=44px controls and useful child canvas; no camera horizontal overflow.'
    })
  }
  assert.deepEqual(errors, [])
} finally {
  if (output) writeFileSync(`${output}/${engine}-round2.json`, JSON.stringify({ results, errors }, null, 2))
  await browser.close(); await server.close(); life('release')
}
