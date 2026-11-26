export const fillResolution = 1000
const maxCorners = 24_000
const directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }] as const
const firstEdge = [0, 1, 1, 0] as const
const firstRow = [0, 0, 1, 1] as const

export type FillResult = { status: 'filled'; path: string } | { status: 'miss' | 'limit' }

export function guideBarriers(rgba: Uint8Array | Uint8ClampedArray) {
  const barriers = new Uint8Array(rgba.length / 4)
  for (let i = 0; i < barriers.length; i++) {
    const p = i * 4
    // Ignore the pale background and faint handwriting rules.
    const darkness = 255 - (rgba[p] * 0.213 + rgba[p + 1] * 0.715 + rgba[p + 2] * 0.072)
    if (darkness * rgba[p + 3] > 24_000) barriers[i] = 1
  }
  return barriers
}

/** Trace the outer and inner boundaries of one four-connected region. */
export function floodFill(barriers: Uint8Array, width: number, height: number, x: number, y: number, budgetMs = 100): FillResult {
  x = Math.floor(x)
  y = Math.floor(y)
  if (!Number.isFinite(x + y) || x < 0 || x >= width || y < 0 || y >= height || barriers[y * width + x]) {
    return { status: 'miss' }
  }

  const deadline = performance.now() + budgetMs
  const filled = new Uint8Array(barriers.length)
  const available = (index: number) => !barriers[index] && !filled[index]
  const pending = [y * width + x]
  let minX = x, maxX = x, minY = y, maxY = y

  while (pending.length) {
    if (performance.now() >= deadline) return { status: 'limit' }
    const seed = pending.pop()!
    if (!available(seed)) continue
    const row = Math.floor(seed / width)
    const start = row * width
    let left = seed
    let right = seed
    while (left > start && available(left - 1)) left--
    while (right < start + width - 1 && available(right + 1)) right++
    filled.fill(1, left, right + 1)
    minX = Math.min(minX, left - start)
    maxX = Math.max(maxX, right - start)
    minY = Math.min(minY, row)
    maxY = Math.max(maxY, row)

    for (const adjacent of [row - 1, row + 1]) {
      if (adjacent < 0 || adjacent >= height) continue
      let previousOpen = false
      for (let i = left - start; i <= right - start; i++) {
        const index = adjacent * width + i
        const open = available(index)
        if (open && !previousOpen) pending.push(index)
        previousOpen = open
      }
    }
  }

  minX = Math.max(0, minX - 1)
  maxX = Math.min(width - 1, maxX + 1)
  minY = Math.max(0, minY - 1)
  maxY = Math.min(height - 1, maxY + 1)
  const cell = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height ? filled[y * width + x] : 0
  for (let row = minY; row <= maxY; row++) {
    if (performance.now() >= deadline) return { status: 'limit' }
    for (let col = minX; col <= maxX; col++) {
      // Extend one pixel under the guide, without crossing it into another region.
      if (barriers[row * width + col] && (
        cell(col - 1, row) === 1 || cell(col + 1, row) === 1 || cell(col, row - 1) === 1 || cell(col, row + 1) === 1
      )) filled[row * width + col] = 2
    }
  }

  // A directed grid edge always has the filled cell on its right.
  // At a diagonal contact, turning right keeps the two corners separate.
  const edge = (col: number, row: number, dir: number) => {
    switch (dir) {
      case 0: return cell(col, row) && !cell(col, row - 1)
      case 1: return cell(col - 1, row) && !cell(col, row)
      case 2: return cell(col - 1, row - 1) && !cell(col - 1, row)
      default: return cell(col, row - 1) && !cell(col - 1, row - 1)
    }
  }
  const visited = new Uint8Array((width + 1) * (height + 1))
  const vertex = (col: number, row: number) => row * (width + 1) + col
  const parts: string[] = []
  let corners = 0

  for (let row = minY; row <= maxY; row++) {
    if (performance.now() >= deadline) return { status: 'limit' }
    for (let col = minX; col <= maxX; col++) {
      const index = row * width + col
      if (!filled[index] || (
        col > 0 && col < width - 1 &&
        filled[index - 1] && filled[index + 1] && filled[index - width] && filled[index + width]
      )) continue
      for (let direction = 0; direction < directions.length; direction++) {
        const startX = col + firstEdge[direction]
        const startY = row + firstRow[direction]
        const start = vertex(startX, startY)
        if (visited[start] & (1 << direction) || !edge(startX, startY, direction)) continue
        let x = startX, y = startY, dir = direction
        parts.push(`M ${x} ${y}`)
        do {
          visited[vertex(x, y)] |= 1 << dir
          x += directions[dir].x
          y += directions[dir].y
          const right = (dir + 1) % 4
          const next = edge(x, y, right) ? right : edge(x, y, dir) ? dir : (dir + 3) % 4
          if (next !== dir || (x === startX && y === startY && next === direction)) {
            parts.push(dir % 2 ? `V${y}` : `H${x}`)
            if (++corners > maxCorners || performance.now() >= deadline) return { status: 'limit' }
          }
          dir = next
        } while (x !== startX || y !== startY || dir !== direction)
        parts.push('Z')
      }
    }
  }

  return { status: 'filled', path: parts.join(' ') }
}
