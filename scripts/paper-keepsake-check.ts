import assert from 'node:assert/strict'

import { hasKeepsakeContent } from '../mobile/finishFindModel'
import { normalizePaperPhoto, normalizeSavedPracticeSession } from '../mobile/practiceStorageModel'
import type { SavedPracticeSession } from '../mobile/practiceStorageModel'
import { catalogPictures, paramsForSource, resolvePicture, sourceForPicture } from '../mobile/src/data/catalog'
import { isPaperKeepsake, makePaperKeepsake, paperKeepsakeTitle, withoutPaperKeepsakes } from '../mobile/src/data/paperKeepsakeModel'
import { buildDrawingBackup, DrawingBackupError, mergeDrawingBackup, parseDrawingBackup, readDrawingBackupImage } from '../mobile/src/data/drawingBackupModel'
import { createPracticeImageCleanup, drawingImageUris } from '../mobile/src/data/practiceImageCleanup'
import { drawingTitle, keepsakeImageFolder, makePracticeSource, practiceImageFolder, rebasePracticeImageUri } from '../mobile/src/data/practiceSource'
import { createPreviousWorkStorage, isUnreadableDrawingRecordError, parsePreviousWorkSession, previousWorkSessionKey } from '../mobile/src/data/previousWork'
import { createSnapShots } from '../mobile/src/features/paper/snapShots'

// Saved drawings are stored as their JSON (previousWork.ts and drawingRecords.ts).
const serializePreviousWorkSession = (session: SavedPracticeSession) => JSON.stringify(session)

// A snapped photo of a drawing made On paper is kept as an ordinary saved drawing with a `paperPhoto`.

function roundTrip(session: SavedPracticeSession) {
  return parsePreviousWorkSession(serializePreviousWorkSession(session))
}

// Normalization keeps a well-formed photo and drops anything else.
assert.deepEqual(normalizePaperPhoto({ uri: 'file:///Documents/tracebuddy-uploads/work-a.jpg', width: 3024, height: 4032 }),
  { uri: 'file:///Documents/tracebuddy-uploads/work-a.jpg', width: 3024, height: 4032 })
assert.deepEqual(normalizePaperPhoto({ uri: 'file:///x.jpg', width: -1, height: Number.NaN }), { uri: 'file:///x.jpg' })
assert.deepEqual(normalizePaperPhoto({ uri: 'file:///x.jpg', width: '3024' }), { uri: 'file:///x.jpg' })
for (const value of [undefined, null, 'file:///x.jpg', {}, { uri: '' }, { uri: 7 }]) {
  assert.equal(normalizePaperPhoto(value), undefined)
}

// Legacy drawings (1.2 and earlier 2.0 builds) load exactly as before: no `paperPhoto` key appears.
const legacy = {
  version: 2, sessionId: 'work-legacy', title: 'Butterfly',
  source: { kind: 'drawing', drawingId: 'butterfly', drawingName: 'Butterfly', drawingTheme: 'Symmetry' },
  createdAt: '2026-06-01T09:00:00.000Z', updatedAt: '2026-06-01T09:01:18.000Z',
  strokes: [{ path: 'M 122 133 L 210 245', color: '#18243A', width: 25, opacity: 0.9, mode: 'draw' }],
  stickers: [], canvasWidth: 1000, canvasHeight: 1000, guideOpacity: 0.24, guideOnTop: false,
  markerColor: '#18243A', markerWidth: 9, brushToolId: 'marker',
}
const legacyLoaded = normalizeSavedPracticeSession(legacy)
assert.ok(legacyLoaded)
assert.equal('paperPhoto' in legacyLoaded, false)
assert.equal(isPaperKeepsake(legacyLoaded), false)
assert.deepEqual(roundTrip(legacyLoaded), legacyLoaded)
assert.equal(serializePreviousWorkSession(legacyLoaded).includes('paperPhoto'), false)
// A damaged photo field leaves an ordinary drawing that still opens.
const damaged = normalizeSavedPracticeSession({ ...legacy, paperPhoto: { uri: 42 } })
assert.ok(damaged)
assert.equal('paperPhoto' in damaged, false)
assert.equal(damaged.strokes.length, 1)

// A keepsake of a catalog picture: titled after it, linked to its id and level, and traced again from its source.
const picture = catalogPictures('detailed').find((candidate) => candidate.level === 'detailed')
assert.ok(picture)
const guideSvg = '<svg viewBox="0 0 1000 1000"><path d="M0 0h10v10z"/></svg>'
function emptyDrawing(source: SavedPracticeSession['source']) {
  const drawing = normalizeSavedPracticeSession({ sessionId: 'work-paper-1', source, createdAt: '2026-11-26T10:00:00.000Z', updatedAt: '2026-11-26T10:00:00.000Z' })
  assert.ok(drawing)
  return drawing
}
assert.notEqual(keepsakeImageFolder, practiceImageFolder)
const photoUri = 'file:///sandbox/old/Documents/tracebuddy-keepsakes/work-paper-1.jpg'
const keepsake = makePaperKeepsake(emptyDrawing(sourceForPicture(picture, guideSvg)), { uri: photoUri, width: 3024, height: 4032 })
assert.equal(keepsake.title, `${picture.name} (on paper)`)
assert.equal(drawingTitle(keepsake), `${picture.name} (on paper)`)
assert.equal(keepsake.source.drawingId, `tb2-detailed-${picture.id}`)
assert.equal(keepsake.finishedAt, keepsake.createdAt)
assert.deepEqual(keepsake.strokes, [])
assert.ok(isPaperKeepsake(keepsake))
assert.ok(hasKeepsakeContent(keepsake.strokes.length, keepsake.stickers.length, keepsake.stamp, keepsake.finishedAt), 'A keepsake counts as saved work')
assert.deepEqual(paramsForSource(keepsake.source), { id: picture.id, level: 'detailed' })
assert.equal(resolvePicture(paramsForSource(keepsake.source)), picture)
const reloaded = roundTrip(keepsake)
assert.deepEqual(reloaded, keepsake)
assert.ok(reloaded && isPaperKeepsake(reloaded))

// A keepsake of a photo picture keeps both files: the photo traced and the photo of the paper.
const tracedPhoto = 'file:///sandbox/old/Documents/tracebuddy-uploads/work-traced.png'
const uploadSource = makePracticeSource(
  { id: 'my-photo', name: 'My photo', theme: 'Local image', category: 'starters', difficulty: 'Starter', svg: '' },
  { uri: tracedPhoto, name: 'My photo', width: 1200, height: 900 },
)
const photoKeepsake = makePaperKeepsake(emptyDrawing(uploadSource), { uri: photoUri })
assert.equal(paperKeepsakeTitle(uploadSource), 'My photo (on paper)')
assert.equal(drawingTitle(photoKeepsake), 'My photo (on paper)')
assert.equal(drawingTitle({ ...photoKeepsake, paperPhoto: undefined, title: 'IMG_1.HEIC' }), 'My photo', 'Photo drawings keep their 2.0 name')
assert.deepEqual(drawingImageUris(photoKeepsake), [tracedPhoto, photoUri])
assert.equal(paramsForSource(photoKeepsake.source).photo, tracedPhoto)
assert.deepEqual(roundTrip(photoKeepsake), photoKeepsake)

// Cleanup and leases: the photo survives while saving and while referenced, even after a sandbox move,
// and goes when its drawing is deleted.
const documents = 'file:///sandbox/current/Documents/'
const current = rebasePracticeImageUri(photoUri, documents)
assert.equal(current, `${documents}tracebuddy-keepsakes/work-paper-1.jpg`, 'Keepsake photos follow a sandbox move')
const files = new Set([current, rebasePracticeImageUri(tracedPhoto, documents), `${documents}tracebuddy-uploads/work-stray.jpg`])
// The photo being traced is already a saved photo drawing.
const photoDrawing = emptyDrawing(uploadSource)
let records: SavedPracticeSession[] = [photoDrawing]
const cleanup = createPracticeImageCleanup(documents, {
  list: async (directory) => [...files].filter((uri) => uri.startsWith(directory)).map((uri) => uri.slice(directory.length)),
  readReferences: async () => records.flatMap((record) => drawingImageUris(record)),
  remove: async (uri) => { files.delete(uri) },
})
// Before the record is written, only the save's lease holds the new photo.
const releaseSave = cleanup.acquire([current])
await cleanup.sweep()
assert.ok(files.has(current), 'The lease keeps a photo that is being saved')
assert.equal(files.has(`${documents}tracebuddy-uploads/work-stray.jpg`), false, 'Unreferenced photos are still cleaned up')
records = [photoDrawing, roundTrip(photoKeepsake)!]
releaseSave()
await cleanup.sweep([current])
assert.ok(files.has(current), 'A saved keepsake keeps its photo after the lease ends')
assert.ok(files.has(rebasePracticeImageUri(tracedPhoto, documents)), 'and the photo it traced')
// A failed save releases the lease with no record: the copied file is removed.
const failed = `${documents}tracebuddy-keepsakes/work-failed.jpg`
files.add(failed)
const releaseFailed = cleanup.acquire([failed])
releaseFailed()
await cleanup.sweep([failed])
assert.equal(files.has(failed), false)
// Deleting the keepsake frees its photo; the traced photo stays while its own drawing uses it.
records = [photoDrawing]
await cleanup.sweep(drawingImageUris(photoKeepsake))
assert.deepEqual([...files], [rebasePracticeImageUri(tracedPhoto, documents)])
records = []
await cleanup.sweep()
assert.equal(files.size, 0)

// The 1.x startup sweep (mobile/App.tsx) deletes every file in tracebuddy-uploads that no source photo or image
// sticker uses. It never lists tracebuddy-keepsakes, so a 1.x launch on the same data keeps keepsake photos.
const legacyUploads = `${documents}${practiceImageFolder}/`
function legacyStartupSweep(onDisk: Set<string>, saved: SavedPracticeSession[]) {
  const referenced = new Set(saved.flatMap((record) => [record.source.uploadedImage?.uri,
    ...record.stickers.filter((sticker) => sticker.kind === 'image').map((sticker) => sticker.uri)]))
  for (const uri of [...onDisk].filter((candidate) => candidate.startsWith(legacyUploads))) {
    if (!referenced.has(uri)) onDisk.delete(uri)
  }
}
const legacyDisk = new Set([current, `${legacyUploads}work-orphan.jpg`])
legacyStartupSweep(legacyDisk, [{ ...keepsake, paperPhoto: { uri: current } }])
assert.deepEqual([...legacyDisk], [current], 'A 1.x sweep removes its own orphans but not keepsake photos')

// Backup and restore (#74): the photo travels as a portable image and comes back into the keepsakes folder.
const jpeg = Buffer.from('paper photo bytes').toString('base64')
const disk = new Map([[current, jpeg]])
const library = new Map([[keepsake.sessionId, { ...keepsake, paperPhoto: { uri: photoUri, width: 3024, height: 4032 } }]])
const emptySettings = { progress: { version: 1 as const, completedLessonIds: [], stepByLessonId: {} }, artFavorites: [], legacyFavorites: [] }
const backup = await buildDrawingBackup({ ...emptySettings, drawings: [...library.values()] },
  (uri) => rebasePracticeImageUri(uri, documents), async (uri) => ({ extension: 'jpg', base64: disk.get(uri) ?? null }))
// The app's image reader takes files from both drawing image folders and treats anything else as missing.
const imageIO = {
  getInfo: async (uri: string) => ({ exists: disk.has(uri), isDirectory: false, size: disk.get(uri)?.length ?? 0 }),
  readBase64: async (uri: string) => disk.get(uri) ?? '',
}
assert.deepEqual(await readDrawingBackupImage(current, documents, 1024, imageIO), { extension: 'jpg', base64: jpeg })
assert.deepEqual(await readDrawingBackupImage(`${documents}elsewhere/work-paper-1.jpg`, documents, 1024, imageIO), { extension: 'jpg', base64: null })
const raw = JSON.stringify(backup)
assert.ok(!raw.includes('/Documents/'), 'The backup has no device paths')
assert.equal(backup.drawings[0].paperPhoto?.uri, 'tracebuddy-image:0')
assert.deepEqual(backup.images, [{ extension: 'jpg', base64: jpeg }])
const parsed = parseDrawingBackup(raw)
// Lose the photo and the drawing, then restore.
disk.clear()
library.clear()
const kinds: string[] = []
const result = await mergeDrawingBackup(parsed, {
  readDrawing: async (id) => library.get(id) ?? null,
  writeDrawing: async (drawing) => { library.set(drawing.sessionId, roundTrip(drawing)!) },
  async writeImage(image, kind) {
    kinds.push(kind)
    const uri = `${documents}${kind === 'keepsake' ? keepsakeImageFolder : practiceImageFolder}/restored-${kinds.length}.${image.extension}`
    if (image.base64 !== null) disk.set(uri, image.base64)
    return uri
  },
  writeSettings: async () => undefined,
})
assert.deepEqual(result, { added: 1, updated: 0, kept: 0, missingPhotos: 0 })
assert.deepEqual(kinds, ['keepsake'])
const restored = library.get(keepsake.sessionId)
assert.ok(restored && isPaperKeepsake(restored), 'The restored keepsake still opens as a photo')
assert.equal(restored.paperPhoto.uri, `${documents}tracebuddy-keepsakes/restored-1.jpg`)
assert.deepEqual([restored.paperPhoto.width, restored.paperPhoto.height], [3024, 4032])
assert.equal(disk.get(restored.paperPhoto.uri), jpeg, 'The photo bytes are restored into the keepsakes folder')
assert.equal(restored.title, keepsake.title)
assert.deepEqual(restored.source, keepsake.source)
// A backup whose paper photo isn't a portable image reference, or was removed as malformed, is refused.
const [entry] = parsed.drawings
for (const paperPhoto of [{ uri: photoUri }, { uri: 'tracebuddy-image:7' }, { uri: 42 }]) {
  assert.throws(() => parseDrawingBackup(JSON.stringify({ ...parsed, drawings: [{ ...entry, paperPhoto }] })),
    (error) => error instanceof DrawingBackupError && error.reason === 'invalid')
}

// Restore with one image used as both a picture's photo and a paper photo: each folder gets its own file.
const shared = 'file:///sandbox/old/Documents/tracebuddy-uploads/work-shared.jpg'
const photoDrawingOfShared = { ...emptyDrawing(makePracticeSource(
  { id: 'my-photo', name: 'My photo', theme: 'Local image', category: 'starters', difficulty: 'Starter', svg: '' },
  { uri: shared, name: 'My photo' })), sessionId: 'work-shared-photo', updatedAt: '2026-11-26T11:00:00.000Z' }
const keepsakeOfShared = { ...keepsake, sessionId: 'work-shared-keepsake', paperPhoto: { uri: shared } }
async function restoreInto(drawings: SavedPracticeSession[]) {
  const images = new Map([[rebasePracticeImageUri(shared, documents), jpeg]])
  const exported = parseDrawingBackup(JSON.stringify(await buildDrawingBackup({ ...emptySettings, drawings },
    (uri) => rebasePracticeImageUri(uri, documents), async (uri) => ({ extension: 'jpg', base64: images.get(uri) ?? null }))))
  const written: { kind: string; uri: string }[] = []
  const saved = new Map<string, SavedPracticeSession>()
  await mergeDrawingBackup(exported, {
    readDrawing: async () => null,
    writeDrawing: async (drawing) => { saved.set(drawing.sessionId, drawing) },
    async writeImage(image, kind) {
      const uri = `${documents}${kind === 'keepsake' ? keepsakeImageFolder : practiceImageFolder}/restored-${written.length}.${image.extension}`
      written.push({ kind, uri })
      return uri
    },
    writeSettings: async () => undefined,
  })
  return { exported, written, saved }
}
// The upload restores first, then the keepsake, from a single shared image.
const crossKind = await restoreInto([photoDrawingOfShared, keepsakeOfShared])
assert.equal(crossKind.exported.images.length, 1, 'The backup stores the shared file once')
assert.deepEqual(crossKind.written.map(({ kind }) => kind), ['drawing', 'keepsake'])
assert.ok(crossKind.saved.get('work-shared-photo')?.source.uploadedImage?.uri.includes('/tracebuddy-uploads/'))
assert.ok(crossKind.saved.get('work-shared-keepsake')?.paperPhoto?.uri.includes('/tracebuddy-keepsakes/'),
  'A keepsake never points at a file in the uploads folder')
// One kind only: two drawings sharing a photo still restore to one file, as before.
const sameKind = await restoreInto([photoDrawingOfShared, { ...photoDrawingOfShared, sessionId: 'work-shared-photo-2' }])
assert.deepEqual(sameKind.written.map(({ kind }) => kind), ['drawing'])
assert.equal(sameKind.saved.get('work-shared-photo')?.source.uploadedImage?.uri, sameKind.saved.get('work-shared-photo-2')?.source.uploadedImage?.uri)

// A record whose paper photo is present but unreadable is an unreadable record: the image-cleanup scan stops
// instead of treating its photo as unused, while ordinary reads report the drawing as unreadable.
const brokenPhoto = JSON.stringify({ ...keepsake, paperPhoto: { uri: null } })
assert.throws(() => parsePreviousWorkSession(brokenPhoto), isUnreadableDrawingRecordError)
assert.throws(() => parsePreviousWorkSession(JSON.stringify({ ...keepsake, paperPhoto: null })), isUnreadableDrawingRecordError)
assert.ok(parsePreviousWorkSession(JSON.stringify({ ...keepsake, paperPhoto: undefined })), 'No paper photo is still an ordinary drawing')
const kv = new Map<string, string>()
const store = createPreviousWorkStorage({
  getAllKeys: async () => [...kv.keys()],
  getItem: async (key) => kv.get(key) ?? null,
  async setItem(key, value) { kv.set(key, value) },
  async removeItem(key) { kv.delete(key) },
})
kv.set(previousWorkSessionKey(keepsake.sessionId), brokenPhoto)
const sweptPhoto = `${documents}${keepsakeImageFolder}/work-paper-1.jpg`
const sweepFiles = new Set([sweptPhoto])
const storeCleanup = createPracticeImageCleanup(documents, {
  list: async (directory) => [...sweepFiles].filter((uri) => uri.startsWith(directory)).map((uri) => uri.slice(directory.length)),
  readReferences: async () => (await store.readSessionsForImageCleanupInQueue()).flatMap((record) => drawingImageUris(record)),
  remove: async (uri) => { sweepFiles.delete(uri) },
})
await assert.rejects(storeCleanup.sweep(), isUnreadableDrawingRecordError)
assert.ok(sweepFiles.has(sweptPhoto), 'The photo of a record with a damaged paperPhoto is not swept')
let unreadable = 0
assert.deepEqual(await store.loadPreviousWorkSessionsWithLegacyMigration({ width: 1, height: 1 }, () => true, () => { unreadable += 1 }), [])
assert.equal(unreadable, 1, 'My drawings reports it as unreadable')

// 1.x screens never list or resume a keepsake, and a save without a paper photo can't replace one.
kv.clear()
const ordinary = { ...emptyDrawing(sourceForPicture(picture, guideSvg)), sessionId: 'work-ink' }
assert.deepEqual(withoutPaperKeepsakes([keepsake, ordinary]).map(({ sessionId }) => sessionId), ['work-ink'])
assert.equal(await store.savePreviousWorkSession(keepsake, () => true), true)
const asInk = { ...keepsake, paperPhoto: undefined, strokes: [{ path: 'M 1 1 L 9 9', color: '#18243A', width: 9, opacity: 0.9, mode: 'draw' as const }] }
assert.equal(await store.savePreviousWorkSession(asInk, () => true), false, 'A 1.x save over a keepsake is refused')
assert.deepEqual((await store.readPreviousWorkSession(keepsake.sessionId))?.paperPhoto, keepsake.paperPhoto)
assert.equal(await store.savePreviousWorkSession({ ...keepsake, title: 'Renamed' }, () => true), true, 'A keepsake can still be saved with its photo')
assert.equal(await store.savePreviousWorkSession(ordinary, () => true), true, 'Ordinary drawings save as before')
assert.equal(await store.savePreviousWorkSession({ ...ordinary, strokes: asInk.strokes }, () => true), true)

// Temporary photo files while snapping (snapShots.ts): each is deleted exactly once, never while in use.
function snapHarness() {
  const deleted: string[] = []
  return { deleted, shots: createSnapShots((uri) => { deleted.push(uri) }) }
}
{ // Back while the shutter is busy: the late photo is deleted and doesn't open review.
  const { deleted, shots } = snapHarness()
  const capture = shots.begin()
  shots.invalidate()
  capture.own('tmp/late.jpg')
  assert.equal(capture.settle(true), false)
  assert.deepEqual(deleted, ['tmp/late.jpg'])
  assert.equal(shots.pending(), null)
}
{ // The screen closes before the camera returns: the file is deleted when it arrives.
  const { deleted, shots } = snapHarness()
  const capture = shots.begin()
  shots.close()
  capture.own('tmp/closed.jpg')
  assert.equal(capture.current(), false)
  assert.equal(capture.settle(true), false)
  assert.deepEqual(deleted, ['tmp/closed.jpg'])
}
{ // The Simulator capture returns a file but measuring it fails: the file is released.
  const { deleted, shots } = snapHarness()
  const capture = shots.begin()
  capture.own('tmp/stand-in.jpg')
  assert.equal(capture.settle(false), false)
  assert.deepEqual(deleted, ['tmp/stand-in.jpg'])
}
{ // Retake deletes the reviewed photo; a capture that fails before any file deletes nothing.
  const { deleted, shots } = snapHarness()
  const capture = shots.begin()
  capture.own('tmp/a.jpg')
  assert.equal(capture.settle(true), true)
  assert.equal(shots.pending(), 'tmp/a.jpg')
  shots.drop()
  assert.equal(shots.begin().settle(false), false)
  assert.deepEqual(deleted, ['tmp/a.jpg'])
}
{ // Keep it, then the screen is swiped away mid-save: the file stays until the copy settles, then goes once.
  const { deleted, shots } = snapHarness()
  const capture = shots.begin()
  capture.own('tmp/keep.jpg')
  capture.settle(true)
  const release = shots.hold('tmp/keep.jpg')
  shots.close()
  assert.deepEqual(deleted, [], 'Closing never deletes a file the save is copying')
  assert.equal(shots.isOpen(), false, 'The save sees the screen closed and gives no feedback')
  release()
  assert.deepEqual(deleted, ['tmp/keep.jpg'])
}
{ // Keep it succeeds: leaving review doesn't delete it under the save; the save's release deletes it once.
  const { deleted, shots } = snapHarness()
  const capture = shots.begin()
  capture.own('tmp/kept.jpg')
  capture.settle(true)
  const release = shots.hold('tmp/kept.jpg')
  shots.invalidate()
  shots.drop()
  assert.deepEqual(deleted, [])
  release()
  shots.close()
  assert.deepEqual(deleted, ['tmp/kept.jpg'])
}
{ // Keep it fails on an open screen: the photo stays in review to try again, and goes with Retake.
  const { deleted, shots } = snapHarness()
  const capture = shots.begin()
  capture.own('tmp/retry.jpg')
  capture.settle(true)
  shots.hold('tmp/retry.jpg')()
  assert.deepEqual(deleted, [])
  assert.equal(shots.pending(), 'tmp/retry.jpg')
  shots.drop()
  assert.deepEqual(deleted, ['tmp/retry.jpg'])
}

console.log('Paper keepsake model checks passed')
