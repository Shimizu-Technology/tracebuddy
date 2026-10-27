import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

import {
  arPagePresets,
  availableARTraceSurfaces,
  canLockARPlacement,
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
  candidateFresh: true,
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
assert.equal(canEnterARChildMode({ ...locked, reason: 'relocalizing' }), false)

assert.deepEqual(normalizeARNativeState(null), initialARNativeState)
assert.deepEqual(normalizeARNativeState({ session: 'surprise', tracking: 'fast', reason: 'bad', anchor: 'screen', placement: 'floating' }), {
  session: 'failed',
  tracking: 'unavailable',
  reason: 'unknown',
  anchor: 'none',
  placement: 'none',
  candidateFresh: false,
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

// Limited/unavailable camera events must win over stale previews and locks.
for (const mode of ['surface', 'marker'] as const) {
  const preview = running({ anchor: mode === 'marker' ? 'markerFound' : 'surfaceFound', placement: 'preview' })
  assert.equal(canLockARPlacement(preview, mode), true)
  assert.equal(deriveARDisplayState(preview, mode), 'readyToPlace')
  for (const tracking of ['limited', 'unavailable', 'initializing'] as const) {
    const degraded = { ...preview, tracking }
    assert.equal(canLockARPlacement(degraded, mode), false)
    assert.equal(canLockARPlacement({ ...preview, reason: 'relocalizing' }, mode), false)
    assert.notEqual(deriveARDisplayState(degraded, mode), 'readyToPlace')
    assert.equal(canEnterARChildMode({ ...locked, tracking }), false)
    assert.notEqual(deriveARDisplayState({ ...locked, tracking }, mode), 'locked')
  }
  for (const session of ['interrupted', 'failed', 'idle'] as const) {
    assert.equal(canLockARPlacement({ ...preview, session }, mode), false)
    assert.equal(canEnterARChildMode({ ...locked, session }), false)
  }
  // Failed raycast/lost marker, expiry, Reset, and a new hit before relock.
  const searching = running({ candidateFresh: false })
  assert.equal(canLockARPlacement(searching, mode), false)
  assert.equal(deriveARDisplayState(searching, mode), mode === 'marker' ? 'searchingMarker' : 'searchingSurface')
  assert.equal(canLockARPlacement({ ...preview, candidateFresh: false }, mode), false)
  assert.equal(canEnterARChildMode({ ...locked, candidateFresh: false }), false)
  assert.notEqual(deriveARDisplayState({ ...locked, candidateFresh: false }, mode), 'locked')
  assert.equal(canLockARPlacement(initialARNativeState, mode), false)
  assert.equal(canLockARPlacement({ ...preview, tracking: 'normal', candidateFresh: true }, mode), true)
  assert.equal(canEnterARChildMode({ ...locked, candidateFresh: true }), true)
}
assert.equal(canLockARPlacement(running({ anchor: 'markerFound', placement: 'preview' }), 'surface'), false)
assert.equal(canLockARPlacement(running({ anchor: 'surfaceFound', placement: 'preview' }), 'marker'), false)
assert.equal(normalizeARNativeState({ ...locked, candidateFresh: 'true' }).candidateFresh, false)
assert.equal(normalizeARNativeState({ ...locked, candidateFresh: undefined }).candidateFresh, false)
assert.deepEqual(availableARTraceSurfaces(false), ['camera', 'screen'])
assert.deepEqual(availableARTraceSurfaces(true), ['camera', 'screen', 'ar'])

// Run the actual pure Swift math/policy on macOS. Linux CI still runs all JS
// transitions; simd/RealityKit device linkage remains the separate iOS build gate.
if (process.platform === 'darwin') {
  const nativeRoot = new URL('../mobile/modules/tracebuddy-ar/ios/', import.meta.url)
  const geometry = readFileSync(new URL('TraceBuddyARGeometry.swift', nativeRoot), 'utf8')
  const frameGate = readFileSync(new URL('ARFrameUpdateGate.swift', nativeRoot), 'utf8')
  const swift = spawnSync('swift', ['-'], { encoding: 'utf8', input: geometry + frameGate + `
func close(_ a: Float, _ b: Float) { precondition(abs(a-b) < 0.00001, "Geometry mismatch") }
let presets: [(Float, Float)] = [(0.2159,0.2794),(0.2794,0.2159),(0.21,0.297),(0.297,0.21)]
for (width, depth) in presets {
  for scale: Float in [0.35, 0.88, 1, 1.15] {
    for angle: Float in [0, .pi/2, -.pi/2, .pi] {
      let guide = traceBuddyGuideTransform(width: width, depth: depth, scale: scale, rotation: angle,
                                          offsetX: width/2 + 0.04, offsetDepth: depth/2 - 0.025)
      // A rotated/translated image anchor must preserve the page's local plane.
      var anchor = simd_float4x4(simd_quatf(angle: 0.7, axis: simd_normalize(SIMD3<Float>(1,2,3))))
      anchor.columns.3 = SIMD4(0.2, 0.3, -0.4, 1)
      let pageAnchor = traceBuddyMarkerPageBasis(anchor)
      let normal = SIMD3(anchor.columns.1.x, anchor.columns.1.y, anchor.columns.1.z)
      let origin = SIMD3(anchor.columns.3.x, anchor.columns.3.y, anchor.columns.3.z)
      let corners: [SIMD4<Float>] = [SIMD4(-0.5,0,-0.5,1),SIMD4(0.5,0,-0.5,1),SIMD4(0.5,0,0.5,1),SIMD4(-0.5,0,0.5,1)]
      let mapped = corners.map { guide * $0 }
      for corner in corners {
        let world = pageAnchor * guide * corner
        close(simd_dot(SIMD3(world.x,world.y,world.z) - origin, normal), 0.0015)
      }
      close(simd_length(mapped[1]-mapped[0]), width*scale)
      close(simd_length(mapped[2]-mapped[1]), depth*scale)
      if angle == 0 && scale == 1 {
        close(mapped[0].x, 0.04); close(mapped[0].z, -0.025)
        precondition(mapped[1].x > mapped[0].x && mapped[3].z > mapped[0].z)
      }
    }
  }
}
func fresh(_ normal: Bool = true, _ guide: Bool = true, _ locked: Bool = false,
           _ hit: Bool = true, _ timestamp: Double? = 10, _ now: Double = 10.1) -> Bool {
  traceBuddyCandidateIsFresh(cameraNormal: normal, hasGuide: guide, lockedSurface: locked,
                            hasCandidate: hit, timestamp: timestamp, now: now, lifetime: 0.5)
}
precondition(fresh())
precondition(!fresh(false)); precondition(!fresh(true,false))
precondition(!fresh(true,true,false,false)) // failed raycast / missing marker
precondition(!fresh(true,true,false,true,nil)) // reset
precondition(!fresh(true,true,false,true,10,10.51)) // expired
precondition(!fresh(true,true,false,true,11,10)) // future timestamps cannot qualify
precondition(fresh(true,true,true,false,nil)) // surface world anchor after lock
precondition(!fresh(false,true,true)) // limited camera always wins
let gate = ARFrameUpdateGate()
precondition(gate.begin()); precondition(!gate.begin()); gate.end(); precondition(gate.begin()); gate.end()
DispatchQueue.concurrentPerform(iterations: 100) { _ in
  if gate.begin() { precondition(!gate.begin()); gate.end() }
}
print("Swift page-corner, freshness and frame-coalescing checks passed.")
` })
  assert.equal(swift.status, 0, swift.stderr || swift.stdout)
  console.log(swift.stdout.trim())
} else {
  console.log('Native Swift geometry checks require macOS; JS state checks ran here.')
}
console.log('AR trace model checks passed.')
