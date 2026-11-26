import { smoothContour } from './smoothContour'

export const fillResolution = 500
export const fillDocumentScale = 1000 / fillResolution
export const fillBudgetMs = 150
const maxCorners = 24_000
const region = 1
const dilation = 2
const examined = 4

export type FillResult = { status: 'filled'; path: string } | { status: 'miss' | 'limit' }

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

/** Trace the outer and inner boundaries of one four-connected region. */
export function floodFill(
  barriers: Uint8Array, width: number, height: number, x: number, y: number,
  { budgetMs = fillBudgetMs, scale = 1 }: { budgetMs?: number; scale?: number } = {},
): FillResult {
  x = Math.floor(x)
  y = Math.floor(y)
  if (!Number.isFinite(x + y) || x < 0 || x >= width || y < 0 || y >= height || barriers[y * width + x]) {
    return { status: 'miss' }
  }
  if (budgetMs <= 0) return { status: 'limit' }

  const deadline = performance.now() + budgetMs
  const filled = new Uint8Array(barriers.length)
  const pending = [y * width + x]
  const boundary: number[] = []
  let work = 0

  while (pending.length) {
    if ((++work & 255) === 0 && performance.now() >= deadline) return { status: 'limit' }
    const seed = pending.pop()!
    if (filled[seed]) continue
    const start = seed - seed % width
    const end = start + width - 1
    let left = seed
    let right = seed
    while (left > start && !filled[left - 1] && !barriers[left - 1]) left--
    while (right < end && !filled[right + 1] && !barriers[right + 1]) right++
    filled.fill(region, left, right + 1)

    // Only span ends and pixels facing a barrier or page edge can have an
    // exposed edge. Add adjacent guide pixels to tuck the fill under the ink.
    boundary.push(left, right)
    if (left > start && barriers[left - 1] && !filled[left - 1]) {
      filled[left - 1] = dilation
      boundary.push(left - 1)
    }
    if (right < end && barriers[right + 1] && !filled[right + 1]) {
      filled[right + 1] = dilation
      boundary.push(right + 1)
    }

    for (let offset = -width; offset <= width; offset += 2 * width) {
      const adjacent = left + offset
      let wasOpen = false
      if (adjacent < 0 || adjacent >= filled.length) {
        for (let i = left; i <= right; i++) boundary.push(i)
        continue
      }
      for (let i = left, j = adjacent; i <= right; i++, j++) {
        if ((++work & 255) === 0 && performance.now() >= deadline) return { status: 'limit' }
        if (barriers[j]) {
          boundary.push(i)
          if (!filled[j]) {
            filled[j] = dilation
            boundary.push(j)
          }
          wasOpen = false
        } else {
          const open = !filled[j]
          if (open && !wasOpen) pending.push(j)
          wasOpen = open
        }
      }
    }
  }

  // An edge points east, south, west, or north with the filled cell on its right.
  // Build only the edges incident to the candidates gathered during the flood.
  const stride = width + 1
  const edges = new Uint8Array(stride * (height + 1))
  const vertices: number[] = []
  for (const index of boundary) {
    if ((++work & 255) === 0 && performance.now() >= deadline) return { status: 'limit' }
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
        if ((++work & 255) === 0 && performance.now() >= deadline) return { status: 'limit' }
        edges[vertex] &= ~(1 << direction)
        vertex += steps[direction]
        if (vertex === start) break
        // Favor the right turn at diagonal contacts to keep the corners separate.
        const right = (direction + 1) & 3
        const next = edges[vertex] & (1 << right) ? right
          : edges[vertex] & (1 << direction) ? direction : (direction + 3) & 3
        if (next !== direction) {
          if (++corners > maxCorners) return { status: 'limit' }
          contour.push(vertex)
          direction = next
        }
      } while (vertex !== start)
      if (++corners > maxCorners) return { status: 'limit' }
      const path = smoothContour(contour, stride, scale, deadline)
      if (path === null) return { status: 'limit' }
      paths.push(path)
    }
  }

  return performance.now() >= deadline ? { status: 'limit' } : { status: 'filled', path: paths.join(' ') }
}
