// The states of Stick to paper (Paper Lock). Placing, child mode and the Done celebration exclude each
// other, and every placement request has its own attempt number. The native view reports which attempt it
// last acted on, so an answer to a cancelled or older attempt can never start child mode.

export type StickPhase = 'adjusting' | 'placing' | 'child' | 'celebrating'

export type StickState = {
  phase: StickPhase
  /** The latest placement request sent to the native view. */
  attempt: number
  /** Every attempt up to this one was cancelled; its placement no longer counts. */
  cancelledThrough: number
}

export const initialStickState: StickState = { phase: 'adjusting', attempt: 0, cancelledThrough: 0 }

export type StickEvent =
  /** nativeAttempt: the attempt the native view's current placement belongs to. */
  | { type: 'lock'; placementReady: boolean; childModeReady: boolean; nativeAttempt: number }
  /** trackingOk: the AR session runs with normal tracking. placement: what the native view reports. */
  | { type: 'tracking'; childModeReady: boolean; trackingOk: boolean; placement: 'none' | 'preview' | 'locked'; nativeAttempt: number }
  /** A placement attempt went unanswered for too long. */
  | { type: 'placementTimeout'; attempt: number }
  | { type: 'done' }
  | { type: 'keepTracing' }
  | { type: 'unlock' }
  | { type: 'reset' }
  | { type: 'blur' }

/** What the screen should do after a transition. 'place' sends `state.attempt` to the native view. */
export type StickEffect = 'place' | 'enterChild' | 'trackingLost' | 'waiting' | 'cancelled' | 'notFound' | null

type Result = { state: StickState; effect: StickEffect }

function to(state: StickState, phase: StickPhase, effect: StickEffect): Result {
  return { state: { ...state, phase }, effect }
}

function cancel(state: StickState, effect: StickEffect, phase: StickPhase = 'adjusting'): Result {
  return { state: { ...state, phase, cancelledThrough: state.attempt }, effect }
}

function place(state: StickState): Result {
  return { state: { ...state, phase: 'placing', attempt: state.attempt + 1 }, effect: 'place' }
}

export function stickTransition(state: StickState, event: StickEvent): Result {
  const { phase } = state
  switch (event.type) {
  case 'lock': {
    if (phase !== 'adjusting') return to(state, phase, null)
    // The guide is already held on the paper by the latest, uncancelled attempt (after an unlock).
    const liveAttempt = event.nativeAttempt === state.attempt && state.attempt > state.cancelledThrough
    if (event.childModeReady && liveAttempt) return to(state, 'child', 'enterChild')
    // A placement left over from a cancelled attempt doesn't count: place again from what is on screen now.
    if (event.placementReady || event.childModeReady) return place(state)
    return to(state, phase, 'waiting')
  }
  case 'tracking': {
    if (phase === 'placing') {
      if (!event.trackingOk) return cancel(state, 'cancelled')
      // Answers to older attempts are ignored; only the current request can finish placing.
      if (event.nativeAttempt !== state.attempt) return to(state, phase, null)
      if (event.childModeReady) return to(state, 'child', 'enterChild')
      // The re-check after Lock found no paper (tracking itself is fine): back to adjusting, Lock can retry.
      if (event.placement === 'none') return cancel(state, 'notFound')
      return to(state, phase, null)
    }
    // Never leave a child tracing over a guide that may have slipped.
    if (phase === 'child' && !event.childModeReady) return to(state, 'adjusting', 'trackingLost')
    return to(state, phase, null)
  }
  case 'placementTimeout':
    return phase === 'placing' && event.attempt === state.attempt ? cancel(state, 'notFound') : to(state, phase, null)
  case 'done':
    if (phase === 'adjusting') return to(state, 'celebrating', null)
    if (phase === 'placing') return cancel(state, 'cancelled', 'celebrating')
    return to(state, phase, null)
  case 'keepTracing':
    return to(state, phase === 'celebrating' ? 'adjusting' : phase, null)
  case 'unlock':
    return to(state, phase === 'child' ? 'adjusting' : phase, null)
  case 'reset':
    if (phase === 'celebrating') return to(state, phase, null)
    return cancel(state, phase === 'placing' ? 'cancelled' : null)
  case 'blur':
    return phase === 'placing' ? cancel(state, 'cancelled') : to(state, phase, null)
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

export type ARPose = { rotationDegrees: number; offsetXmeters: number; offsetYmeters: number; scale: number; opacity: number }
export type ScreenPose = { x: number; y: number; scale: number; rotation: number }

/**
 * What ARKit receives. The gesture keeps an unwrapped angle (it can pass 180° mid-twist), but the native view
 * clamps to −180…180°, so the angle is wrapped here; offsets in meters stay within the page's reach.
 */
export function arPoseFor(pose: ScreenPose, metersPerPoint: number, offsetLimit: number, opacity = 1): ARPose {
  const wrap = ((((pose.rotation + 180) % 360) + 360) % 360) - 180
  const limit = (value: number) => Math.min(offsetLimit, Math.max(-offsetLimit, Number.isFinite(value) ? value : 0))
  return {
    rotationDegrees: wrap === -180 ? 180 : wrap,
    offsetXmeters: limit(pose.x * metersPerPoint),
    offsetYmeters: limit(pose.y * metersPerPoint),
    scale: pose.scale,
    opacity,
  }
}

/**
 * From Lock on, the guide's pose is fixed in meters on the paper: turning the device (which changes the points
 * to meters factor) or a late gesture or fade frame must not move or change a placed guide.
 */
export function arPoseToSend(phase: StickPhase, live: ARPose, frozen: ARPose | null) {
  return canAdjust(phase) || !frozen ? live : frozen
}

/** Back to adjusting: the on-screen pose that matches the frozen guide at the current screen size. */
export function screenPoseFrom(frozen: ARPose, metersPerPoint: number): ScreenPose {
  return {
    x: frozen.offsetXmeters / metersPerPoint,
    y: frozen.offsetYmeters / metersPerPoint,
    scale: frozen.scale,
    rotation: frozen.rotationDegrees,
  }
}
