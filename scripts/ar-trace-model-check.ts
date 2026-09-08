import assert from 'node:assert/strict'

import {
  arPagePresets,
  arTrackingAdvice,
  canEnterARChildMode,
  clampARValue,
  deriveARDisplayState,
  initialARNativeState,
  normalizeARNativeState,
} from '../mobile/src/features/ar/arTraceState'
import type { ARNativeState } from '../mobile/src/features/ar/arTraceState'

const running = (overrides: Partial<ARNativeState>): ARNativeState => ({
  ...initialARNativeState,
  session: 'running',
  tracking: 'normal',
  ...overrides,
})

assert.equal(deriveARDisplayState(initialARNativeState, 'surface'), 'checkingSupport')
assert.equal(deriveARDisplayState(running({ tracking: 'initializing', reason: 'initializing' }), 'surface'), 'initializing')
assert.equal(deriveARDisplayState(running({}), 'surface'), 'searchingSurface')
assert.equal(deriveARDisplayState(running({}), 'marker'), 'searchingMarker')
assert.equal(deriveARDisplayState(running({ anchor: 'surfaceFound', placement: 'preview' }), 'surface'), 'readyToPlace')
assert.equal(deriveARDisplayState(running({ anchor: 'tracked', placement: 'locked' }), 'surface'), 'locked')
assert.equal(deriveARDisplayState(running({ tracking: 'limited', anchor: 'tracked', placement: 'locked' }), 'surface'), 'limited')
assert.equal(deriveARDisplayState(running({ tracking: 'limited', reason: 'relocalizing', anchor: 'stale', placement: 'locked' }), 'surface'), 'relocalizing')
assert.equal(deriveARDisplayState(running({ tracking: 'limited', anchor: 'stale', placement: 'locked' }), 'surface'), 'lost')
assert.equal(deriveARDisplayState({ ...initialARNativeState, session: 'interrupted' }, 'surface'), 'interrupted')
assert.equal(deriveARDisplayState({ ...initialARNativeState, session: 'failed' }, 'surface'), 'failed')
assert.equal(deriveARDisplayState({ ...initialARNativeState, session: 'unsupported' }, 'surface'), 'unsupported')
assert.equal(arTrackingAdvice(running({ tracking: 'limited', reason: 'excessiveMotion' })), 'Move the phone more slowly.')
assert.equal(arTrackingAdvice(running({ tracking: 'limited', reason: 'insufficientFeatures' })), 'Add light or point at more of the table.')
assert.equal(arTrackingAdvice(running({ tracking: 'limited', reason: 'relocalizing' })), 'Return the phone to the stand position.')

const locked = running({ anchor: 'tracked', placement: 'locked' })
assert.equal(canEnterARChildMode(locked), true)
assert.equal(canEnterARChildMode({ ...locked, tracking: 'limited' }), false)
assert.equal(canEnterARChildMode({ ...locked, anchor: 'stale' }), false)
assert.equal(canEnterARChildMode({ ...locked, placement: 'preview' }), false)
assert.equal(canEnterARChildMode({ ...locked, session: 'interrupted' }), false)

assert.deepEqual(normalizeARNativeState(null), initialARNativeState)
assert.deepEqual(normalizeARNativeState({ session: 'surprise', tracking: 'fast', reason: 'bad', anchor: 'screen', placement: 'floating' }), {
  session: 'failed',
  tracking: 'unavailable',
  reason: 'unknown',
  anchor: 'none',
  placement: 'none',
  message: undefined,
})
assert.equal(normalizeARNativeState({ ...locked, message: 'x'.repeat(300) }).message?.length, 240)
assert.equal(clampARValue(Number.NaN, 0.1, 1), 0.1)
assert.equal(clampARValue(Number.POSITIVE_INFINITY, 0.1, 1), 0.1)
assert.equal(clampARValue(-4, 0.1, 1), 0.1)
assert.equal(clampARValue(4, 0.1, 1), 1)

assert.equal(arPagePresets.letterPortrait.widthMeters, 0.2159)
assert.equal(arPagePresets.letterPortrait.heightMeters, 0.2794)
assert.equal(arPagePresets.letterLandscape.widthMeters, 0.2794)
assert.equal(arPagePresets.letterLandscape.heightMeters, 0.2159)
assert.equal(arPagePresets.a4Portrait.widthMeters, 0.21)
assert.equal(arPagePresets.a4Portrait.heightMeters, 0.297)
assert.equal(arPagePresets.a4Landscape.widthMeters, 0.297)
assert.equal(arPagePresets.a4Landscape.heightMeters, 0.21)

console.log('AR trace model checks passed.')
