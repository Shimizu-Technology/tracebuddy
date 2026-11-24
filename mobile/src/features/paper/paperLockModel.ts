// The states of Stick to paper (Paper Lock). Placing, child mode and the Done celebration exclude each
// other, so a late tracking update can never start child mode behind the celebration or after a reset.

export type StickPhase = 'adjusting' | 'placing' | 'child' | 'celebrating'

export type StickEvent =
  | { type: 'lock'; placementReady: boolean; childModeReady: boolean }
  /** trackingOk: the AR session runs with normal tracking. */
  | { type: 'tracking'; childModeReady: boolean; trackingOk: boolean }
  | { type: 'done' }
  | { type: 'keepTracing' }
  | { type: 'unlock' }
  | { type: 'reset' }
  | { type: 'blur' }

/** What the screen should do after a transition. */
export type StickEffect = 'place' | 'enterChild' | 'trackingLost' | 'waiting' | 'cancelled' | null

export function stickTransition(phase: StickPhase, event: StickEvent): { phase: StickPhase; effect: StickEffect } {
  switch (event.type) {
  case 'lock':
    if (phase !== 'adjusting') return { phase, effect: null }
    if (event.childModeReady) return { phase: 'child', effect: 'enterChild' }
    return event.placementReady ? { phase: 'placing', effect: 'place' } : { phase, effect: 'waiting' }
  case 'tracking':
    if (phase === 'placing' && event.childModeReady) return { phase: 'child', effect: 'enterChild' }
    if (phase === 'placing' && !event.trackingOk) return { phase: 'adjusting', effect: 'cancelled' }
    // Never leave a child tracing over a guide that may have slipped.
    if (phase === 'child' && !event.childModeReady) return { phase: 'adjusting', effect: 'trackingLost' }
    return { phase, effect: null }
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
