import assert from 'node:assert/strict'
import { createTextDrawing } from '../shared/drawings'
import type { PracticeStroke, SavedPracticeSession } from '../mobile/practiceStorageModel'
import { buildDrawingBackup, DrawingBackupError, DrawingRestoreWriteError, maxDrawingBackupBytes, mergeDrawingBackup,
  mergeDrawingBackupSettings, parseDrawingBackup, readDrawingBackupImage } from '../mobile/src/data/drawingBackupModel'
import type { DrawingBackupSettings } from '../mobile/src/data/drawingBackupModel'
import { createDrawingRecords, drawingRecordFileName } from '../mobile/src/data/drawingRecords'
import { newDrawing, drawingCopy } from '../mobile/src/data/drawingSession'
import { legacyPracticeSessionId } from '../mobile/src/data/legacyPractice'
import { createPracticeImageCleanup, drawingImageUris } from '../mobile/src/data/practiceImageCleanup'
import { createPreviousWorkStorage, normalizePreviousWorkSession, previousWorkSessionKey, serializePreviousWorkIndex } from '../mobile/src/data/previousWork'
import { legacyPracticeAutosavePrefix, previousWorkIndexKey } from '../mobile/src/data/storageKeys'
import { preserveLessonDrawing } from '../mobile/src/features/learn/lessonPractice'

const saved = (id: string, updatedAt = '2026-11-26T09:30:00.000Z'): SavedPracticeSession => ({
  ...newDrawing({
    kind: 'drawing', drawingId: 'butterfly', drawingName: 'Butterfly', drawingTheme: 'Animals',
    drawingSvg: '<svg viewBox="0 0 100 100"><path d="M 0 0 L 0 100 L 100 0 Z"/></svg>',
  }),
  sessionId: id, createdAt: '2026-11-26T09:00:00.000Z', updatedAt,
})

const marker: PracticeStroke = { path: 'M 0 0 L 100 100', opacity: 1, width: 12, mode: 'draw', color: '#18243A' }
const watercolor = { ...marker, color: '#62BDE3', blend: 'multiply' as const }
const longStroke = { ...watercolor, path: 'M 0 0' + ' L 299.65 640.77'.repeat(400) }
const large = { ...saved('large'), strokes: [
  ...Array.from({ length: 500 }, (_, i) => ({ ...longStroke, path: longStroke.path + ` L ${i} 100` })),
  ...Array.from({ length: 5 }, (_, i): PracticeStroke => ({ ...marker, kind: 'fill', path: `M ${i} 0` + ' L 280 640'.repeat(2700) + ' Z' })),
] }
assert.ok(JSON.stringify(large).length > 2 * 1024 * 1024)
const canonical = (drawing: SavedPracticeSession): SavedPracticeSession => normalizePreviousWorkSession(drawing)!

const kv = new Map<string, string>()
const files = new Map<string, string>()
let failKey: string | undefined
let failStage = false
let failPublish = false
let failReadFile: string | undefined
const nativeReadError = new SyntaxError('Native record read failed')
const makeStore = () => createPreviousWorkStorage({
  getAllKeys: async () => [...kv.keys()],
  getItem: async (key) => kv.get(key) ?? null,
  async setItem(key, value) {
    if (key === failKey) throw new Error('AsyncStorage quota exceeded')
    kv.set(key, value)
  },
  async removeItem(key) { kv.delete(key) },
}, createDrawingRecords({
  list: async () => [...files.keys()],
  exists: async (name) => files.has(name),
  read: async (name) => {
    if (name === failReadFile) throw nativeReadError
    return files.get(name) ?? null
  },
  async write(name, value) {
    if (failStage) {
      files.set(name, value.slice(0, 150))
      throw new Error('Disk full')
    }
    files.set(name, value)
  },
  async move(from, to) {
    if (failPublish && from.endsWith('.pending')) throw new Error('Could not publish staged drawing')
    assert.ok(files.has(from))
    files.set(to, files.get(from)!)
    files.delete(from)
  },
  async remove(name) { files.delete(name) },
}))
const store = makeStore()

const other = Array.from({ length: 296 }, (_, i) => ({ ...saved(`work-${i}`), strokes: [marker] }))
const lesson = { ...saved('lesson:simple/cat'), strokes: [{ ...watercolor, lessonStep: 2 }], lessonFinished: true as const }
const photoUri = 'file:///old/Documents/tracebuddy-uploads/paper.png'
const missingUri = 'file:///old/Documents/tracebuddy-uploads/sticker.png'
const photo: SavedPracticeSession = {
  ...saved('paper'),
  title: 'My paper drawing',
  source: { kind: 'upload', drawingId: 'paper-photo', drawingTheme: 'Paper', drawingName: 'My paper drawing',
    uploadedImage: { uri: photoUri, name: 'My paper drawing', width: 80, height: 80 } },
  finishedAt: '2026-11-26T09:30:00.000Z',
}
const sticker: SavedPracticeSession = {
  ...saved('sticker'),
  stickers: [{ kind: 'image', stickerId: 'missing', label: 'Photo', uri: missingUri, x: 150, y: 200, width: 80, height: 80, rotation: 0, opacity: 1 }],
}
const all = [...other, large, lesson, photo, sticker]

const put = (drawing: SavedPracticeSession) => store.savePreviousWorkSession(drawing, () => true)
await Promise.all(all.map(put))
assert.equal((await store.loadPreviousWorkSessions()).length, 300, 'Concurrent Draw and Learn writes keep all 300 drawings')
assert.deepEqual(await store.readPreviousWorkSession(large.sessionId), canonical(large), 'Full stroke data survives a multi-megabyte save')
assert.deepEqual(await store.readPreviousWorkSession(lesson.sessionId), canonical(lesson))

// A bad index cannot block a save; an interrupted older index-first write cannot
// hide an unindexed drawing, fabricate a missing session, or delete a real one.
const badIndex = serializePreviousWorkIndex(['killed-before-session', all[0].sessionId])
kv.set(previousWorkIndexKey, badIndex)
failKey = previousWorkIndexKey
await put({ ...other[0], title: 'Still saved under quota' })
assert.equal((await makeStore().loadPreviousWorkSessions()).length, 300)
assert.equal(kv.get(previousWorkIndexKey), badIndex)
assert.equal(await store.readPreviousWorkSession('killed-before-session'), null)
failKey = undefined
assert.equal((await store.loadPreviousWorkSessions()).length, 300)
assert.equal(JSON.parse(kv.get(previousWorkIndexKey)!).ids.length, 300)
kv.set(previousWorkIndexKey, '{broken')
assert.equal((await makeStore().loadPreviousWorkSessions()).length, 300)
assert.equal(JSON.parse(kv.get(previousWorkIndexKey)!).ids.length, 300)

// The original 1.2 AsyncStorage record remains the fallback for a first edit.
const older = saved('old-12')
kv.set(previousWorkSessionKey(older.sessionId), JSON.stringify(older))
failStage = true
await assert.rejects(put({ ...older, title: 'Would lose this' }), /Disk full/)
assert.deepEqual(await makeStore().readPreviousWorkSession(older.sessionId), canonical(older))
await assert.rejects(put({ ...large, strokes: [marker] }), /Disk full/)
failStage = false
assert.deepEqual(await makeStore().readPreviousWorkSession(large.sessionId), canonical(large), 'A partial write leaves the last good version intact')
await put({ ...older, title: 'Edited after upgrade' })
assert.equal(JSON.parse(kv.get(previousWorkSessionKey(older.sessionId))!).title, older.title)
await store.queuePreviousWorkWrite(() => store.deleteSessionInQueue(older.sessionId))
assert.equal(await makeStore().readPreviousWorkSession(older.sessionId), null, 'Deleting upgraded work cannot reveal the previous release copy')

const largeFile = drawingRecordFileName(large.sessionId)
failPublish = true
await assert.rejects(put({ ...large, strokes: [marker] }), /publish/)
failPublish = false
assert.deepEqual(await makeStore().readPreviousWorkSession(large.sessionId), canonical(large), 'A failed final rename can load the previous file')
files.set(largeFile + '.pending', '{"truncated')
const restartedStore = makeStore()
assert.ok((await restartedStore.loadPreviousWorkSessions()).some(({ sessionId }) => sessionId === large.sessionId))
assert.ok(!files.has(largeFile + '.pending'), 'Restart ignores abandoned staging data')
for (const corrupt of ['', '{', JSON.stringify({ ...large, strokes: ['truncated'] }), JSON.stringify({ ...large, sessionId: 'wrong' }), 'null']) {
  files.set(largeFile, corrupt)
  assert.deepEqual(await restartedStore.readPreviousWorkSession(large.sessionId), canonical(large), 'A corrupt primary can load its valid previous copy')
}
await assert.rejects(restartedStore.readSessionsForImageCleanupInQueue(), /no drawing/, 'Cleanup refuses a scan when the fallback cannot account for the damaged primary')
failPublish = true
await assert.rejects(put({ ...large, strokes: [marker] }), /publish/)
failPublish = false
assert.deepEqual(await restartedStore.readPreviousWorkSession(large.sessionId), canonical(large), 'A failed repair must preserve the only readable fallback')
files.set(largeFile, '')
files.set(largeFile + '.previous', '{')
kv.set(previousWorkSessionKey(large.sessionId), JSON.stringify(large))
assert.deepEqual(await restartedStore.readPreviousWorkSession(large.sessionId), canonical(large), 'The historical AsyncStorage row is the third fallback')
kv.delete(previousWorkSessionKey(large.sessionId))
await put(large)
assert.ok(files.has(largeFile) && !files.has(largeFile + '.previous'))

// Copy holds another reference to the same photo. Start fresh makes a new ID
// and keeps the guide without modifying the original.
const copy = drawingCopy(photo)
const fresh = { ...newDrawing(photo.source), strokes: [marker] }
assert.equal(new Set([photo.sessionId, copy.sessionId, fresh.sessionId]).size, 3)
assert.equal(fresh.finishedAt, undefined)
assert.deepEqual(drawingImageUris(fresh), [photoUri])
await put(copy)
await put(fresh)
const photoFiles = new Set([photoUri])
const sweep = createPracticeImageCleanup('file:///old/Documents/', {
  list: async () => ['paper.png'],
  readReferences: async () => (await store.readSessionsForImageCleanupInQueue()).flatMap(drawingImageUris),
  async remove(uri) { photoFiles.delete(uri) },
})
await store.queuePreviousWorkWrite(async () => {
  await store.deleteSessionInQueue(copy.sessionId)
  await store.deleteSessionInQueue(fresh.sessionId)
  await sweep.sweep([photoUri])
})
assert.ok(photoFiles.has(photoUri), 'Deleting copies cannot unlink an image still in use')
assert.deepEqual(await store.readPreviousWorkSession(photo.sessionId), canonical(photo))

await assert.rejects(store.queuePreviousWorkWrite(() => preserveLessonDrawing(store, lesson, () => true, async () => {
  throw new Error('Interrupted progress write')
})), /Interrupted/)
assert.equal((await store.readPreviousWorkSession(lesson.sessionId))?.lessonFinished, true, 'Replay does not delete the original on failure')
await store.queuePreviousWorkWrite(() => preserveLessonDrawing(store, lesson, () => true, async () => undefined))
const archived = (await store.loadPreviousWorkSessions()).filter((drawing) => drawing.lessonFinished)
assert.equal(archived.length, 1, 'Retry does not duplicate a lesson archive')
assert.deepEqual(archived[0].strokes, canonical(lesson).strokes)
assert.equal(await store.readPreviousWorkSession(lesson.sessionId), null, 'Starting the lesson again uses a clean slot')

const settings: DrawingBackupSettings = {
  progress: { version: 1, completedLessonIds: ['simple/cat'], stepByLessonId: { 'simple/cat': 2 } },
  artFavorites: ['duck'],
  legacyFavorites: ['butterfly'],
}
const emptySettings: DrawingBackupSettings = { progress: { version: 1, completedLessonIds: [], stepByLessonId: {} }, artFavorites: [], legacyFavorites: [] }
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII='
const original = await store.loadPreviousWorkSessions()
const exportBackup = () => buildDrawingBackup({ ...settings, drawings: original }, (uri) => uri, async (uri) => ({
  extension: 'png', base64: photoFiles.has(uri) ? png : null,
}))
const backup = await exportBackup()
const raw = JSON.stringify(backup)
assert.ok(!raw.includes('/old/Documents'), 'Portable files never include device paths')
assert.deepEqual(backup.images.map((image) => image.base64).sort(), [png, null], 'A missing photo is marked without discarding its drawing')
const parsed = parseDrawingBackup(raw)
assert.deepEqual(parsed.progress, settings.progress)

const restoredImages = new Map<string, string | null>()
let restoredSettings = emptySettings
let writes = 0
let failAfter: number | undefined
const toEmpty = {
  readDrawing: (id: string) => store.readSessionInQueue(id),
  async writeDrawing(drawing: SavedPracticeSession) {
    if (writes === failAfter) throw new Error('File write failed')
    await store.writeSessionInQueue(drawing)
    writes += 1
  },
  async writeImage(image: { extension: string; base64: string | null }) {
    const uri = `file:///new/Documents/tracebuddy-uploads/restore-${restoredImages.size}.${image.extension}`
    restoredImages.set(uri, image.base64)
    return uri
  },
  async writeSettings(value: DrawingBackupSettings) { restoredSettings = mergeDrawingBackupSettings(restoredSettings, value) },
}
const restore = () => store.queuePreviousWorkWrite(() => mergeDrawingBackup(parsed, toEmpty))
async function assertSameBackup() {
  const exported = await buildDrawingBackup({ ...restoredSettings, drawings: await store.loadPreviousWorkSessions() }, (uri) => uri, async (uri) => ({
    extension: 'png', base64: restoredImages.get(uri) ?? null,
  }))
  assert.deepEqual(parseDrawingBackup(JSON.stringify(exported)), parsed, 'Backup → wipe → restore preserves drawing content, favorite IDs, progress and photo bytes')
}
files.clear()
kv.clear()
assert.deepEqual(await restore(), { added: 300, updated: 0, kept: 0, missingPhotos: 1 })
await assertSameBackup()
const missingSticker = await store.readPreviousWorkSession(sticker.sessionId)
assert.equal(missingSticker?.stickers.length, 1)
assert.deepEqual(drawingImageUris(missingSticker).map((uri) => restoredImages.get(uri)), [null], 'A missing image keeps its sticker and can be reported on load')

await put({ ...original[0], updatedAt: '2030-01-01T00:00:00.000Z', title: 'Newer here' })
await put({ ...original[1], updatedAt: '2025-01-01T00:00:00.000Z', title: 'Older here' })
await put(saved('local-only'))
restoredSettings = { ...restoredSettings, artFavorites: ['local-card'], progress: { ...restoredSettings.progress,
  completedLessonIds: ['easy-flower'], stepByLessonId: { 'simple/cat': 3, 'easy-flower': 1 } } }
assert.deepEqual(await restore(), { added: 0, updated: 1, kept: 299, missingPhotos: 0 })
assert.equal((await store.readPreviousWorkSession(original[0].sessionId))?.title, 'Newer here')
assert.equal((await store.readPreviousWorkSession(original[1].sessionId))?.title, original[1].title)
assert.ok(await store.readPreviousWorkSession('local-only'))
assert.deepEqual(restoredSettings.artFavorites, ['local-card', 'duck'])
assert.deepEqual(restoredSettings.progress.completedLessonIds, ['easy-flower', 'simple/cat'])
assert.equal(restoredSettings.progress.stepByLessonId['simple/cat'], 3)

files.clear()
kv.clear()
writes = 0
failAfter = 3
await assert.rejects(restore(), (error) => error instanceof DrawingRestoreWriteError && error.result.added === 3)
assert.equal((await store.loadPreviousWorkSessions()).length, 3)
failAfter = undefined
assert.equal((await restore()).added, 297, 'Retry skips drawings already committed')

const repair = other[2]
const repairFile = drawingRecordFileName(repair.sessionId)
const onlyRepair = { ...parsed, drawings: [canonical(repair)] }
files.set(repairFile, '{broken record')
failReadFile = repairFile
await assert.rejects(store.queuePreviousWorkWrite(() => mergeDrawingBackup(onlyRepair, toEmpty)),
  (error) => error instanceof DrawingRestoreWriteError && error.cause === nativeReadError)
assert.equal(files.get(repairFile), '{broken record', 'Restore cannot overwrite an uninspected record after an I/O failure')
failReadFile = undefined
assert.deepEqual(await store.queuePreviousWorkWrite(() => mergeDrawingBackup(onlyRepair, toEmpty)),
  { added: 1, updated: 0, kept: 0, missingPhotos: 0 }, 'Restore can replace a proven corrupt record')
assert.deepEqual(await store.readPreviousWorkSession(repair.sessionId), canonical(repair))

const withMissingPhoto = parsed.drawings.find(({ sessionId }) => sessionId === sticker.sessionId)!
for (const drawings of [[withMissingPhoto, repair], [repair, withMissingPhoto]]) {
  files.clear()
  kv.clear()
  writes = 0
  failAfter = 1
  const missingPhotos = drawings[0] === withMissingPhoto ? 1 : 0
  await assert.rejects(store.queuePreviousWorkWrite(() => mergeDrawingBackup({ ...parsed, drawings }, toEmpty)),
    (error) => error instanceof DrawingRestoreWriteError && error.result.added === 1 && error.result.missingPhotos === missingPhotos,
    'A partial restore reports missing photos only for drawings it saved')
}
failAfter = undefined

// A migrated v1.1 key is deterministic and fits the native filename budget.
// Preserve an original overlong ID if a previous app already saved its row.
const longLegacyKey = legacyPracticeAutosavePrefix + 'A'.repeat(145) + 'owl'
const siblingKey = legacyPracticeAutosavePrefix + 'A'.repeat(145) + 'bat'
const shortenedId = legacyPracticeSessionId(longLegacyKey)
assert.doesNotThrow(() => drawingRecordFileName(shortenedId))
assert.notEqual(shortenedId, legacyPracticeSessionId(siblingKey))
const legacyData = JSON.stringify({ drawingId: 'butterfly', drawingName: 'Butterfly', strokes: [marker] })
const historicalLongId = 'legacy-' + 'A'.repeat(145) + 'owl'
assert.throws(() => drawingRecordFileName(historicalLongId), /Invalid drawing ID/)
const oldLongRecord = { ...saved(historicalLongId), strokes: [marker] }
files.clear()
kv.clear()
kv.set(longLegacyKey, legacyData)
kv.set(siblingKey, legacyData)
kv.set(previousWorkSessionKey(historicalLongId), JSON.stringify(oldLongRecord))
await store.queuePreviousWorkWrite(() => store.migrateLegacyPracticeAutosavesInQueue({ width: 200, height: 400 }, () => true, true))
assert.deepEqual(await store.readPreviousWorkSession(historicalLongId), canonical(oldLongRecord))
assert.ok(await store.readPreviousWorkSession(legacyPracticeSessionId(siblingKey)))
assert.equal(await store.readPreviousWorkSession(shortenedId), null, 'A lingering autosave must not duplicate its already migrated record')
const oldLongBackup = parseDrawingBackup(JSON.stringify(await buildDrawingBackup(
  { ...emptySettings, drawings: [oldLongRecord] }, (uri) => uri, async () => { throw new Error('No images expected') },
)))
kv.clear()
assert.equal((await store.queuePreviousWorkWrite(() => mergeDrawingBackup(oldLongBackup, toEmpty))).added, 1)
assert.deepEqual(await store.readPreviousWorkSession(historicalLongId), canonical(oldLongRecord))

const fixtureDocs = 'file:///old/Documents/'
const inspected: string[] = []
const readPhotoFiles = {
  async getInfo(uri: string) {
    inspected.push(uri)
    return uri === photoUri ? { exists: true as const, isDirectory: false, size: 10 } : { exists: true as const, isDirectory: false, size: 0 }
  },
  async readBase64(uri: string) {
    assert.equal(uri, photoUri, 'A zero-byte photo must not be read')
    return png
  },
}
const outOfFolder = { ...photo, sessionId: 'old-photo', source: {
  ...photo.source, uploadedImage: { ...photo.source.uploadedImage!, uri: fixtureDocs + 'tracebuddy-images/old.JPG' },
} }
const imageBackup = await buildDrawingBackup({ ...emptySettings, drawings: [photo, sticker, outOfFolder] }, (uri) => uri,
  (uri, maxBytes) => readDrawingBackupImage(uri, fixtureDocs, maxBytes, readPhotoFiles))
assert.deepEqual(inspected, [photoUri, missingUri], 'Backup does not open files outside the safe photo directory')
assert.deepEqual(parseDrawingBackup(JSON.stringify(imageBackup)).images,
  [{ extension: 'png', base64: png }, { extension: 'png', base64: null }, { extension: 'jpg', base64: null }])

for (const words of ['one = 2', 'url(x)', 'href=src onload=2']) {
  const drawing = createTextDrawing(words)
  const source = { kind: 'custom' as const, drawingId: drawing.id, drawingName: words, drawingTheme: 'My words', drawingSvg: drawing.svg }
  const wordBackup = await buildDrawingBackup({ ...emptySettings, drawings: [{ ...saved('words'), source }] }, (uri) => uri,
    async () => { throw new Error('No images expected') })
  assert.equal(parseDrawingBackup(JSON.stringify(wordBackup)).drawings[0].source.drawingSvg, drawing.svg)
}

const reject = (input: string) => assert.throws(() => parseDrawingBackup(input), (error) => error instanceof DrawingBackupError && error.reason === 'invalid')
const small = { ...backup, drawings: [backup.drawings.find(({ sessionId }) => sessionId === photo.sessionId)!] }
const [valid] = small.drawings
reject('{')
reject('null')
reject(JSON.stringify({ ...small, version: 42 }))
reject(JSON.stringify({ ...small, drawings: [valid, valid] }))
reject(JSON.stringify({ ...small, drawings: [{ ...valid, strokes: [false] }] }))
reject(JSON.stringify({ ...small, drawings: [{ ...valid, updatedAt: 'yesterday' }] }))
reject(JSON.stringify({ ...small, drawings: [{ ...valid, source: { ...valid.source, drawingSvg: '<svg><image href="file:///data/private.png"/></svg>' } }] }))
for (const attribute of ['href="https://example.invalid/picture.svg"', 'style="fill:url(https://example.invalid/picture.svg)"']) {
  reject(JSON.stringify({ ...small, drawings: [{ ...valid, source: { ...valid.source, drawingSvg: `<svg><path ${attribute}/></svg>` } }] }))
}
reject(JSON.stringify({ ...small, drawings: [{ ...valid, source: { ...valid.source, uploadedImage: { uri: 'file:///data/private.png' } } }] }))
reject(JSON.stringify({ ...small, images: [{ extension: '../png', base64: png }] }))
reject(JSON.stringify({ ...small, images: [{ extension: 'png', base64: 'a***' }] }))
reject(JSON.stringify({ ...small, images: [], drawings: [valid] }))
reject(JSON.stringify({ ...small, progress: { ...small.progress, stepByLessonId: ['bad'] } }))
const tooLarge = (error: unknown) => error instanceof DrawingBackupError && error.reason === 'too-large'
assert.equal(maxDrawingBackupBytes, 32 * 1024 * 1024)
const utf8Archive = JSON.stringify({ ...small, drawings: [{ ...valid, title: 'é𝄞' }] })
const padding = maxDrawingBackupBytes - Buffer.byteLength(utf8Archive)
assert.equal(parseDrawingBackup(utf8Archive + ' '.repeat(padding)).drawings[0].title, 'é𝄞')
assert.throws(() => parseDrawingBackup(utf8Archive + ' '.repeat(padding + 1)), tooLarge, 'Restore checks UTF-8 bytes')
const wideTitle = '絵'.repeat(400_000)
await assert.rejects(buildDrawingBackup({ ...emptySettings, drawings: Array.from({ length: 28 }, (_, i) =>
  ({ ...saved('utf8-' + i), title: wideTitle })) }, (uri) => uri, async () => { throw new Error('No images expected') }),
tooLarge, 'Export checks actual UTF-8 size before allocating the full file')
console.log('Drawing backup: 300 drawings, multi-megabyte ink, aborted writes, index recovery, copy/delete/replay, identical round-trip, merge/retry, missing photos and malformed/oversized files')
