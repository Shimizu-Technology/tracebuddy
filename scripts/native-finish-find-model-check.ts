import assert from 'node:assert/strict'
import { continueDrawing, finishAfterSave, hasKeepsakeContent, keepsakeStamps, makeNativeModePreference, newestDrawings, normalizeModePreference, normalizeStamp, toggleStamp } from '../mobile/finishFindModel.ts'
import { normalizeSavedPracticeSession } from '../mobile/practiceStorageModel.ts'
import { normalizeResumeContext, navigate, goBack } from '../mobile/practiceModel.ts'

const old = {
  version: 2, sessionId: 'old', updatedAt: '2026-10-26T10:00:00Z',
  source: { kind: 'drawing', drawingId: 'flower', drawingName: 'Flower', drawingTheme: 'Nature' },
  strokes: [{ path: 'M 100 100 L 900 900', width: 30, color: '#18243A', opacity: 0.9, mode: 'draw' }],
}
const loaded = normalizeSavedPracticeSession(old)!
assert.equal(loaded.sessionId, old.sessionId)
assert.equal(loaded.stamp, undefined)
assert.equal(loaded.finishedAt, undefined)
assert.deepEqual(loaded.strokes, old.strokes.map((stroke) => ({ ...stroke, dasharray: undefined })))
for (const stamp of keepsakeStamps) {
  const session = normalizeSavedPracticeSession(JSON.parse(JSON.stringify({ ...loaded, stamp, finishedAt: '2026-10-27T10:00:00Z' })))!
  assert.equal(session.stamp, stamp)
  assert.equal(normalizeSavedPracticeSession(JSON.parse(JSON.stringify(session)))?.stamp, stamp)
  assert.equal(session.finishedAt, '2026-10-27T10:00:00Z')
  assert.equal(toggleStamp(stamp, stamp), undefined)
  assert.equal(toggleStamp(undefined, stamp), stamp)
}
for (const value of ['unknown', null, {}, 1, true]) {
  assert.equal(normalizeStamp(value), undefined)
  assert.equal(normalizeSavedPracticeSession({ ...old, stamp: value })?.stamp, undefined)
}
assert.equal(normalizeSavedPracticeSession({ ...old, finishedAt: 'invalid' })?.finishedAt, undefined)
assert.equal(continueDrawing([]), undefined)
const input = [old, { ...old, sessionId: 'latest', updatedAt: '2026-10-27T10:00:00Z' }, { ...old, sessionId: 'bad', updatedAt: 'invalid' }]
assert.equal(continueDrawing(input)?.sessionId, 'latest')
assert.deepEqual(newestDrawings(input).map((item) => item.sessionId), ['latest', 'old', 'bad'])
assert.equal(input[0].sessionId, 'old')
assert.deepEqual(newestDrawings([{ ...old, sessionId: 'b' }, { ...old, sessionId: 'a' }]).map((item) => item.sessionId), ['a', 'b'])
for (const surface of ['camera', 'screen', 'ar'] as const) {
  const persisted = JSON.stringify(makeNativeModePreference(surface))
  assert.equal(normalizeModePreference(persisted, true), surface)
  assert.equal(normalizeModePreference(persisted, false), surface === 'ar' ? 'camera' : surface)
}
assert.equal(normalizeModePreference({ version: 1, mode: 'screen' }, false), 'screen')
for (const value of [null, '{broken', { version: 99, mode: 'screen' }, { version: 99, nativeSurface: 'ar' }]) assert.equal(normalizeModePreference(value, true), 'camera')
// Clear removes the session records and key; absence restores the default with no stamp.
assert.equal(normalizeModePreference(undefined, true), 'camera')
assert.equal(normalizeSavedPracticeSession(undefined), null)
const context = normalizeResumeContext({ mode: 'gallery', history: ['picker'], lessonId: 'line' }, ['line'])!
assert.equal(context.mode, 'gallery')
assert.equal(goBack(navigate({ current: 'picker', history: [] }, 'gallery')).current, 'picker')
console.log('Native Finish & find: old sessions, five stamp round trips/toggles, unknown values, sorting/continue, shared mode compatibility + AR fallback, clear defaults, gallery navigation passed')

assert.equal(hasKeepsakeContent(0, 0), false)
assert.equal(hasKeepsakeContent(1, 0), true)
assert.equal(hasKeepsakeContent(0, 1), true)
assert.equal(hasKeepsakeContent(0, 0, 'heart'), true)
assert.equal(hasKeepsakeContent(0, 0, undefined, '2026-10-27T10:00:00Z'), true)
let opened = 0
let resolveSave!: (saved: boolean) => void
const saving = new Promise<boolean>((resolve) => { resolveSave = resolve })
const pending = finishAfterSave(() => saving, () => { opened++ })
await Promise.resolve()
assert.equal(opened, 0, 'Done must not open while a write is pending')
resolveSave(false)
assert.equal(await pending, false)
assert.equal(opened, 0, 'Failed save keeps Retry on the canvas')
assert.equal(await finishAfterSave(async () => true, () => { opened++ }), true)
assert.equal(opened, 1)
await assert.rejects(finishAfterSave(async () => { throw Error('storage offline') }, () => { opened++ }))
assert.equal(opened, 1)
console.log('Done waits for save, leaves failures recoverable, and retains blank finished/stamp-only keepsakes')
