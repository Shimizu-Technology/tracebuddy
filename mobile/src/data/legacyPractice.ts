import { createTextDrawing, drawingById } from '../../../shared'
import { brushTools, defaultMarkerColor, makePracticeSessionTitle, normalizeSavedPracticeStroke, practiceStrokeWidth } from '../../practiceStorageModel'
import type { BrushToolId, PracticeSource, PracticeStroke, SavedPracticeSession } from '../../practiceStorageModel'
import { createPracticeSessionId, makePracticeSource } from './practiceSource'
import { legacyPracticeAutosavePrefix } from './storageKeys'

function legacyPracticeSessionId(storageKey: string) {
  const suffix = storageKey.slice(legacyPracticeAutosavePrefix.length).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150) || createPracticeSessionId()
  return `legacy-${suffix}`
}

function isLegacyUploadAutosaveKey(storageKey: string) {
  return storageKey.slice(legacyPracticeAutosavePrefix.length).startsWith('uploaded_')
}

function scaleLegacyPathValue(value: number, axis: 'x' | 'y' | 'none', scaleX: number, scaleY: number) {
  const scaled = axis === 'x' ? value * scaleX : axis === 'y' ? value * scaleY : value
  return String(Math.round(scaled * 100) / 100)
}

function legacyPathAxisForCommand(command: string, valueIndex: number): 'x' | 'y' | 'none' {
  const commandType = command.toUpperCase()
  if (commandType === 'H') return 'x'
  if (commandType === 'V') return 'y'
  if (commandType === 'A') {
    const arcAxes: Array<'x' | 'y' | 'none'> = ['x', 'y', 'none', 'none', 'none', 'x', 'y']
    return arcAxes[valueIndex % arcAxes.length]
  }
  if (commandType === 'Z') return 'none'
  return valueIndex % 2 === 0 ? 'x' : 'y'
}

function scaleLegacyPracticePath(path: string, scaleX: number, scaleY: number) {
  const tokens = path.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi)
  if (!tokens) return path

  let activeCommand = ''
  let commandValueIndex = 0

  return tokens.map((token) => {
    if (/^[a-zA-Z]$/.test(token)) {
      activeCommand = token
      commandValueIndex = 0
      return token
    }

    const value = Number(token)
    if (!Number.isFinite(value)) return token
    const axis = legacyPathAxisForCommand(activeCommand, commandValueIndex)
    commandValueIndex += 1
    return scaleLegacyPathValue(value, axis, scaleX, scaleY)
  }).join(' ')
}

function scaleLegacyPracticeStroke(stroke: PracticeStroke, scaleX: number, scaleY: number): PracticeStroke {
  return {
    ...stroke,
    path: scaleLegacyPracticePath(stroke.path, scaleX, scaleY),
    width: practiceStrokeWidth(stroke.width * Math.min(scaleX, scaleY)),
  }
}

function legacyPracticeSource(drawingId: string, drawingName: string, storageKey: string): PracticeSource {
  const libraryDrawing = !isLegacyUploadAutosaveKey(storageKey) ? drawingById(drawingId) : null
  if (libraryDrawing) return makePracticeSource(libraryDrawing, null)

  const customDrawing = createTextDrawing(drawingName)
  return {
    kind: 'custom',
    drawingId: `${legacyPracticeSessionId(storageKey)}-source`,
    drawingName,
    drawingTheme: isLegacyUploadAutosaveKey(storageKey) ? 'Legacy upload · image unavailable' : 'Saved practice',
    drawingSvg: customDrawing.svg,
  }
}

export function normalizeLegacyPracticeAutosave(value: unknown, storageKey: string, legacyCanvasSize: { width: number; height: number }): SavedPracticeSession | null {
  if (!value || typeof value !== 'object') return null
  const session = value as {
    drawingId?: unknown
    drawingName?: unknown
    updatedAt?: unknown
    strokes?: unknown
    guideOpacity?: unknown
    guideOnTop?: unknown
    markerColor?: unknown
    markerWidth?: unknown
    brushToolId?: unknown
  }
  if (typeof session.drawingId !== 'string' || typeof session.drawingName !== 'string') return null

  const scaleX = 1000 / Math.max(1, legacyCanvasSize.width)
  const scaleY = 1000 / Math.max(1, legacyCanvasSize.height)
  const strokes = Array.isArray(session.strokes)
    ? session.strokes
        .map(normalizeSavedPracticeStroke)
        .filter((stroke): stroke is PracticeStroke => Boolean(stroke))
        .map((stroke) => scaleLegacyPracticeStroke(stroke, scaleX, scaleY))
    : []
  if (strokes.length === 0) return null

  const source = legacyPracticeSource(session.drawingId, session.drawingName, storageKey)
  const updatedAt = typeof session.updatedAt === 'string' ? session.updatedAt : new Date().toISOString()

  return {
    version: 2,
    sessionId: legacyPracticeSessionId(storageKey),
    title: makePracticeSessionTitle(source),
    source,
    createdAt: updatedAt,
    updatedAt,
    strokes,
    stickers: [],
    canvasWidth: 1000,
    canvasHeight: 1000,
    guideOpacity: typeof session.guideOpacity === 'number' ? Math.min(0.66, Math.max(0.08, session.guideOpacity)) : 0.24,
    guideOnTop: typeof session.guideOnTop === 'boolean' ? session.guideOnTop : true,
    markerColor: typeof session.markerColor === 'string' ? session.markerColor : defaultMarkerColor,
    markerWidth: typeof session.markerWidth === 'number' ? session.markerWidth : 9,
    brushToolId: typeof session.brushToolId === 'string' && brushTools.some((tool) => tool.id === session.brushToolId) ? session.brushToolId as BrushToolId : 'marker',
  }
}
