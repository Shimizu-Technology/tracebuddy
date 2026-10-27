import assert from 'node:assert/strict'
import { continueTarget, keepsakeStamps, makeModePreference, newestDrawings, normalizeModePreference, normalizeStamp, toggleStamp } from '../shared/finishFind'
const old = { sessionId: 'old', updatedAt: '2026-10-26T09:00:00Z' }
const recent = { sessionId: 'new', updatedAt: '2026-10-27T09:00:00Z' }
const broken = { sessionId: 'broken', updatedAt: 'bad' }
const sessions = [old, recent, broken]
assert.equal(continueTarget([]), undefined)
assert.equal(continueTarget(sessions), recent)
assert.deepEqual(sessions, [old, recent, broken], 'sorting must not mutate the gallery input')
assert.deepEqual(newestDrawings(sessions), [recent, old, broken])
assert.deepEqual(newestDrawings([{ sessionId: 'b', updatedAt: old.updatedAt }, { sessionId: 'a', updatedAt: old.updatedAt }]).map((s) => s.sessionId), ['a', 'b'])
assert.equal(keepsakeStamps.length, 5)
for (const stamp of keepsakeStamps) {
  assert.equal(normalizeStamp(stamp.id), stamp.id)
  assert.equal(toggleStamp(undefined, stamp.id), stamp.id)
  assert.equal(toggleStamp(stamp.id, stamp.id), undefined)
  assert(stamp.path && stamp.label)
}
for (const value of [undefined, null, '', 'gold-medal', {}, 1]) assert.equal(normalizeStamp(value), undefined)
for (const value of [undefined, null, 'screen', { mode: 'screen' }, { version: 2, mode: 'screen' }, { version: 1, mode: 'unknown' }]) assert.deepEqual(normalizeModePreference(value), { version: 1, mode: 'camera' })
for (const mode of ['camera', 'screen'] as const) assert.equal(normalizeModePreference(JSON.parse(JSON.stringify(makeModePreference(mode)))).mode, mode)
console.log('Finish & find models pass: newest/continue, five optional stamps, unknown/old values, persisted mode and immutable sorting.')
