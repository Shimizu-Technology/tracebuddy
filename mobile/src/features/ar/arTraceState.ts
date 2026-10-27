export type ARPlacementMode = 'surface' | 'marker'
export type ARSessionState = 'idle' | 'running' | 'interrupted' | 'failed' | 'unsupported'
export type ARTrackingState = 'unavailable' | 'initializing' | 'normal' | 'limited'
export type ARTrackingReason = 'none' | 'initializing' | 'excessiveMotion' | 'insufficientFeatures' | 'relocalizing' | 'unknown'
export type ARAnchorState = 'none' | 'surfaceFound' | 'markerFound' | 'tracked' | 'stale'
export type ARPlacementState = 'none' | 'preview' | 'locked'

export type ARNativeState = {
  resetRevision: number
  guideImageUri: string | null
  session: ARSessionState
  tracking: ARTrackingState
  reason: ARTrackingReason
  anchor: ARAnchorState
  placement: ARPlacementState
  candidateFresh: boolean
  message?: string
}

export type ARDisplayState =
  | 'checkingSupport'
  | 'initializing'
  | 'searchingSurface'
  | 'searchingMarker'
  | 'readyToPlace'
  | 'locked'
  | 'limited'
  | 'relocalizing'
  | 'interrupted'
  | 'lost'
  | 'failed'
  | 'unsupported'

export const initialARNativeState: ARNativeState = {
  resetRevision: 0,
  guideImageUri: null,
  session: 'idle',
  tracking: 'unavailable',
  reason: 'none',
  anchor: 'none',
  placement: 'none',
  candidateFresh: false,
}

export function deriveARDisplayState(state: ARNativeState, mode: ARPlacementMode): ARDisplayState {
  if (state.session === 'unsupported') return 'unsupported'
  if (state.session === 'failed') return 'failed'
  if (state.session === 'interrupted') return 'interrupted'
  if (state.session === 'idle') return 'checkingSupport'
  if (state.reason === 'relocalizing') return 'relocalizing'
  if (state.anchor === 'stale') return 'lost'
  if (state.tracking === 'limited') return 'limited'
  if (state.tracking === 'unavailable' || state.tracking === 'initializing') return 'initializing'
  if (canEnterARChildMode(state)) return 'locked'
  if (canLockARPlacement(state, mode)) return 'readyToPlace'
  return mode === 'marker' ? 'searchingMarker' : 'searchingSurface'
}

export const arDisplayCopy: Record<ARDisplayState, { title: string; detail: string }> = {
  checkingSupport: { title: 'Checking this device', detail: 'Getting Paper Lock ready.' },
  initializing: { title: 'Hold still for a moment', detail: 'TraceBuddy is learning where the table is.' },
  searchingSurface: { title: 'Find the table', detail: 'Move the phone slowly until the guide appears on the paper.' },
  searchingMarker: { title: 'Show the Paper Lock marker', detail: 'Keep the whole square visible beside the paper.' },
  readyToPlace: { title: 'Ready to place', detail: 'Line up the guide, then lock it to the paper.' },
  locked: { title: 'Guide locked', detail: 'Check alignment before tracing. If it drifts, stop and reset.' },
  limited: { title: 'Tracking needs a moment', detail: 'Keep the phone still. Do not trace until the lock returns.' },
  relocalizing: { title: 'Return to the stand position', detail: 'TraceBuddy is looking for the paper again.' },
  interrupted: { title: 'Tracking paused', detail: 'Come back to TraceBuddy, then wait for the lock.' },
  lost: { title: 'The paper lock was lost', detail: 'Reset and line up the guide again.' },
  failed: { title: 'Paper Lock could not start', detail: 'You can retry or use regular Camera Trace.' },
  unsupported: { title: 'Paper Lock is not available here', detail: 'Regular Camera Trace still works on this device.' },
}

export function arTrackingAdvice(state: ARNativeState) {
  if (state.message) return state.message
  switch (state.reason) {
  case 'excessiveMotion': return 'Move the phone more slowly.'
  case 'insufficientFeatures': return 'Add light or point at more of the table.'
  case 'relocalizing': return 'Return the phone to the stand position.'
  case 'initializing': return 'Hold still for a moment.'
  default: return undefined
  }
}

export type ARPagePreset = 'letterPortrait' | 'letterLandscape' | 'a4Portrait' | 'a4Landscape'

export const arPagePresets: Record<ARPagePreset, { label: string; widthMeters: number; heightMeters: number }> = {
  letterPortrait: { label: 'Letter portrait', widthMeters: 0.2159, heightMeters: 0.2794 },
  letterLandscape: { label: 'Letter landscape', widthMeters: 0.2794, heightMeters: 0.2159 },
  a4Portrait: { label: 'A4 portrait', widthMeters: 0.21, heightMeters: 0.297 },
  a4Landscape: { label: 'A4 landscape', widthMeters: 0.297, heightMeters: 0.21 },
}

export function clampARValue(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, value))
}

export function canEnterARChildMode(state: ARNativeState) {
  return state.session === 'running'
    && state.tracking === 'normal'
    && state.reason === 'none'
    && state.anchor === 'tracked'
    && state.placement === 'locked'
    && state.candidateFresh
}

export function canLockARPlacement(state: ARNativeState, mode: ARPlacementMode) {
  return state.session === 'running'
    && state.tracking === 'normal'
    && state.reason === 'none'
    && state.candidateFresh
    && state.placement === 'preview'
    && state.anchor === (mode === 'marker' ? 'markerFound' : 'surfaceFound')
}

export type ARTraceSurface = 'camera' | 'screen' | 'ar'

export function availableARTraceSurfaces(supported: boolean): ARTraceSurface[] {
  return supported ? ['camera', 'screen', 'ar'] : ['camera', 'screen']
}

export function normalizeARNativeState(value: unknown): ARNativeState {
  if (!value || typeof value !== 'object') return initialARNativeState
  const candidate = value as Partial<ARNativeState>
  const sessions: ARSessionState[] = ['idle', 'running', 'interrupted', 'failed', 'unsupported']
  const trackingStates: ARTrackingState[] = ['unavailable', 'initializing', 'normal', 'limited']
  const reasons: ARTrackingReason[] = ['none', 'initializing', 'excessiveMotion', 'insufficientFeatures', 'relocalizing', 'unknown']
  const anchors: ARAnchorState[] = ['none', 'surfaceFound', 'markerFound', 'tracked', 'stale']
  const placements: ARPlacementState[] = ['none', 'preview', 'locked']

  return {
    resetRevision: Number.isSafeInteger(candidate.resetRevision) && (candidate.resetRevision ?? -1) >= 0 ? candidate.resetRevision! : -1,
    guideImageUri: typeof candidate.guideImageUri === 'string' ? candidate.guideImageUri : null,
    session: sessions.includes(candidate.session as ARSessionState) ? candidate.session as ARSessionState : 'failed',
    tracking: trackingStates.includes(candidate.tracking as ARTrackingState) ? candidate.tracking as ARTrackingState : 'unavailable',
    reason: reasons.includes(candidate.reason as ARTrackingReason) ? candidate.reason as ARTrackingReason : 'unknown',
    anchor: anchors.includes(candidate.anchor as ARAnchorState) ? candidate.anchor as ARAnchorState : 'none',
    placement: placements.includes(candidate.placement as ARPlacementState) ? candidate.placement as ARPlacementState : 'none',
    candidateFresh: candidate.candidateFresh === true,
    message: typeof candidate.message === 'string' ? candidate.message.slice(0, 240) : undefined,
  }
}

// Both the reset command and the captured drawing/preset must match. Reject
// queued events before they can restore preview or child-mode readiness.
export function isCurrentAREvent(state: ARNativeState, resetRevision: number, guideUri: string | null) {
  return guideUri !== null && state.resetRevision === resetRevision && state.guideImageUri === guideUri
}

export type ARGuideCapture = { key: string; uri: string }
export function currentARGuide(capture: ARGuideCapture | null, key: string) {
  return capture?.key === key ? capture.uri : null
}

export function arGuideGenerationKey(drawing: { id: string; svg: string }, uploadUri: string | undefined, preset: ARPagePreset, generation: number) {
  return JSON.stringify([drawing.id, drawing.svg, uploadUri, preset, generation])
}
