import { smoothContour } from './smoothContour'

export const fillResolution = 500
export const fillDocumentScale = 1000 / fillResolution
export const fillBudgetMs = 150
const maxCorners = 24_000
const region = 1
const dilation = 2
const examined = 4

export type FillResult =
  | { status: 'filled'; path: string; corners: number }
  | { status: 'limit'; reason: 'time' | 'corners' }
  | { status: 'miss' }

export type FillGuideIndex = ReturnType<typeof indexFillGuide>

export function guideBarriers(rgba: Uint8Array | Uint8ClampedArray) {
  const barriers = new Uint8Array(rgba.length / 4)
  for (let i = 0, p = 0; i < barriers.length; i++, p += 4) {
    // Ignore the pale background and faint handwriting rules.
    const alpha = rgba[p + 3]
    if (alpha <= 94) continue
    const darkness = 255 - (rgba[p] * 0.213 + rgba[p + 1] * 0.715 + rgba[p + 2] * 0.072)
    if (darkness * alpha > 24_000) barriers[i] = 1
  }
  return barriers
}

// Index the open spans once when the guide loads. Fill taps can then step over
// long stretches of white space and visit individual pixels only at the ink.
export function indexFillGuide(barriers: Uint8Array, width: number, height: number) {
  const rows = new Uint32Array(height + 1)
  const starts: number[] = []
  const ends: number[] = []
  for (let y = 0; y < height; y++) {
    rows[y] = starts.length
    const rowEnd = (y + 1) * width
    let pixel = y * width
    while (pixel < rowEnd) {
      if (barriers[pixel]) {
        pixel++
        continue
      }
      starts.push(pixel++)
      while (pixel < rowEnd && !barriers[pixel]) pixel++
      ends.push(pixel - 1)
    }
  }
  rows[height] = starts.length
  return { width, height, rows, starts: Uint32Array.from(starts), ends: Uint32Array.from(ends) }
}

function firstSpanEndingAtOrAfter(guide: FillGuideIndex, row: number, pixel: number) {
  let low = guide.rows[row]
  let high = guide.rows[row + 1]
  while (low < high) {
    const middle = (low + high) >>> 1
    if (guide.ends[middle] < pixel) low = middle + 1
    else high = middle
  }
  return low
}

/** Trace the outer and inner boundaries of one four-connected region. */
export function floodFill(
  guide: FillGuideIndex, x: number, y: number,
  { budgetMs = fillBudgetMs, scale = 1 }: { budgetMs?: number; scale?: number } = {},
): FillResult {
  const { width, height, rows, starts, ends } = guide
  x = Math.floor(x)
  y = Math.floor(y)
  if (!Number.isFinite(x + y) || x < 0 || x >= width || y < 0 || y >= height) return { status: 'miss' }

  const seed = y * width + x
  const seedSpan = firstSpanEndingAtOrAfter(guide, y, seed)
  if (seedSpan === rows[y + 1] || starts[seedSpan] > seed) return { status: 'miss' }
  if (budgetMs <= 0) return { status: 'limit', reason: 'time' }

  const deadline = performance.now() + budgetMs
  const filled = new Uint8Array(width * height)
  const pending = [seedSpan]
  const boundary: number[] = []
  let work = 0

  while (pending.length) {
    if ((++work & 63) === 0 && performance.now() >= deadline) return { status: 'limit', reason: 'time' }
    const span = pending.pop()!
    const left = starts[span]
    if (filled[left]) continue
    const right = ends[span]
    const row = Math.floor(left / width)
    filled.fill(region, left, right + 1)

    // Only span ends and pixels facing a barrier or page edge can have an
    // exposed edge. Add adjacent guide pixels to tuck the fill under the ink.
    boundary.push(left, right)
    if (left > row * width && !filled[left - 1]) {
      filled[left - 1] = dilation
      boundary.push(left - 1)
    }
    if (right < (row + 1) * width - 1 && !filled[right + 1]) {
      filled[right + 1] = dilation
      boundary.push(right + 1)
    }

    for (let offset = -1; offset <= 1; offset += 2) {
      const adjacentRow = row + offset
      if (adjacentRow < 0 || adjacentRow >= height) {
        for (let i = left; i <= right; i++) boundary.push(i)
        continue
      }

      const shift = offset * width
      const adjacentEnd = right + shift
      let pixel = left + shift
      let next = firstSpanEndingAtOrAfter(guide, adjacentRow, pixel)
      const rowEnd = rows[adjacentRow + 1]
      while (pixel <= adjacentEnd) {
        const hasOverlap = next < rowEnd && starts[next] <= adjacentEnd
        const inkEnd = hasOverlap ? starts[next] : adjacentEnd + 1
        for (; pixel < inkEnd; pixel++) {
          boundary.push(pixel - shift)
          if (!filled[pixel]) {
            filled[pixel] = dilation
            boundary.push(pixel)
          }
        }
        if (!hasOverlap) break
        if (!filled[starts[next]]) pending.push(next)
        pixel = ends[next] + 1
        next++
      }
    }
  }

  // An edge points east, south, west, or north with the filled cell on its right.
  // Build only the edges incident to the candidates gathered during the flood.
  const stride = width + 1
  const edges = new Uint8Array(stride * (height + 1))
  const vertices: number[] = []
  for (const index of boundary) {
    if ((++work & 255) === 0 && performance.now() >= deadline) return { status: 'limit', reason: 'time' }
    if (filled[index] & examined) continue
    filled[index] |= examined
    const col = index % width
    const topLeft = index + (index - col) / width
    if (!filled[index - width]) {
      if (!edges[topLeft]) vertices.push(topLeft)
      edges[topLeft] |= 1
    }
    if (col === width - 1 || !filled[index + 1]) {
      const topRight = topLeft + 1
      if (!edges[topRight]) vertices.push(topRight)
      edges[topRight] |= 2
    }
    if (!filled[index + width]) {
      const bottomRight = topLeft + stride + 1
      if (!edges[bottomRight]) vertices.push(bottomRight)
      edges[bottomRight] |= 4
    }
    if (col === 0 || !filled[index - 1]) {
      const bottomLeft = topLeft + stride
      if (!edges[bottomLeft]) vertices.push(bottomLeft)
      edges[bottomLeft] |= 8
    }
  }

  const steps = [1, stride, -1, -stride]
  const paths: string[] = []
  let corners = 0
  for (const start of vertices) {
    while (edges[start]) {
      let vertex = start
      let direction = 31 - Math.clz32(edges[start] & -edges[start])
      const contour = [start]
      do {
        if ((++work & 255) === 0 && performance.now() >= deadline) return { status: 'limit', reason: 'time' }
        edges[vertex] &= ~(1 << direction)
        vertex += steps[direction]
        if (vertex === start) break
        // Favor the right turn at diagonal contacts to keep the corners separate.
        const right = (direction + 1) & 3
        const next = edges[vertex] & (1 << right) ? right
          : edges[vertex] & (1 << direction) ? direction : (direction + 3) & 3
        if (next !== direction) {
          if (++corners > maxCorners) return { status: 'limit', reason: 'corners' }
          contour.push(vertex)
          direction = next
        }
      } while (vertex !== start)
      if (++corners > maxCorners) return { status: 'limit', reason: 'corners' }
      const path = smoothContour(contour, stride, scale, deadline)
      if (path === null) return { status: 'limit', reason: 'time' }
      paths.push(path)
    }
  }

  const path = paths.join(' ')
  if (performance.now() >= deadline) return { status: 'limit', reason: 'time' }
  return { status: 'filled', path, corners }
}
