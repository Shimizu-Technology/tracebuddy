// Pure Previous Work model: input, persistence and SVG rendering share document units.
// 1,000,000 covers all existing native widths (even a 1 pt canvas and legacy
// pixel-to-document migration), with headroom and a finite SVG geometry bound.
export const maxPracticeStrokeWidth = 1_000_000
export function practiceStrokeWidth(width: number) {
  return Number.isFinite(width) ? Math.min(maxPracticeStrokeWidth, Math.max(Number.MIN_VALUE, width)) : 1
}

export function documentStrokeWidth(markerWidth: number, multiplier: number, side: number, zoom: number) {
  return practiceStrokeWidth(markerWidth * multiplier * 1000 / Math.max(1, side) / Math.max(1, zoom))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export type BrushToolId = 'pencil' | 'marker' | 'crayon' | 'paint' | 'eraser'
export type PracticeStrokeMode = 'draw' | 'erase'

type BrushTool = {
  id: BrushToolId
  label: string
  widthMultiplier: number
  opacity: number
  mode: PracticeStrokeMode
  dasharray?: number[]
}

export type PracticeStroke = {
  path: string
  color: string
  width: number
  opacity: number
  mode: PracticeStrokeMode
  dasharray?: number[]
}

export type PracticeSticker = {
  stickerId: string
  kind: 'shape' | 'image'
  label: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  svg?: string
  uri?: string
}

export type PracticeSource = {
  kind: 'drawing' | 'custom' | 'upload'
  drawingId: string
  drawingName: string
  drawingTheme: string
  drawingSvg?: string
  uploadedImage?: UploadedImage
}

export type SavedPracticeSession = {
  version: 2
  sessionId: string
  title: string
  source: PracticeSource
  createdAt: string
  updatedAt: string
  strokes: PracticeStroke[]
  stickers: PracticeSticker[]
  canvasWidth: number
  canvasHeight: number
  guideOpacity: number
  guideOnTop: boolean
  markerColor: string
  markerWidth: number
  brushToolId: BrushToolId
}

export type UploadedImage = {
  uri: string
  name: string
  width?: number
  height?: number
}

export const brushTools: BrushTool[] = [
  { id: 'pencil', label: 'Pencil', widthMultiplier: 0.62, opacity: 0.72, mode: 'draw' },
  { id: 'marker', label: 'Marker', widthMultiplier: 1, opacity: 0.9, mode: 'draw' },
  { id: 'crayon', label: 'Crayon', widthMultiplier: 1.35, opacity: 0.62, mode: 'draw', dasharray: [1, 5] },
  { id: 'paint', label: 'Paint', widthMultiplier: 2.05, opacity: 0.42, mode: 'draw' },
  { id: 'eraser', label: 'Eraser', widthMultiplier: 2.2, opacity: 1, mode: 'erase' },
]

export const brushSizes = [
  { label: 'Fine', value: 5 },
  { label: 'Round', value: 9 },
  { label: 'Fill', value: 16 },
] as const

export function normalizeSavedPracticeStroke(value: unknown): PracticeStroke | null {
  if (!value || typeof value !== 'object') return null
  const stroke = value as Partial<PracticeStroke>
  if (typeof stroke.path !== 'string' || !stroke.path.startsWith('M ')) return null
  if (typeof stroke.width !== 'number' || !Number.isFinite(stroke.width) || stroke.width <= 0) return null

  return {
    path: stroke.path,
    color: typeof stroke.color === 'string' ? stroke.color : '#18243A',
    width: practiceStrokeWidth(stroke.width),
    opacity: typeof stroke.opacity === 'number' ? clamp(stroke.opacity, 0.05, 1) : 0.9,
    mode: stroke.mode === 'erase' ? 'erase' : 'draw',
    dasharray: Array.isArray(stroke.dasharray) && stroke.dasharray.every((item) => typeof item === 'number') ? stroke.dasharray : undefined,
  }
}

function normalizeSavedPracticeSticker(value: unknown): PracticeSticker | null {
  if (!value || typeof value !== 'object') return null
  const sticker = value as Partial<PracticeSticker>
  if (typeof sticker.stickerId !== 'string' || typeof sticker.label !== 'string') return null
  if (sticker.kind !== 'shape' && sticker.kind !== 'image') return null
  if (typeof sticker.x !== 'number' || typeof sticker.y !== 'number' || typeof sticker.width !== 'number' || typeof sticker.height !== 'number') return null
  if (!Number.isFinite(sticker.x) || !Number.isFinite(sticker.y) || !Number.isFinite(sticker.width) || !Number.isFinite(sticker.height)) return null
  if (sticker.kind === 'shape' && typeof sticker.svg !== 'string') return null
  if (sticker.kind === 'image' && typeof sticker.uri !== 'string') return null

  return {
    stickerId: sticker.stickerId,
    kind: sticker.kind,
    label: sticker.label,
    x: clamp(sticker.x, -200, 1200),
    y: clamp(sticker.y, -200, 1200),
    width: clamp(sticker.width, 24, 1000),
    height: clamp(sticker.height, 24, 1000),
    rotation: typeof sticker.rotation === 'number' && Number.isFinite(sticker.rotation) ? sticker.rotation : 0,
    opacity: typeof sticker.opacity === 'number' ? clamp(sticker.opacity, 0.08, 1) : 0.88,
    svg: sticker.kind === 'shape' ? sticker.svg : undefined,
    uri: sticker.kind === 'image' ? sticker.uri : undefined,
  }
}

export function makePracticeSessionTitle(source: PracticeSource) {
  return source.kind === 'custom' ? `${source.drawingName} practice` : source.drawingName
}

export function normalizePracticeSource(value: unknown): PracticeSource | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Partial<PracticeSource>
  if (source.kind !== 'drawing' && source.kind !== 'custom' && source.kind !== 'upload') return null
  if (typeof source.drawingId !== 'string' || typeof source.drawingName !== 'string' || typeof source.drawingTheme !== 'string') return null

  return {
    kind: source.kind,
    drawingId: source.drawingId,
    drawingName: source.drawingName,
    drawingTheme: source.drawingTheme,
    drawingSvg: typeof source.drawingSvg === 'string' ? source.drawingSvg : undefined,
    uploadedImage: source.kind === 'upload' && source.uploadedImage && typeof source.uploadedImage === 'object' && typeof source.uploadedImage.uri === 'string'
      ? {
          uri: source.uploadedImage.uri,
          name: typeof source.uploadedImage.name === 'string' ? source.uploadedImage.name : source.drawingName,
          width: typeof source.uploadedImage.width === 'number' ? source.uploadedImage.width : undefined,
          height: typeof source.uploadedImage.height === 'number' ? source.uploadedImage.height : undefined,
        }
      : undefined,
  }
}

export function normalizeSavedPracticeSession(value: unknown): SavedPracticeSession | null {
  if (!value || typeof value !== 'object') return null
  const session = value as Partial<SavedPracticeSession>
  const source = normalizePracticeSource(session.source)
  if (!source || typeof session.sessionId !== 'string') return null

  const strokes = Array.isArray(session.strokes)
    ? session.strokes.map(normalizeSavedPracticeStroke).filter((stroke): stroke is PracticeStroke => Boolean(stroke))
    : []
  const stickers = Array.isArray(session.stickers)
    ? session.stickers.map(normalizeSavedPracticeSticker).filter((sticker): sticker is PracticeSticker => Boolean(sticker))
    : []

  return {
    version: 2,
    sessionId: session.sessionId,
    title: typeof session.title === 'string' ? session.title : makePracticeSessionTitle(source),
    source,
    createdAt: typeof session.createdAt === 'string' ? session.createdAt : new Date().toISOString(),
    updatedAt: typeof session.updatedAt === 'string' ? session.updatedAt : new Date().toISOString(),
    strokes,
    stickers,
    canvasWidth: typeof session.canvasWidth === 'number' && Number.isFinite(session.canvasWidth) ? Math.max(1, session.canvasWidth) : 1000,
    canvasHeight: typeof session.canvasHeight === 'number' && Number.isFinite(session.canvasHeight) ? Math.max(1, session.canvasHeight) : 1000,
    guideOpacity: typeof session.guideOpacity === 'number' ? clamp(session.guideOpacity, 0.08, 0.66) : 0.24,
    guideOnTop: typeof session.guideOnTop === 'boolean' ? session.guideOnTop : true,
    markerColor: typeof session.markerColor === 'string' ? session.markerColor : '#18243A',
    markerWidth: typeof session.markerWidth === 'number' ? session.markerWidth : 9,
    brushToolId: session.brushToolId && brushTools.some((tool) => tool.id === session.brushToolId) ? session.brushToolId : 'marker',
  }
}

