import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'node:url'
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
      request.onblocked = () => reject(new Error('Uploaded image database open was blocked'))
    })
    if (!db.objectStoreNames.contains('uploaded-images')) {
      db.close()
      return 0
    }
    const transaction = db.transaction('uploaded-images', 'readonly')
    const countRequest = transaction.objectStore('uploaded-images').count()
    return new Promise((resolveCount, reject) => {
      countRequest.onsuccess = () => {
        db.close()
        resolveCount(countRequest.result)
      }
      countRequest.onerror = () => {
        db.close()
        reject(countRequest.error)
      }
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

  const unsavedDialogHandled = new Promise((resolveDialog, rejectDialog) => {
    const handleDialog = async (dialog) => {
      clearTimeout(timeout)
      try {
        await dialog.dismiss()
        resolveDialog()
      } catch (error) {
        rejectDialog(error)
      }
    }
    const timeout = setTimeout(() => {
      page.off('dialog', handleDialog)
      rejectDialog(new Error('Unsaved-work confirmation did not appear'))
    }, 3_000)
    page.once('dialog', handleDialog)
  })
  await clickByText(page, 'Pictures')
  await unsavedDialogHandled
  await waitForSelector(page, '.practice-screen')
  assert(await page.$('.picker-screen') === null, 'Dismissing the unsaved-work warning should keep Practice open')
  console.log('Unsaved navigation warning passed')

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
      request.onblocked = () => reject(new Error('Uploaded image database open was blocked'))
    })
    await new Promise((resolveWrite, reject) => {
      const transaction = db.transaction('uploaded-images', 'readwrite')
      for (const imageId of ['linked-clear-image', 'orphan-clear-image']) {
        transaction.objectStore('uploaded-images').put({ imageId, fileName: `${imageId}.svg`, originalSrc: 'data:image/svg+xml,<svg/>', processedSrc: 'data:image/svg+xml,<svg/>' })
      }
      transaction.oncomplete = resolveWrite
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
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
    localStorage.setItem('tracebuddy.drawingPreferences.v1', JSON.stringify({ version: 1, favoriteIds: ['guam-outline'], recentIds: ['guam-outline'] }))
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
  assert(await page.evaluate(() => localStorage.getItem('tracebuddy.drawingPreferences.v1') === null), 'Bulk clear left favorites or recent picks behind')
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
    const db = await new Promise((resolveDb, reject) => {
      request.onsuccess = () => resolveDb(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('Uploaded image database open was blocked'))
    })
    const countRequest = db.transaction('uploaded-images', 'readonly').objectStore('uploaded-images').count()
    return new Promise((resolveCount, reject) => {
      countRequest.onsuccess = () => {
        db.close()
        resolveCount(countRequest.result === 0)
      }
      countRequest.onerror = () => {
        db.close()
        reject(countRequest.error)
      }
    })
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
      request.onblocked = () => reject(new Error('Uploaded image database open was blocked'))
    })
    await new Promise((resolveWrite, reject) => {
      const transaction = db.transaction('uploaded-images', 'readwrite')
      transaction.objectStore('uploaded-images').put({ imageId, fileName: 'active-guide.svg', originalSrc: imageSvg, processedSrc: imageSvg })
      transaction.oncomplete = resolveWrite
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
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
      request.onblocked = () => reject(new Error('Uploaded image database open was blocked'))
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
    db.close()
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
  await page.waitForFunction(() => {
    try {
      const index = JSON.parse(localStorage.getItem('tracebuddy.previousWork.v1.index') ?? '{}')
      return Array.isArray(index.ids) && index.ids.includes('preserved-corrupt-index')
    } catch {
      return false
    }
  }, { timeout: 3_000 })
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
      request.onblocked = () => reject(new Error('Uploaded image database open was blocked'))
    })
    await new Promise((resolveWrite, reject) => {
      const transaction = db.transaction('uploaded-images', 'readwrite')
      transaction.objectStore('uploaded-images').put({ imageId: 'orphan-test-image', fileName: 'orphan-test.svg', originalSrc: 'data:image/svg+xml,<svg/>', processedSrc: 'data:image/svg+xml,<svg/>' })
      transaction.oncomplete = resolveWrite
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  })
  assert(await countUploadedImages(page) === 1, 'Could not seed an orphan upload record')
  await page.reload({ waitUntil: 'networkidle0' })
  await waitForSelector(page, '.hero-screen')
  await page.waitForFunction(async () => {
    const request = indexedDB.open('tracebuddy-uploaded-images', 1)
    const db = await new Promise((resolveDb, reject) => {
      request.onsuccess = () => resolveDb(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('Uploaded image database open was blocked'))
    })
    const transaction = db.transaction('uploaded-images', 'readonly')
    const countRequest = transaction.objectStore('uploaded-images').count()
    return new Promise((resolveCount, reject) => {
      countRequest.onsuccess = () => {
        db.close()
        resolveCount(countRequest.result === 0)
      }
      countRequest.onerror = () => {
        db.close()
        reject(countRequest.error)
      }
    })
  }, { timeout: 3_000 })
  console.log('Startup orphan upload cleanup passed')

  await clickByText(page, 'Practice on screen')
  await waitForSelector(page, '.practice-screen')
  const practiceUpload = await page.$('.practice-screen input[type="file"]')
  assert(practiceUpload, 'Practice upload input is unavailable')
  await practiceUpload.uploadFile(fileURLToPath(new URL('../public/favicon.svg', import.meta.url)))
  await page.waitForFunction(() => document.querySelector('.practice-screen h1')?.textContent === 'favicon.svg', { timeout: 3_000 })
  await clickByText(page, 'Camera', '.practice-header button')
  await waitForSelector(page, '.trace-screen')
  await page.evaluate(() => {
    window.__traceBuddyOriginalIdbPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = () => {
      throw new DOMException('Simulated uploaded-image save failure', 'QuotaExceededError')
    }
  })
  await clickByText(page, 'Line art')
  await page.waitForFunction(() => document.querySelector('.cleanup-status')?.classList.contains('error'), { timeout: 3_000 })
  await clickByText(page, 'Practice on screen')
  await waitForSelector(page, '.practice-screen')
  await page.waitForFunction(() => document.querySelector('.practice-save-status')?.classList.contains('error'), { timeout: 3_000 })
  assert(await page.$('.practice-save-status button') !== null, 'Uploaded-image save failure did not expose Retry in Practice')
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = window.__traceBuddyOriginalIdbPut
    delete window.__traceBuddyOriginalIdbPut
  })
  await clickByText(page, 'Retry')
  await page.waitForFunction(() => document.querySelector('.practice-save-status')?.classList.contains('saved'), { timeout: 3_000 })
  console.log('Uploaded-image save status propagation passed')

  await page.evaluate(() => {
    window.__traceBuddyOriginalFileReader = window.FileReader
    window.__traceBuddyControlledReaders = []
    window.FileReader = class ControlledFileReader {
      result = null
      onload = null
      onerror = null
      onabort = null
      readAsDataURL() {
        window.__traceBuddyControlledReaders.push(this)
      }
    }
  })
  const rapidUpload = await page.$('.practice-screen input[type="file"]')
  assert(rapidUpload, 'Practice upload input is unavailable for rapid replacement')
  const rapidUploadDialogs = []
  const dismissRapidUploadDialog = (dialog) => {
    rapidUploadDialogs.push(dialog.message())
    void dialog.dismiss()
  }
  page.on('dialog', dismissRapidUploadDialog)
  await rapidUpload.uploadFile(fileURLToPath(new URL('../public/favicon.svg', import.meta.url)))
  await page.waitForFunction(() => window.__traceBuddyControlledReaders.length === 1, { timeout: 3_000 })
  await rapidUpload.uploadFile(fileURLToPath(new URL('../mobile/assets/icon.png', import.meta.url)))
  await page.waitForFunction(() => window.__traceBuddyControlledReaders.length === 2, { timeout: 3_000 })
  await page.evaluate(() => {
    window.__traceBuddyControlledReaders[0].onerror?.(new ProgressEvent('error'))
  })
  const selectedRapidUploadName = await page.$eval('.practice-screen input[type="file"]', (input) => input.files?.[0]?.name ?? '')
  assert(selectedRapidUploadName === 'icon.png', `A stale FileReader failure cleared the newer upload: ${selectedRapidUploadName}`)
  assert(rapidUploadDialogs.length === 0, `A stale FileReader failure showed an obsolete alert: ${rapidUploadDialogs.join(' | ')}`)
  await page.evaluate(() => {
    const reader = window.__traceBuddyControlledReaders[1]
    reader.result = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    reader.onload?.(new ProgressEvent('load'))
  })
  await page.waitForFunction(() => document.querySelector('.practice-screen h1')?.textContent === 'icon.png', { timeout: 3_000 })
  await page.evaluate(() => {
    window.FileReader = window.__traceBuddyOriginalFileReader
    delete window.__traceBuddyOriginalFileReader
    delete window.__traceBuddyControlledReaders
  })
  page.off('dialog', dismissRapidUploadDialog)
  console.log('Rapid upload replacement passed')

  await drawStroke(page, 28)
  await page.waitForFunction(() => document.querySelector('.practice-save-status')?.classList.contains('saving'), { timeout: 3_000 })
  await page.waitForFunction(() => document.querySelector('.practice-save-status')?.classList.contains('saved'), { timeout: 3_000 })
  const clearRaceSessionId = await page.evaluate(() => JSON.parse(localStorage.getItem('tracebuddy.previousWork.v1.index')).ids[0])
  assert(clearRaceSessionId, 'Could not identify the saved session for the clear/autosave race check')
  await page.evaluate(() => {
    window.__traceBuddyOriginalIdbTransaction = IDBDatabase.prototype.transaction
    window.__traceBuddyDelayNextIdbTransaction = true
    IDBDatabase.prototype.transaction = function delayedTransaction(...args) {
      const transaction = window.__traceBuddyOriginalIdbTransaction.apply(this, args)
      if (!window.__traceBuddyDelayNextIdbTransaction || args[1] !== 'readwrite') return transaction
      window.__traceBuddyDelayNextIdbTransaction = false
      return new Proxy(transaction, {
        get(target, property) {
          const value = Reflect.get(target, property, target)
          return typeof value === 'function' ? value.bind(target) : value
        },
        set(target, property, value) {
          if (property === 'oncomplete' && typeof value === 'function') {
            return Reflect.set(target, property, (event) => setTimeout(() => value.call(target, event), 700), target)
          }
          return Reflect.set(target, property, value, target)
        },
      })
    }
  })
  await drawStroke(page, 54)
  await page.waitForFunction(() => document.querySelector('.practice-save-status')?.classList.contains('saving'), { timeout: 3_000 })
  page.once('dialog', (dialog) => dialog.accept())
  await clickByText(page, 'Clear all')
  await page.waitForFunction((sessionId) => (
    localStorage.getItem(`tracebuddy.previousWork.v1.session.${sessionId}`) === null
    && document.querySelector('.practice-save-status')?.classList.contains('saved')
  ), { timeout: 3_000 }, clearRaceSessionId)
  const clearedSessionWasResurrected = await page.evaluate((sessionId) => {
    const index = JSON.parse(localStorage.getItem('tracebuddy.previousWork.v1.index') ?? '{"ids":[]}')
    return localStorage.getItem(`tracebuddy.previousWork.v1.session.${sessionId}`) !== null || index.ids.includes(sessionId)
  }, clearRaceSessionId)
  assert(!clearedSessionWasResurrected, 'A pending autosave resurrected a cleared session')
  await page.evaluate(() => {
    IDBDatabase.prototype.transaction = window.__traceBuddyOriginalIdbTransaction
    delete window.__traceBuddyOriginalIdbTransaction
    delete window.__traceBuddyDelayNextIdbTransaction
  })
  console.log('Clear/autosave race protection passed')

  await clickByText(page, 'Pictures')
  await waitForSelector(page, '.picker-screen')
  page.once('dialog', (dialog) => dialog.accept())
  await clickByText(page, 'Clear local work')
  await page.waitForFunction(() => document.querySelectorAll('.previous-work-card').length === 0, { timeout: 3_000 })
  await page.evaluate(() => {
    const image = {
      imageId: 'legacy-inline-image',
      fileName: 'legacy-inline.svg',
      originalSrc: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="none" stroke="black"/></svg>',
      processedSrc: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="none" stroke="black"/></svg>',
    }
    localStorage.setItem('tracebuddy.previousWork.v1.session.legacy-inline', JSON.stringify({
      version: 2,
      sessionId: 'legacy-inline',
      title: 'Legacy inline upload',
      source: { kind: 'upload', drawingId: 'upload', drawingName: image.fileName, drawingTheme: 'Local upload', uploadedImage: image },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      strokes: [{ path: 'M 100 100 L 180 180', color: '#000000', width: 12, opacity: 0.9, mode: 'draw' }],
      guideOpacity: 0.26,
      guideOnTop: true,
      markerColor: '#000000',
      markerWidth: 12,
      brushToolId: 'marker',
    }))
    localStorage.setItem('tracebuddy.previousWork.v1.index', JSON.stringify({ version: 1, ids: ['legacy-inline'] }))
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await clickByText(page, 'Pictures')
  await waitForSelector(page, '.picker-screen')
  await clickByText(page, 'Resume')
  await waitForSelector(page, '.practice-screen')
  await page.waitForFunction(async () => {
    const request = indexedDB.open('tracebuddy-uploaded-images', 1)
    const db = await new Promise((resolveDb, reject) => {
      request.onsuccess = () => resolveDb(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('Uploaded image database open was blocked'))
    })
    const getRequest = db.transaction('uploaded-images', 'readonly').objectStore('uploaded-images').get('legacy-inline-image')
    return new Promise((resolveRecord, reject) => {
      getRequest.onsuccess = () => {
        db.close()
        resolveRecord(Boolean(getRequest.result))
      }
      getRequest.onerror = () => {
        db.close()
        reject(getRequest.error)
      }
    })
  }, { timeout: 3_000 })
  await drawStroke(page, 15)
  await clickByText(page, 'Pictures')
  await waitForSelector(page, '.picker-screen')
  const storedLegacySource = await page.evaluate(() => JSON.parse(localStorage.getItem('tracebuddy.previousWork.v1.session.legacy-inline')).source.uploadedImage)
  assert(!storedLegacySource.originalSrc && !storedLegacySource.processedSrc, 'Legacy inline source was not normalized after save')
  await page.reload({ waitUntil: 'networkidle0' })
  await clickByText(page, 'Pictures')
  await waitForSelector(page, '.picker-screen')
  await clickByText(page, 'Resume')
  await waitForSelector(page, '.practice-screen')
  assert(await page.$eval('.practice-screen h1', (heading) => heading.textContent) === 'legacy-inline.svg', 'Migrated inline upload did not survive ID-only reload')
  console.log('Legacy inline upload migration passed')

  console.log('Storage checks passed: active-stroke flush, visible retry, unsaved-navigation warning, complete bulk clear, active-guide preservation, corrupt-index preservation, orphan cleanup, uploaded-image failure propagation, rapid replacement, clear/autosave race protection, and legacy inline migration.')
} finally {
  await closeBrowser(browser)
}
