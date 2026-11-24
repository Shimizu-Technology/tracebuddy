import { clamp, clampCenterOffset, handleTransform, nearestSquareAngle, normalizeDegrees, rotatePoint } from './paperModel'
import type { Point, Size } from './paperModel'
import { paperTheme } from './paperTheme'

// Gesture and layout math for the guide. Every function here also runs on the UI thread ('worklet').
// Worklets don't capture module values used in default parameters, so defaults are applied in the body.

export type PairMetrics = { mid: Point; distance: number; angle: number }
export type ScaleLimits = { min: number; max: number }

export function pairMetrics(a: Point, b: Point): PairMetrics {
  'worklet'
  return {
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  }
}

/** The shortest turn from one angle to another, in degrees. */
export function angleDelta(from: number, to: number) {
  'worklet'
  return normalizeDegrees(to - from)
}

/**
 * One frame of a two-finger gesture as a single transform: the guide moves with the midpoint of the fingers,
 * scales by how far they spread and turns by how far they twist, all around that midpoint. Done as one step,
 * the spot under each finger stays under it whatever mix of drag, pinch and twist the fingers make.
 */
export function moveWithFingers(center: Point, previousMid: Point, mid: Point, factor: number, turn: number): Point {
  'worklet'
  const scaled = { x: previousMid.x + (center.x - previousMid.x) * factor, y: previousMid.y + (center.y - previousMid.y) * factor }
  const turned = rotatePoint(scaled, previousMid, turn)
  return { x: turned.x + mid.x - previousMid.x, y: turned.y + mid.y - previousMid.y }
}

/** The scale step a pinch can take without leaving the allowed range. */
export function limitedFactor(scale: number, factor: number, limits: ScaleLimits) {
  'worklet'
  return clamp(scale * factor, limits.min, limits.max) / scale
}

/**
 * Gentle snap to 0/90/180/270 with hysteresis: it settles within about 4° and lets go only past about 7°,
 * so hovering near the edge doesn't buzz. `snappedTo` is the square angle it is holding, or NaN.
 */
export function snapStep(raw: number, snappedTo: number) {
  'worklet'
  const { snapDegrees, snapReleaseDegrees } = paperTheme
  if (!Number.isNaN(snappedTo) && Math.abs(raw - snappedTo) < snapReleaseDegrees) return { rotation: snappedTo, snappedTo }
  const square = nearestSquareAngle(raw)
  if (Math.abs(raw - square) < snapDegrees) return { rotation: square, snappedTo: square }
  return { rotation: raw, snappedTo: Number.NaN }
}

/** The on-screen box around the whole frame, handles included, at any size and turn. */
export function frameBounds(page: Size, scale: number, rotation: number): Size {
  'worklet'
  const { outset, handle, handleStroke } = paperTheme.size.frame
  const extra = (outset + handle / 2 + handleStroke) * 2
  const width = page.width * scale + extra
  const height = page.height * scale + extra
  const radians = (rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  return { width: width * cos + height * sin, height: width * sin + height * cos }
}

/**
 * While More is open the whole scene (camera and guide together, so their alignment stays true) moves so the
 * full frame sits between the top buttons and the sheet, and inside the screen sideways. It shrinks only when
 * the frame can't fit. Recomputed every frame from the live guide, so nudges and gestures stay in view.
 */
export function sheetLift({ screen, sheetHeight, topLimit, center, bounds, margin }: {
  screen: Size
  sheetHeight: number
  topLimit: number
  center: Point
  bounds: Size
  margin: number
}) {
  'worklet'
  const top = topLimit + margin
  const bottom = screen.height - sheetHeight - margin
  const left = margin
  const right = screen.width - margin
  const availableHeight = Math.max(1, bottom - top)
  const availableWidth = Math.max(1, right - left)
  const scale = Math.min(1, availableHeight / Math.max(1, bounds.height), availableWidth / Math.max(1, bounds.width))
  const scaledX = screen.width / 2 + (center.x - screen.width / 2) * scale
  const scaledY = screen.height / 2 + (center.y - screen.height / 2) * scale
  const halfWidth = (bounds.width * scale) / 2
  const halfHeight = (bounds.height * scale) / 2
  const targetX = halfWidth * 2 >= availableWidth ? left + availableWidth / 2 : clamp(scaledX, left + halfWidth, right - halfWidth)
  const targetY = halfHeight * 2 >= availableHeight ? top + availableHeight / 2 : clamp(scaledY, top + halfHeight, bottom - halfHeight)
  return { dx: targetX - scaledX, dy: targetY - scaledY, scale }
}

/** Where a point on the stage lands after the scene transform from sheetLift. */
export function liftedPoint(point: Point, screen: Size, lift: { dx: number; dy: number; scale: number }): Point {
  'worklet'
  return {
    x: screen.width / 2 + (point.x - screen.width / 2) * lift.scale + lift.dx,
    y: screen.height / 2 + (point.y - screen.height / 2) * lift.scale + lift.dy,
  }
}

/** Where the guide is: offset of its center from where it rests, its size and its turn. */
export type Pose = { x: number; y: number; scale: number; rotation: number }
/** The unsnapped turn the fingers have made, and the square angle the snap is holding (or NaN). */
export type Turn = { raw: number; snappedTo: number }

export function startTurn(rotation: number): Turn {
  'worklet'
  // Starting exactly square counts as held, so a small twist doesn't buzz straight away.
  return { raw: rotation, snappedTo: rotation === nearestSquareAngle(rotation) ? rotation : Number.NaN }
}

/** One frame of two fingers on the guide. `snapped` is true only on the frame the snap takes hold. */
export function pairFrame(pose: Pose, turn: Turn, previous: [Point, Point], current: [Point, Point], rest: Point, stage: Size, limits: ScaleLimits) {
  'worklet'
  const before = pairMetrics(previous[0], previous[1])
  const after = pairMetrics(current[0], current[1])
  const factor = limitedFactor(pose.scale, after.distance / before.distance, limits)
  const raw = turn.raw + angleDelta(before.angle, after.angle)
  const snap = snapStep(raw, turn.snappedTo)
  const center = moveWithFingers({ x: rest.x + pose.x, y: rest.y + pose.y }, before.mid, after.mid, factor, snap.rotation - pose.rotation)
  const offset = clampCenterOffset({ x: center.x - rest.x, y: center.y - rest.y }, rest, stage)
  return {
    pose: { x: offset.x, y: offset.y, scale: pose.scale * factor, rotation: snap.rotation },
    turn: { raw, snappedTo: snap.snappedTo },
    snapped: Number.isNaN(turn.snappedTo) && !Number.isNaN(snap.snappedTo),
  }
}

/** One frame of a single finger: a plain drag moves the guide. */
export function dragFrame(pose: Pose, previous: Point, current: Point, rest: Point, stage: Size): Pose {
  'worklet'
  const offset = clampCenterOffset({ x: pose.x + current.x - previous.x, y: pose.y + current.y - previous.y }, rest, stage)
  return { ...pose, x: offset.x, y: offset.y }
}

/** A finger that started on a corner handle resizes and turns the guide around its center. */
export function handleFrame(pose: Pose, turn: Turn, start: { touch: Point; scale: number; rotation: number }, current: Point, rest: Point, limits: ScaleLimits) {
  'worklet'
  const center = { x: rest.x + pose.x, y: rest.y + pose.y }
  const next = handleTransform(start.touch, current, center, start.scale, start.rotation)
  const snap = snapStep(next.rotation, turn.snappedTo)
  return {
    pose: { ...pose, scale: clamp(next.scale, limits.min, limits.max), rotation: snap.rotation },
    turn: { raw: next.rotation, snappedTo: snap.snappedTo },
    snapped: Number.isNaN(turn.snappedTo) && !Number.isNaN(snap.snappedTo),
  }
}

/** A stage point in the guide's own coordinates (for checking that fingers stay on the same spot). */
export function toGuideLocal(point: Point, pose: Pose, rest: Point): Point {
  'worklet'
  const center = { x: rest.x + pose.x, y: rest.y + pose.y }
  const unturned = rotatePoint(point, center, -pose.rotation)
  return { x: (unturned.x - center.x) / pose.scale, y: (unturned.y - center.y) / pose.scale }
}

export type GuideAction = 'bigger' | 'smaller' | 'turnLeft' | 'turnRight'

/** VoiceOver's alternatives to pinch and twist: a size step, or a quarter turn from the nearest square angle. */
export function accessibilityPose(pose: Pose, action: string, limits: ScaleLimits): Pose {
  const sizeStep = 0.1
  if (action === 'bigger' || action === 'smaller') {
    return { ...pose, scale: clamp(pose.scale + (action === 'bigger' ? sizeStep : -sizeStep), limits.min, limits.max) }
  }
  if (action === 'turnLeft' || action === 'turnRight') {
    return { ...pose, rotation: normalizeDegrees(nearestSquareAngle(pose.rotation) + (action === 'turnRight' ? 90 : -90)) }
  }
  return pose
}

export const guideAccessibilityActions: { name: GuideAction; label: string }[] = [
  { name: 'bigger', label: 'Make bigger' },
  { name: 'smaller', label: 'Make smaller' },
  { name: 'turnLeft', label: 'Turn left' },
  { name: 'turnRight', label: 'Turn right' },
]
