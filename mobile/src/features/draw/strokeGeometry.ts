import type { Point } from '../../../practiceModel'

export function pointDistance(from: Point, to: Point) {
  'worklet'
  return Math.hypot(to.x - from.x, to.y - from.y)
}

export function keepStrokeSample(from: Point, to: Point, width: number) {
  'worklet'
  return pointDistance(from, to) >= Math.min(6, Math.max(1.25, width * 0.2))
}

export function keepStrokeOnPinch(elapsedMs: number, travelPt: number) {
  'worklet'
  return elapsedMs >= 180 && travelPt >= 9
}

// Sampling skips small moves, so the finger's final position can be unsaved when it lifts.
export function withFinalPoint(points: Point[], pending: Point | null) {
  'worklet'
  if (!pending) return points
  const last = points[points.length - 1]
  return last.x === pending.x && last.y === pending.y ? points : [...points, pending]
}

export function roundedPoint({ x, y }: Point): Point {
  'worklet'
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 }
}

export function strokePath(points: Point[], width: number) {
  'worklet'
  const [first] = points
  const start = `M ${first.x} ${first.y}`
  if (points.length === 1) return `${start} L ${roundedPoint({ x: first.x + 0.01, y: first.y }).x} ${first.y}`

  const minDistance = Math.min(5, Math.max(1.25, width * 0.18))
  let path = start
  let previous = first
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]
    if (index === points.length - 1 || pointDistance(previous, point) >= minDistance) {
      path += ` L ${point.x} ${point.y}`
      previous = point
    }
  }
  return path
}

// The canvas can show the picture turned in quarter turns (clockwise, about its center).
// Undo that turn so a finger on the turned view lands on the right spot in the picture.
export function unturnPoint(point: Point, side: number, quarterTurns: number): Point {
  'worklet'
  const center = side / 2
  const dx = point.x - center
  const dy = point.y - center
  switch (((quarterTurns % 4) + 4) % 4) {
    case 1: return { x: center + dy, y: center - dx }
    case 2: return { x: center - dx, y: center - dy }
    case 3: return { x: center - dy, y: center + dx }
    default: return point
  }
}
