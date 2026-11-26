import type { PracticeStroke } from '../../../practiceStorageModel'

export type InkExport = { uri: string; release: () => void }

export function createInkExport(strokes: readonly PracticeStroke[], size: number): InkExport | undefined {
  if (typeof document === 'undefined') return undefined
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ink = canvas.getContext('2d')
  if (!ink) return undefined

  ink.scale(size / 1000, size / 1000)
  ink.lineCap = 'round'
  ink.lineJoin = 'round'
  for (const stroke of strokes) {
    const path = new Path2D(stroke.path)
    const eraser = stroke.mode === 'erase'
    ink.globalCompositeOperation = eraser ? 'destination-out' : stroke.blend ?? 'source-over'
    ink.globalAlpha = eraser ? 1 : stroke.opacity
    ink.fillStyle = ink.strokeStyle = eraser ? '#000000' : stroke.color
    if (stroke.kind === 'fill') {
      ink.fill(path)
    } else {
      ink.lineWidth = stroke.width
      ink.setLineDash(stroke.dasharray?.every((length) => Number.isFinite(length) && length >= 0) ? stroke.dasharray : [])
      ink.stroke(path)
    }
  }
  return { uri: canvas.toDataURL('image/png'), release: () => {} }
}
