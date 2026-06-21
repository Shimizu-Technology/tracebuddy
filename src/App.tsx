import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent, WheelEvent } from 'react'
import { createTextDrawing, drawingCategories, drawings, sanitizeTraceText } from './drawings'
import type { Drawing, DrawingFilterId } from './drawings'
import './App.css'

type AppMode = 'welcome' | 'picker' | 'trace' | 'practice'
type TraceSurface = 'camera' | 'screen'
type CameraStatus = 'idle' | 'starting' | 'ready' | 'blocked' | 'unsupported'
type Direction = 'up' | 'right' | 'down' | 'left'

type PickerCategoryId = DrawingFilterId

type PracticePoint = {
  x: number
  y: number
}

type BrushToolId = 'pencil' | 'marker' | 'crayon' | 'paint' | 'eraser'
type PracticeStrokeMode = 'draw' | 'erase'

type BrushTool = {
  id: BrushToolId
  label: string
  widthMultiplier: number
  opacity: number
  mode: PracticeStrokeMode
  dasharray?: string
}

type PracticeStroke = {
  path: string
  color: string
  width: number
  opacity: number
  mode: PracticeStrokeMode
  dasharray?: string
}

type UploadedImageReference = {
  imageId: string
  fileName: string
  originalSrc?: string
  processedSrc?: string
}

type PracticeSource = {
  kind: 'drawing' | 'custom' | 'upload'
  drawingId: string
  drawingName: string
  drawingTheme: string
  drawingSvg?: string
  uploadedImage?: UploadedImageReference
}

type SavedPracticeSession = {
  version: 2
  sessionId: string
  title: string
  source: PracticeSource
  createdAt: string
  updatedAt: string
  strokes: PracticeStroke[]
  guideOpacity: number
  guideOnTop: boolean
  markerColor: string
  markerWidth: number
  brushToolId: BrushToolId
}

type PracticeViewport = {
  x: number
  y: number
  scale: number
}

type Transform = {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  locked: boolean
  outline: boolean
}

type TransformUpdate = Partial<Transform> | ((current: Transform) => Partial<Transform>)

type UploadedImageState = {
  imageId: string
  originalSrc: string
  processedSrc: string
  fileName: string
}

type UploadCleanupMode = 'original' | 'background' | 'outline'
type UploadCleanupStatus = 'idle' | 'processing' | 'ready' | 'error'

type UploadCleanupOptions = {
  mode: Exclude<UploadCleanupMode, 'original'>
  backgroundTolerance: number
  outlineDetail: number
}

type PaperDetectionStatus = 'idle' | 'scanning' | 'found' | 'not-found' | 'unavailable'

type PaperDetection = {
  centerX: number
  centerY: number
  width: number
  height: number
  rotation: number
  confidence: number
  stageWidth: number
  stageHeight: number
}

type PaperDetectionOptions = {
  smooth?: boolean
}

type IconProps = {
  className?: string
}

type WakeLockSentinelLike = {
  release: () => Promise<void>
  addEventListener?: (type: 'release', listener: () => void) => void
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
  }
}

const markerColors = ['#18243A', '#4A5568', '#FF795D', '#FF4FA3', '#F7A8C8', '#D946EF', '#E45336', '#F2994A', '#F2C94C', '#219653', '#27AE60', '#2F80ED', '#56CCF2', '#9B51E0', '#EB5757', '#8B5E3C'] as const

const brushTools: BrushTool[] = [
  { id: 'pencil', label: 'Pencil', widthMultiplier: 0.62, opacity: 0.72, mode: 'draw' },
  { id: 'marker', label: 'Marker', widthMultiplier: 1, opacity: 0.9, mode: 'draw' },
  { id: 'crayon', label: 'Crayon', widthMultiplier: 1.35, opacity: 0.62, mode: 'draw', dasharray: '1 5' },
  { id: 'paint', label: 'Paint', widthMultiplier: 2.05, opacity: 0.42, mode: 'draw' },
  { id: 'eraser', label: 'Eraser', widthMultiplier: 2.2, opacity: 1, mode: 'erase' },
]

const brushSizes = [
  { label: 'Fine', value: 8 },
  { label: 'Round', value: 12 },
  { label: 'Fill', value: 22 },
] as const

const defaultPracticeViewport: PracticeViewport = { x: 0, y: 0, scale: 1 }
const previousWorkIndexKey = 'tracebuddy.previousWork.v1.index'
const previousWorkSessionPrefix = 'tracebuddy.previousWork.v1.session.'
const legacyPracticeAutosavePrefix = 'tracebuddy.practice.v1.'
const uploadedImageDbName = 'tracebuddy-uploaded-images'
const uploadedImageStoreName = 'uploaded-images'
const practiceAutosaveDelayMs = 450

const defaultTransform: Transform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 0.62,
  locked: false,
  outline: false,
}

const PAPER_SCAN_WIDTH = 180
const PAPER_MIN_AREA_RATIO = 0.04
const PAPER_IDLE_MESSAGE = 'Find the paper to align the drawing automatically.'
const PAPER_SCANNING_MESSAGE = 'Scanning for paper.'
const PAPER_NOT_FOUND_MESSAGE = 'No clear sheet found. Use bright paper on a darker, non-glossy surface.'
const PAPER_UNAVAILABLE_MESSAGE = 'Start the camera first, then try finding the paper again.'
const PAPER_FOUND_MESSAGE = 'Paper found. Tap Track paper to follow small camera shifts.'
const PAPER_TRACKING_MESSAGE = 'Tracking paper. Keep the sheet in view.'
const PAPER_TRACKING_PAUSED_MESSAGE = 'Camera paused. Retry camera to resume paper tracking.'
const UPLOAD_CLEANUP_MAX_DIMENSION = 1024
const UPLOAD_CLEANUP_CHUNK_PIXELS = 120_000
const UPLOAD_CLEANUP_IDLE_MESSAGE = 'Use the original upload, or clean it when the background gets in the way.'
const UPLOAD_CLEANUP_BACKGROUND_PROCESSING_MESSAGE = 'Removing the simple background locally.'
const UPLOAD_CLEANUP_OUTLINE_PROCESSING_MESSAGE = 'Building a transparent line-art version locally.'
const UPLOAD_CLEANUP_BACKGROUND_READY_MESSAGE = 'Background cleanup applied. Adjust sensitivity if too much disappears.'
const UPLOAD_CLEANUP_OUTLINE_READY_MESSAGE = 'Line-art cleanup applied. Adjust detail if lines are missing or noisy.'
const UPLOAD_CLEANUP_ERROR_MESSAGE = 'Could not clean this image. Try the original or upload a different picture.'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function pointsToSvgPath(points: PracticePoint[]) {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  return rest.reduce((path, point) => `${path} L ${point.x} ${point.y}`, `M ${first.x} ${first.y}`)
}

function simplifyPracticePoints(points: PracticePoint[], minDistance: number) {
  if (points.length <= 2) return points

  const simplified: PracticePoint[] = [points[0]]
  for (const point of points.slice(1, -1)) {
    const previous = simplified[simplified.length - 1]
    if (Math.hypot(point.x - previous.x, point.y - previous.y) >= minDistance) simplified.push(point)
  }

  const last = points[points.length - 1]
  const previous = simplified[simplified.length - 1]
  if (last !== previous) simplified.push(last)
  return simplified
}

function normalizeSavedPracticeStroke(value: unknown): PracticeStroke | null {
  if (!value || typeof value !== 'object') return null
  const stroke = value as Partial<PracticeStroke>
  if (typeof stroke.path !== 'string' || !stroke.path.startsWith('M ')) return null
  if (typeof stroke.width !== 'number' || !Number.isFinite(stroke.width)) return null

  return {
    path: stroke.path,
    color: typeof stroke.color === 'string' ? stroke.color : markerColors[0],
    width: clamp(stroke.width, 0.5, 120),
    opacity: typeof stroke.opacity === 'number' ? clamp(stroke.opacity, 0.05, 1) : 0.9,
    mode: stroke.mode === 'erase' ? 'erase' : 'draw',
    dasharray: typeof stroke.dasharray === 'string' ? stroke.dasharray : undefined,
  }
}

function createPracticeSessionId() {
  return `work-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

let uploadedImageDbPromise: Promise<IDBDatabase> | null = null

function openUploadedImageDb() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'))
  if (uploadedImageDbPromise) return uploadedImageDbPromise

  uploadedImageDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(uploadedImageDbName, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(uploadedImageStoreName)) db.createObjectStore(uploadedImageStoreName, { keyPath: 'imageId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      uploadedImageDbPromise = null
      reject(request.error ?? new Error('Could not open image storage'))
    }
  })

  return uploadedImageDbPromise
}

function uploadedImageRecordSignature(image: UploadedImageState) {
  return JSON.stringify([image.imageId, image.fileName, image.originalSrc, image.processedSrc])
}

async function saveUploadedImageRecord(image: UploadedImageState) {
  const db = await openUploadedImageDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(uploadedImageStoreName, 'readwrite')
    tx.objectStore(uploadedImageStoreName).put({ ...image, updatedAt: new Date().toISOString() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not save uploaded image'))
  })
}

async function loadUploadedImageRecord(imageId: string) {
  const db = await openUploadedImageDb()
  return new Promise<UploadedImageState | null>((resolve, reject) => {
    const tx = db.transaction(uploadedImageStoreName, 'readonly')
    const request = tx.objectStore(uploadedImageStoreName).get(imageId)
    request.onsuccess = () => {
      const result = request.result as Partial<UploadedImageState> | undefined
      resolve(result && typeof result.imageId === 'string' && typeof result.originalSrc === 'string' && typeof result.processedSrc === 'string' && typeof result.fileName === 'string'
        ? { imageId: result.imageId, originalSrc: result.originalSrc, processedSrc: result.processedSrc, fileName: result.fileName }
        : null)
    }
    request.onerror = () => reject(request.error ?? new Error('Could not load uploaded image'))
  })
}

async function deleteUploadedImageRecordIfUnused(imageId: string, remainingIds: string[]) {
  const remainingSessions = remainingIds
    .map((id) => {
      try {
        const rawSession = window.localStorage.getItem(previousWorkSessionKey(id))
        return rawSession ? normalizeSavedPracticeSession(JSON.parse(rawSession)) : null
      } catch {
        return null
      }
    })
    .filter((session): session is SavedPracticeSession => Boolean(session))

  if (remainingSessions.some((session) => session.source.uploadedImage?.imageId === imageId)) return

  try {
    const db = await openUploadedImageDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(uploadedImageStoreName, 'readwrite')
      tx.objectStore(uploadedImageStoreName).delete(imageId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Could not delete uploaded image'))
    })
  } catch {
    // Best-effort cleanup only.
  }
}

function serializePracticeSource(source: PracticeSource): PracticeSource {
  if (source.kind !== 'upload') return source
  const image = source.uploadedImage
  return {
    ...source,
    uploadedImage: image?.imageId ? { imageId: image.imageId, fileName: image.fileName } : undefined,
  }
}

function makePracticeSaveSignature(session: Pick<SavedPracticeSession, 'source' | 'strokes' | 'guideOpacity' | 'guideOnTop' | 'markerColor' | 'markerWidth' | 'brushToolId'>) {
  return JSON.stringify({ ...session, source: serializePracticeSource(session.source) })
}

function makePracticeSource(drawing: Drawing, uploadedImage: UploadedImageState | null): PracticeSource {
  if (uploadedImage) {
    return {
      kind: 'upload',
      drawingId: drawing.id,
      drawingName: uploadedImage.fileName,
      drawingTheme: 'Local upload',
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
    drawingSvg: isCustom ? drawing.svg : undefined,
  }
}

function drawingFromPracticeSource(source: PracticeSource) {
  const libraryDrawing = drawings.find((drawing) => drawing.id === source.drawingId)
  return libraryDrawing ?? {
    id: source.drawingId,
    name: source.drawingName,
    theme: source.drawingTheme,
    category: 'letters' as const,
    difficulty: 'Starter' as const,
    svg: source.drawingSvg ?? drawings[0].svg,
  }
}

function makePracticeSessionTitle(source: PracticeSource) {
  return source.kind === 'custom' ? `${source.drawingName} practice` : source.drawingName
}

function previousWorkSessionKey(sessionId: string) {
  return `${previousWorkSessionPrefix}${sessionId}`
}

function legacyPracticeSessionId(storageKey: string) {
  const suffix = storageKey.slice(legacyPracticeAutosavePrefix.length).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150) || createPracticeSessionId()
  return `legacy-${suffix}`
}

function legacyPracticeSource(pictureName: string, pictureTheme: string, storageKey: string): PracticeSource {
  const libraryDrawing = drawings.find((drawing) => drawing.name === pictureName && drawing.theme === pictureTheme)
  if (libraryDrawing) return makePracticeSource(libraryDrawing, null)

  const customDrawing = createTextDrawing(pictureName)
  return {
    kind: 'custom',
    drawingId: `${legacyPracticeSessionId(storageKey)}-source`,
    drawingName: pictureName,
    drawingTheme: pictureTheme.startsWith('Local upload') ? 'Legacy upload · image unavailable' : pictureTheme,
    drawingSvg: customDrawing.svg,
  }
}

function normalizeLegacyPracticeAutosave(value: unknown, storageKey: string): SavedPracticeSession | null {
  if (!value || typeof value !== 'object') return null
  const session = value as {
    pictureName?: unknown
    pictureTheme?: unknown
    updatedAt?: unknown
    strokes?: unknown
    guideOpacity?: unknown
    guideOnTop?: unknown
    markerColor?: unknown
    markerWidth?: unknown
    brushToolId?: unknown
  }
  if (typeof session.pictureName !== 'string' || typeof session.pictureTheme !== 'string') return null

  const strokes = Array.isArray(session.strokes)
    ? session.strokes.map(normalizeSavedPracticeStroke).filter((stroke): stroke is PracticeStroke => Boolean(stroke))
    : []
  if (strokes.length === 0) return null

  const source = legacyPracticeSource(session.pictureName, session.pictureTheme, storageKey)
  const updatedAt = typeof session.updatedAt === 'string' ? session.updatedAt : new Date().toISOString()

  return {
    version: 2,
    sessionId: legacyPracticeSessionId(storageKey),
    title: makePracticeSessionTitle(source),
    source,
    createdAt: updatedAt,
    updatedAt,
    strokes,
    guideOpacity: typeof session.guideOpacity === 'number' ? clamp(session.guideOpacity, 0.08, 0.72) : 0.26,
    guideOnTop: typeof session.guideOnTop === 'boolean' ? session.guideOnTop : true,
    markerColor: typeof session.markerColor === 'string' ? session.markerColor : markerColors[0],
    markerWidth: typeof session.markerWidth === 'number' ? session.markerWidth : 12,
    brushToolId: typeof session.brushToolId === 'string' && brushTools.some((tool) => tool.id === session.brushToolId) ? session.brushToolId as BrushToolId : 'marker',
  }
}

function migrateLegacyPracticeAutosaves() {
  const legacyKeys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
    .filter((key): key is string => Boolean(key?.startsWith(legacyPracticeAutosavePrefix)))

  legacyKeys.forEach((key) => {
    try {
      const rawSession = window.localStorage.getItem(key)
      const migratedSession = rawSession ? normalizeLegacyPracticeAutosave(JSON.parse(rawSession), key) : null
      if (!migratedSession) return

      savePreviousWorkSession(migratedSession)
      window.localStorage.removeItem(key)
    } catch {
      // Leave the legacy autosave in place if migration cannot complete.
    }
  })
}

function normalizePracticeSource(value: unknown): PracticeSource | null {
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
    uploadedImage: source.kind === 'upload' && source.uploadedImage && typeof source.uploadedImage === 'object' && typeof source.uploadedImage.imageId === 'string'
      ? {
          imageId: source.uploadedImage.imageId,
          fileName: typeof source.uploadedImage.fileName === 'string' ? source.uploadedImage.fileName : source.drawingName,
          originalSrc: typeof source.uploadedImage.originalSrc === 'string' ? source.uploadedImage.originalSrc : undefined,
          processedSrc: typeof source.uploadedImage.processedSrc === 'string' ? source.uploadedImage.processedSrc : undefined,
        }
      : undefined,
  }
}

function normalizeSavedPracticeSession(value: unknown): SavedPracticeSession | null {
  if (!value || typeof value !== 'object') return null
  const session = value as Partial<SavedPracticeSession>
  const source = normalizePracticeSource(session.source)
  if (!source || typeof session.sessionId !== 'string') return null

  const strokes = Array.isArray(session.strokes)
    ? session.strokes.map(normalizeSavedPracticeStroke).filter((stroke): stroke is PracticeStroke => Boolean(stroke))
    : []

  return {
    version: 2,
    sessionId: session.sessionId,
    title: typeof session.title === 'string' ? session.title : makePracticeSessionTitle(source),
    source,
    createdAt: typeof session.createdAt === 'string' ? session.createdAt : new Date().toISOString(),
    updatedAt: typeof session.updatedAt === 'string' ? session.updatedAt : new Date().toISOString(),
    strokes,
    guideOpacity: typeof session.guideOpacity === 'number' ? clamp(session.guideOpacity, 0.08, 0.72) : 0.26,
    guideOnTop: typeof session.guideOnTop === 'boolean' ? session.guideOnTop : true,
    markerColor: typeof session.markerColor === 'string' ? session.markerColor : markerColors[0],
    markerWidth: typeof session.markerWidth === 'number' ? session.markerWidth : 12,
    brushToolId: session.brushToolId && brushTools.some((tool) => tool.id === session.brushToolId) ? session.brushToolId : 'marker',
  }
}

function readPreviousWorkIds() {
  try {
    const rawIndex = window.localStorage.getItem(previousWorkIndexKey)
    if (!rawIndex) return []
    const parsed = JSON.parse(rawIndex) as { ids?: unknown }
    return Array.isArray(parsed.ids) ? parsed.ids.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

async function hydrateUploadedImageSession(session: SavedPracticeSession) {
  const imageRef = session.source.uploadedImage
  if (session.source.kind !== 'upload' || !imageRef?.imageId || imageRef.originalSrc) return session

  try {
    const uploadedImage = await loadUploadedImageRecord(imageRef.imageId)
    if (!uploadedImage) return session
    return { ...session, source: { ...session.source, uploadedImage } }
  } catch {
    return session
  }
}

async function loadPreviousWorkSessions() {
  migrateLegacyPracticeAutosaves()
  const ids = readPreviousWorkIds()
  const sessions = ids
    .map((id) => {
      try {
        const rawSession = window.localStorage.getItem(previousWorkSessionKey(id))
        return rawSession ? normalizeSavedPracticeSession(JSON.parse(rawSession)) : null
      } catch {
        return null
      }
    })
    .filter((session): session is SavedPracticeSession => Boolean(session))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))

  const hydratedSessions = await Promise.all(sessions.map(hydrateUploadedImageSession))
  const validIds = hydratedSessions.map((session) => session.sessionId)
  if (validIds.length !== ids.length || validIds.some((id, index) => id !== ids[index])) {
    try {
      window.localStorage.setItem(previousWorkIndexKey, JSON.stringify({ version: 1, ids: validIds }))
    } catch {
      // Ignore storage cleanup failures.
    }
  }

  return hydratedSessions
}

function savePreviousWorkSession(session: SavedPracticeSession) {
  const currentIds = readPreviousWorkIds()
  const ids = [session.sessionId, ...currentIds.filter((id) => id !== session.sessionId)]
  const serializedSession = { ...session, source: serializePracticeSource(session.source) }
  window.localStorage.setItem(previousWorkSessionKey(session.sessionId), JSON.stringify(serializedSession))
  window.localStorage.setItem(previousWorkIndexKey, JSON.stringify({ version: 1, ids }))
}

function deletePreviousWorkSession(sessionId: string) {
  const rawSession = window.localStorage.getItem(previousWorkSessionKey(sessionId))
  const deletedSession = (() => {
    try {
      return rawSession ? normalizeSavedPracticeSession(JSON.parse(rawSession)) : null
    } catch {
      return null
    }
  })()
  const ids = readPreviousWorkIds().filter((id) => id !== sessionId)
  window.localStorage.removeItem(previousWorkSessionKey(sessionId))
  window.localStorage.setItem(previousWorkIndexKey, JSON.stringify({ version: 1, ids }))
  if (deletedSession?.source.uploadedImage?.imageId) void deleteUploadedImageRecordIfUnused(deletedSession.source.uploadedImage.imageId, ids)
}

function formatPreviousWorkDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Saved work'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount
}

function normalizeRotation(degrees: number) {
  return ((((degrees + 180) % 360) + 360) % 360) - 180
}

function lerpRotation(start: number, end: number, amount: number) {
  return normalizeRotation(start + normalizeRotation(end - start) * amount)
}

function normalizeAngle(degrees: number) {
  let angle = degrees
  while (angle > 90) angle -= 180
  while (angle < -90) angle += 180
  return angle
}

function paperEdgeRotation(majorAxisDegrees: number) {
  const angle = normalizeAngle(majorAxisDegrees)
  if (Math.abs(angle) > 45) return angle + (angle < 0 ? 90 : -90)
  return angle
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const drawingImageSrcById = new Map(drawings.map((drawing) => [drawing.id, svgToDataUrl(drawing.svg)]))

function drawingImageSrc(drawing: Drawing) {
  return drawingImageSrcById.get(drawing.id) ?? svgToDataUrl(drawing.svg)
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image could not be loaded.'))
    image.src = src
  })
}

function getScaledImageSize(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0))
}

function canvasToPngDataUrl(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not encode cleaned image.'))
        return
      }

      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Could not read cleaned image.'))
      reader.readAsDataURL(blob)
    }, 'image/png')
  })
}

function sampleBackgroundColor(data: Uint8ClampedArray, width: number, height: number): [number, number, number] {
  if (width < 1 || height < 1) return [255, 255, 255]

  const desiredCornerSize = clamp(Math.round(Math.min(width, height) * 0.045), 4, 28)
  const cornerWidth = Math.max(1, Math.min(width, desiredCornerSize))
  const cornerHeight = Math.max(1, Math.min(height, desiredCornerSize))
  const corners = [
    [0, 0],
    [width - cornerWidth, 0],
    [0, height - cornerHeight],
    [width - cornerWidth, height - cornerHeight],
  ]
  let red = 0
  let green = 0
  let blue = 0
  let count = 0

  for (const [startX, startY] of corners) {
    for (let y = startY; y < startY + cornerHeight; y += 1) {
      for (let x = startX; x < startX + cornerWidth; x += 1) {
        const offset = (y * width + x) * 4
        if (data[offset + 3] < 12) continue
        red += data[offset]
        green += data[offset + 1]
        blue += data[offset + 2]
        count += 1
      }
    }
  }

  if (!count) return [255, 255, 255]

  const background: [number, number, number] = [red / count, green / count, blue / count]
  return background.every(Number.isFinite) ? background : [255, 255, 255]
}

async function removeBackgroundFromImageData(imageData: ImageData, tolerance: number) {
  const { data, width, height } = imageData
  const [backgroundRed, backgroundGreen, backgroundBlue] = sampleBackgroundColor(data, width, height)
  const cutDistance = 18 + tolerance * 1.42
  const featherDistance = 44
  const chunkBytes = UPLOAD_CLEANUP_CHUNK_PIXELS * 4

  for (let chunkStart = 0; chunkStart < data.length; chunkStart += chunkBytes) {
    const chunkEnd = Math.min(data.length, chunkStart + chunkBytes)

    for (let offset = chunkStart; offset < chunkEnd; offset += 4) {
      const redDistance = data[offset] - backgroundRed
      const greenDistance = data[offset + 1] - backgroundGreen
      const blueDistance = data[offset + 2] - backgroundBlue
      const colorDistance = Math.sqrt(redDistance * redDistance + greenDistance * greenDistance + blueDistance * blueDistance)

      if (colorDistance <= cutDistance) {
        data[offset + 3] = 0
        continue
      }

      if (colorDistance <= cutDistance + featherDistance) {
        const alphaScale = clamp((colorDistance - cutDistance) / featherDistance, 0, 1)
        data[offset + 3] = Math.round(data[offset + 3] * alphaScale)
      }
    }

    if (chunkEnd < data.length) await yieldToBrowser()
  }
}

async function convertTinyImageToOutline(imageData: ImageData, detail: number) {
  const { data } = imageData
  const toneCutoff = 210 - detail * 1.35
  const chunkBytes = UPLOAD_CLEANUP_CHUNK_PIXELS * 4

  for (let chunkStart = 0; chunkStart < data.length; chunkStart += chunkBytes) {
    const chunkEnd = Math.min(data.length, chunkStart + chunkBytes)

    for (let offset = chunkStart; offset < chunkEnd; offset += 4) {
      const grayscale = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]
      const darkness = 255 - grayscale
      const alpha = clamp((darkness - toneCutoff) * 2.2, 0, 210) * (data[offset + 3] / 255)
      data[offset] = 20
      data[offset + 1] = 32
      data[offset + 2] = 51
      data[offset + 3] = Math.round(alpha)
    }

    if (chunkEnd < data.length) await yieldToBrowser()
  }
}

async function convertImageDataToOutline(imageData: ImageData, detail: number) {
  const { data, width, height } = imageData

  if (width < 3 || height < 3) {
    await convertTinyImageToOutline(imageData, detail)
    return
  }

  const grayscale = new Float32Array(width * height)
  const output = new Uint8ClampedArray(data.length)
  const edgeCutoff = 182 - detail * 1.42
  const toneCutoff = 210 - detail * 1.35

  for (let indexStart = 0; indexStart < width * height; indexStart += UPLOAD_CLEANUP_CHUNK_PIXELS) {
    const indexEnd = Math.min(width * height, indexStart + UPLOAD_CLEANUP_CHUNK_PIXELS)

    for (let index = indexStart; index < indexEnd; index += 1) {
      const offset = index * 4
      const grayscaleValue = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]
      const darkness = 255 - grayscaleValue
      const toneAlpha = clamp((darkness - toneCutoff) * 2.2, 0, 170)
      const sourceAlpha = data[offset + 3] / 255
      grayscale[index] = grayscaleValue
      output[offset] = 20
      output[offset + 1] = 32
      output[offset + 2] = 51
      output[offset + 3] = Math.round(toneAlpha * sourceAlpha)
    }

    if (indexEnd < width * height) await yieldToBrowser()
  }

  for (let yStart = 1; yStart < height - 1; yStart += 72) {
    const yEnd = Math.min(height - 1, yStart + 72)

    for (let y = yStart; y < yEnd; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x
        const topLeft = grayscale[index - width - 1]
        const top = grayscale[index - width]
        const topRight = grayscale[index - width + 1]
        const left = grayscale[index - 1]
        const right = grayscale[index + 1]
        const bottomLeft = grayscale[index + width - 1]
        const bottom = grayscale[index + width]
        const bottomRight = grayscale[index + width + 1]
        const gx = -topLeft + topRight - 2 * left + 2 * right - bottomLeft + bottomRight
        const gy = -topLeft - 2 * top - topRight + bottomLeft + 2 * bottom + bottomRight
        const edgeStrength = Math.sqrt(gx * gx + gy * gy)
        const darkness = 255 - grayscale[index]
        const edgeAlpha = clamp((edgeStrength - edgeCutoff) * 2.35, 0, 255)
        const toneAlpha = clamp((darkness - toneCutoff) * 2.2, 0, 170)
        const sourceAlpha = data[index * 4 + 3] / 255
        const alpha = Math.round(Math.max(edgeAlpha, toneAlpha) * sourceAlpha)
        const offset = index * 4

        output[offset] = 20
        output[offset + 1] = 32
        output[offset + 2] = 51
        output[offset + 3] = alpha
      }
    }

    if (yEnd < height - 1) await yieldToBrowser()
  }

  data.set(output)
}

async function processUploadedImage(src: string, options: UploadCleanupOptions) {
  const image = await loadImage(src)
  const canvas = document.createElement('canvas')
  const size = getScaledImageSize(image.naturalWidth || image.width, image.naturalHeight || image.height, UPLOAD_CLEANUP_MAX_DIMENSION)
  canvas.width = size.width
  canvas.height = size.height

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas is unavailable.')

  await yieldToBrowser()
  context.drawImage(image, 0, 0, size.width, size.height)
  await yieldToBrowser()
  const imageData = context.getImageData(0, 0, size.width, size.height)
  await yieldToBrowser()

  if (options.mode === 'background') {
    await removeBackgroundFromImageData(imageData, options.backgroundTolerance)
  } else {
    await convertImageDataToOutline(imageData, options.outlineDetail)
  }

  context.putImageData(imageData, 0, 0)
  return canvasToPngDataUrl(canvas)
}

function isPaperPixel(r: number, g: number, b: number) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  const saturation = max - min

  return luminance > 145 && saturation < 78 && r > 118 && g > 118 && b > 108
}

function mapVideoRectToStage(
  video: HTMLVideoElement,
  stage: HTMLDivElement,
  rect: { centerX: number; centerY: number; width: number; height: number; rotation: number; confidence: number },
  sampleWidth: number,
  sampleHeight: number,
): PaperDetection | null {
  const videoWidth = video.videoWidth
  const videoHeight = video.videoHeight
  const stageRect = stage.getBoundingClientRect()

  if (!videoWidth || !videoHeight || !stageRect.width || !stageRect.height) return null

  const scaleToVideoX = videoWidth / sampleWidth
  const scaleToVideoY = videoHeight / sampleHeight
  const coverScale = Math.max(stageRect.width / videoWidth, stageRect.height / videoHeight)
  const renderedWidth = videoWidth * coverScale
  const renderedHeight = videoHeight * coverScale
  const offsetX = (stageRect.width - renderedWidth) / 2
  const offsetY = (stageRect.height - renderedHeight) / 2

  const videoCenterX = rect.centerX * scaleToVideoX
  const videoCenterY = rect.centerY * scaleToVideoY
  const stageCenterX = offsetX + videoCenterX * coverScale
  const stageCenterY = offsetY + videoCenterY * coverScale
  const stageWidth = rect.width * scaleToVideoX * coverScale
  const stageHeight = rect.height * scaleToVideoY * coverScale

  return {
    centerX: stageCenterX,
    centerY: stageCenterY,
    width: stageWidth,
    height: stageHeight,
    rotation: rect.rotation,
    confidence: rect.confidence,
    stageWidth: stageRect.width,
    stageHeight: stageRect.height,
  }
}

function detectPaperRectangle(video: HTMLVideoElement, stage: HTMLDivElement, canvas: HTMLCanvasElement): PaperDetection | null {
  const videoWidth = video.videoWidth
  const videoHeight = video.videoHeight
  if (!videoWidth || !videoHeight) return null

  const sampleWidth = PAPER_SCAN_WIDTH
  const sampleHeight = Math.max(90, Math.round((videoHeight / videoWidth) * sampleWidth))
  canvas.width = sampleWidth
  canvas.height = sampleHeight

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  context.drawImage(video, 0, 0, sampleWidth, sampleHeight)
  const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight)
  const totalPixels = sampleWidth * sampleHeight
  const mask = new Uint8Array(totalPixels)

  for (let pixel = 0; pixel < totalPixels; pixel += 1) {
    const offset = pixel * 4
    if (isPaperPixel(data[offset], data[offset + 1], data[offset + 2])) {
      mask[pixel] = 1
    }
  }

  const visited = new Uint8Array(totalPixels)
  const stack: number[] = []
  let bestPoints: Array<[number, number]> = []

  for (let index = 0; index < totalPixels; index += 1) {
    if (!mask[index] || visited[index]) continue

    const points: Array<[number, number]> = []
    stack.push(index)
    visited[index] = 1

    while (stack.length) {
      const current = stack.pop()
      if (current === undefined) continue

      const x = current % sampleWidth
      const y = Math.floor(current / sampleWidth)
      points.push([x, y])

      const neighbors = [current - 1, current + 1, current - sampleWidth, current + sampleWidth]
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= totalPixels || visited[neighbor] || !mask[neighbor]) continue
        const neighborX = neighbor % sampleWidth
        if (Math.abs(neighborX - x) > 1) continue
        visited[neighbor] = 1
        stack.push(neighbor)
      }
    }

    if (points.length > bestPoints.length) {
      bestPoints = points
    }
  }

  if (bestPoints.length < totalPixels * PAPER_MIN_AREA_RATIO) return null

  const sum = bestPoints.reduce((acc, [x, y]) => ({ x: acc.x + x, y: acc.y + y }), { x: 0, y: 0 })
  const centerX = sum.x / bestPoints.length
  const centerY = sum.y / bestPoints.length

  let covarianceXX = 0
  let covarianceYY = 0
  let covarianceXY = 0

  for (const [x, y] of bestPoints) {
    const dx = x - centerX
    const dy = y - centerY
    covarianceXX += dx * dx
    covarianceYY += dy * dy
    covarianceXY += dx * dy
  }

  const theta = 0.5 * Math.atan2(2 * covarianceXY, covarianceXX - covarianceYY)
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  let minA = Number.POSITIVE_INFINITY
  let maxA = Number.NEGATIVE_INFINITY
  let minB = Number.POSITIVE_INFINITY
  let maxB = Number.NEGATIVE_INFINITY

  for (const [x, y] of bestPoints) {
    const a = x * cos + y * sin
    const b = -x * sin + y * cos
    minA = Math.min(minA, a)
    maxA = Math.max(maxA, a)
    minB = Math.min(minB, b)
    maxB = Math.max(maxB, b)
  }

  const major = maxA - minA
  const minor = maxB - minB
  if (major < sampleWidth * 0.2 || minor < sampleHeight * 0.16) return null

  const majorAxisDegrees = normalizeAngle((theta * 180) / Math.PI)
  const rotation = paperEdgeRotation(majorAxisDegrees)
  const majorAxisIsVertical = Math.abs(majorAxisDegrees) > 45
  const paperWidth = majorAxisIsVertical ? minor : major
  const paperHeight = majorAxisIsVertical ? major : minor
  const centerA = (minA + maxA) / 2
  const centerB = (minB + maxB) / 2
  const boxCenterX = centerA * cos - centerB * sin
  const boxCenterY = centerA * sin + centerB * cos
  const fillRatio = clamp(bestPoints.length / Math.max(major * minor, 1), 0, 1)
  const areaRatio = clamp(bestPoints.length / totalPixels / 0.35, 0, 1)
  const confidence = clamp(fillRatio * 0.7 + areaRatio * 0.3, 0, 1)

  if (confidence < 0.35) return null

  return mapVideoRectToStage(video, stage, {
    centerX: boxCenterX,
    centerY: boxCenterY,
    width: paperWidth,
    height: paperHeight,
    rotation,
    confidence,
  }, sampleWidth, sampleHeight)
}

function App() {
  const [mode, setMode] = useState<AppMode>('welcome')
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing>(drawings[0])
  const [uploadedImage, setUploadedImage] = useState<UploadedImageState | null>(null)
  const [previousWorkSessions, setPreviousWorkSessions] = useState<SavedPracticeSession[]>([])
  const [activePracticeSession, setActivePracticeSession] = useState<SavedPracticeSession | null>(null)
  const [traceSurface, setTraceSurface] = useState<TraceSurface>('camera')
  const [uploadCleanupMode, setUploadCleanupMode] = useState<UploadCleanupMode>('original')
  const [backgroundTolerance, setBackgroundTolerance] = useState(48)
  const [outlineDetail, setOutlineDetail] = useState(62)
  const [uploadCleanupStatus, setUploadCleanupStatus] = useState<UploadCleanupStatus>('idle')
  const [uploadCleanupMessage, setUploadCleanupMessage] = useState(UPLOAD_CLEANUP_IDLE_MESSAGE)
  const [transform, setTransform] = useState<Transform>(defaultTransform)
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle')
  const [cameraError, setCameraError] = useState('')
  const [paperDetection, setPaperDetection] = useState<PaperDetection | null>(null)
  const [paperDetectionStatus, setPaperDetectionStatus] = useState<PaperDetectionStatus>('idle')
  const [paperDetectionMessage, setPaperDetectionMessage] = useState(PAPER_IDLE_MESSAGE)
  const [paperLockEnabled, setPaperLockEnabled] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const paperCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 })
  const cameraRequestRef = useRef(0)
  const mountedRef = useRef(false)
  const modeRef = useRef<AppMode>(mode)
  const paperLockEnabledRef = useRef(false)
  const uploadCleanupRequestRef = useRef(0)
  const uploadedImageSaveSignatureRef = useRef('')
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)

  const overlaySrc = uploadedImage?.processedSrc ?? drawingImageSrc(selectedDrawing)
  const pictureName = uploadedImage ? uploadedImage.fileName : selectedDrawing.name
  const pictureTheme = uploadedImage ? `Local upload · ${uploadCleanupMode === 'original' ? 'Original image' : uploadCleanupMode === 'background' ? 'Background cleanup' : 'Line-art cleanup'}` : selectedDrawing.theme

  useEffect(() => {
    let cancelled = false
    const task = window.setTimeout(() => {
      void loadPreviousWorkSessions().then((sessions) => {
        if (!cancelled) setPreviousWorkSessions(sessions)
      })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(task)
    }
  }, [])

  const stopStream = useCallback((stream: MediaStream) => {
    stream.getTracks().forEach((track) => track.stop())
  }, [])

  const isCurrentCameraRequest = useCallback((requestId: number) => {
    return mountedRef.current && modeRef.current === 'trace' && cameraRequestRef.current === requestId
  }, [])

  const stopActiveCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
  }, [])

  const stopCamera = useCallback(({ resetStatus = true }: { resetStatus?: boolean } = {}) => {
    cameraRequestRef.current += 1
    stopActiveCamera()

    if (resetStatus && mountedRef.current) {
      setCameraStatus('idle')
      setCameraError('')
    }
  }, [stopActiveCamera])

  const requestWakeLock = useCallback(async () => {
    if (wakeLockRef.current || document.visibilityState !== 'visible') return

    const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock
    if (!wakeLock) return

    try {
      const sentinel = await wakeLock.request('screen')

      if (wakeLockRef.current || (modeRef.current !== 'trace' && modeRef.current !== 'practice') || document.visibilityState !== 'visible') {
        await sentinel.release()
        return
      }

      wakeLockRef.current = sentinel
      sentinel.addEventListener?.('release', () => {
        wakeLockRef.current = null
      })
    } catch {
      // Wake Lock is optional and unavailable in several mobile browsers.
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    const sentinel = wakeLockRef.current
    wakeLockRef.current = null
    if (!sentinel) return

    try {
      await sentinel.release()
    } catch {
      // The lock may already be released by the browser.
    }
  }, [])

  const startCamera = useCallback(async () => {
    const requestId = cameraRequestRef.current + 1
    cameraRequestRef.current = requestId
    stopActiveCamera()

    if (!navigator.mediaDevices?.getUserMedia) {
      if (isCurrentCameraRequest(requestId)) {
        setCameraStatus('unsupported')
        setCameraError('This browser does not support camera access. You can still preview the tracing controls in demo mode.')
      }
      return
    }

    if (mountedRef.current) {
      setCameraStatus('starting')
      setCameraError('')
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      if (!isCurrentCameraRequest(requestId)) {
        stopStream(stream)
        return
      }

      streamRef.current = stream
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          if (mountedRef.current && modeRef.current === 'trace' && streamRef.current === stream) {
            setCameraStatus('idle')
            setCameraError('Camera stream ended. Tap Retry camera to restart.')
          }
        }, { once: true })
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      if (!isCurrentCameraRequest(requestId)) {
        stopActiveCamera()
        return
      }

      setCameraStatus('ready')
    } catch (error) {
      if (!isCurrentCameraRequest(requestId)) return

      stopActiveCamera()
      setCameraStatus('blocked')
      setCameraError(error instanceof Error ? error.message : 'Camera permission was blocked or unavailable.')
    }
  }, [isCurrentCameraRequest, stopActiveCamera, stopStream])

  const hasLiveCameraStream = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return false

    const videoTracks = stream.getVideoTracks()
    const hasLiveVideoTrack = videoTracks.some((track) => track.readyState === 'live')
    const hasEndedVideoTrack = videoTracks.some((track) => track.readyState === 'ended')
    const videoHasCurrentStream = videoRef.current?.srcObject === stream

    return videoTracks.length > 0 && hasLiveVideoTrack && !hasEndedVideoTrack && videoHasCurrentStream
  }, [])

  const ensureCameraStream = useCallback(() => {
    if (!hasLiveCameraStream()) {
      void startCamera()
      return
    }

    if (videoRef.current?.paused) {
      void videoRef.current.play().catch(() => {
        void startCamera()
      })
    }
  }, [hasLiveCameraStream, startCamera])

  const applyPaperDetection = useCallback((detection: PaperDetection, { smooth = false }: PaperDetectionOptions = {}) => {
    const overlayElement = overlayRef.current
    const baseOverlayWidth = overlayElement?.offsetWidth || Math.min(detection.stageWidth * 0.76, 470)
    const baseOverlayHeight = overlayElement?.offsetHeight || baseOverlayWidth
    const overlayAspect = baseOverlayWidth / Math.max(baseOverlayHeight, 1)
    const paperAspect = detection.width / Math.max(detection.height, 1)
    const widthMatchedScale = (detection.width * 0.84) / Math.max(baseOverlayWidth, 1)
    const heightMatchedScale = (detection.height * 0.84) / Math.max(baseOverlayHeight, 1)
    const geometricFallbackScale = (Math.sqrt(detection.width * detection.height) * 0.72) / Math.max(Math.sqrt(baseOverlayWidth * baseOverlayHeight), 1)
    const targetScale = overlayAspect >= paperAspect ? widthMatchedScale : heightMatchedScale
    const nextScale = clamp(Number.isFinite(targetScale) ? targetScale : geometricFallbackScale, 0.35, 2.2)
    const nextX = detection.centerX - detection.stageWidth / 2
    const nextY = detection.centerY - detection.stageHeight / 2
    const smoothing = smooth ? 0.38 : 1

    setTransform((current) => ({
      ...current,
      x: lerp(current.x, nextX, smoothing),
      y: lerp(current.y, nextY, smoothing),
      scale: lerp(current.scale, nextScale, smoothing),
      rotation: lerpRotation(current.rotation, detection.rotation, smoothing),
      locked: paperLockEnabledRef.current ? true : current.locked,
    }))
  }, [])

  const detectAndApplyPaper = useCallback(({ smooth = false }: PaperDetectionOptions = {}) => {
    const video = videoRef.current
    const stage = stageRef.current
    const canvas = paperCanvasRef.current

    if (cameraStatus !== 'ready' || !video || !stage || !canvas) {
      setPaperDetectionStatus('unavailable')
      setPaperDetectionMessage(paperLockEnabledRef.current ? PAPER_TRACKING_PAUSED_MESSAGE : PAPER_UNAVAILABLE_MESSAGE)
      return false
    }

    if (!smooth) {
      setPaperDetectionStatus('scanning')
      setPaperDetectionMessage(PAPER_SCANNING_MESSAGE)
    }

    const detection = detectPaperRectangle(video, stage, canvas)

    if (!detection) {
      if (smooth && paperLockEnabledRef.current) {
        return false
      }

      setPaperDetection(null)
      setPaperDetectionStatus('not-found')
      setPaperDetectionMessage(PAPER_NOT_FOUND_MESSAGE)
      return false
    }

    const nextMessage = paperLockEnabledRef.current ? PAPER_TRACKING_MESSAGE : PAPER_FOUND_MESSAGE
    setPaperDetection(detection)
    setPaperDetectionStatus('found')
    setPaperDetectionMessage((current) => (current === nextMessage ? current : nextMessage))
    applyPaperDetection(detection, { smooth })
    return true
  }, [applyPaperDetection, cameraStatus])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      stopCamera({ resetStatus: false })
      void releaseWakeLock()
    }
  }, [releaseWakeLock, stopCamera])

  useEffect(() => {
    modeRef.current = mode

    const task = window.setTimeout(() => {
      if (mode === 'trace') {
        void startCamera()
        void requestWakeLock()
      } else if (mode === 'practice') {
        stopCamera()
        void requestWakeLock()
      } else {
        stopCamera()
        void releaseWakeLock()
      }
    }, 0)

    return () => window.clearTimeout(task)
  }, [mode, releaseWakeLock, requestWakeLock, startCamera, stopCamera])

  useEffect(() => {
    paperLockEnabledRef.current = paperLockEnabled
  }, [paperLockEnabled])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (modeRef.current === 'trace' || modeRef.current === 'practice')) {
        if (modeRef.current === 'trace') ensureCameraStream()
        void requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [ensureCameraStream, requestWakeLock])

  useEffect(() => {
    if (!paperLockEnabled || mode !== 'trace') return undefined

    if (cameraStatus !== 'ready') {
      const pauseStatus = window.setTimeout(() => {
        setPaperDetectionStatus('unavailable')
        setPaperDetectionMessage(PAPER_TRACKING_PAUSED_MESSAGE)
      }, 0)

      return () => window.clearTimeout(pauseStatus)
    }

    const firstScan = window.setTimeout(() => {
      detectAndApplyPaper({ smooth: false })
    }, 250)

    const interval = window.setInterval(() => {
      detectAndApplyPaper({ smooth: true })
    }, 700)

    return () => {
      window.clearTimeout(firstScan)
      window.clearInterval(interval)
    }
  }, [cameraStatus, detectAndApplyPaper, mode, paperLockEnabled])

  useEffect(() => {
    if (!uploadedImage?.originalSrc) return undefined

    const originalSrc = uploadedImage.originalSrc
    const requestId = uploadCleanupRequestRef.current + 1
    uploadCleanupRequestRef.current = requestId

    const task = window.setTimeout(() => {
      if (uploadCleanupMode === 'original') {
        setUploadedImage((current) => (current?.originalSrc === originalSrc ? { ...current, processedSrc: current.originalSrc } : current))
        setUploadCleanupStatus('idle')
        setUploadCleanupMessage(UPLOAD_CLEANUP_IDLE_MESSAGE)
        return
      }

      setUploadCleanupStatus('processing')
      setUploadCleanupMessage(uploadCleanupMode === 'background' ? UPLOAD_CLEANUP_BACKGROUND_PROCESSING_MESSAGE : UPLOAD_CLEANUP_OUTLINE_PROCESSING_MESSAGE)

      void processUploadedImage(originalSrc, { mode: uploadCleanupMode, backgroundTolerance, outlineDetail })
        .then((processedSrc) => {
          if (uploadCleanupRequestRef.current !== requestId) return
          setUploadedImage((current) => (current?.originalSrc === originalSrc ? { ...current, processedSrc } : current))
          setUploadCleanupStatus('ready')
          setUploadCleanupMessage(uploadCleanupMode === 'background' ? UPLOAD_CLEANUP_BACKGROUND_READY_MESSAGE : UPLOAD_CLEANUP_OUTLINE_READY_MESSAGE)
        })
        .catch(() => {
          if (uploadCleanupRequestRef.current !== requestId) return
          setUploadedImage((current) => (current?.originalSrc === originalSrc ? { ...current, processedSrc: current.originalSrc } : current))
          setUploadCleanupStatus('error')
          setUploadCleanupMessage(UPLOAD_CLEANUP_ERROR_MESSAGE)
        })
    }, uploadCleanupMode === 'original' ? 0 : 160)

    return () => window.clearTimeout(task)
  }, [backgroundTolerance, outlineDetail, uploadCleanupMode, uploadedImage?.originalSrc])

  useEffect(() => {
    if (!uploadedImage) {
      uploadedImageSaveSignatureRef.current = ''
      return
    }

    const saveSignature = uploadedImageRecordSignature(uploadedImage)
    if (saveSignature === uploadedImageSaveSignatureRef.current) return

    void saveUploadedImageRecord(uploadedImage)
      .then(() => {
        uploadedImageSaveSignatureRef.current = saveSignature
      })
      .catch(() => {
        setUploadCleanupStatus('error')
        setUploadCleanupMessage('Could not save this uploaded image locally. Clear older Previous Work or try a smaller image.')
      })
  }, [uploadedImage])

  function resetPaperDetection() {
    paperLockEnabledRef.current = false
    setPaperDetection(null)
    setPaperDetectionStatus('idle')
    setPaperDetectionMessage(PAPER_IDLE_MESSAGE)
    setPaperLockEnabled(false)
  }

  function resetUploadCleanup() {
    uploadCleanupRequestRef.current += 1
    setUploadCleanupMode('original')
    setBackgroundTolerance(48)
    setOutlineDetail(62)
    setUploadCleanupStatus('idle')
    setUploadCleanupMessage(UPLOAD_CLEANUP_IDLE_MESSAGE)
  }

  function openTrace(drawing?: Drawing) {
    setActivePracticeSession(null)
    if (drawing) {
      setSelectedDrawing(drawing)
      setUploadedImage(null)
      resetUploadCleanup()
    }
    setTraceSurface('camera')
    resetPaperDetection()
    setTransform(defaultTransform)
    setMode('trace')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openPractice(drawing?: Drawing) {
    setActivePracticeSession(null)
    if (drawing) {
      setSelectedDrawing(drawing)
      setUploadedImage(null)
      resetUploadCleanup()
    }
    setTraceSurface('screen')
    resetPaperDetection()
    setTransform(defaultTransform)
    setMode('practice')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function uploadedImageFromSource(source: PracticeSource) {
    if (source.kind !== 'upload') return null
    const imageRef = source.uploadedImage
    if (!imageRef?.imageId) return null
    if (imageRef.originalSrc && imageRef.processedSrc) return { imageId: imageRef.imageId, originalSrc: imageRef.originalSrc, processedSrc: imageRef.processedSrc, fileName: imageRef.fileName }
    return loadUploadedImageRecord(imageRef.imageId)
  }

  async function applyPracticeSource(source: PracticeSource) {
    const resolvedUploadedImage = await uploadedImageFromSource(source)
    if (source.kind === 'upload' && !resolvedUploadedImage) {
      window.alert('This uploaded image is no longer available in this browser. The saved strokes are still local, but the image preview cannot be restored.')
      return false
    }

    uploadedImageSaveSignatureRef.current = resolvedUploadedImage ? uploadedImageRecordSignature(resolvedUploadedImage) : ''
    setSelectedDrawing(drawingFromPracticeSource(source))
    setUploadedImage(resolvedUploadedImage)
    resetUploadCleanup()
    resetPaperDetection()
    setTransform(defaultTransform)
    setTraceSurface('screen')
    return true
  }

  function openPreviousWork(session: SavedPracticeSession) {
    void applyPracticeSource(session.source).then((ready) => {
      if (!ready) return
      setActivePracticeSession(session)
      setMode('practice')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  function startFreshFromPreviousWork(session: SavedPracticeSession) {
    void applyPracticeSource(session.source).then((ready) => {
      if (!ready) return
      setActivePracticeSession(null)
      setMode('practice')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  function duplicatePreviousWork(session: SavedPracticeSession) {
    const now = new Date().toISOString()
    const copiedSession: SavedPracticeSession = {
      ...session,
      sessionId: createPracticeSessionId(),
      title: `${session.title} copy`,
      createdAt: now,
      updatedAt: now,
      strokes: session.strokes.map((stroke) => ({ ...stroke })),
    }

    try {
      savePreviousWorkSession(copiedSession)
      setPreviousWorkSessions((current) => [copiedSession, ...current.filter((item) => item.sessionId !== copiedSession.sessionId)])
    } catch {
      window.alert('TraceBuddy could not duplicate this work in this browser. Clear older Previous Work or try again in a moment.')
    }
  }

  function deletePreviousWork(session: SavedPracticeSession) {
    if (!window.confirm(`Delete ${session.title} from this browser?`)) return

    try {
      deletePreviousWorkSession(session.sessionId)
      setPreviousWorkSessions((current) => current.filter((item) => item.sessionId !== session.sessionId))
      if (activePracticeSession?.sessionId === session.sessionId) setActivePracticeSession(null)
    } catch {
      window.alert('TraceBuddy could not delete this work from this browser. Try again in a moment.')
    }
  }

  const handlePracticeSessionSaved = useCallback((session: SavedPracticeSession) => {
    setPreviousWorkSessions((current) => [session, ...current.filter((item) => item.sessionId !== session.sessionId)])
  }, [])

  const handlePracticeSessionDeleted = useCallback((sessionId: string) => {
    setActivePracticeSession(null)
    setPreviousWorkSessions((current) => current.filter((item) => item.sessionId !== sessionId))
  }, [])

  function openSelectedSurface(drawing: Drawing) {
    if (traceSurface === 'screen') {
      openPractice(drawing)
      return
    }

    openTrace(drawing)
  }

  function openTextSurface(value: string) {
    const safeText = sanitizeTraceText(value)
    if (!safeText) return
    openSelectedSurface(createTextDrawing(safeText))
  }

  function updateTransform(update: TransformUpdate) {
    setTransform((current) => ({
      ...current,
      ...(typeof update === 'function' ? update(current) : update),
    }))
  }

  function resetOverlay() {
    resetPaperDetection()
    setTransform(defaultTransform)
  }

  function findPaper() {
    detectAndApplyPaper({ smooth: false })
  }

  function togglePaperLock() {
    if (paperLockEnabledRef.current) {
      paperLockEnabledRef.current = false
      setPaperLockEnabled(false)
      setTransform((current) => ({ ...current, locked: false }))
      setPaperDetectionMessage((current) => {
        if (current === PAPER_TRACKING_MESSAGE) return PAPER_FOUND_MESSAGE
        if (current === PAPER_TRACKING_PAUSED_MESSAGE) return PAPER_UNAVAILABLE_MESSAGE
        return current
      })
      return
    }

    paperLockEnabledRef.current = true
    setPaperLockEnabled(true)
    setTransform((transformState) => ({ ...transformState, locked: true }))
  }

  function onUpload(event: ChangeEvent<HTMLInputElement>, targetMode: 'trace' | 'practice' = 'trace') {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      input.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      void (async () => {
        const originalSrc = String(reader.result)
        const nextUploadedImage: UploadedImageState = {
          imageId: createPracticeSessionId(),
          originalSrc,
          processedSrc: originalSrc,
          fileName: file.name || 'Uploaded picture',
        }

        try {
          await saveUploadedImageRecord(nextUploadedImage)
          uploadedImageSaveSignatureRef.current = uploadedImageRecordSignature(nextUploadedImage)
        } catch {
          input.value = ''
          window.alert('TraceBuddy could not save this upload locally. Try a smaller image, clear older Previous Work, or choose a built-in template.')
          return
        }

        resetUploadCleanup()
        setUploadedImage(nextUploadedImage)
        setActivePracticeSession(null)
        resetPaperDetection()
        setTransform(defaultTransform)
        setTraceSurface(targetMode === 'practice' ? 'screen' : 'camera')
        setMode(targetMode)
        input.value = ''
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })()
    }
    reader.onerror = () => {
      input.value = ''
    }
    reader.readAsDataURL(file)
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (transform.locked || paperLockEnabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      baseX: transform.x,
      baseY: transform.y,
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active || transform.locked || paperLockEnabled) return
    const dx = event.clientX - dragRef.current.startX
    const dy = event.clientY - dragRef.current.startY
    updateTransform({ x: dragRef.current.baseX + dx, y: dragRef.current.baseY + dy })
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    dragRef.current.active = false
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer may already be released if the drag was cancelled.
    }
  }

  return (
    <main className="app-shell">
      <canvas ref={paperCanvasRef} className="paper-scan-canvas" aria-hidden="true" />
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setMode('welcome')} aria-label="TraceBuddy home">
          <span className="brand-mark" aria-hidden="true"><PencilIcon /></span>
          <span>
            <strong>TraceBuddy</strong>
            <small>Camera + screen tracing</small>
          </span>
        </button>
        <nav aria-label="Main navigation">
          <button className={mode === 'welcome' ? 'active' : ''} type="button" onClick={() => setMode('welcome')} aria-current={mode === 'welcome' ? 'page' : undefined}>Home</button>
          <button className={mode === 'picker' ? 'active' : ''} type="button" onClick={() => setMode('picker')} aria-current={mode === 'picker' ? 'page' : undefined}>Pictures</button>
          <button className={mode === 'trace' ? 'active' : ''} type="button" onClick={() => openTrace()} aria-current={mode === 'trace' ? 'page' : undefined}>Camera</button>
          <button className={mode === 'practice' ? 'active' : ''} type="button" onClick={() => openPractice()} aria-current={mode === 'practice' ? 'page' : undefined}>Practice</button>
        </nav>
      </header>

      {mode === 'welcome' && <WelcomeScreen onStart={() => setMode('picker')} onDemo={() => openTrace(drawings[0])} onPractice={() => openPractice(drawings[0])} />}
      {mode === 'picker' && (
        <PickerScreen
          selectedDrawing={selectedDrawing}
          traceSurface={traceSurface}
          onTraceSurfaceChange={setTraceSurface}
          previousWorkSessions={previousWorkSessions}
          onSelect={openSelectedSurface}
          onTextSubmit={openTextSurface}
          onUpload={(event) => onUpload(event, traceSurface === 'screen' ? 'practice' : 'trace')}
          onResumeWork={openPreviousWork}
          onStartFreshWork={startFreshFromPreviousWork}
          onDuplicateWork={duplicatePreviousWork}
          onDeleteWork={deletePreviousWork}
        />
      )}
      {mode === 'trace' && (
        <TraceScreen
          pictureName={pictureName}
          pictureTheme={pictureTheme}
          overlaySrc={overlaySrc}
          transform={transform}
          cameraStatus={cameraStatus}
          cameraError={cameraError}
          paperDetection={paperDetection}
          paperDetectionStatus={paperDetectionStatus}
          paperDetectionMessage={paperDetectionMessage}
          paperLockEnabled={paperLockEnabled}
          hasUploadedImage={Boolean(uploadedImage)}
          uploadCleanupMode={uploadCleanupMode}
          uploadCleanupStatus={uploadCleanupStatus}
          uploadCleanupMessage={uploadCleanupMessage}
          backgroundTolerance={backgroundTolerance}
          outlineDetail={outlineDetail}
          videoRef={videoRef}
          stageRef={stageRef}
          overlayRef={overlayRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          updateTransform={updateTransform}
          onUpload={onUpload}
          onPicker={() => setMode('picker')}
          onPractice={() => openPractice()}
          onRetryCamera={startCamera}
          onFindPaper={findPaper}
          onTogglePaperLock={togglePaperLock}
          onCleanupModeChange={setUploadCleanupMode}
          onBackgroundToleranceChange={setBackgroundTolerance}
          onOutlineDetailChange={setOutlineDetail}
          onReset={resetOverlay}
        />
      )}
      {mode === 'practice' && (
        <PracticeScreen
          pictureName={pictureName}
          pictureTheme={pictureTheme}
          overlaySrc={overlaySrc}
          selectedDrawing={selectedDrawing}
          uploadedImage={uploadedImage}
          initialSession={activePracticeSession}
          onSessionSaved={handlePracticeSessionSaved}
          onSessionDeleted={handlePracticeSessionDeleted}
          onPicker={() => setMode('picker')}
          onCameraTrace={() => openTrace()}
          onUpload={(event) => onUpload(event, 'practice')}
        />
      )}
    </main>
  )
}

function WelcomeScreen({ onStart, onDemo, onPractice }: { onStart: () => void; onDemo: () => void; onPractice: () => void }) {
  const demoDrawing = drawings.find((drawing) => drawing.id === 'dream-unicorn') ?? drawings[0]

  return (
    <section className="hero-screen">
      <div className="hero-copy">
        <p className="eyebrow">Camera overlay drawing practice</p>
        <h1>Trace drawings on real paper with your camera.</h1>
        <p className="lede">
          Pick a cute picture, trace it on real paper with the camera, or practice directly on the screen with a finger or stylus.
        </p>
        <div className="hero-actions">
          <button className="primary-button" type="button" onClick={onStart}>Pick a picture</button>
          <button className="secondary-button" type="button" onClick={onDemo}>Try camera trace</button>
          <button className="secondary-button" type="button" onClick={onPractice}>Practice on screen</button>
        </div>
        <div className="trust-row" aria-label="Privacy and safety boundaries">
          <span>No account</span>
          <span>No ads</span>
          <span>Camera stays local</span>
        </div>
      </div>

      <div className="hero-demo-card" aria-label="TraceBuddy demo preview">
        <div className="mock-device">
          <div className="mock-camera-bg">
            <span className="paper-sheet" />
            <img src={drawingImageSrc(demoDrawing)} alt={`${demoDrawing.name} overlay preview`} />
          </div>
        </div>
        <div className="setup-card">
          <h2>Simple setup</h2>
          <ol>
            <li>Put paper on the table.</li>
            <li>Place phone or iPad on a stand.</li>
            <li>Move the overlay, lock it, and trace.</li>
          </ol>
        </div>
      </div>
    </section>
  )
}

function PickerScreen({
  selectedDrawing,
  traceSurface,
  onTraceSurfaceChange,
  previousWorkSessions,
  onSelect,
  onTextSubmit,
  onUpload,
  onResumeWork,
  onStartFreshWork,
  onDuplicateWork,
  onDeleteWork,
}: {
  selectedDrawing: Drawing
  traceSurface: TraceSurface
  onTraceSurfaceChange: (surface: TraceSurface) => void
  previousWorkSessions: SavedPracticeSession[]
  onSelect: (drawing: Drawing) => void
  onTextSubmit: (value: string) => void
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onResumeWork: (session: SavedPracticeSession) => void
  onStartFreshWork: (session: SavedPracticeSession) => void
  onDuplicateWork: (session: SavedPracticeSession) => void
  onDeleteWork: (session: SavedPracticeSession) => void
}) {
  const [activeCategory, setActiveCategory] = useState<PickerCategoryId>('all')
  const [customText, setCustomText] = useState('')
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<PickerCategoryId, number>> = { all: drawings.length }
    for (const drawing of drawings) {
      counts[drawing.category] = (counts[drawing.category] ?? 0) + 1
      if (drawing.collection) counts[drawing.collection] = (counts[drawing.collection] ?? 0) + 1
    }
    return counts
  }, [])
  const visibleDrawings = useMemo(() => {
    if (activeCategory === 'all') return drawings
    if (activeCategory === 'curated') return drawings.filter((drawing) => drawing.collection === 'curated')
    return drawings.filter((drawing) => drawing.category === activeCategory)
  }, [activeCategory])

  return (
    <section className="picker-screen">
      <div className="section-heading picker-heading">
        <div>
          <p className="eyebrow">Choose a tracing picture</p>
          <h1>Pick from a bigger tracing library.</h1>
          <p>Browse simple line-art templates, then use the camera over paper or practice directly on the screen.</p>
          <div className="surface-switch" role="group" aria-label="Tracing surface">
            <button type="button" className={traceSurface === 'camera' ? 'active' : ''} aria-pressed={traceSurface === 'camera'} onClick={() => onTraceSurfaceChange('camera')}>
              <strong>Camera + paper</strong>
              <small>Overlay above real paper</small>
            </button>
            <button type="button" className={traceSurface === 'screen' ? 'active' : ''} aria-pressed={traceSurface === 'screen'} onClick={() => onTraceSurfaceChange('screen')}>
              <strong>On-screen practice</strong>
              <small>Trace with finger or stylus</small>
            </button>
          </div>
          <form className="custom-text-form" onSubmit={(event) => { event.preventDefault(); onTextSubmit(customText) }}>
            <label>
              <span>Write your own words</span>
              <input value={customText} maxLength={48} placeholder="Stassie, ABC, I love Guam" onChange={(event) => setCustomText(event.target.value)} />
            </label>
            <button type="submit">Trace words</button>
          </form>
        </div>
        <label className="upload-pill" aria-label="Upload your own tracing image">
          <span className="drawing-icon" aria-hidden="true"><ImageIcon /></span>
          <span>
            <strong>Upload your own</strong>
            <small>Photo or drawing</small>
          </span>
          <input type="file" accept="image/*" onChange={onUpload} />
        </label>
      </div>

      {previousWorkSessions.length > 0 && (
        <section className="previous-work-section" aria-labelledby="previous-work-title">
          <div className="previous-work-heading">
            <div>
              <p className="eyebrow">Saved in this browser</p>
              <h2 id="previous-work-title">Previous work</h2>
            </div>
            <span>{previousWorkSessions.length}</span>
          </div>
          <div className="previous-work-grid">
            {previousWorkSessions.map((session) => (
              <article key={session.sessionId} className="previous-work-card">
                <button type="button" className="previous-work-preview" onClick={() => onResumeWork(session)} aria-label={`Resume ${session.title}`}>
                  <img src={session.source.kind === 'upload' && session.source.uploadedImage?.processedSrc ? session.source.uploadedImage.processedSrc : drawingImageSrc(drawingFromPracticeSource(session.source))} alt="" aria-hidden="true" />
                  <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                    {session.strokes.filter((stroke) => stroke.mode === 'draw').slice(-18).map((stroke, index) => (
                      <path key={`${session.sessionId}-preview-${index}`} d={stroke.path} style={{ stroke: stroke.color, strokeWidth: stroke.width, opacity: stroke.opacity, strokeDasharray: stroke.dasharray }} />
                    ))}
                  </svg>
                </button>
                <strong>{session.title}</strong>
                <small>{formatPreviousWorkDate(session.updatedAt)} · {session.strokes.length} strokes</small>
                <div className="previous-work-actions">
                  <button type="button" onClick={() => onResumeWork(session)}>Resume</button>
                  <button type="button" onClick={() => onStartFreshWork(session)}>Fresh</button>
                  <button type="button" onClick={() => onDuplicateWork(session)}>Copy</button>
                  <button type="button" onClick={() => onDeleteWork(session)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="category-strip" aria-label="Template categories">
        {drawingCategories.map((category) => (
          <button key={category.id} type="button" className={activeCategory === category.id ? 'active' : ''} aria-pressed={activeCategory === category.id} aria-label={`${category.label}, ${categoryCounts[category.id] ?? 0} templates`} onClick={() => setActiveCategory(category.id)}>
            <span>{category.label}</span>
            <small aria-hidden="true">{categoryCounts[category.id] ?? 0}</small>
          </button>
        ))}
      </div>

      <div className="template-count" aria-live="polite">
        Showing {visibleDrawings.length} {visibleDrawings.length === 1 ? 'template' : 'templates'}.
      </div>

      <div className="drawing-grid">
        {visibleDrawings.map((drawing) => (
          <button
            key={drawing.id}
            type="button"
            className={`drawing-card ${selectedDrawing.id === drawing.id ? 'selected' : ''}`}
            onClick={() => onSelect(drawing)}
          >
            <img src={drawingImageSrc(drawing)} alt={`${drawing.name} tracing line art`} />
            <span className="drawing-meta">
              <strong>{drawing.name}</strong>
              <small>{drawing.theme}</small>
            </span>
            <span className="difficulty-badge">{drawing.difficulty}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function TraceScreen({
  pictureName,
  pictureTheme,
  overlaySrc,
  transform,
  cameraStatus,
  cameraError,
  paperDetection,
  paperDetectionStatus,
  paperDetectionMessage,
  paperLockEnabled,
  hasUploadedImage,
  uploadCleanupMode,
  uploadCleanupStatus,
  uploadCleanupMessage,
  backgroundTolerance,
  outlineDetail,
  videoRef,
  stageRef,
  overlayRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  updateTransform,
  onUpload,
  onPicker,
  onPractice,
  onRetryCamera,
  onFindPaper,
  onTogglePaperLock,
  onCleanupModeChange,
  onBackgroundToleranceChange,
  onOutlineDetailChange,
  onReset,
}: {
  pictureName: string
  pictureTheme: string
  overlaySrc: string
  transform: Transform
  cameraStatus: CameraStatus
  cameraError: string
  paperDetection: PaperDetection | null
  paperDetectionStatus: PaperDetectionStatus
  paperDetectionMessage: string
  paperLockEnabled: boolean
  hasUploadedImage: boolean
  uploadCleanupMode: UploadCleanupMode
  uploadCleanupStatus: UploadCleanupStatus
  uploadCleanupMessage: string
  backgroundTolerance: number
  outlineDetail: number
  videoRef: React.RefObject<HTMLVideoElement | null>
  stageRef: React.RefObject<HTMLDivElement | null>
  overlayRef: React.RefObject<HTMLDivElement | null>
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void
  updateTransform: (update: TransformUpdate) => void
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onPicker: () => void
  onPractice: () => void
  onRetryCamera: () => void
  onFindPaper: () => void
  onTogglePaperLock: () => void
  onCleanupModeChange: (mode: UploadCleanupMode) => void
  onBackgroundToleranceChange: (value: number) => void
  onOutlineDetailChange: (value: number) => void
  onReset: () => void
}) {
  const [controlsExpanded, setControlsExpanded] = useState(false)
  const manualTransformDisabled = paperLockEnabled
  const paperTrackingPaused = paperLockEnabled && cameraStatus !== 'ready'

  const cameraMessage = useMemo(() => {
    if (cameraStatus === 'ready') return 'Camera ready — place paper in view.'
    if (cameraStatus === 'starting') return 'Starting camera.'
    if (cameraStatus === 'unsupported') return 'Camera unsupported — demo surface shown.'
    if (cameraStatus === 'blocked') return 'Camera blocked — demo surface shown.'
    return 'Camera idle.'
  }, [cameraStatus])

  const adjustScale = (delta: number) => {
    if (manualTransformDisabled) return
    updateTransform((current) => ({ scale: clamp(current.scale + delta, 0.35, 2.2) }))
  }

  const adjustRotation = (delta: number) => {
    if (manualTransformDisabled) return
    updateTransform((current) => ({ rotation: clamp(current.rotation + delta, -180, 180) }))
  }

  const toggleLockOrTracking = () => {
    if (paperLockEnabled) {
      onTogglePaperLock()
      return
    }

    updateTransform((current) => ({ locked: !current.locked }))
  }

  const cleanupModes: Array<{ mode: UploadCleanupMode; label: string; description: string }> = [
    { mode: 'original', label: 'Original', description: 'No cleanup' },
    { mode: 'background', label: 'Cut background', description: 'Best for plain backdrops' },
    { mode: 'outline', label: 'Line art', description: 'Best for tracing' },
  ]

  return (
    <section className="trace-screen">
      <div className="trace-header">
        <div>
          <p className="eyebrow">Trace mode</p>
          <h1>{pictureName}</h1>
          <p><span aria-live="polite">{cameraMessage}</span> <span>{pictureTheme}</span></p>
        </div>
        <div className="trace-header-actions">
          <button className="secondary-button compact" type="button" onClick={onPicker}>Change picture</button>
          <button className="secondary-button compact" type="button" onClick={onPractice}>Practice on screen</button>
          <label className="secondary-button compact file-button">
            Upload
            <input type="file" accept="image/*" onChange={onUpload} />
          </label>
        </div>
      </div>

      <div className="trace-layout">
        <div ref={stageRef} className="camera-stage" aria-label="Camera tracing stage">
          <video ref={videoRef} className={cameraStatus === 'ready' ? 'camera-video visible' : 'camera-video'} playsInline muted />
          <div className={`demo-camera ${cameraStatus === 'ready' ? 'hidden' : ''}`}>
            <div className="desk-grid" />
            <div className="demo-paper">
              <span>Paper preview</span>
            </div>
          </div>

          {paperDetection && (
            <div
              className={`paper-guide ${paperLockEnabled ? 'active' : ''}`}
              aria-hidden="true"
              style={{
                left: `${paperDetection.centerX}px`,
                top: `${paperDetection.centerY}px`,
                width: `${paperDetection.width}px`,
                height: `${paperDetection.height}px`,
                transform: `translate(-50%, -50%) rotate(${paperDetection.rotation}deg)`,
              }}
            />
          )}

          <div
            ref={overlayRef}
            className={`overlay-layer ${transform.locked || paperLockEnabled ? 'locked' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{
              transform: `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px)) rotate(${transform.rotation}deg) scale(${transform.scale})`,
              opacity: transform.opacity,
            }}
          >
            <img className={transform.outline ? 'outline-filter' : ''} src={overlaySrc} alt="Tracing overlay" draggable={false} />
          </div>

          <div className="stage-badge">
            <span aria-hidden="true">{transform.locked || paperLockEnabled ? <LockIcon /> : <MoveIcon />}</span>
            <span>{paperTrackingPaused ? 'Paper lock paused — retry camera' : paperLockEnabled ? 'Paper lock on — follows sheet' : transform.locked ? 'Locked — trace now' : 'Drag picture to move'}</span>
          </div>

          {cameraStatus !== 'ready' && (
            <div className="camera-help">
              <strong>{cameraStatus === 'starting' ? 'Starting camera' : 'Demo mode'}</strong>
              <span>{cameraError || 'Use HTTPS on a phone or iPad to test the real camera.'}</span>
              <button type="button" onClick={onRetryCamera}>Retry camera</button>
            </div>
          )}
        </div>

        <aside className={`controls-panel ${controlsExpanded ? 'expanded' : 'collapsed'}`} aria-label="Tracing controls">
          <div className="mobile-control-bar">
            <button className="sheet-toggle" type="button" aria-expanded={controlsExpanded} onClick={() => setControlsExpanded((current) => !current)}>
              <span>{controlsExpanded ? 'Hide controls' : 'Adjust drawing'}</span>
              <small>{paperTrackingPaused ? 'Paper lock paused' : paperLockEnabled ? 'Paper lock active' : transform.locked ? 'Locked' : 'Setup mode'}</small>
            </button>
            <button className={transform.locked || paperLockEnabled ? 'mini-lock active' : 'mini-lock'} type="button" aria-pressed={transform.locked || paperLockEnabled} onClick={toggleLockOrTracking}>
              {paperLockEnabled ? 'Stop track' : transform.locked ? 'Unlock' : 'Lock'}
            </button>
          </div>

          <p className="sr-only" aria-live="polite">{paperDetectionMessage}</p>

          <div className="controls-body">
            <div className="control-card setup-control">
              <span>Step 1</span>
              <strong>Prop your device above the paper.</strong>
              <small>Use a gooseneck holder, overhead stand, tripod arm, document camera stand, or a sturdy box/books setup.</small>
              <p>Safety: make sure the phone or tablet cannot fall onto the child or paper.</p>
            </div>

            <div className={`control-card paper-control ${paperLockEnabled ? 'active' : ''}`}>
              <span>Beta</span>
              <strong>Find the paper automatically.</strong>
              <small>TraceBuddy looks for the largest bright sheet and can keep the drawing centered on it as the camera view shifts.</small>
              <div className="paper-actions">
                <button type="button" onClick={onFindPaper} disabled={cameraStatus !== 'ready'}>Find paper</button>
                <button type="button" className={paperLockEnabled ? 'active' : ''} aria-pressed={paperLockEnabled} onClick={onTogglePaperLock} disabled={cameraStatus !== 'ready' && !paperLockEnabled}>
                  {paperLockEnabled ? 'Stop paper lock' : 'Track paper'}
                </button>
              </div>
              <p className={`paper-status ${paperDetectionStatus}`}>{paperDetectionMessage}</p>
            </div>

            {hasUploadedImage && (
              <div className={`control-card upload-cleanup-control ${uploadCleanupMode !== 'original' ? 'active' : ''}`}>
                <span>Upload beta</span>
                <strong>Clean the uploaded image.</strong>
                <small>Remove simple backgrounds or turn a photo into transparent tracing lines. Everything stays in this browser.</small>
                <div className="cleanup-mode-grid" role="group" aria-label="Uploaded image cleanup mode">
                  {cleanupModes.map((cleanupMode) => (
                    <button key={cleanupMode.mode} type="button" className={uploadCleanupMode === cleanupMode.mode ? 'active' : ''} aria-pressed={uploadCleanupMode === cleanupMode.mode} onClick={() => onCleanupModeChange(cleanupMode.mode)}>
                      <strong>{cleanupMode.label}</strong>
                      <small>{cleanupMode.description}</small>
                    </button>
                  ))}
                </div>

                {uploadCleanupMode === 'background' && (
                  <label className="cleanup-slider">
                    <span>
                      <strong>Background sensitivity</strong>
                      <small>{Math.round(backgroundTolerance)}%</small>
                    </span>
                    <input type="range" value={backgroundTolerance} min={10} max={90} step={1} aria-valuetext={`${Math.round(backgroundTolerance)}%`} onChange={(event) => onBackgroundToleranceChange(Number(event.target.value))} />
                  </label>
                )}

                {uploadCleanupMode === 'outline' && (
                  <label className="cleanup-slider">
                    <span>
                      <strong>Line detail</strong>
                      <small>{Math.round(outlineDetail)}%</small>
                    </span>
                    <input type="range" value={outlineDetail} min={20} max={95} step={1} aria-valuetext={`${Math.round(outlineDetail)}%`} onChange={(event) => onOutlineDetailChange(Number(event.target.value))} />
                  </label>
                )}

                <p className={`cleanup-status ${uploadCleanupStatus}`} aria-live="polite">{uploadCleanupMessage}</p>
              </div>
            )}

            <div className="quick-controls" aria-label="Quick tracing adjustments">
              <div className="quick-row">
                <span>Size</span>
                <div className="stepper-buttons">
                  <button type="button" onClick={() => adjustScale(-0.08)} disabled={manualTransformDisabled}>Smaller</button>
                  <button type="button" onClick={() => adjustScale(0.08)} disabled={manualTransformDisabled}>Bigger</button>
                </div>
              </div>
              <div className="quick-row">
                <span>Rotate</span>
                <div className="stepper-buttons">
                  <button type="button" onClick={() => adjustRotation(-5)} disabled={manualTransformDisabled}>-5°</button>
                  <button type="button" onClick={() => adjustRotation(5)} disabled={manualTransformDisabled}>+5°</button>
                </div>
              </div>
              <div className="quick-row opacity-row">
                <span>Opacity</span>
                <div className="preset-buttons">
                  {[0.35, 0.5, 0.7, 0.9].map((opacity) => (
                    <button key={opacity} className={Math.abs(transform.opacity - opacity) < 0.02 ? 'active' : ''} type="button" onClick={() => updateTransform({ opacity })}>
                      {Math.round(opacity * 100)}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Slider label="Opacity" value={transform.opacity} min={0.15} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(value) => updateTransform({ opacity: value })} />
            <Slider label="Size" value={transform.scale} min={0.35} max={2.2} step={0.01} disabled={manualTransformDisabled} format={(v) => `${Math.round(v * 100)}%`} onChange={(value) => updateTransform({ scale: value })} />
            <Slider label="Rotate" value={transform.rotation} min={-180} max={180} step={1} disabled={manualTransformDisabled} format={(v) => `${Math.round(v)}°`} onChange={(value) => updateTransform({ rotation: value })} />

            <div className="toggle-grid">
              <button className={transform.locked || paperLockEnabled ? 'toggle active' : 'toggle'} type="button" aria-pressed={transform.locked || paperLockEnabled} onClick={toggleLockOrTracking}>
                {paperLockEnabled ? 'Stop tracking' : transform.locked ? 'Unlock' : 'Lock'}
                <small>{paperLockEnabled ? 'Paper lock' : transform.locked ? 'Move again' : 'Trace safely'}</small>
              </button>
              <button className={transform.outline ? 'toggle active' : 'toggle'} type="button" aria-pressed={transform.outline} onClick={() => updateTransform((current) => ({ outline: !current.outline }))}>
                Outline
                <small>High contrast</small>
              </button>
            </div>

            <div className="nudge-grid" aria-label="Nudge overlay position">
              <button type="button" aria-label="Move overlay up" disabled={manualTransformDisabled} onClick={() => updateTransform((current) => ({ y: current.y - 10 }))}><ArrowIcon direction="up" /></button>
              <button type="button" aria-label="Move overlay left" disabled={manualTransformDisabled} onClick={() => updateTransform((current) => ({ x: current.x - 10 }))}><ArrowIcon direction="left" /></button>
              <button type="button" aria-label="Move overlay right" disabled={manualTransformDisabled} onClick={() => updateTransform((current) => ({ x: current.x + 10 }))}><ArrowIcon direction="right" /></button>
              <button type="button" aria-label="Move overlay down" disabled={manualTransformDisabled} onClick={() => updateTransform((current) => ({ y: current.y + 10 }))}><ArrowIcon direction="down" /></button>
            </div>

            <button className="reset-button" type="button" onClick={onReset}>Reset overlay</button>
            <p className="privacy-note">Privacy: paper detection runs locally in this browser and does not upload photos or camera video anywhere.</p>
          </div>
        </aside>
      </div>
    </section>
  )
}

function PracticeScreen({
  pictureName,
  pictureTheme,
  overlaySrc,
  selectedDrawing,
  uploadedImage,
  initialSession,
  onSessionSaved,
  onSessionDeleted,
  onPicker,
  onCameraTrace,
  onUpload,
}: {
  pictureName: string
  pictureTheme: string
  overlaySrc: string
  selectedDrawing: Drawing
  uploadedImage: UploadedImageState | null
  initialSession: SavedPracticeSession | null
  onSessionSaved: (session: SavedPracticeSession) => void
  onSessionDeleted: (sessionId: string) => void
  onPicker: () => void
  onCameraTrace: () => void
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  const [strokes, setStrokes] = useState<PracticeStroke[]>(initialSession?.strokes ?? [])
  const [activePath, setActivePath] = useState('')
  const [activeStrokeRender, setActiveStrokeRender] = useState<PracticeStroke | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(initialSession?.sessionId ?? null)
  const [sessionCreatedAt, setSessionCreatedAt] = useState(initialSession?.createdAt ?? new Date().toISOString())
  const [sessionTitle, setSessionTitle] = useState(initialSession?.title ?? makePracticeSessionTitle(makePracticeSource(selectedDrawing, uploadedImage)))
  const [guideOpacity, setGuideOpacity] = useState(initialSession?.guideOpacity ?? 0.26)
  const [markerColor, setMarkerColor] = useState<string>(initialSession?.markerColor ?? markerColors[0])
  const [markerWidth, setMarkerWidth] = useState(initialSession?.markerWidth ?? 12)
  const [brushToolId, setBrushToolId] = useState<BrushToolId>(initialSession?.brushToolId ?? 'marker')
  const [guideOnTop, setGuideOnTop] = useState(initialSession?.guideOnTop ?? true)
  const [viewportLocked, setViewportLocked] = useState(true)
  const [viewport, setViewport] = useState<PracticeViewport>(defaultPracticeViewport)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<PracticeViewport>(defaultPracticeViewport)
  const activePathRef = useRef('')
  const activePointsRef = useRef<PracticePoint[]>([])
  const activePointCountRef = useRef(0)
  const activePathFrameRef = useRef<number | null>(null)
  const autosaveReadyRef = useRef(false)
  const lastSavedSignatureRef = useRef('')
  const activeStrokeStyleRef = useRef<PracticeStroke>({ path: '', color: markerColor, width: markerWidth, opacity: 0.9, mode: 'draw' })
  const lastPointRef = useRef<PracticePoint | null>(null)
  const drawingRef = useRef(false)
  const activePointersRef = useRef(new Map<number, PracticePoint>())
  const viewportGestureRef = useRef<
    | { mode: 'pan'; pointerId: number; startPoint: PracticePoint; startViewport: PracticeViewport }
    | { mode: 'pinch'; startDistance: number; startCenter: PracticePoint; startViewport: PracticeViewport }
    | null
  >(null)

  const brushTool = useMemo(() => brushTools.find((tool) => tool.id === brushToolId) ?? brushTools[1], [brushToolId])
  const activeStrokeWidth = (markerWidth * brushTool.widthMultiplier) / Math.max(viewport.scale, 1)
  const practiceSource = useMemo(() => makePracticeSource(selectedDrawing, uploadedImage), [selectedDrawing, uploadedImage])
  const sourceResetKey = JSON.stringify({
    sessionId: initialSession?.sessionId ?? 'fresh',
    kind: practiceSource.kind,
    drawingId: practiceSource.drawingId,
    drawingName: practiceSource.drawingName,
    drawingTheme: practiceSource.drawingTheme,
    imageId: practiceSource.uploadedImage?.imageId ?? '',
  })
  const practiceSourceRef = useRef(practiceSource)
  const topGuideOpacity = Math.max(guideOpacity, 0.48)

  useEffect(() => {
    practiceSourceRef.current = practiceSource
  }, [practiceSource])

  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  useEffect(() => {
    let cancelled = false
    autosaveReadyRef.current = false

    async function resetPracticeSession() {
      await Promise.resolve()
      if (cancelled) return

      activePathRef.current = ''
      activePointsRef.current = []
      activePointCountRef.current = 0
      lastPointRef.current = null
      drawingRef.current = false
      setActivePath('')
      setActiveStrokeRender(null)
      const nextStrokes = initialSession?.strokes ?? []
      const nextGuideOpacity = initialSession?.guideOpacity ?? 0.26
      const nextGuideOnTop = initialSession?.guideOnTop ?? true
      const nextMarkerColor = initialSession?.markerColor ?? markerColors[0]
      const nextMarkerWidth = initialSession?.markerWidth ?? 12
      const nextBrushToolId = initialSession?.brushToolId ?? 'marker'
      const resetPracticeSource = practiceSourceRef.current

      setStrokes(nextStrokes)
      setSessionId(initialSession?.sessionId ?? null)
      setSessionCreatedAt(initialSession?.createdAt ?? new Date().toISOString())
      setSessionTitle(initialSession?.title ?? makePracticeSessionTitle(resetPracticeSource))
      setGuideOpacity(nextGuideOpacity)
      setGuideOnTop(nextGuideOnTop)
      setMarkerColor(nextMarkerColor)
      setMarkerWidth(nextMarkerWidth)
      setBrushToolId(nextBrushToolId)
      lastSavedSignatureRef.current = makePracticeSaveSignature({
        source: resetPracticeSource,
        strokes: nextStrokes,
        guideOpacity: nextGuideOpacity,
        guideOnTop: nextGuideOnTop,
        markerColor: nextMarkerColor,
        markerWidth: nextMarkerWidth,
        brushToolId: nextBrushToolId,
      })
      autosaveReadyRef.current = true
    }

    void resetPracticeSession()

    return () => {
      cancelled = true
    }
  }, [initialSession, sourceResetKey])

  useEffect(() => {
    if (!autosaveReadyRef.current) return

    if (strokes.length === 0) {
      if (!sessionId) return
      const deleteTimeout = window.setTimeout(() => {
        try {
          deletePreviousWorkSession(sessionId)
          setSessionId(null)
          setSessionCreatedAt(new Date().toISOString())
          onSessionDeleted(sessionId)
        } catch {
          // Ignore storage failures; the visible drawing remains clear.
        }
      }, practiceAutosaveDelayMs)

      return () => window.clearTimeout(deleteTimeout)
    }

    const timeout = window.setTimeout(() => {
      const now = new Date().toISOString()
      const nextSessionId = sessionId ?? createPracticeSessionId()
      if (!sessionId) setSessionId(nextSessionId)

      const savedSession: SavedPracticeSession = {
        version: 2,
        sessionId: nextSessionId,
        title: sessionTitle,
        source: practiceSource,
        createdAt: sessionCreatedAt,
        updatedAt: now,
        strokes,
        guideOpacity,
        guideOnTop,
        markerColor,
        markerWidth,
        brushToolId,
      }

      const nextSignature = makePracticeSaveSignature(savedSession)
      if (nextSignature === lastSavedSignatureRef.current) return

      try {
        savePreviousWorkSession(savedSession)
        lastSavedSignatureRef.current = nextSignature
        onSessionSaved(savedSession)
      } catch {
        // Keep drawing usable if browser storage is unavailable or full.
      }
    }, practiceAutosaveDelayMs)

    return () => window.clearTimeout(timeout)
  }, [brushToolId, guideOnTop, guideOpacity, markerColor, markerWidth, onSessionDeleted, onSessionSaved, practiceSource, sessionCreatedAt, sessionId, sessionTitle, strokes])

  const committedStrokeLayers = useMemo(() => {
    const eraserStrokes = strokes.map((stroke, index) => ({ stroke, index })).filter(({ stroke }) => stroke.mode === 'erase')
    const drawGroups: Array<{ strokes: Array<{ stroke: PracticeStroke; index: number }>; endIndex: number }> = []
    let currentGroup: Array<{ stroke: PracticeStroke; index: number }> = []

    const flushDrawGroup = () => {
      if (currentGroup.length === 0) return
      drawGroups.push({ strokes: currentGroup, endIndex: currentGroup[currentGroup.length - 1].index })
      currentGroup = []
    }

    strokes.forEach((stroke, index) => {
      if (stroke.mode === 'erase') {
        flushDrawGroup()
        return
      }

      currentGroup.push({ stroke, index })
    })
    flushDrawGroup()

    const activeEraserStroke = activePath && activeStrokeRender?.mode === 'erase' ? { ...activeStrokeRender, path: activePath } : null
    const maskStrokesByGroup = drawGroups.map((group) => [
      ...eraserStrokes.filter(({ index }) => index > group.endIndex).map(({ stroke }) => stroke),
      ...(activeEraserStroke ? [activeEraserStroke] : []),
    ])

    return (
      <>
        {maskStrokesByGroup.some((maskStrokes) => maskStrokes.length > 0) && (
          <defs>
            {maskStrokesByGroup.map((maskStrokes, groupIndex) => maskStrokes.length > 0 && (
              <mask key={`mask-${groupIndex}`} id={`practice-ink-mask-${groupIndex}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">
                <rect x="0" y="0" width="1000" height="1000" fill="#ffffff" />
                {maskStrokes.map((stroke, maskIndex) => (
                  <path key={`mask-stroke-${groupIndex}-${maskIndex}`} d={stroke.path} stroke="#000000" strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                ))}
              </mask>
            ))}
          </defs>
        )}
        {drawGroups.map((group, groupIndex) => {
          const maskStrokes = maskStrokesByGroup[groupIndex]
          const groupPaths = group.strokes.map(({ stroke, index }) => (
            <path key={`stroke-${index}`} d={stroke.path} style={{ stroke: stroke.color, strokeWidth: stroke.width, opacity: stroke.opacity, strokeDasharray: stroke.dasharray }} />
          ))

          return maskStrokes.length > 0 ? (
            <g key={`draw-group-${groupIndex}`} mask={`url(#practice-ink-mask-${groupIndex})`}>
              {groupPaths}
            </g>
          ) : (
            <g key={`draw-group-${groupIndex}`}>{groupPaths}</g>
          )
        })}
      </>
    )
  }, [activePath, activeStrokeRender, strokes])

  const scheduleActivePathUpdate = useCallback(() => {
    if (activePathFrameRef.current !== null) return

    activePathFrameRef.current = window.requestAnimationFrame(() => {
      activePathFrameRef.current = null
      setActivePath(activePathRef.current)
    })
  }, [])

  const cancelActivePathUpdate = useCallback(() => {
    if (activePathFrameRef.current === null) return
    window.cancelAnimationFrame(activePathFrameRef.current)
    activePathFrameRef.current = null
  }, [])

  useEffect(() => () => cancelActivePathUpdate(), [cancelActivePathUpdate])

  const clampPracticeViewport = useCallback((next: PracticeViewport) => {
    const canvas = canvasRef.current
    const scale = clamp(next.scale, 1, 5)
    if (!canvas) return { x: 0, y: 0, scale }

    const rect = canvas.getBoundingClientRect()
    const extraX = Math.max(0, (scale - 1) * rect.width)
    const extraY = Math.max(0, (scale - 1) * rect.height)
    const overscroll = 120

    return {
      x: clamp(next.x, -extraX - overscroll, overscroll),
      y: clamp(next.y, -extraY - overscroll, overscroll),
      scale,
    }
  }, [])

  const updatePracticeViewport = useCallback((update: PracticeViewport | ((current: PracticeViewport) => PracticeViewport)) => {
    const next = typeof update === 'function' ? update(viewportRef.current) : update
    const clamped = clampPracticeViewport(next)
    viewportRef.current = clamped
    setViewport(clamped)
  }, [clampPracticeViewport])

  const pointFromEvent = useCallback((event: PointerEvent<HTMLDivElement>): PracticePoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    const currentViewport = viewportRef.current
    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top
    const contentX = (localX - currentViewport.x) / currentViewport.scale
    const contentY = (localY - currentViewport.y) / currentViewport.scale

    return {
      x: clamp((contentX / Math.max(rect.width, 1)) * 1000, 0, 1000),
      y: clamp((contentY / Math.max(rect.height, 1)) * 1000, 0, 1000),
    }
  }, [])

  const viewportPointerFromEvent = useCallback((event: PointerEvent<HTMLDivElement>): PracticePoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }, [])

  const pointerStats = useCallback(() => {
    const points = [...activePointersRef.current.values()]
    if (points.length < 2) return null

    const [first, second] = points
    return {
      distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
      center: {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
      },
    }
  }, [])

  const restartViewportGesture = useCallback(() => {
    const pointers = [...activePointersRef.current.entries()]
    if (pointers.length >= 2) {
      const stats = pointerStats()
      if (!stats) return
      viewportGestureRef.current = {
        mode: 'pinch',
        startDistance: stats.distance,
        startCenter: stats.center,
        startViewport: viewportRef.current,
      }
      return
    }

    if (pointers.length === 1) {
      const [pointerId, point] = pointers[0]
      viewportGestureRef.current = {
        mode: 'pan',
        pointerId,
        startPoint: point,
        startViewport: viewportRef.current,
      }
      return
    }

    viewportGestureRef.current = null
  }, [pointerStats])

  const finishStroke = useCallback(() => {
    if (!drawingRef.current) return

    const { color, width, opacity, mode, dasharray } = activeStrokeStyleRef.current
    const simplifiedPoints = simplifyPracticePoints(activePointsRef.current, clamp(width * 0.18, 1.25, 5))
    let path = pointsToSvgPath(simplifiedPoints)
    if (path && simplifiedPoints.length === 1) path = `${path} l 0.1 0`

    if (path) {
      setStrokes((current) => [...current, { path, color, width, opacity, mode, dasharray }])
    }

    cancelActivePathUpdate()
    activePathRef.current = ''
    activePointsRef.current = []
    activePointCountRef.current = 0
    lastPointRef.current = null
    drawingRef.current = false
    setActivePath('')
    setActiveStrokeRender(null)
  }, [cancelActivePathUpdate])

  const resetViewportGestureState = useCallback(() => {
    const canvas = canvasRef.current
    activePointersRef.current.forEach((_point, pointerId) => {
      try {
        if (canvas?.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId)
      } catch {
        // Pointer capture may already be gone when switching modes mid-gesture.
      }
    })
    activePointersRef.current.clear()
    viewportGestureRef.current = null
  }, [])

  const toggleViewportMode = useCallback(() => {
    finishStroke()
    resetViewportGestureState()
    setViewportLocked((locked) => !locked)
  }, [finishStroke, resetViewportGestureState])

  const onPracticePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)

    if (!viewportLocked) {
      activePointersRef.current.set(event.pointerId, viewportPointerFromEvent(event))
      restartViewportGesture()
      return
    }

    const point = pointFromEvent(event)
    const path = `M ${point.x} ${point.y}`
    activePathRef.current = path
    activePointCountRef.current = 1
    activePointsRef.current = [point]
    const strokeStyle: PracticeStroke = {
      path,
      color: brushTool.mode === 'erase' ? '#000000' : markerColor,
      width: activeStrokeWidth,
      opacity: brushTool.opacity,
      mode: brushTool.mode,
      dasharray: brushTool.dasharray,
    }
    activeStrokeStyleRef.current = strokeStyle
    setActiveStrokeRender(strokeStyle)
    lastPointRef.current = point
    drawingRef.current = true
    setActivePath(path)
  }

  const onPracticePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!viewportLocked) {
      if (!activePointersRef.current.has(event.pointerId)) return
      activePointersRef.current.set(event.pointerId, viewportPointerFromEvent(event))

      const gesture = viewportGestureRef.current
      if (!gesture) return

      if (activePointersRef.current.size >= 2) {
        const stats = pointerStats()
        if (!stats) return
        const pinchGesture = gesture.mode === 'pinch'
          ? gesture
          : {
              mode: 'pinch' as const,
              startDistance: stats.distance,
              startCenter: stats.center,
              startViewport: viewportRef.current,
            }
        if (gesture.mode !== 'pinch') viewportGestureRef.current = pinchGesture

        const nextScale = clamp(pinchGesture.startViewport.scale * (stats.distance / pinchGesture.startDistance), 1, 5)
        const contentAtStartCenterX = (pinchGesture.startCenter.x - pinchGesture.startViewport.x) / pinchGesture.startViewport.scale
        const contentAtStartCenterY = (pinchGesture.startCenter.y - pinchGesture.startViewport.y) / pinchGesture.startViewport.scale
        updatePracticeViewport({
          x: stats.center.x - contentAtStartCenterX * nextScale,
          y: stats.center.y - contentAtStartCenterY * nextScale,
          scale: nextScale,
        })
        return
      }

      if (gesture.mode !== 'pan') {
        restartViewportGesture()
        return
      }

      const currentPoint = activePointersRef.current.get(gesture.pointerId)
      if (!currentPoint) return
      updatePracticeViewport({
        x: gesture.startViewport.x + currentPoint.x - gesture.startPoint.x,
        y: gesture.startViewport.y + currentPoint.y - gesture.startPoint.y,
        scale: gesture.startViewport.scale,
      })
      return
    }

    if (!drawingRef.current) return
    const point = pointFromEvent(event)
    const lastPoint = lastPointRef.current
    const minPointDistance = clamp(activeStrokeStyleRef.current.width * 0.2, 1.25, 6)
    if (lastPoint && Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < minPointDistance) return

    activePointsRef.current.push(point)
    activePathRef.current = `${activePathRef.current} L ${point.x} ${point.y}`
    activePointCountRef.current += 1
    lastPointRef.current = point
    scheduleActivePathUpdate()
  }

  const onPracticePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!viewportLocked) {
      activePointersRef.current.delete(event.pointerId)
      restartViewportGesture()
    } else {
      finishStroke()
    }

    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer may already be released if the stroke was cancelled.
    }
  }

  const onPracticeWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (viewportLocked) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    const startViewport = viewportRef.current
    const nextScale = clamp(startViewport.scale * Math.exp(-event.deltaY * 0.0012), 1, 5)
    const contentX = (point.x - startViewport.x) / startViewport.scale
    const contentY = (point.y - startViewport.y) / startViewport.scale
    updatePracticeViewport({
      x: point.x - contentX * nextScale,
      y: point.y - contentY * nextScale,
      scale: nextScale,
    })
  }

  const clearPractice = () => {
    cancelActivePathUpdate()
    activePathRef.current = ''
    activePointsRef.current = []
    activePointCountRef.current = 0
    lastPointRef.current = null
    drawingRef.current = false
    setActivePath('')
    setActiveStrokeRender(null)
    setStrokes([])
    const deletedSessionId = sessionId
    setSessionId(null)
    setSessionCreatedAt(new Date().toISOString())
    if (deletedSessionId) {
      try {
        deletePreviousWorkSession(deletedSessionId)
        onSessionDeleted(deletedSessionId)
      } catch {
        // Ignore storage failures; the visible drawing has already been cleared.
      }
    }
  }

  const confirmClearPractice = () => {
    if (strokes.length === 0 && !activePath) return
    if (window.confirm('Clear all coloring saved in this work?')) clearPractice()
  }

  const resetPracticeViewport = () => {
    resetViewportGestureState()
    updatePracticeViewport(defaultPracticeViewport)
  }

  const zoomPractice = (amount: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const center = { x: rect.width / 2, y: rect.height / 2 }
    const startViewport = viewportRef.current
    const nextScale = clamp(startViewport.scale + amount, 1, 5)
    const contentX = (center.x - startViewport.x) / startViewport.scale
    const contentY = (center.y - startViewport.y) / startViewport.scale
    updatePracticeViewport({
      x: center.x - contentX * nextScale,
      y: center.y - contentY * nextScale,
      scale: nextScale,
    })
  }

  const activeStrokeStyle = {
    stroke: activeStrokeRender?.color,
    strokeWidth: activeStrokeRender?.width,
    opacity: activeStrokeRender?.opacity,
    strokeDasharray: activeStrokeRender?.dasharray,
  }

  return (
    <section className="practice-screen coloring-studio">
      <div className="practice-header">
        <div>
          <p className="eyebrow">On-screen coloring studio</p>
          <h1>{pictureName}</h1>
          <p>{pictureTheme} · Draw while locked. Unlock only when you want to move or zoom the page.</p>
        </div>
        <div className="trace-header-actions">
          <button className="secondary-button compact" type="button" onClick={onPicker}>Pictures</button>
          <button className="secondary-button compact" type="button" onClick={onCameraTrace}>Camera</button>
          <label className="secondary-button compact file-button">
            Upload
            <input type="file" accept="image/*" onChange={onUpload} />
          </label>
        </div>
      </div>

      <div className="practice-studio-shell">
        <div className="practice-toolbar-ribbon" aria-label="Coloring tools">
          <button className={viewportLocked ? 'studio-tool mode active' : 'studio-tool mode'} type="button" aria-pressed={viewportLocked} onClick={toggleViewportMode}>
            <span>{viewportLocked ? 'Locked' : 'Move'}</span>
            <small>{viewportLocked ? 'Draw mode' : 'Pan + zoom'}</small>
          </button>

          <div className="studio-tool-group color-tool" aria-label="Marker colors" role="group">
            <span>Color</span>
            <div className="compact-swatches">
              {markerColors.map((color) => (
                <button key={color} type="button" className={markerColor === color ? 'active' : ''} style={{ backgroundColor: color }} aria-label={`Use marker color ${color}`} aria-pressed={markerColor === color} onClick={() => setMarkerColor(color)} />
              ))}
            </div>
          </div>

          <div className="studio-tool-group" aria-label="Brush type" role="group">
            <span>Brush</span>
            <div className="compact-segmented brush-type-buttons">
              {brushTools.map((tool) => (
                <button key={tool.id} type="button" className={brushToolId === tool.id ? 'active' : ''} aria-pressed={brushToolId === tool.id} onClick={() => setBrushToolId(tool.id)}>{tool.label}</button>
              ))}
            </div>
          </div>

          <div className="studio-tool-group" aria-label="Brush size" role="group">
            <span>Size</span>
            <div className="compact-segmented size-buttons">
              {brushSizes.map((size) => (
                <button key={size.value} type="button" className={markerWidth === size.value ? 'active' : ''} aria-pressed={markerWidth === size.value} onClick={() => setMarkerWidth(size.value)}>{size.label}</button>
              ))}
            </div>
          </div>

          <div className="studio-tool-group guide-tool" aria-label="Guide visibility" role="group">
            <span>Guide {Math.round(guideOpacity * 100)}%</span>
            <div className="compact-stepper">
              <button type="button" aria-label="Make guide lighter" onClick={() => setGuideOpacity((current) => clamp(current - 0.05, 0.08, 0.72))}>Less</button>
              <button type="button" aria-label="Make guide darker" onClick={() => setGuideOpacity((current) => clamp(current + 0.05, 0.08, 0.72))}>More</button>
            </div>
          </div>

          <div className="studio-tool-group" aria-label="Outline layer" role="group">
            <span>Lines</span>
            <div className="compact-stepper">
              <button type="button" className={guideOnTop ? 'active' : ''} aria-pressed={guideOnTop} onClick={() => setGuideOnTop((current) => !current)}>{guideOnTop ? 'On top' : 'Behind'}</button>
            </div>
          </div>

          <div className="studio-tool-group zoom-tool" aria-label="Canvas zoom" role="group">
            <span>Zoom {Math.round(viewport.scale * 100)}%</span>
            <div className="compact-stepper">
              <button type="button" disabled={viewportLocked} aria-label="Zoom out" onClick={() => zoomPractice(-0.35)}>−</button>
              <button type="button" disabled={viewportLocked} aria-label="Zoom in" onClick={() => zoomPractice(0.35)}>+</button>
              <button type="button" disabled={viewport.scale === 1 && viewport.x === 0 && viewport.y === 0} onClick={resetPracticeViewport}>Reset</button>
            </div>
          </div>

          <div className="studio-tool-group action-tool" aria-label="Drawing actions" role="group">
            <span>Actions</span>
            <div className="compact-stepper">
              <button type="button" onClick={() => setStrokes((current) => current.slice(0, -1))} disabled={strokes.length === 0}>Undo</button>
              <button type="button" onClick={confirmClearPractice} disabled={strokes.length === 0 && !activePath}>Clear all</button>
            </div>
          </div>
        </div>

        <div className="practice-card studio-card">
          <div className="practice-status-strip">
            <span>{viewportLocked ? 'Draw mode: page is locked, lines stay visible, and coloring autosaves on this device.' : 'Move mode: drag to pan, pinch or scroll to zoom, then lock again to color.'}</span>
          </div>

          <div
            ref={canvasRef}
            className={viewportLocked ? 'practice-canvas locked' : 'practice-canvas unlocked'}
            onPointerDown={onPracticePointerDown}
            onPointerMove={onPracticePointerMove}
            onPointerUp={onPracticePointerUp}
            onPointerCancel={onPracticePointerUp}
            onWheel={onPracticeWheel}
          >
            <div className="practice-transform-layer" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}>
              <img className="practice-guide-image" src={overlaySrc} alt="Tracing guide" draggable={false} style={{ opacity: guideOpacity }} />
              <svg className="practice-ink" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
                {committedStrokeLayers}
                {activePath && activeStrokeRender?.mode === 'draw' && <path className="active" d={activePath} style={activeStrokeStyle} />}
              </svg>
              {guideOnTop && <img className="practice-guide-image on-top" src={overlaySrc} alt="" draggable={false} aria-hidden="true" style={{ opacity: topGuideOpacity }} />}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  disabled = false,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  disabled?: boolean
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  return (
    <label className="slider-control">
      <span>
        <strong>{label}</strong>
        <small>{format(value)}</small>
      </span>
      <input type="range" value={value} min={min} max={max} step={step} disabled={disabled} aria-valuetext={format(value)} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

function PencilIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 16.8 15.7 5.1a2.2 2.2 0 0 1 3.2 3.2L7.2 20 3.5 20.5 4 16.8Z" fill="#ff795d" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m14.4 6.4 3.2 3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ImageIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="m4.5 17 4.8-5.2 3.6 3.8 2.2-2.3L20 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16.5" cy="8.5" r="1.5" fill="currentColor" />
    </svg>
  )
}

function MoveIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m8 7 4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 10V7.8a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 14v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ArrowIcon({ direction, className }: IconProps & { direction: Direction }) {
  const iconClassName = ['arrow-icon', `arrow-icon--${direction}`, className].filter(Boolean).join(' ')

  return (
    <svg className={iconClassName} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m6.5 10.5 5.5-5.5 5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default App
