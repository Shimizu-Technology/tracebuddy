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

// Previous Work uses this exact session normalizer after AsyncStorage JSON
// hydration. Reopen every real tool/size at compact 200 pt, plus the 1 pt
// layout guard (the smallest possible frame), without changing ink or masks.
const { brushSizes, brushTools, documentStrokeWidth, maxPracticeStrokeWidth, normalizeSavedPracticeSession, normalizeSavedPracticeStroke, practiceStrokeWidth } = await import('../mobile/practiceStorageModel.ts')
let widthRoundTrips = 0
for (const side of [1, 200]) {
  for (const zoom of [1, 1.7, 5]) {
    for (const tool of brushTools) {
      for (const size of brushSizes) {
        const stroke = {
          path: 'M 100 500 L 900 500', color: '#18243A',
          width: documentStrokeWidth(size.value, tool.widthMultiplier, side, zoom),
          opacity: tool.opacity, mode: tool.mode, dasharray: tool.dasharray,
        }
        const stored = JSON.stringify({
          version: 2, sessionId: 'width-round-trip', title: 'Previous Work fixture',
          source: { kind: 'drawing', drawingId: 'flower', drawingName: 'Flower', drawingTheme: 'Nature' },
          strokes: [stroke], stickers: [], canvasWidth: 1000, canvasHeight: 1000,
        })
        const reopened = normalizeSavedPracticeSession(JSON.parse(stored))!
        assert.deepEqual(reopened.strokes, [stroke])
        const reopenedAgain = normalizeSavedPracticeSession(JSON.parse(JSON.stringify(reopened)))!
        assert.deepEqual(reopenedAgain.strokes, [stroke])
        assert.ok(stroke.width > 0 && stroke.width <= maxPracticeStrokeWidth)
        widthRoundTrips++
      }
    }
  }
}
const erasedWork = normalizeSavedPracticeSession({
  sessionId: 'erased-region', source: { kind: 'drawing', drawingId: 'flower', drawingName: 'Flower', drawingTheme: 'Nature' },
  strokes: [
    { path: 'M 100 500 L 900 500', width: 164, color: '#18243A', opacity: 1, mode: 'draw' },
    { path: 'M 100 500 L 900 500', width: documentStrokeWidth(16, 2.2, 200, 1), color: '#18243A', opacity: 1, mode: 'erase' },
  ],
})!
assert.equal(erasedWork.strokes[1].width, 176)
const reopenErasedWork = normalizeSavedPracticeSession(JSON.parse(JSON.stringify(erasedWork)))!
// A point 70 document units from this horizontal stroke is inked by Paint,
// erased by the 176-wide mask, and must remain erased after reopening.
assert.ok(erasedWork.strokes[0].width / 2 > 70)
assert.ok(reopenErasedWork.strokes[1].width / 2 > 70)
assert.deepEqual(reopenErasedWork.strokes, erasedWork.strokes)
for (const width of [0.01, 80, 176, 35_200, 80_000]) {
  assert.equal(normalizeSavedPracticeStroke({ path: 'M 0 0', width })?.width, width)
}
for (const width of [NaN, Infinity, -1, 0]) assert.equal(normalizeSavedPracticeStroke({ path: 'M 0 0', width }), null)
assert.equal(practiceStrokeWidth(maxPracticeStrokeWidth * 2), maxPracticeStrokeWidth)
assert.equal(normalizeSavedPracticeStroke({ path: 'M 0 0', width: maxPracticeStrokeWidth * 2 })?.width, maxPracticeStrokeWidth)
console.log(`Native Previous Work widths passed: ${widthRoundTrips} brush/size/canvas/zoom round trips and preserved erased region`)
