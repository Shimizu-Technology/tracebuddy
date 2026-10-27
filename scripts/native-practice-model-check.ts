import assert from 'node:assert/strict'
import { saveTemporaryCapture } from '../mobile/captureUtils.ts'
import { documentFrame, documentPoint, goBack, navigate, normalizeResumeContext, ownedTouch, photoAccessAllowed } from '../mobile/practiceModel.ts'
import type { NavigationState } from '../mobile/practiceModel.ts'

let navigation: NavigationState = { current: 'picker', history: [] }
navigation = navigate(navigation, 'learn')
navigation = navigate(navigation, 'practice')
assert.equal(goBack(navigation).current, 'learn')
assert.equal(goBack(goBack(navigation)).current, 'picker')
assert.deepEqual(navigate(navigation, 'picker'), { current: 'picker', history: [] })
assert.deepEqual(goBack({ current: 'trace', history: [] }), { current: 'picker', history: [] })
assert.equal(navigate(navigation, 'practice'), navigation)

// Guide point and ink point share one document across rotation, split windows,
// and the captured view. Check inverse mapping at every requested zoom.
let samples = 0
for (const size of [{ width: 390, height: 560 }, { width: 740, height: 170 }, { width: 820, height: 900 }, { width: 1180, height: 600 }, { width: 360, height: 240 }]) {
  const frame = documentFrame(size)
  for (const scale of [1, 1.7, 5]) {
    for (const point of [{ x: 180, y: 240 }, { x: 500, y: 500 }, { x: 820, y: 730 }]) {
      const viewport = { x: -72, y: 31, scale }
      const screen = { x: (frame.x + point.x / 1000 * frame.side) * scale + viewport.x, y: (frame.y + point.y / 1000 * frame.side) * scale + viewport.y }
      const mapped = documentPoint(screen, size, viewport)!
      assert.ok(Math.abs(mapped.x - point.x) < 1e-9)
      assert.ok(Math.abs(mapped.y - point.y) < 1e-9)
      samples++
    }
  }
}
assert.equal(documentPoint({ x: 0, y: 0 }, { width: 800, height: 200 }, { x: 0, y: 0, scale: 1 }), null)
const primary = { identifier: 7, locationX: 120, locationY: 140 }
const palm = { identifier: 9, locationX: 800, locationY: 700 }
assert.equal(ownedTouch([palm, primary], 7), primary)
assert.equal(ownedTouch([palm], 7), null)
assert.equal(ownedTouch([palm], null), null)
assert.equal(photoAccessAllowed({ granted: true }), true)
assert.equal(photoAccessAllowed({ granted: false, accessPrivileges: 'limited' }), true)
assert.equal(photoAccessAllowed({ status: 'denied', accessPrivileges: 'none' }), false)
assert.deepEqual(normalizeResumeContext({ mode: 'practice', sessionId: 'saved-v2', lessonId: 'flower', source: { kind: 'custom' } }, ['line', 'flower']), { mode: 'practice', sessionId: 'saved-v2', lessonId: 'flower', source: { kind: 'custom' }, history: [] })
assert.equal(normalizeResumeContext({ mode: 'unknown' }, ['line']), null)
assert.equal(normalizeResumeContext({ mode: 'learn', lessonId: 'deleted' }, ['line'])?.lessonId, 'line')
console.log(`Native practice model checks passed: ${samples} coordinate round trips, back history, touch ownership, Photos access, resume context`)

const captureEvents: string[] = []
await saveTemporaryCapture(async () => 'tmp.png', async (uri) => { captureEvents.push(`save:${uri}`) }, (uri) => { captureEvents.push(`release:${uri}`) })
assert.deepEqual(captureEvents, ['save:tmp.png', 'release:tmp.png'])
captureEvents.length = 0
await assert.rejects(saveTemporaryCapture(async () => 'tmp.png', async () => { throw new Error('Photos denied') }, (uri) => { captureEvents.push(`release:${uri}`) }))
assert.deepEqual(captureEvents, ['release:tmp.png'])
captureEvents.length = 0
await assert.rejects(saveTemporaryCapture(async () => { throw new Error('Capture failed') }, async () => { captureEvents.push('unexpected save') }, () => { captureEvents.push('unexpected release') }))
assert.deepEqual(captureEvents, [])
const resumed = normalizeResumeContext({ mode: 'practice', lessonId: 'flower', history: ['picker', 'learn'] }, ['line', 'flower'])!
assert.equal(goBack({ current: resumed.mode, history: resumed.history! }).current, 'learn')
assert.equal(ownedTouch([{ identifier: '7', locationX: 2, locationY: 3 }], '7')?.locationX, 2)
console.log('Temporary capture cleanup checks passed (save, denied, failed capture); lesson back history restored')

assert.equal(ownedTouch({ 0: palm, 1: primary, length: 2 }, 7), primary)
