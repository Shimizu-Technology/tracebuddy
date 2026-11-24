import { drawingById, drawings } from '../../../shared'
import type { Drawing } from '../../../shared'
import type { PracticeSource, SavedPracticeSession, UploadedImage } from '../../practiceStorageModel'

export const practiceImageFolder = 'tracebuddy-uploads'
export const photoDrawingName = 'My photo'

export function drawingTitle({ source, title }: Pick<SavedPracticeSession, 'source' | 'title'>) {
  if (source.kind !== 'upload') return title
  const copySuffix = /(?: copy)+$/.exec(title)?.[0] ?? ''
  return photoDrawingName + copySuffix
}

export function rebasePracticeImageUri(uri: string, documentDirectory: string | null) {
  if (!documentDirectory || !uri.startsWith('file://')) return uri
  const file = new RegExp(`/Documents/${practiceImageFolder}/([a-zA-Z0-9][a-zA-Z0-9._-]*)$`).exec(uri)?.[1]
  // The v2 format stores an absolute URI. An app update can move the sandbox
  // while keeping these files in the same path relative to Documents.
  return file ? `${documentDirectory}${practiceImageFolder}/${file}` : uri
}

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
