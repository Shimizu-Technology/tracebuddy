// The states of Stick to paper (Paper Lock). Placing, child mode and the Done celebration exclude each
// other, so a late tracking update can never start child mode behind the celebration or after a reset.

export type StickPhase = 'adjusting' | 'placing' | 'child' | 'celebrating'

export type StickEvent =
  | { type: 'lock'; placementReady: boolean; childModeReady: boolean }
  /** trackingOk: the AR session runs with normal tracking. placement: what the native view reports. */
  | { type: 'tracking'; childModeReady: boolean; trackingOk: boolean; placement: 'none' | 'preview' | 'locked' }
  /** Placing took too long without an answer. */
  | { type: 'placementTimeout' }
  | { type: 'done' }
  | { type: 'keepTracing' }
  | { type: 'unlock' }
  | { type: 'reset' }
  | { type: 'blur' }

/** What the screen should do after a transition. */
export type StickEffect = 'place' | 'enterChild' | 'trackingLost' | 'waiting' | 'cancelled' | 'notFound' | null

export function stickTransition(phase: StickPhase, event: StickEvent): { phase: StickPhase; effect: StickEffect } {
  switch (event.type) {
  case 'lock':
    if (phase !== 'adjusting') return { phase, effect: null }
    if (event.childModeReady) return { phase: 'child', effect: 'enterChild' }
    return event.placementReady ? { phase: 'placing', effect: 'place' } : { phase, effect: 'waiting' }
  case 'tracking':
    if (phase === 'placing' && event.childModeReady) return { phase: 'child', effect: 'enterChild' }
    if (phase === 'placing' && !event.trackingOk) return { phase: 'adjusting', effect: 'cancelled' }
    // The re-check after Lock found no paper (tracking itself is fine): back to adjusting, so Lock can try again.
    if (phase === 'placing' && event.placement === 'none') return { phase: 'adjusting', effect: 'notFound' }
    // Never leave a child tracing over a guide that may have slipped.
    if (phase === 'child' && !event.childModeReady) return { phase: 'adjusting', effect: 'trackingLost' }
    return { phase, effect: null }
  case 'placementTimeout':
    return phase === 'placing' ? { phase: 'adjusting', effect: 'notFound' } : { phase, effect: null }
  case 'done':
    if (phase === 'adjusting') return { phase: 'celebrating', effect: null }
    if (phase === 'placing') return { phase: 'celebrating', effect: 'cancelled' }
    return { phase, effect: null }
  case 'keepTracing':
    return phase === 'celebrating' ? { phase: 'adjusting', effect: null } : { phase, effect: null }
  case 'unlock':
    return phase === 'child' ? { phase: 'adjusting', effect: null } : { phase, effect: null }
  case 'reset':
    if (phase === 'celebrating') return { phase, effect: null }
    return { phase: 'adjusting', effect: phase === 'placing' ? 'cancelled' : null }
  case 'blur':
    return phase === 'placing' ? { phase: 'adjusting', effect: 'cancelled' } : { phase, effect: null }
  }
}

/** Gestures, nudges and the fade change the guide only while a grown-up is adjusting it. */
export function canAdjust(phase: StickPhase) {
  return phase === 'adjusting'
}

/** Close, Page, Lock and Done are on screen while adjusting or waiting for placement. */
export function showsControls(phase: StickPhase) {
  return phase === 'adjusting' || phase === 'placing'
}

/**
 * What ARKit receives. The gesture keeps an unwrapped angle (it can pass 180° mid-twist), but the native view
 * clamps to −180…180°, so the angle is wrapped here; offsets in meters stay within the page's reach.
 */
export function arPoseFor(pose: { x: number; y: number; scale: number; rotation: number }, metersPerPoint: number, offsetLimit: number) {
  const wrap = ((((pose.rotation + 180) % 360) + 360) % 360) - 180
  const limit = (value: number) => Math.min(offsetLimit, Math.max(-offsetLimit, Number.isFinite(value) ? value : 0))
  return {
    rotationDegrees: wrap === -180 ? 180 : wrap,
    offsetXmeters: limit(pose.x * metersPerPoint),
    offsetYmeters: limit(pose.y * metersPerPoint),
    scale: pose.scale,
  }
}
