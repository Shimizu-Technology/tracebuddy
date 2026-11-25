import assert from 'node:assert/strict'
import {
  parentSetupSeenValue, parseDrawingPreferences, parseFamilyActivity, parseLearningProgress,
  parseModePreference, parseParentSetupSeen, parseResumeContext, parseSavedAlignment,
  serializeModePreference, serializeResumeContext,
} from '../mobile/src/data/localSettings.ts'
import { toggleFavoriteDrawing } from '../shared/index.ts'
import { createFavoritePreference, isLegacyFavoriteId, parseArtFavorites } from '../mobile/src/data/favoritePreference.ts'
import { createPracticeImageCleanup, drawingImageUris } from '../mobile/src/data/practiceImageCleanup.ts'
import { drawingTitle, rebasePracticeImageUri } from '../mobile/src/data/practiceSource.ts'
import { normalizeLegacyPracticeAutosave } from '../mobile/src/data/legacyPractice.ts'
import { createPreviousWorkStorage, parsePreviousWorkSession, previousWorkSessionKey } from '../mobile/src/data/previousWork.ts'
import {
  legacyPracticeAutosavePrefix, localSettingKeys, previousWorkIndexKey,
} from '../mobile/src/data/storageKeys.ts'

assert.deepEqual(localSettingKeys, [
  'tracebuddy.resumeContext.v1',
  'tracebuddy.drawingPreferences.v1',
  'tracebuddy.learningProgress.v1',
  'tracebuddy.lessonMuted.v1',
  'tracebuddy.parentSetupSeen.v1',
  'tracebuddy.savedAlignment.v1',
  'tracebuddy.familyActivity.v1',
  'tracebuddy.modePreference.v1',
  'tracebuddy.whoIsDrawing.v1',
  'tracebuddy.artFavorites.v1',
])
assert.equal(previousWorkIndexKey, 'tracebuddy.previousWork.v1.index')
assert.equal(legacyPracticeAutosavePrefix, 'tracebuddy.practice.v1.')

// Synthetic drawing with the keys and version 2 payload written by the 1.2 release (7fe7f63).
const savedIn12 = {
  version: 2,
  sessionId: 'work-mpufogzk-8p7ksd',
  title: 'Butterfly',
  source: { kind: 'drawing', drawingId: 'butterfly', drawingName: 'Butterfly', drawingTheme: 'Symmetry' },
  createdAt: '2026-06-01T09:00:00.000Z',
  updatedAt: '2026-06-01T09:01:18.000Z',
  strokes: [
    { path: 'M 122 133 L 210 245 L 430 570', color: '#18243A', width: 25, opacity: 0.9, mode: 'draw' },
    { path: 'M 210 245 L 245 234', color: '#18243A', width: 55, opacity: 1, mode: 'erase' },
  ],
  stickers: [{
    stickerId: 'work-mpufpgpe-q52vbn', kind: 'shape', label: 'Heart',
    x: 350, y: 390, width: 170, height: 170, rotation: 0, opacity: 0.88,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M 50 82 L 20 42 L 50 20 L 80 42 Z"/></svg>',
  }],
  canvasWidth: 1000,
  canvasHeight: 1000,
  guideOpacity: 0.24,
  guideOnTop: false,
  markerColor: '#18243A',
  markerWidth: 9,
  brushToolId: 'marker',
}
const historicalSessionKey = 'tracebuddy.previousWork.v1.session.work-mpufogzk-8p7ksd'
const legacyKey = 'tracebuddy.practice.v1.line-paths'
const records = new Map([
  [historicalSessionKey, JSON.stringify(savedIn12)],
  [previousWorkIndexKey, JSON.stringify({ version: 1, ids: [savedIn12.sessionId] })],
  [legacyKey, JSON.stringify({
    drawingId: 'line-paths', drawingName: 'Line Paths', updatedAt: '2026-05-14T12:00:00.000Z',
    strokes: [{ path: 'M 20 40 L 60 80', color: '#18243A', width: 2, opacity: 0.9, mode: 'draw' }],
  })],
  ['tracebuddy.practice.v1.invalid', '{'],
])
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

let allowWrite = true
let afterMultiGetSnapshot: (() => Promise<void>) | undefined
const storage = createPreviousWorkStorage({
  getAllKeys: async () => [...records.keys()],
  getItem: async (key) => records.get(key) ?? null,
  setItem: async (key, value) => { records.set(key, value) },
  multiGet: async (keys) => {
    const snapshot = keys.map((key): [string, string | null] => [key, records.get(key) ?? null])
    await afterMultiGetSnapshot?.()
    return snapshot
  },
  multiSet: async (entries) => {
    if (!allowWrite) throw new Error('fixture storage write failed')
    entries.forEach(([key, value]) => records.set(key, value))
  },
  removeItem: async (key) => { records.delete(key) },
})

assert.equal(previousWorkSessionKey(savedIn12.sessionId), historicalSessionKey)
const [saved] = await storage.loadPreviousWorkSessions()
assert.deepEqual(JSON.parse(JSON.stringify(saved)), savedIn12)
assert.equal(saved.stamp, undefined)
assert.equal(saved.finishedAt, undefined)

const keepsake = { ...saved, stamp: 'heart' as const, finishedAt: '2026-06-02T09:00:00.000Z' }
await storage.savePreviousWorkSession(keepsake, () => true)
assert.deepEqual(await storage.loadPreviousWorkSessions(), [parsePreviousWorkSession(records.get(historicalSessionKey) ?? null)])
assert.deepEqual((await storage.loadPreviousWorkSessions())[0], keepsake)

allowWrite = false
await storage.loadPreviousWorkSessionsWithLegacyMigration({ width: 200, height: 400 })
assert.ok(records.has(legacyKey), 'A failed migration keeps the original autosave')
allowWrite = true
const sessions = await storage.loadPreviousWorkSessionsWithLegacyMigration({ width: 200, height: 400 })
assert.deepEqual(sessions.map((session) => session.sessionId), [savedIn12.sessionId, 'legacy-line-paths'])
assert.equal(sessions[1].strokes[0].path, 'M 100 100 L 300 200')
assert.equal(sessions[1].strokes[0].width, 5)
assert.ok(!records.has(legacyKey), 'A completed migration removes the original autosave')
assert.ok(records.has('tracebuddy.practice.v1.invalid'), 'Malformed autosaves remain untouched')
assert.deepEqual(await storage.loadPreviousWorkSessionsWithLegacyMigration({ width: 200, height: 400 }), sessions)

records.set(previousWorkIndexKey, '{broken')
assert.deepEqual(await storage.loadPreviousWorkSessions(() => false), sessions)
assert.equal(records.get(previousWorkIndexKey), '{broken', 'A revoked read cannot rewrite the index')
assert.deepEqual(await storage.loadPreviousWorkSessions(), sessions)
assert.deepEqual(JSON.parse(records.get(previousWorkIndexKey)!), { version: 1, ids: sessions.map((session) => session.sessionId) })
// This load is also used by the flag-off app. Start a read against a dangling
// ID, then save that ID again at the front, leaving the serialized index equal.
const readStarted = deferred()
const resumeRead = deferred()
afterMultiGetSnapshot = async () => { readStarted.resolve(); await resumeRead.promise }
records.delete(historicalSessionKey)
const indexBeforeRace = records.get(previousWorkIndexKey)
const repairing = storage.loadPreviousWorkSessions()
await readStarted.promise
await storage.savePreviousWorkSession(keepsake, () => true)
assert.equal(records.get(previousWorkIndexKey), indexBeforeRace, 'Restoring the first record leaves the IDs identical')
afterMultiGetSnapshot = undefined
resumeRead.resolve()
assert.deepEqual(await repairing, sessions, 'Repair must reread rows and keep the restored session')
assert.equal(records.get(previousWorkIndexKey), indexBeforeRace)
records.delete(historicalSessionKey)
assert.deepEqual(await storage.loadPreviousWorkSessions(), [sessions[1]])
assert.deepEqual(JSON.parse(records.get(previousWorkIndexKey)!).ids, [sessions[1].sessionId])
await storage.savePreviousWorkSession(keepsake, () => true)

await storage.savePreviousWorkSession({ ...saved, sessionId: 'revoked' }, () => false)
assert.ok(!records.has(previousWorkSessionKey('revoked')), 'A revoked save cannot write a new session')

const preferences = { version: 1, favoriteIds: ['butterfly'], recentIds: ['butterfly', 'line-paths'] }
const progress = { version: 1, completedLessonIds: ['line-control'], stepByLessonId: { 'line-control': 2, 'easy-flower': 1 } }
const alignment = { version: 1, x: 12, y: -10, scale: 1.1, rotation: 15, opacity: 0.45 }
assert.deepEqual(parseDrawingPreferences(JSON.stringify(preferences)), preferences)
assert.deepEqual(parseLearningProgress(JSON.stringify(progress)), progress)
assert.deepEqual(parseSavedAlignment(JSON.stringify(alignment)), alignment)
assert.equal(parseParentSetupSeen(parentSetupSeenValue), true)
assert.equal(parseParentSetupSeen(null), false)
assert.equal(parseParentSetupSeen('true'), false)
assert.equal(parseFamilyActivity('mirror-my-marks'), 'mirror-my-marks')
assert.equal(parseFamilyActivity('removed-activity'), 'take-turn-doodle')

const resume = {
  mode: 'practice' as const, lessonId: 'easy-flower', sessionId: savedIn12.sessionId, source: saved.source,
  history: ['picker', 'learn'] as const,
}
const storedResume = serializeResumeContext({ ...resume, history: [...resume.history] })
assert.deepEqual(parseResumeContext(storedResume), JSON.parse(storedResume))
assert.deepEqual(parseResumeContext('{"mode":"learn","lessonId":"line-control"}'), {
  mode: 'learn', lessonId: 'line-control', sessionId: null, source: undefined, history: [],
})
assert.equal(serializeModePreference('ar'), '{"version":1,"mode":"camera","nativeSurface":"ar"}')
assert.equal(parseModePreference(serializeModePreference('ar'), true), 'ar')
assert.equal(parseModePreference(serializeModePreference('ar'), false), 'camera')
assert.equal(parseModePreference('screen', false), 'screen')
assert.equal(parseModePreference('{broken', true), 'camera')

// A 1.1 autosave of an uploaded photo keeps its strokes; the photo itself was never stored, so the guide says so.
const uploadedAutosave = normalizeLegacyPracticeAutosave({
  drawingId: 'uploaded_family-photo', drawingName: 'Family photo', updatedAt: '2026-05-20T08:00:00.000Z',
  strokes: [{ path: 'M 10 10 L 100 200', color: '#FF4FA3', width: 4, opacity: 0.9, mode: 'draw' }],
}, 'tracebuddy.practice.v1.uploaded_family-photo', { width: 200, height: 400 })
assert.ok(uploadedAutosave)
assert.equal(uploadedAutosave.sessionId, 'legacy-uploaded_family-photo')
assert.equal(uploadedAutosave.source.kind, 'custom')
assert.equal(uploadedAutosave.source.drawingTheme, 'Legacy upload · image unavailable')
assert.equal(uploadedAutosave.strokes[0].path, 'M 50 25 L 500 500')

// Resuming practice on an uploaded photo keeps the photo reference.
const uploadResume = {
  mode: 'practice' as const, lessonId: 'easy-flower', sessionId: 'work-upload-1', history: ['picker'] as const,
  source: {
    kind: 'upload' as const, drawingId: 'upload-1', drawingName: 'Beach day', drawingTheme: 'Your photo',
    uploadedImage: { uri: 'file:///var/mobile/Containers/Data/Application/X/Documents/tracebuddy-images/upload-1.jpg', name: 'Beach day', width: 1200, height: 900 },
  },
}
const storedUploadResume = serializeResumeContext({ ...uploadResume, history: [...uploadResume.history] })
assert.deepEqual(parseResumeContext(storedUploadResume), JSON.parse(storedUploadResume))

// iOS moves the Documents directory when a build is installed over the app.
const oldUpload = 'file:///sandbox/old/Documents/tracebuddy-uploads/work-photo.png'
const currentDocuments = 'file:///sandbox/current/Documents/'
assert.equal(rebasePracticeImageUri(oldUpload, currentDocuments), currentDocuments + 'tracebuddy-uploads/work-photo.png')
assert.equal(rebasePracticeImageUri(oldUpload, null), oldUpload)
const otherImage = 'file:///sandbox/old/Documents/other-folder/work-photo.png'
assert.equal(rebasePracticeImageUri(otherImage, currentDocuments), otherImage)

const uploadedSession = {
  ...saved,
  source: { ...uploadResume.source, uploadedImage: { ...uploadResume.source.uploadedImage, uri: oldUpload } },
  title: 'IMG_4821.HEIC',
}
assert.equal(drawingTitle(uploadedSession), 'My photo')
assert.equal(drawingTitle({ ...uploadedSession, title: uploadedSession.title + ' copy' }), 'My photo copy')
assert.equal(drawingTitle(saved), saved.title)
assert.deepEqual(drawingImageUris(uploadedSession), [oldUpload])
const currentUpload = rebasePracticeImageUri(oldUpload, currentDocuments)
const photoFiles = new Set([currentUpload])
let photoReferences: string[] | null = []
const imageCleanup = createPracticeImageCleanup(currentDocuments, {
  list: async (directory) => [...photoFiles].map((uri) => uri.slice(directory.length)),
  readReferences: async () => {
    if (!photoReferences) throw new Error('Malformed session')
    return photoReferences
  },
  remove: async (uri) => { photoFiles.delete(uri) },
})
const releasePicker = imageCleanup.acquire([oldUpload])
const releaseCanvas = imageCleanup.acquire([currentUpload])
await imageCleanup.sweep()
assert.ok(photoFiles.has(currentUpload), 'A pending pick survives a sweep')
releasePicker()
releasePicker()
await imageCleanup.sweep()
assert.ok(photoFiles.has(currentUpload), 'Two consumers hold independent references')
releaseCanvas()
photoReferences = [oldUpload, oldUpload]
await imageCleanup.sweep([currentUpload])
photoReferences = [oldUpload]
await imageCleanup.sweep([currentUpload])
assert.ok(photoFiles.has(currentUpload), 'Deleting one shared record keeps the remaining copy or resume reference')
photoReferences = null
await assert.rejects(imageCleanup.sweep())
assert.ok(photoFiles.has(currentUpload), 'An incomplete scan cannot delete a photo')
photoReferences = []
await imageCleanup.sweep([otherImage])
assert.ok(photoFiles.has(currentUpload), 'Only managed candidates can be removed')
await imageCleanup.sweep()
assert.equal(photoFiles.size, 0, 'Releasing the final reference allows cleanup')

const hydrationStarted = deferred()
const finishHydration = deferred()
let legacyFavorites = JSON.stringify(preferences)
let artFavorites = JSON.stringify(['crab'])
let failLegacyWrite = false
const legacy = createFavoritePreference(async () => {
  hydrationStarted.resolve()
  await finishHydration.promise
  return legacyFavorites
}, async (value) => {
  if (failLegacyWrite) throw new Error('Could not write legacy favorites')
  legacyFavorites = value
}, parseDrawingPreferences, toggleFavoriteDrawing)
const art = createFavoritePreference(async () => artFavorites, async (value) => { artFavorites = value },
  parseArtFavorites, (value, id) => [...value, id])
const initialLegacy = legacy.read()
await hydrationStarted.promise
const firstEdit = legacy.toggle('line-paths')
assert.deepEqual(await art.toggle('cat'), { value: ['crab', 'cat'], revision: 1 })
finishHydration.resolve()
assert.deepEqual(await initialLegacy, { value: preferences, revision: 1 })
const confirmed = await firstEdit
assert.deepEqual(confirmed.value, { ...preferences, favoriteIds: ['butterfly', 'line-paths'] })
assert.equal(confirmed.revision, 2)
failLegacyWrite = true
await Promise.all([
  assert.rejects(legacy.toggle('butterfly')),
  assert.rejects(legacy.toggle('line-paths')),
])
assert.deepEqual((await legacy.read()).value, confirmed.value, 'A failed edit cannot resurrect unconfirmed state')
assert.deepEqual((await art.read()).value, ['crab', 'cat'], 'A legacy failure does not affect art favorites')

assert(isLegacyFavoriteId('butterfly'), 'Existing favorites still use the legacy store')
for (const id of ['puppy', 'bunny', 'panda', 'seahorse']) {
  assert(!isLegacyFavoriteId(id), `Curated ${id} must use the art store because the legacy guide is retired`)
}

console.log('Native storage: legacy/current formats, serialized index repair, photo references and independent confirmed favorites')
