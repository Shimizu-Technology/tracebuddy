type Point = { x: number; y: number }

// Keep the approximation within the one-pixel dilation under the guide.
const toleranceSquared = 0.95 ** 2
const maxTrim = 0.3

function simplify(points: Point[], deadline: number) {
  const last = points.length - 1
  const first = points[0]
  let opposite = 1
  let furthest = 0
  let work = 0
  for (let i = 1; i <= last; i++) {
    const distance = (points[i].x - first.x) ** 2 + (points[i].y - first.y) ** 2
    if (distance > furthest) {
      furthest = distance
      opposite = i
    }
  }

  // Break the loop into two non-degenerate lines for Douglas–Peucker.
  points.push(first)
  const keep = new Uint8Array(points.length)
  keep[0] = keep[opposite] = 1
  const spans = [0, opposite, opposite, last + 1]
  while (spans.length) {
    const end = spans.pop()!
    const start = spans.pop()!
    const a = points[start]
    const b = points[end]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lengthSquared = dx * dx + dy * dy
    let far = -1
    let distanceSquared = toleranceSquared
    for (let i = start + 1; i < end; i++) {
      if ((++work & 255) === 0 && performance.now() >= deadline) return null
      const x = points[i].x - a.x
      const y = points[i].y - a.y
      const projection = lengthSquared ? Math.max(0, Math.min(1, (x * dx + y * dy) / lengthSquared)) : 0
      const distance = (x - projection * dx) ** 2 + (y - projection * dy) ** 2
      if (distance > distanceSquared) {
        far = i
        distanceSquared = distance
      }
    }
    if (far !== -1) {
      keep[far] = 1
      spans.push(start, far, far, end)
    }
  }
  points.pop()
  const simplified = points.filter((_, i) => keep[i])
  return simplified.length >= 3 ? simplified : points
}

function toward(from: Point, to: Point): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const share = Math.min(0.25, maxTrim / Math.hypot(dx, dy))
  return { x: from.x + dx * share, y: from.y + dy * share }
}

export function smoothContour(vertices: number[], stride: number, scale: number, deadline: number) {
  const points = vertices.map((index) => ({ x: index % stride, y: Math.floor(index / stride) }))
  const format = ({ x, y }: Point) => `${Math.round(x * scale * 10) / 10} ${Math.round(y * scale * 10) / 10}`
  // Keep rectangular page edges and tiny contours intact.
  if (points.length <= 5) return `M ${points.map(format).join(' L')} Z`

  const simplified = simplify(points, deadline)
  if (!simplified) return null
  const parts: string[] = []
  for (let i = 0; i < simplified.length; i++) {
    if (((i + 1) & 255) === 0 && performance.now() >= deadline) return null
    const point = simplified[i]
    const before = toward(point, simplified[(i + simplified.length - 1) % simplified.length])
    const after = toward(point, simplified[(i + 1) % simplified.length])
    parts.push(`${i === 0 ? 'M ' : 'L'}${format(before)} Q${format(point)} ${format(after)}`)
  }
  return `${parts.join(' ')} Z`
}
