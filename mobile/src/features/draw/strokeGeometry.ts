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
