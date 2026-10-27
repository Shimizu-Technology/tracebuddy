export type PracticeDocumentSize = { width: number; height: number; legacyViewport?: boolean }
export type InkStroke = {
  path: string
  color: string
  width: number
  opacity: number
  mode: 'draw' | 'erase'
  dasharray?: string
  transform?: string
}

export const defaultDocument: PracticeDocumentSize = { width: 1000, height: 1000 }

export function normalizeDocument(value: unknown): PracticeDocumentSize | undefined {
  if (!value || typeof value !== 'object') return undefined
  const size = value as PracticeDocumentSize
  return Number.isFinite(size.width) && Number.isFinite(size.height) && size.width >= 100 && size.height >= 100
    && size.width <= 10000 && size.height <= 10000
    ? { width: size.width, height: size.height, legacyViewport: size.legacyViewport === true } : undefined
}

// The old format recorded normalized ink but no viewport dimensions. Recover its
// rectangular page using the old layout at first open, then persist that page.
// An original viewport with a different aspect ratio cannot be inferred.
export function recoverLegacyDocument(strokes: InkStroke[], width: number, height: number) {
  const ratio = height / Math.max(width, 1)
  return {
    document: { width: 1000, height: 1000 * ratio, legacyViewport: true },
    strokes: strokes.map((stroke) => ({ ...stroke, transform: `scale(1 ${ratio})` })),
  }
}

export function guideBounds(size: PracticeDocumentSize) {
  return { x: size.width * 0.06, y: size.height * 0.06, width: size.width * 0.88, height: size.height * 0.88 }
}

export function inkGroups(strokes: InkStroke[]) {
  const groups: { draws: InkStroke[]; erasers: InkStroke[] }[] = []
  let current: InkStroke[] = []
  strokes.forEach((stroke, index) => {
    if (stroke.mode === 'draw') current.push(stroke)
    else if (current.length) {
      groups.push({ draws: current, erasers: strokes.slice(index).filter((item) => item.mode === 'erase') })
      current = []
    }
  })
  if (current.length) groups.push({ draws: current, erasers: [] })
  return groups
}
