import { drawingById, drawings } from '../../../shared'
import type { Drawing } from '../../../shared'
import type { PracticeSource, UploadedImage } from '../../practiceStorageModel'

export function createPracticeSessionId() {
  return `work-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function makePracticeSource(drawing: Drawing, uploadedImage: UploadedImage | null): PracticeSource {
  if (uploadedImage) {
    return {
      kind: 'upload',
      drawingId: drawing.id,
      drawingName: uploadedImage.name,
      drawingTheme: 'Local image',
      drawingSvg: drawing.svg,
      uploadedImage,
    }
  }

  const isCustom = drawing.id.startsWith('custom-text-')
  return {
    kind: isCustom ? 'custom' : 'drawing',
    drawingId: drawing.id,
    drawingName: drawing.name,
    drawingTheme: drawing.theme,
    drawingSvg: drawing.svg,
  }
}

export function drawingFromPracticeSource(source: PracticeSource) {
  const libraryDrawing = drawingById(source.drawingId)
  const drawing = libraryDrawing ?? {
    id: source.drawingId,
    name: source.drawingName,
    theme: source.drawingTheme,
    category: 'letters' as const,
    difficulty: 'Starter' as const,
    svg: source.drawingSvg ?? drawings[0].svg,
  }

  return {
    drawing,
    uploadedImage: source.kind === 'upload' ? source.uploadedImage ?? null : null,
  }
}
