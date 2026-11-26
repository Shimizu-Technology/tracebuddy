import assert from 'node:assert/strict'

import { hasKeepsakeContent } from '../mobile/finishFindModel'
import { normalizePaperPhoto, normalizeSavedPracticeSession } from '../mobile/practiceStorageModel'
import type { SavedPracticeSession } from '../mobile/practiceStorageModel'
import { catalogPictures, paramsForSource, resolvePicture, sourceForPicture } from '../mobile/src/data/catalog'
import { isPaperKeepsake, makePaperKeepsake, paperKeepsakeTitle } from '../mobile/src/data/paperKeepsakeModel'
import { createPracticeImageCleanup, drawingImageUris } from '../mobile/src/data/practiceImageCleanup'
import { drawingTitle, makePracticeSource, rebasePracticeImageUri } from '../mobile/src/data/practiceSource'
import { parsePreviousWorkSession, serializePreviousWorkSession } from '../mobile/src/data/previousWork'

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
const photoUri = 'file:///sandbox/old/Documents/tracebuddy-uploads/work-paper-1.jpg'
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
const files = new Set([current, rebasePracticeImageUri(tracedPhoto, documents), `${documents}tracebuddy-uploads/work-stray.jpg`])
// The photo being traced is already a saved photo drawing.
const photoDrawing = emptyDrawing(uploadSource)
let records: SavedPracticeSession[] = [photoDrawing]
const cleanup = createPracticeImageCleanup(documents, {
  list: async (directory) => [...files].map((uri) => uri.slice(directory.length)),
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
const failed = `${documents}tracebuddy-uploads/work-failed.jpg`
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

console.log('Paper keepsake model checks passed')
