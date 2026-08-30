import puppeteer from 'puppeteer-core'
import { clickByText, closeBrowser, findChromeExecutable, waitForSelector } from './browser-utils.mjs'

const url = process.env.CHECK_URL || 'http://127.0.0.1:5173'
const browser = await puppeteer.launch({
  executablePath: findChromeExecutable(),
  headless: true,
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
})

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function drawStroke(page, startOffset = 0, finish = true) {
  const canvas = await page.$('.practice-canvas')
  const bounds = await canvas?.boundingBox()
  if (!bounds) throw new Error('Practice canvas is unavailable')
  await page.mouse.move(bounds.x + 70 + startOffset, bounds.y + 90)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 190 + startOffset, bounds.y + 170, { steps: 8 })
  if (finish) await page.mouse.up()
}

async function countUploadedImages(page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('tracebuddy-uploaded-images', 1)
    const db = await new Promise((resolveDb, reject) => {
      request.onsuccess = () => resolveDb(request.result)
      request.onerror = () => reject(request.error)
    })
    if (!db.objectStoreNames.contains('uploaded-images')) return 0
    const transaction = db.transaction('uploaded-images', 'readonly')
    const countRequest = transaction.objectStore('uploaded-images').count()
    return new Promise((resolveCount, reject) => {
      countRequest.onsuccess = () => resolveCount(countRequest.result)
      countRequest.onerror = () => reject(countRequest.error)
    })
  })
}

const page = await browser.newPage()
try {
  await page.setViewport({ width: 1180, height: 900, deviceScaleFactor: 1 })
  await page.goto(url, { waitUntil: 'networkidle0' })
  console.log('Opened fresh app state')
  await clickByText(page, 'Practice on screen')
  console.log('Clicked practice')
  await waitForSelector(page, '.practice-screen')
  console.log('Practice ready')

  await drawStroke(page, 0, false)
  console.log('Drew first stroke')
  await clickByText(page, 'Pictures')
  await page.mouse.up()
  console.log('Clicked pictures immediately')
  await waitForSelector(page, '.picker-screen')
  console.log('Picker ready')
  const firstSaveMeta = await page.evaluate(() => document.querySelector('.previous-work-card small')?.textContent ?? '')
  assert(firstSaveMeta.includes('1 strokes'), `Immediate exit did not flush the stroke: ${firstSaveMeta}`)
  console.log('Immediate exit flush passed')

  await clickByText(page, 'Resume')
  await waitForSelector(page, '.practice-screen')
  await page.evaluate(() => {
    window.__traceBuddyOriginalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new DOMException('Simulated quota failure', 'QuotaExceededError')
    }
  })
  await drawStroke(page, 35)
  await page.waitForFunction(() => document.querySelector('.practice-save-status')?.classList.contains('error'), { timeout: 3_000 })
  console.log('Visible storage error passed')

  await page.evaluate(() => {
    Storage.prototype.setItem = window.__traceBuddyOriginalSetItem
    delete window.__traceBuddyOriginalSetItem
  })
  await clickByText(page, 'Retry')
  await page.waitForFunction(() => document.querySelector('.practice-save-status')?.classList.contains('saved'), { timeout: 3_000 })
  await clickByText(page, 'Pictures')
  await waitForSelector(page, '.picker-screen')
  const retrySaveMeta = await page.evaluate(() => document.querySelector('.previous-work-card small')?.textContent ?? '')
  assert(retrySaveMeta.includes('2 strokes'), `Retry did not persist the second stroke: ${retrySaveMeta}`)
  console.log('Storage retry passed')

  await page.evaluate(async () => {
    const request = indexedDB.open('tracebuddy-uploaded-images', 1)
    const db = await new Promise((resolveDb, reject) => {
      request.onsuccess = () => resolveDb(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolveWrite, reject) => {
      const transaction = db.transaction('uploaded-images', 'readwrite')
      for (const imageId of ['linked-clear-image', 'orphan-clear-image']) {
        transaction.objectStore('uploaded-images').put({ imageId, fileName: `${imageId}.svg`, originalSrc: 'data:image/svg+xml,<svg/>', processedSrc: 'data:image/svg+xml,<svg/>' })
      }
      transaction.oncomplete = resolveWrite
      transaction.onerror = () => reject(transaction.error)
    })
    localStorage.setItem('tracebuddy.previousWork.v1.session.unindexed-clear-test', JSON.stringify({
      version: 2,
      sessionId: 'unindexed-clear-test',
      title: 'Unindexed upload',
      source: { kind: 'upload', drawingId: 'upload', drawingName: 'upload.svg', drawingTheme: 'Local upload', uploadedImage: { imageId: 'linked-clear-image', fileName: 'upload.svg' } },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      strokes: [],
      guideOpacity: 0.26,
      guideOnTop: true,
      markerColor: '#000000',
      markerWidth: 12,
      brushToolId: 'marker',
    }))
  })
  assert(await countUploadedImages(page) === 2, 'Could not seed linked and orphan image records before bulk clear')
  await page.evaluate(() => {
    window.__traceBuddyOriginalIdbClear = IDBObjectStore.prototype.clear
    IDBObjectStore.prototype.clear = () => {
      throw new DOMException('Simulated IndexedDB cleanup failure', 'UnknownError')
    }
  })
  const clearDialogs = []
  const acceptClearDialogs = (dialog) => {
    clearDialogs.push(dialog.message())
    void dialog.accept()
  }
  page.on('dialog', acceptClearDialogs)
  await clickByText(page, 'Clear local work')
  await page.waitForFunction(() => document.querySelectorAll('.previous-work-card').length === 0, { timeout: 3_000 })
  const unindexedRecordExists = await page.evaluate(() => localStorage.getItem('tracebuddy.previousWork.v1.session.unindexed-clear-test') !== null)
  assert(!unindexedRecordExists, 'Bulk clear left an unindexed session behind')
  assert(await countUploadedImages(page) === 2, 'A simulated image-cleanup failure should not hide whether image records remain')
  for (let attempt = 0; attempt < 20 && clearDialogs.length < 2; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert(clearDialogs.some((message) => message.includes('could not finish removing stored image files')), 'Partial cleanup was not reported')
  await page.evaluate(() => {
    IDBObjectStore.prototype.clear = window.__traceBuddyOriginalIdbClear
    delete window.__traceBuddyOriginalIdbClear
  })
  await clickByText(page, 'Clear local work')
  await page.waitForFunction(async () => {
    const request = indexedDB.open('tracebuddy-uploaded-images', 1)
    const db = await new Promise((resolveDb) => { request.onsuccess = () => resolveDb(request.result) })
    const countRequest = db.transaction('uploaded-images', 'readonly').objectStore('uploaded-images').count()
    return new Promise((resolveCount) => { countRequest.onsuccess = () => resolveCount(countRequest.result === 0) })
  }, { timeout: 3_000 })
  page.off('dialog', acceptClearDialogs)
  console.log('Bulk clear passed')

  await page.evaluate(async () => {
    const imageId = 'active-guide-preservation-image'
    const imageSvg = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="none" stroke="black"/></svg>'
    const request = indexedDB.open('tracebuddy-uploaded-images', 1)
    const db = await new Promise((resolveDb, reject) => {
      request.onsuccess = () => resolveDb(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolveWrite, reject) => {
      const transaction = db.transaction('uploaded-images', 'readwrite')
      transaction.objectStore('uploaded-images').put({ imageId, fileName: 'active-guide.svg', originalSrc: imageSvg, processedSrc: imageSvg })
      transaction.oncomplete = resolveWrite
      transaction.onerror = () => reject(transaction.error)
    })
    localStorage.setItem('tracebuddy.previousWork.v1.session.active-guide-preservation', JSON.stringify({
      version: 2,
      sessionId: 'active-guide-preservation',
      title: 'Active guide preservation',
      source: { kind: 'upload', drawingId: 'upload', drawingName: 'active-guide.svg', drawingTheme: 'Local upload', uploadedImage: { imageId, fileName: 'active-guide.svg' } },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      strokes: [{ path: 'M 100 100 L 200 200', color: '#000000', width: 12, opacity: 0.9, mode: 'draw' }],
      guideOpacity: 0.26,
      guideOnTop: true,
      markerColor: '#000000',
      markerWidth: 12,
      brushToolId: 'marker',
    }))
    localStorage.setItem('tracebuddy.previousWork.v1.index', JSON.stringify({ version: 1, ids: ['active-guide-preservation'] }))
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await clickByText(page, 'Pictures')
  await waitForSelector(page, '.picker-screen')
  await clickByText(page, 'Resume')
  await waitForSelector(page, '.practice-screen')
  page.once('dialog', (dialog) => dialog.accept())
  await clickByText(page, 'Clear all')
  await page.waitForFunction(() => localStorage.getItem('tracebuddy.previousWork.v1.session.active-guide-preservation') === null, { timeout: 3_000 })
  assert(await countUploadedImages(page) === 1, 'Clearing coloring deleted the uploaded guide that remains active')
  await drawStroke(page)
  await clickByText(page, 'Pictures')
  await waitForSelector(page, '.picker-screen')
  const resumedGuideImageId = await page.evaluate(() => {
    const index = JSON.parse(localStorage.getItem('tracebuddy.previousWork.v1.index') ?? '{"ids":[]}')
    const rawSession = index.ids[0] ? localStorage.getItem(`tracebuddy.previousWork.v1.session.${index.ids[0]}`) : null
    return rawSession ? JSON.parse(rawSession).source?.uploadedImage?.imageId : null
  })
  assert(resumedGuideImageId === 'active-guide-preservation-image', `New work lost its preserved uploaded guide: ${resumedGuideImageId}`)
  assert(await countUploadedImages(page) === 1, 'New work references an uploaded guide that is no longer stored')
  page.once('dialog', (dialog) => dialog.accept())
  await clickByText(page, 'Clear local work')
  await page.waitForFunction(() => document.querySelectorAll('.previous-work-card').length === 0, { timeout: 3_000 })
  assert(await countUploadedImages(page) === 0, 'Guide-preservation cleanup did not remove the image after local work was cleared')
  console.log('Active uploaded guide preservation passed')

  await page.evaluate(async () => {
    const request = indexedDB.open('tracebuddy-uploaded-images', 1)
    const db = await new Promise((resolveDb, reject) => {
      request.onsuccess = () => resolveDb(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolveWrite, reject) => {
      const transaction = db.transaction('uploaded-images', 'readwrite')
      transaction.objectStore('uploaded-images').put({
        imageId: 'preserved-corrupt-index-image',
        fileName: 'preserved-corrupt-index.svg',
        originalSrc: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
        processedSrc: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
      })
      transaction.oncomplete = resolveWrite
      transaction.onerror = () => reject(transaction.error)
    })
    localStorage.setItem('tracebuddy.previousWork.v1.session.preserved-corrupt-index', JSON.stringify({
      version: 2,
      sessionId: 'preserved-corrupt-index',
      title: 'Preserved upload',
      source: { kind: 'upload', drawingId: 'upload', drawingName: 'preserved.svg', drawingTheme: 'Local upload', uploadedImage: { imageId: 'preserved-corrupt-index-image', fileName: 'preserved.svg' } },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      strokes: [],
      guideOpacity: 0.26,
      guideOnTop: true,
      markerColor: '#000000',
      markerWidth: 12,
      brushToolId: 'marker',
    }))
    localStorage.setItem('tracebuddy.previousWork.v1.index', '{corrupt')
  })
  assert(await countUploadedImages(page) === 1, 'Could not seed a referenced upload record')
  await page.reload({ waitUntil: 'networkidle0' })
  await waitForSelector(page, '.hero-screen')
  await new Promise((resolve) => setTimeout(resolve, 250))
  assert(await countUploadedImages(page) === 1, 'Corrupt index cleanup deleted an image referenced by an unindexed session')
  console.log('Corrupt-index preservation passed')

  await clickByText(page, 'Pictures')
  await waitForSelector(page, '.picker-screen')
  page.once('dialog', (dialog) => dialog.accept())
  await clickByText(page, 'Clear local work')
  await page.waitForFunction(() => localStorage.getItem('tracebuddy.previousWork.v1.session.preserved-corrupt-index') === null, { timeout: 3_000 })
  assert(await countUploadedImages(page) === 0, 'Repair clear did not remove corrupt-index storage')

  await page.evaluate(async () => {
    const request = indexedDB.open('tracebuddy-uploaded-images', 1)
    const db = await new Promise((resolveDb, reject) => {
      request.onsuccess = () => resolveDb(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolveWrite, reject) => {
      const transaction = db.transaction('uploaded-images', 'readwrite')
      transaction.objectStore('uploaded-images').put({ imageId: 'orphan-test-image', fileName: 'orphan-test.svg', originalSrc: 'data:image/svg+xml,<svg/>', processedSrc: 'data:image/svg+xml,<svg/>' })
      transaction.oncomplete = resolveWrite
      transaction.onerror = () => reject(transaction.error)
    })
  })
  assert(await countUploadedImages(page) === 1, 'Could not seed an orphan upload record')
  await page.reload({ waitUntil: 'networkidle0' })
  await waitForSelector(page, '.hero-screen')
  await page.waitForFunction(async () => {
    const request = indexedDB.open('tracebuddy-uploaded-images', 1)
    const db = await new Promise((resolveDb, reject) => {
      request.onsuccess = () => resolveDb(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = db.transaction('uploaded-images', 'readonly')
    const countRequest = transaction.objectStore('uploaded-images').count()
    return new Promise((resolveCount) => {
      countRequest.onsuccess = () => resolveCount(countRequest.result === 0)
      countRequest.onerror = () => resolveCount(false)
    })
  }, { timeout: 3_000 })
  console.log('Startup orphan upload cleanup passed')

  console.log('Storage checks passed: active-stroke flush, visible retry, complete bulk clear, active-guide preservation, corrupt-index preservation, and orphan cleanup.')
} finally {
  await closeBrowser(browser)
}
