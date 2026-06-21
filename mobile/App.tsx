import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native'
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import * as MediaLibrary from 'expo-media-library'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, G, Mask, Path, Rect, SvgXml } from 'react-native-svg'
import { captureRef } from 'react-native-view-shot'

import { createTextDrawing, drawingCategories, drawings, sanitizeTraceText } from '@tracebuddy/shared'
import type { Drawing, DrawingFilterId } from '@tracebuddy/shared'

type ScreenMode = 'picker' | 'trace' | 'practice'
type TraceSurface = 'camera' | 'screen'
type PickerCategoryId = DrawingFilterId

type PracticePoint = {
  x: number
  y: number
}

type BrushToolId = 'pencil' | 'marker' | 'crayon' | 'paint' | 'eraser'
type PracticeStrokeMode = 'draw' | 'erase'
type PracticePanelId = 'tool' | 'size' | 'add' | 'view'

type BrushTool = {
  id: BrushToolId
  label: string
  widthMultiplier: number
  opacity: number
  mode: PracticeStrokeMode
  dasharray?: number[]
}

type PracticeStroke = {
  path: string
  color: string
  width: number
  opacity: number
  mode: PracticeStrokeMode
  dasharray?: number[]
}

type PracticeSticker = {
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

type PracticeSource = {
  kind: 'drawing' | 'custom' | 'upload'
  drawingId: string
  drawingName: string
  drawingTheme: string
  drawingSvg?: string
  uploadedImage?: UploadedImage
}

type SavedPracticeSession = {
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

type PracticeViewport = {
  x: number
  y: number
  scale: number
}

type OverlayTransform = {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
}

type UploadedImage = {
  uri: string
  name: string
  width?: number
  height?: number
}

const defaultTransform: OverlayTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 0.72,
}

const markerColors = ['#18243A', '#4A5568', '#FF795D', '#FF4FA3', '#F7A8C8', '#D946EF', '#E45336', '#F2994A', '#F2C94C', '#219653', '#27AE60', '#2F80ED', '#56CCF2', '#9B51E0', '#EB5757', '#8B5E3C'] as const

const brushTools: BrushTool[] = [
  { id: 'pencil', label: 'Pencil', widthMultiplier: 0.62, opacity: 0.72, mode: 'draw' },
  { id: 'marker', label: 'Marker', widthMultiplier: 1, opacity: 0.9, mode: 'draw' },
  { id: 'crayon', label: 'Crayon', widthMultiplier: 1.35, opacity: 0.62, mode: 'draw', dasharray: [1, 5] },
  { id: 'paint', label: 'Paint', widthMultiplier: 2.05, opacity: 0.42, mode: 'draw' },
  { id: 'eraser', label: 'Eraser', widthMultiplier: 2.2, opacity: 1, mode: 'erase' },
]

const brushSizes = [
  { label: 'Fine', value: 5 },
  { label: 'Round', value: 9 },
  { label: 'Fill', value: 16 },
] as const

const practiceStickerShapes = [
  {
    id: 'heart',
    label: 'Heart',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 84C29 68 15 55 15 37c0-12 8-21 19-21 7 0 13 4 16 10 3-6 9-10 16-10 11 0 19 9 19 21 0 18-14 31-35 47Z" fill="#F7A8C8" stroke="#18243A" stroke-width="5" stroke-linejoin="round"/></svg>',
  },
  {
    id: 'star',
    label: 'Star',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="m50 10 11 26 28 3-21 18 6 28-24-15-24 15 6-28-21-18 28-3 11-26Z" fill="#F2C94C" stroke="#18243A" stroke-width="5" stroke-linejoin="round"/></svg>',
  },
  {
    id: 'flower',
    label: 'Flower',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="#FFB6D9" stroke="#18243A" stroke-width="4" stroke-linejoin="round"><ellipse cx="50" cy="23" rx="13" ry="18"/><ellipse cx="77" cy="50" rx="18" ry="13"/><ellipse cx="50" cy="77" rx="13" ry="18"/><ellipse cx="23" cy="50" rx="18" ry="13"/></g><circle cx="50" cy="50" r="15" fill="#F2C94C" stroke="#18243A" stroke-width="4"/></svg>',
  },
  {
    id: 'rainbow',
    label: 'Rainbow',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M14 72a36 36 0 0 1 72 0" fill="none" stroke="#FF4FA3" stroke-width="12" stroke-linecap="round"/><path d="M27 72a23 23 0 0 1 46 0" fill="none" stroke="#F2C94C" stroke-width="12" stroke-linecap="round"/><path d="M40 72a10 10 0 0 1 20 0" fill="none" stroke="#56CCF2" stroke-width="12" stroke-linecap="round"/><path d="M10 72h80" stroke="#18243A" stroke-width="5" stroke-linecap="round"/></svg>',
  },
  {
    id: 'cloud',
    label: 'Cloud',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M28 72h43c11 0 19-7 19-17s-8-18-19-18h-2C66 26 56 18 44 18c-15 0-27 12-27 27v1C8 49 3 56 3 64c0 10 9 18 25 18Z" fill="#CFE8F7" stroke="#18243A" stroke-width="5" stroke-linejoin="round"/></svg>',
  },
  {
    id: 'sparkle',
    label: 'Sparkle',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 8 61 38 92 50 61 62 50 92 39 62 8 50 39 38 50 8Z" fill="#DDF4E7" stroke="#18243A" stroke-width="5" stroke-linejoin="round"/><path d="M76 12v16M68 20h16M22 72v14M15 79h14" stroke="#FF4FA3" stroke-width="5" stroke-linecap="round"/></svg>',
  },
] as const

const defaultPracticeViewport: PracticeViewport = { x: 0, y: 0, scale: 1 }
const previousWorkIndexKey = 'tracebuddy.previousWork.v1.index'
const previousWorkSessionPrefix = 'tracebuddy.previousWork.v1.session.'
const legacyPracticeAutosavePrefix = 'tracebuddy.practice.v1.'
const uploadedWorkDirectory = `${FileSystem.documentDirectory ?? ''}tracebuddy-uploads/`
const practiceAutosaveDelayMs = 450

const palette = {
  ink: '#18243A',
  muted: '#667085',
  paper: '#FFF7EA',
  paperStrong: '#FFF1DC',
  surface: '#FFFFFF',
  coral: '#FF795D',
  coralDark: '#A44632',
  sky: '#CFE8F7',
  mint: '#DDF4E7',
  border: 'rgba(24, 36, 58, 0.12)',
  camera: '#101927',
}

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
    width: clamp(stroke.width, 0.5, 80),
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

function createPracticeSessionId() {
  return `work-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function makePracticeSource(drawing: Drawing, uploadedImage: UploadedImage | null): PracticeSource {
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
    drawingSvg: isCustom ? drawing.svg : undefined,
  }
}

function drawingFromPracticeSource(source: PracticeSource) {
  const libraryDrawing = drawings.find((drawing) => drawing.id === source.drawingId)
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

function makePracticeSessionTitle(source: PracticeSource) {
  return source.kind === 'custom' ? `${source.drawingName} practice` : source.drawingName
}

function previousWorkSessionKey(sessionId: string) {
  return `${previousWorkSessionPrefix}${sessionId}`
}

function makePracticeSaveSignature(session: Pick<SavedPracticeSession, 'source' | 'strokes' | 'stickers' | 'canvasWidth' | 'canvasHeight' | 'guideOpacity' | 'guideOnTop' | 'markerColor' | 'markerWidth' | 'brushToolId'>) {
  return JSON.stringify(session)
}

function legacyPracticeSessionId(storageKey: string) {
  const suffix = storageKey.slice(legacyPracticeAutosavePrefix.length).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150) || createPracticeSessionId()
  return `legacy-${suffix}`
}

function isLegacyUploadAutosaveKey(storageKey: string) {
  return storageKey.slice(legacyPracticeAutosavePrefix.length).startsWith('uploaded_')
}

function scaleLegacyPracticePath(path: string, scaleX: number, scaleY: number) {
  let coordinateIndex = 0
  return path.replace(/-?\d+(?:\.\d+)?/g, (match) => {
    const value = Number(match)
    if (!Number.isFinite(value)) return match
    const scaled = value * (coordinateIndex % 2 === 0 ? scaleX : scaleY)
    coordinateIndex += 1
    return String(Math.round(scaled * 100) / 100)
  })
}

function scaleLegacyPracticeStroke(stroke: PracticeStroke, scaleX: number, scaleY: number): PracticeStroke {
  return {
    ...stroke,
    path: scaleLegacyPracticePath(stroke.path, scaleX, scaleY),
    width: clamp(stroke.width * Math.min(scaleX, scaleY), 0.5, 80),
  }
}

function legacyPracticeSource(drawingId: string, drawingName: string, storageKey: string): PracticeSource {
  const libraryDrawing = !isLegacyUploadAutosaveKey(storageKey) ? drawings.find((drawing) => drawing.id === drawingId) : null
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

function normalizeLegacyPracticeAutosave(value: unknown, storageKey: string, legacyCanvasSize: { width: number; height: number }): SavedPracticeSession | null {
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
    guideOpacity: typeof session.guideOpacity === 'number' ? clamp(session.guideOpacity, 0.08, 0.66) : 0.24,
    guideOnTop: typeof session.guideOnTop === 'boolean' ? session.guideOnTop : true,
    markerColor: typeof session.markerColor === 'string' ? session.markerColor : markerColors[0],
    markerWidth: typeof session.markerWidth === 'number' ? session.markerWidth : 9,
    brushToolId: typeof session.brushToolId === 'string' && brushTools.some((tool) => tool.id === session.brushToolId) ? session.brushToolId as BrushToolId : 'marker',
  }
}

async function migrateLegacyPracticeAutosaves(legacyCanvasSize: { width: number; height: number }) {
  const keys = await AsyncStorage.getAllKeys()
  const legacyKeys = keys.filter((key) => key.startsWith(legacyPracticeAutosavePrefix))

  for (const key of legacyKeys) {
    try {
      const rawSession = await AsyncStorage.getItem(key)
      const migratedSession = rawSession ? normalizeLegacyPracticeAutosave(JSON.parse(rawSession), key, legacyCanvasSize) : null
      if (!migratedSession) continue

      await savePreviousWorkSession(migratedSession)
      await AsyncStorage.removeItem(key)
    } catch {
      // Leave the legacy autosave in place if migration cannot complete.
    }
  }
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

function normalizeSavedPracticeSession(value: unknown): SavedPracticeSession | null {
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
    markerColor: typeof session.markerColor === 'string' ? session.markerColor : markerColors[0],
    markerWidth: typeof session.markerWidth === 'number' ? session.markerWidth : 9,
    brushToolId: session.brushToolId && brushTools.some((tool) => tool.id === session.brushToolId) ? session.brushToolId : 'marker',
  }
}

async function readPreviousWorkIds() {
  try {
    const rawIndex = await AsyncStorage.getItem(previousWorkIndexKey)
    if (!rawIndex) return []
    const parsed = JSON.parse(rawIndex) as { ids?: unknown }
    return Array.isArray(parsed.ids) ? parsed.ids.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

async function loadPreviousWorkSessions() {
  const ids = await readPreviousWorkIds()
  if (ids.length === 0) return []

  const entries = await AsyncStorage.multiGet(ids.map(previousWorkSessionKey))
  const sessions = entries
    .map(([, rawSession]) => {
      if (!rawSession) return null
      try {
        return normalizeSavedPracticeSession(JSON.parse(rawSession))
      } catch {
        return null
      }
    })
    .filter((session): session is SavedPracticeSession => Boolean(session))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))

  const validIds = sessions.map((session) => session.sessionId)
  if (validIds.length !== ids.length || validIds.some((id, index) => id !== ids[index])) {
    await AsyncStorage.setItem(previousWorkIndexKey, JSON.stringify({ version: 1, ids: validIds })).catch(() => undefined)
  }

  return sessions
}

async function loadPreviousWorkSessionsWithLegacyMigration(legacyCanvasSize: { width: number; height: number }) {
  await migrateLegacyPracticeAutosaves(legacyCanvasSize)
  return loadPreviousWorkSessions()
}

let previousWorkWriteQueue = Promise.resolve()

function queuePreviousWorkWrite<T>(operation: () => Promise<T>) {
  const result = previousWorkWriteQueue.then(operation, operation)
  previousWorkWriteQueue = result.then(() => undefined, () => undefined)
  return result
}

async function savePreviousWorkSession(session: SavedPracticeSession) {
  return queuePreviousWorkWrite(async () => {
    const currentIds = await readPreviousWorkIds()
    const ids = [session.sessionId, ...currentIds.filter((id) => id !== session.sessionId)]
    await AsyncStorage.multiSet([
      [previousWorkSessionKey(session.sessionId), JSON.stringify(session)],
      [previousWorkIndexKey, JSON.stringify({ version: 1, ids })],
    ])
  })
}

function isStoredUploadedImageUri(uri?: string) {
  return Boolean(uri && uploadedWorkDirectory && uri.startsWith(uploadedWorkDirectory))
}

function storedUploadedImageUrisFromStickers(stickers: PracticeSticker[]) {
  return stickers
    .filter((sticker) => sticker.kind === 'image')
    .map((sticker) => sticker.uri)
    .filter((uri): uri is string => Boolean(uri && isStoredUploadedImageUri(uri)))
}

function storedUploadedImageUrisFromSession(session: SavedPracticeSession | null) {
  if (!session) return []
  const uris = [session.source.uploadedImage?.uri, ...storedUploadedImageUrisFromStickers(session.stickers)]
  return uris.filter((uri): uri is string => Boolean(uri && isStoredUploadedImageUri(uri)))
}

async function cleanupStoredImageUrisIfUnused(candidateUris: string[], sessionIds?: string[]) {
  const storedUris = Array.from(new Set(candidateUris.filter(isStoredUploadedImageUri)))
  if (storedUris.length === 0) return

  const ids = sessionIds ?? await readPreviousWorkIds()
  const entries = await AsyncStorage.multiGet(ids.map(previousWorkSessionKey))
  const referencedUris = new Set<string>()
  entries.forEach(([, rawSession]) => {
    if (!rawSession) return
    try {
      storedUploadedImageUrisFromSession(normalizeSavedPracticeSession(JSON.parse(rawSession))).forEach((uri) => referencedUris.add(uri))
    } catch {
      // Ignore malformed sessions during best-effort file cleanup.
    }
  })

  await Promise.all(storedUris.filter((uri) => !referencedUris.has(uri)).map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)))
}

async function cleanupUploadedImageIfUnused(deletedSession: SavedPracticeSession | null, remainingIds: string[]) {
  await cleanupStoredImageUrisIfUnused(storedUploadedImageUrisFromSession(deletedSession), remainingIds)
}

async function deletePreviousWorkSession(sessionId: string) {
  return queuePreviousWorkWrite(async () => {
    const currentIds = await readPreviousWorkIds()
    const rawDeletedSession = await AsyncStorage.getItem(previousWorkSessionKey(sessionId)).catch(() => null)
    const deletedSession = (() => {
      try {
        return rawDeletedSession ? normalizeSavedPracticeSession(JSON.parse(rawDeletedSession)) : null
      } catch {
        return null
      }
    })()
    const ids = currentIds.filter((id) => id !== sessionId)
    await AsyncStorage.multiRemove([previousWorkSessionKey(sessionId)])
    await AsyncStorage.setItem(previousWorkIndexKey, JSON.stringify({ version: 1, ids }))
    await cleanupUploadedImageIfUnused(deletedSession, ids)
  })
}

function uploadedImageExtension(value?: string) {
  if (!value) return null
  const cleanValue = value.split(/[?#]/)[0]
  const rawFileName = cleanValue.split('/').pop() ?? ''
  const fileName = (() => {
    try {
      return decodeURIComponent(rawFileName)
    } catch {
      return rawFileName
    }
  })()
  const extension = /[^/.]\.([a-zA-Z0-9]{1,8})$/.exec(fileName)?.[1]?.toLowerCase()
  return extension ?? null
}

function uploadedImageFileName(sourceUri: string, fallbackName?: string) {
  const extension = uploadedImageExtension(fallbackName) ?? uploadedImageExtension(sourceUri) ?? 'jpg'
  return `${createPracticeSessionId()}.${extension}`
}

async function persistUploadedImage(sourceUri: string, fallbackName?: string) {
  if (!FileSystem.documentDirectory) return null
  if (sourceUri.startsWith(uploadedWorkDirectory)) return sourceUri

  try {
    await FileSystem.makeDirectoryAsync(uploadedWorkDirectory, { intermediates: true })
    const destinationUri = `${uploadedWorkDirectory}${uploadedImageFileName(sourceUri, fallbackName)}`
    await FileSystem.copyAsync({ from: sourceUri, to: destinationUri })
    return destinationUri
  } catch {
    return null
  }
}

function TraceBuddyMobile() {
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [permission, requestPermission] = useCameraPermissions()
  const [mode, setMode] = useState<ScreenMode>('picker')
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing>(drawings[0])
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null)
  const [activeCategory, setActiveCategory] = useState<PickerCategoryId>('all')
  const [traceSurface, setTraceSurface] = useState<TraceSurface>('camera')
  const [customText, setCustomText] = useState('')
  const [previousWorkSessions, setPreviousWorkSessions] = useState<SavedPracticeSession[]>([])
  const [activePracticeSession, setActivePracticeSession] = useState<SavedPracticeSession | null>(null)
  const [transform, setTransform] = useState<OverlayTransform>(defaultTransform)
  const [overlayLocked, setOverlayLocked] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(true)
  const [isPickingImage, setIsPickingImage] = useState(false)
  const cameraPromptedRef = useRef(false)
  const overlayLockedRef = useRef(false)
  const overlayDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: defaultTransform.x, y: defaultTransform.y, pageX: 0, pageY: 0 })
  const transformRef = useRef(defaultTransform)
  const legacyMigrationCompleteRef = useRef(false)
  const legacyMigrationCanvasSizeRef = useRef({
    width: Math.max(1, width - 20),
    height: Math.max(430, height - 280),
  })

  const refreshPreviousWork = useCallback(() => {
    const loadTask = legacyMigrationCompleteRef.current
      ? loadPreviousWorkSessions()
      : loadPreviousWorkSessionsWithLegacyMigration(legacyMigrationCanvasSizeRef.current).then((sessions) => {
          legacyMigrationCompleteRef.current = true
          return sessions
        })

    void loadTask.then(setPreviousWorkSessions).catch(() => setPreviousWorkSessions([]))
  }, [])

  useEffect(() => {
    refreshPreviousWork()
  }, [refreshPreviousWork])

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

  const pictureName = uploadedImage?.name ?? selectedDrawing.name
  const pictureTheme = uploadedImage ? 'Local image' : selectedDrawing.theme
  const overlayBaseSize = Math.min(width * 0.78, height * 0.44, 430)
  const uploadedAspect = uploadedImage?.width && uploadedImage.height ? uploadedImage.width / uploadedImage.height : 1
  const overlayWidth = uploadedImage ? overlayBaseSize * clamp(uploadedAspect, 0.65, 1.35) : overlayBaseSize
  const overlayHeight = uploadedImage ? overlayBaseSize / clamp(uploadedAspect, 0.65, 1.35) : overlayBaseSize

  const setOverlayTransform = useCallback((update: OverlayTransform | ((current: OverlayTransform) => OverlayTransform)) => {
    const next = typeof update === 'function' ? update(transformRef.current) : update
    transformRef.current = next
    setTransform(next)
  }, [])

  useEffect(() => {
    overlayLockedRef.current = overlayLocked
  }, [overlayLocked])

  useEffect(() => {
    if (mode !== 'trace' && mode !== 'practice') return undefined

    activateKeepAwakeAsync('tracebuddy-trace').catch(() => {
      // Keep awake is a convenience, not a blocker for tracing.
    })

    return () => {
      deactivateKeepAwake('tracebuddy-trace')
    }
  }, [mode])

  useEffect(() => {
    if (mode !== 'trace' || permission?.granted || cameraPromptedRef.current) return
    cameraPromptedRef.current = true
    requestPermission().catch(() => {
      // The trace screen renders a retry action if permission fails.
    })
  }, [mode, permission?.granted, requestPermission])

  const resetOverlay = useCallback(() => {
    dragStartRef.current = { x: defaultTransform.x, y: defaultTransform.y, pageX: 0, pageY: 0 }
    transformRef.current = defaultTransform
    setOverlayTransform(defaultTransform)
    setOverlayLocked(false)
  }, [setOverlayTransform])

  const openTraceWithDrawing = useCallback((drawing: Drawing) => {
    setSelectedDrawing(drawing)
    setUploadedImage(null)
    setActivePracticeSession(null)
    setMode(traceSurface === 'screen' ? 'practice' : 'trace')
    setControlsOpen(true)
    resetOverlay()
  }, [resetOverlay, traceSurface])

  const openTraceWithCustomText = useCallback(() => {
    const safeText = sanitizeTraceText(customText)
    if (!safeText) {
      Alert.alert('Add words to trace', 'Type a name, word, number, or short phrase first.')
      return
    }

    openTraceWithDrawing(createTextDrawing(safeText))
  }, [customText, openTraceWithDrawing])

  const pickLocalImage = useCallback(async () => {
    try {
      setIsPickingImage(true)
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Photo permission needed', 'Allow photo access to choose a local image for tracing.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsMultipleSelection: false,
      })

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0]
        const persistedUri = await persistUploadedImage(asset.uri, asset.fileName ?? 'local-image.jpg')
        if (!persistedUri) {
          Alert.alert('Could not save image', 'TraceBuddy could not copy this image into local app storage. Try choosing it again or use a built-in template.')
          return
        }

        setUploadedImage({
          uri: persistedUri,
          name: asset.fileName ?? 'Local image',
          width: asset.width,
          height: asset.height,
        })
        setActivePracticeSession(null)
        setMode(traceSurface === 'screen' ? 'practice' : 'trace')
        setControlsOpen(true)
        resetOverlay()
      }
    } catch {
      Alert.alert('Could not open photos', 'Try again or choose a built-in tracing template.')
    } finally {
      setIsPickingImage(false)
    }
  }, [resetOverlay, traceSurface])

  const adjustOpacity = useCallback((delta: number) => {
    setOverlayTransform((current) => ({ ...current, opacity: clamp(current.opacity + delta, 0.18, 1) }))
  }, [setOverlayTransform])

  const adjustScale = useCallback((delta: number) => {
    setOverlayTransform((current) => ({ ...current, scale: clamp(current.scale + delta, 0.42, 2.2) }))
  }, [setOverlayTransform])

  const adjustRotation = useCallback((delta: number) => {
    setOverlayTransform((current) => ({ ...current, rotation: current.rotation + delta }))
  }, [setOverlayTransform])

  const decreaseOpacity = useCallback(() => adjustOpacity(-0.08), [adjustOpacity])
  const increaseOpacity = useCallback(() => adjustOpacity(0.08), [adjustOpacity])
  const decreaseScale = useCallback(() => adjustScale(-0.08), [adjustScale])
  const increaseScale = useCallback(() => adjustScale(0.08), [adjustScale])
  const rotateLeft = useCallback(() => adjustRotation(-5), [adjustRotation])
  const rotateRight = useCallback(() => adjustRotation(5), [adjustRotation])

  const nudgeOverlay = useCallback((x: number, y: number) => {
    setOverlayTransform((current) => ({ ...current, x: current.x + x, y: current.y + y }))
  }, [setOverlayTransform])

  const nudgeUp = useCallback(() => nudgeOverlay(0, -8), [nudgeOverlay])
  const nudgeLeft = useCallback(() => nudgeOverlay(-8, 0), [nudgeOverlay])
  const nudgeDown = useCallback(() => nudgeOverlay(0, 8), [nudgeOverlay])
  const nudgeRight = useCallback(() => nudgeOverlay(8, 0), [nudgeOverlay])

  const openCameraTrace = useCallback(() => {
    setTraceSurface('camera')
    setActivePracticeSession(null)
    setMode('trace')
    setControlsOpen(true)
    resetOverlay()
  }, [resetOverlay])

  const openScreenPractice = useCallback(() => {
    setTraceSurface('screen')
    setActivePracticeSession(null)
    setMode('practice')
  }, [])

  const shouldStartOverlayDrag = useCallback(() => !overlayLockedRef.current, [])

  const startOverlayDrag = useCallback((event: GestureResponderEvent) => {
    if (overlayLockedRef.current) return
    overlayDraggingRef.current = true
    dragStartRef.current = {
      x: transformRef.current.x,
      y: transformRef.current.y,
      pageX: event.nativeEvent.pageX,
      pageY: event.nativeEvent.pageY,
    }
  }, [])

  const moveOverlayDrag = useCallback((event: GestureResponderEvent) => {
    if (!overlayDraggingRef.current || overlayLockedRef.current) return
    const nextX = dragStartRef.current.x + event.nativeEvent.pageX - dragStartRef.current.pageX
    const nextY = dragStartRef.current.y + event.nativeEvent.pageY - dragStartRef.current.pageY
    setOverlayTransform((current) => ({ ...current, x: nextX, y: nextY }))
  }, [setOverlayTransform])

  const endOverlayDrag = useCallback(() => {
    overlayDraggingRef.current = false
  }, [])

  const applyPracticeSource = useCallback((source: PracticeSource) => {
    const { drawing, uploadedImage: savedUploadedImage } = drawingFromPracticeSource(source)
    setSelectedDrawing(drawing)
    setUploadedImage(savedUploadedImage)
    setTraceSurface('screen')
    resetOverlay()
  }, [resetOverlay])

  const openPreviousWorkSession = useCallback((session: SavedPracticeSession) => {
    applyPracticeSource(session.source)
    setActivePracticeSession(session)
    setMode('practice')
  }, [applyPracticeSource])

  const startFreshFromPreviousWork = useCallback((session: SavedPracticeSession) => {
    applyPracticeSource(session.source)
    setActivePracticeSession(null)
    setMode('practice')
  }, [applyPracticeSource])

  const duplicatePreviousWorkSession = useCallback((session: SavedPracticeSession) => {
    const now = new Date().toISOString()
    const copiedSession: SavedPracticeSession = {
      ...session,
      sessionId: createPracticeSessionId(),
      title: `${session.title} copy`,
      createdAt: now,
      updatedAt: now,
      strokes: session.strokes.map((stroke) => ({ ...stroke, dasharray: stroke.dasharray ? [...stroke.dasharray] : undefined })),
      stickers: session.stickers.map((sticker) => ({ ...sticker })),
    }

    void savePreviousWorkSession(copiedSession)
      .then(() => setPreviousWorkSessions((current) => [copiedSession, ...current.filter((item) => item.sessionId !== copiedSession.sessionId)]))
      .catch(() => Alert.alert('Could not duplicate work', 'Try again in a moment.'))
  }, [])

  const deletePreviousWork = useCallback((session: SavedPracticeSession) => {
    Alert.alert('Delete previous work?', `Remove ${session.title} from this phone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deletePreviousWorkSession(session.sessionId)
            .then(() => {
              setPreviousWorkSessions((current) => current.filter((item) => item.sessionId !== session.sessionId))
              if (activePracticeSession?.sessionId === session.sessionId) setActivePracticeSession(null)
            })
            .catch(() => Alert.alert('Could not delete work', 'Try again in a moment.'))
        },
      },
    ])
  }, [activePracticeSession?.sessionId])

  const handlePracticeSessionSaved = useCallback((session: SavedPracticeSession) => {
    setPreviousWorkSessions((current) => [session, ...current.filter((item) => item.sessionId !== session.sessionId)])
  }, [])

  const handlePracticeSessionDeleted = useCallback((sessionId: string) => {
    setActivePracticeSession(null)
    setPreviousWorkSessions((current) => current.filter((item) => item.sessionId !== sessionId))
  }, [])

  if (mode === 'picker') {
    return (
      <View style={styles.appShell}>
        <StatusBar style="dark" />
        <FlatList
          data={visibleDrawings}
          numColumns={2}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.cardRow}
          contentContainerStyle={[styles.pickerContent, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 32 }]}
          ListHeaderComponent={(
            <View>
              <View style={styles.heroCard}>
                <View style={styles.heroBadgeRow}>
                  <View style={styles.brandMark}>
                    <TraceIcon />
                  </View>
                  <Text style={styles.eyebrow}>TraceBuddy mobile</Text>
                </View>
                <Text style={styles.heroTitle}>Pick a picture, then trace your way.</Text>
                <Text style={styles.heroCopy}>Use the camera for paper tracing, or practice directly on the screen with your finger or stylus. Everything stays local on this phone.</Text>
                <View style={styles.traceSurfaceSwitch} accessibilityLabel="Tracing mode">
                  <Pressable
                    style={[styles.traceSurfaceOption, traceSurface === 'camera' && styles.traceSurfaceOptionActive]}
                    onPress={() => setTraceSurface('camera')}
                    accessibilityRole="button"
                    accessibilityState={{ selected: traceSurface === 'camera' }}
                  >
                    <Text style={[styles.traceSurfaceTitle, traceSurface === 'camera' && styles.traceSurfaceTitleActive]}>Camera + paper</Text>
                    <Text style={[styles.traceSurfaceCopy, traceSurface === 'camera' && styles.traceSurfaceCopyActive]}>Overlay above real paper.</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.traceSurfaceOption, traceSurface === 'screen' && styles.traceSurfaceOptionActive]}
                    onPress={() => setTraceSurface('screen')}
                    accessibilityRole="button"
                    accessibilityState={{ selected: traceSurface === 'screen' }}
                  >
                    <Text style={[styles.traceSurfaceTitle, traceSurface === 'screen' && styles.traceSurfaceTitleActive]}>On-screen practice</Text>
                    <Text style={[styles.traceSurfaceCopy, traceSurface === 'screen' && styles.traceSurfaceCopyActive]}>Trace with finger or stylus.</Text>
                  </Pressable>
                </View>
                <View style={styles.customTextCard}>
                  <View style={styles.customTextCopy}>
                    <Text style={styles.customTextTitle}>Write your own words</Text>
                    <Text style={styles.customTextSmall}>Names, ABCs, numbers, or short phrases.</Text>
                  </View>
                  <TextInput
                    value={customText}
                    onChangeText={setCustomText}
                    placeholder="Stassie, ABC, I love Guam"
                    placeholderTextColor="#8A94A6"
                    style={styles.customTextInput}
                    returnKeyType="done"
                    maxLength={48}
                  />
                  <Pressable style={styles.customTextButton} onPress={openTraceWithCustomText} accessibilityRole="button">
                    <Text style={styles.customTextButtonText}>Trace words</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.uploadPill} onPress={pickLocalImage} disabled={isPickingImage} accessibilityRole="button" accessibilityLabel="Upload a local photo or drawing">
                  <ImageIcon />
                  <View style={styles.uploadCopy}>
                    <Text style={styles.uploadTitle}>{isPickingImage ? 'Opening photos' : 'Upload your own'}</Text>
                    <Text style={styles.uploadSmall}>Local photo or drawing</Text>
                  </View>
                </Pressable>
              </View>

              <PreviousWorkSection
                sessions={previousWorkSessions}
                onResume={openPreviousWorkSession}
                onStartFresh={startFreshFromPreviousWork}
                onDuplicate={duplicatePreviousWorkSession}
                onDelete={deletePreviousWork}
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryStrip}>
                {drawingCategories.map((category) => {
                  const active = activeCategory === category.id
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => setActiveCategory(category.id)}
                      style={[styles.categoryChip, active && styles.categoryChipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${category.label}, ${categoryCounts[category.id] ?? 0} templates`}
                    >
                      <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{category.label}</Text>
                      <View style={[styles.categoryCount, active && styles.categoryCountActive]}>
                        <Text style={styles.categoryCountText}>{categoryCounts[category.id] ?? 0}</Text>
                      </View>
                    </Pressable>
                  )
                })}
              </ScrollView>

              <Text style={styles.templateCount}>Showing {visibleDrawings.length} {visibleDrawings.length === 1 ? 'template' : 'templates'}.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.drawingCard, selectedDrawing.id === item.id && !uploadedImage && styles.drawingCardSelected]}
              onPress={() => openTraceWithDrawing(item)}
              accessibilityRole="button"
              accessibilityLabel={`Trace ${item.name}. ${item.difficulty} difficulty. ${item.theme}.`}
            >
              <View style={styles.drawingPreview}>
                <SvgXml xml={item.svg} width="100%" height="100%" />
              </View>
              <View style={styles.drawingMeta}>
                <Text style={styles.drawingName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.drawingTheme} numberOfLines={1}>{item.theme}</Text>
              </View>
              <Text style={styles.difficultyBadge}>{item.difficulty}</Text>
            </Pressable>
          )}
        />
      </View>
    )
  }

  if (mode === 'practice') {
    return (
      <PracticeScreen
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        pictureName={pictureName}
        pictureTheme={pictureTheme}
        selectedDrawing={selectedDrawing}
        uploadedImage={uploadedImage}
        initialSession={activePracticeSession}
        onSessionSaved={handlePracticeSessionSaved}
        onSessionDeleted={handlePracticeSessionDeleted}
        onPicker={() => setMode('picker')}
        onCameraTrace={openCameraTrace}
      />
    )
  }

  const cameraReady = Boolean(permission?.granted)

  return (
    <View style={styles.traceShell}>
      <StatusBar style="light" />
      {cameraReady ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" autofocus="on" />
      ) : (
        <View style={styles.cameraFallback}>
          <View style={styles.fakePaper} />
          <Text style={styles.cameraFallbackTitle}>Camera permission needed</Text>
          <Text style={styles.cameraFallbackCopy}>TraceBuddy uses the camera only to show your paper under the overlay.</Text>
          <Pressable style={styles.cameraRetryButton} onPress={() => requestPermission()} accessibilityRole="button">
            <Text style={styles.cameraRetryText}>Start camera</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.traceHeader, styles.pointerBoxNone, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.headerButton} onPress={() => setMode('picker')} accessibilityRole="button" accessibilityLabel="Back to picture picker">
          <BackIcon />
          <Text style={styles.headerButtonText}>Picker</Text>
        </Pressable>
        <View style={styles.traceTitleCard}>
          <Text style={styles.traceTitle} numberOfLines={1}>{pictureName}</Text>
          <Text style={styles.traceSubtitle} numberOfLines={1}>{pictureTheme} · {overlayLocked ? 'Locked' : 'Drag to move'}</Text>
        </View>
        <Pressable style={styles.iconButton} onPress={() => setOverlayLocked((locked) => !locked)} accessibilityRole="button" accessibilityLabel={overlayLocked ? 'Unlock overlay' : 'Lock overlay'}>
          {overlayLocked ? <LockIcon /> : <UnlockIcon />}
        </Pressable>
      </View>

      <View
        style={[
          styles.overlayWrap,
          {
            left: (width - overlayWidth) / 2,
            top: (height - overlayHeight) / 2 - 24,
            width: overlayWidth,
            height: overlayHeight,
            opacity: transform.opacity,
            transform: [
              { translateX: transform.x },
              { translateY: transform.y },
              { scale: transform.scale },
              { rotate: `${transform.rotation}deg` },
            ],
          },
          overlayLocked && styles.overlayWrapLocked,
          styles.pointerBoxOnly,
        ]}
        onStartShouldSetResponder={shouldStartOverlayDrag}
        onMoveShouldSetResponder={shouldStartOverlayDrag}
        onResponderGrant={startOverlayDrag}
        onResponderMove={moveOverlayDrag}
        onResponderRelease={endOverlayDrag}
        onResponderTerminate={endOverlayDrag}
      >
        {uploadedImage ? (
          <Image source={{ uri: uploadedImage.uri }} style={styles.uploadedOverlayImage} resizeMode="contain" />
        ) : (
          <SvgXml xml={selectedDrawing.svg} width="100%" height="100%" />
        )}
      </View>

      <View style={[styles.traceControls, styles.pointerBoxNone, { paddingBottom: insets.bottom + 12 }]}>
        {!controlsOpen ? (
          <Pressable style={styles.openControlsButton} onPress={() => setControlsOpen(true)} accessibilityRole="button">
            <Text style={styles.openControlsText}>Adjust drawing</Text>
          </Pressable>
        ) : (
          <View style={styles.controlsSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.controlsHeader}>
              <View>
                <Text style={styles.controlsTitle}>Adjust drawing</Text>
                <Text style={styles.controlsStatus}>{overlayLocked ? 'Locked to avoid accidental dragging.' : 'Drag the overlay or use precise nudges.'}</Text>
              </View>
              <Pressable style={styles.hideButton} onPress={() => setControlsOpen(false)} accessibilityRole="button">
                <Text style={styles.hideButtonText}>Hide</Text>
              </Pressable>
            </View>

            <View style={styles.controlGrid}>
              <ControlGroup label="Opacity">
                <ControlButton label="Less" onPress={decreaseOpacity} />
                <ControlValue value={`${Math.round(transform.opacity * 100)}%`} />
                <ControlButton label="More" onPress={increaseOpacity} />
              </ControlGroup>

              <ControlGroup label="Size">
                <ControlButton label="Smaller" onPress={decreaseScale} />
                <ControlValue value={`${Math.round(transform.scale * 100)}%`} />
                <ControlButton label="Larger" onPress={increaseScale} />
              </ControlGroup>

              <ControlGroup label="Rotate">
                <ControlButton label="Left" onPress={rotateLeft} />
                <ControlValue value={`${Math.round(transform.rotation)}°`} />
                <ControlButton label="Right" onPress={rotateRight} />
              </ControlGroup>
            </View>

            <View style={styles.nudgePanel}>
              <Text style={styles.nudgeTitle}>Nudge</Text>
              <View style={styles.nudgeRowCenter}>
                <ControlButton label="Up" onPress={nudgeUp} />
              </View>
              <View style={styles.nudgeRow}>
                <ControlButton label="Left" onPress={nudgeLeft} />
                <ControlButton label="Down" onPress={nudgeDown} />
                <ControlButton label="Right" onPress={nudgeRight} />
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable style={[styles.actionButton, overlayLocked && styles.actionButtonActive]} onPress={() => setOverlayLocked((locked) => !locked)} accessibilityRole="button">
                <Text style={[styles.actionButtonText, overlayLocked && styles.actionButtonTextActive]}>{overlayLocked ? 'Unlock overlay' : 'Lock overlay'}</Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={resetOverlay} accessibilityRole="button">
                <Text style={styles.actionButtonText}>Reset</Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={openScreenPractice} accessibilityRole="button">
                <Text style={styles.actionButtonText}>Screen</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}

function formatPreviousWorkDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Saved work'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function PracticeStickerView({ sticker, selected, frameStyle }: { sticker: PracticeSticker; selected?: boolean; frameStyle: object }) {
  return (
    <View style={[styles.practiceStickerFrame, frameStyle, { opacity: sticker.opacity, transform: [{ rotate: `${sticker.rotation}deg` }] }, selected && styles.practiceStickerFrameSelected]} pointerEvents="none">
      {sticker.kind === 'image' && sticker.uri ? (
        <Image source={{ uri: sticker.uri }} style={styles.practiceStickerImage} resizeMode="contain" />
      ) : sticker.svg ? (
        <SvgXml xml={sticker.svg} width="100%" height="100%" />
      ) : null}
    </View>
  )
}

function percentageStickerFrame(sticker: PracticeSticker) {
  return {
    left: `${sticker.x / 10}%`,
    top: `${sticker.y / 10}%`,
    width: `${sticker.width / 10}%`,
    height: `${sticker.height / 10}%`,
  }
}

function sizedStickerFrame(sticker: PracticeSticker, canvasSize: { width: number; height: number }) {
  return {
    left: (sticker.x / 1000) * canvasSize.width,
    top: (sticker.y / 1000) * canvasSize.height,
    width: (sticker.width / 1000) * canvasSize.width,
    height: (sticker.height / 1000) * canvasSize.height,
  }
}

function PreviousWorkSection({
  sessions,
  onResume,
  onStartFresh,
  onDuplicate,
  onDelete,
}: {
  sessions: SavedPracticeSession[]
  onResume: (session: SavedPracticeSession) => void
  onStartFresh: (session: SavedPracticeSession) => void
  onDuplicate: (session: SavedPracticeSession) => void
  onDelete: (session: SavedPracticeSession) => void
}) {
  if (sessions.length === 0) return null

  return (
    <View style={styles.previousWorkSection}>
      <View style={styles.previousWorkHeader}>
        <View>
          <Text style={styles.previousWorkEyebrow}>Saved on this phone</Text>
          <Text style={styles.previousWorkTitle}>Previous work</Text>
        </View>
        <View style={styles.previousWorkCount}>
          <Text style={styles.previousWorkCountText}>{sessions.length}</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previousWorkRail}>
        {sessions.map((session) => (
          <View key={session.sessionId} style={styles.previousWorkCard}>
            <Pressable style={styles.previousWorkPreview} onPress={() => onResume(session)} accessibilityRole="button" accessibilityLabel={`Resume ${session.title}`}>
              <View style={styles.previousWorkPreviewContent} pointerEvents="none">
                {session.source.kind === 'upload' && session.source.uploadedImage ? (
                  <Image source={{ uri: session.source.uploadedImage.uri }} style={styles.previousWorkGuideImage} resizeMode="contain" />
                ) : (
                  <SvgXml xml={session.source.drawingSvg ?? drawingFromPracticeSource(session.source).drawing.svg} width="100%" height="100%" />
                )}
                {session.stickers.map((sticker) => (
                  <PracticeStickerView key={`${session.sessionId}-${sticker.stickerId}`} sticker={sticker} frameStyle={percentageStickerFrame(sticker)} />
                ))}
                <Svg pointerEvents="none" width="100%" height="100%" viewBox={`0 0 ${session.canvasWidth} ${session.canvasHeight}`} preserveAspectRatio="xMidYMid meet" style={styles.previousWorkInk}>
                  {session.strokes.filter((stroke) => stroke.mode === 'draw').slice(-16).map((stroke, index) => (
                    <Path key={`${session.sessionId}-preview-${index}`} d={stroke.path} stroke={stroke.color} strokeWidth={stroke.width} strokeOpacity={stroke.opacity} strokeDasharray={stroke.dasharray} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  ))}
                </Svg>
              </View>
            </Pressable>
            <Text style={styles.previousWorkName} numberOfLines={1}>{session.title}</Text>
            <Text style={styles.previousWorkMeta} numberOfLines={1}>{formatPreviousWorkDate(session.updatedAt)} · {session.strokes.length} strokes{session.stickers.length > 0 ? ` · ${session.stickers.length} pieces` : ''}</Text>
            <View style={styles.previousWorkActions}>
              <Pressable style={[styles.previousWorkAction, styles.previousWorkActionPrimary]} onPress={() => onResume(session)} accessibilityRole="button" accessibilityLabel={`Resume ${session.title}`}>
                <Text style={[styles.previousWorkActionText, styles.previousWorkActionTextPrimary]}>Resume</Text>
              </Pressable>
              <Pressable style={styles.previousWorkAction} onPress={() => onStartFresh(session)} accessibilityRole="button" accessibilityLabel={`Start fresh from ${session.title}`}>
                <Text style={styles.previousWorkActionText}>Fresh</Text>
              </Pressable>
            </View>
            <View style={styles.previousWorkActions}>
              <Pressable style={styles.previousWorkAction} onPress={() => onDuplicate(session)} accessibilityRole="button" accessibilityLabel={`Copy ${session.title}`}>
                <Text style={styles.previousWorkActionText}>Copy</Text>
              </Pressable>
              <Pressable style={styles.previousWorkAction} onPress={() => onDelete(session)} accessibilityRole="button" accessibilityLabel={`Delete ${session.title}`}>
                <Text style={styles.previousWorkActionText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

function PracticeScreen({
  insetsTop,
  insetsBottom,
  pictureName,
  pictureTheme,
  selectedDrawing,
  uploadedImage,
  initialSession,
  onSessionSaved,
  onSessionDeleted,
  onPicker,
  onCameraTrace,
}: {
  insetsTop: number
  insetsBottom: number
  pictureName: string
  pictureTheme: string
  selectedDrawing: Drawing
  uploadedImage: UploadedImage | null
  initialSession: SavedPracticeSession | null
  onSessionSaved: (session: SavedPracticeSession) => void
  onSessionDeleted: (sessionId: string) => void
  onPicker: () => void
  onCameraTrace: () => void
}) {
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 })
  const [practiceStrokes, setPracticeStrokes] = useState<PracticeStroke[]>(initialSession?.strokes ?? [])
  const [stickers, setStickers] = useState<PracticeSticker[]>(initialSession?.stickers ?? [])
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(initialSession?.stickers?.[0]?.stickerId ?? null)
  const [activePath, setActivePath] = useState('')
  const [activeStrokeRender, setActiveStrokeRender] = useState<PracticeStroke | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(initialSession?.sessionId ?? null)
  const [sessionCreatedAt, setSessionCreatedAt] = useState(initialSession?.createdAt ?? new Date().toISOString())
  const [sessionTitle, setSessionTitle] = useState(initialSession?.title ?? makePracticeSessionTitle(makePracticeSource(selectedDrawing, uploadedImage)))
  const [markerColor, setMarkerColor] = useState<string>(initialSession?.markerColor ?? markerColors[0])
  const [markerWidth, setMarkerWidth] = useState(initialSession?.markerWidth ?? 9)
  const [brushToolId, setBrushToolId] = useState<BrushToolId>(initialSession?.brushToolId ?? 'marker')
  const [guideOpacity, setGuideOpacity] = useState(initialSession?.guideOpacity ?? 0.24)
  const [guideOnTop, setGuideOnTop] = useState(initialSession?.guideOnTop ?? true)
  const [activePanel, setActivePanel] = useState<PracticePanelId | null>(null)
  const [isSavingImage, setIsSavingImage] = useState(false)
  const [viewportLocked, setViewportLocked] = useState(true)
  const [viewport, setViewport] = useState<PracticeViewport>(defaultPracticeViewport)
  const canvasSizeRef = useRef(canvasSize)
  const practiceCanvasRef = useRef<View | null>(null)
  const viewportRef = useRef<PracticeViewport>(defaultPracticeViewport)
  const activePathRef = useRef('')
  const activePointsRef = useRef<PracticePoint[]>([])
  const activePointCountRef = useRef(0)
  const activePathFrameRef = useRef<number | null>(null)
  const autosaveReadyRef = useRef(false)
  const lastSavedSignatureRef = useRef('')
  const activeStrokeStyleRef = useRef<PracticeStroke>({ path: '', color: markerColor, width: markerWidth, opacity: 0.9, mode: 'draw' })
  const lastPointRef = useRef<PracticePoint | null>(null)
  const drawingActiveRef = useRef(false)
  const viewportGestureRef = useRef<
    | { mode: 'pan'; startPoint: PracticePoint; startViewport: PracticeViewport }
    | { mode: 'pinch'; startDistance: number; startCenter: PracticePoint; startViewport: PracticeViewport }
    | null
  >(null)

  const brushTool = useMemo(() => brushTools.find((tool) => tool.id === brushToolId) ?? brushTools[1], [brushToolId])
  const activeStrokeWidth = ((markerWidth * brushTool.widthMultiplier) / Math.max(viewport.scale, 1)) * (1000 / Math.max(1, Math.min(canvasSize.width, canvasSize.height)))
  const practiceSource = useMemo(() => makePracticeSource(selectedDrawing, uploadedImage), [selectedDrawing, uploadedImage])
  const sourceResetKey = `${initialSession?.sessionId ?? 'fresh'}|${practiceSource.kind}|${practiceSource.drawingId}|${practiceSource.uploadedImage?.uri ?? ''}`
  const topGuideOpacity = Math.max(guideOpacity, 0.48)
  const selectedBrushSize = useMemo(() => brushSizes.find((size) => size.value === markerWidth) ?? brushSizes[1], [markerWidth])
  const selectedSticker = useMemo(() => stickers.find((sticker) => sticker.stickerId === selectedStickerId) ?? null, [selectedStickerId, stickers])
  const selectedStickerIdRef = useRef<string | null>(selectedStickerId)
  const savedStickerUrisRef = useRef(storedUploadedImageUrisFromStickers(initialSession?.stickers ?? []))

  useEffect(() => {
    selectedStickerIdRef.current = selectedStickerId
  }, [selectedStickerId])

  useEffect(() => {
    canvasSizeRef.current = canvasSize
  }, [canvasSize])

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
      drawingActiveRef.current = false
      const nextStrokes = initialSession?.strokes ?? []
      const nextStickers = initialSession?.stickers ?? []
      const nextGuideOpacity = initialSession?.guideOpacity ?? 0.24
      const nextGuideOnTop = initialSession?.guideOnTop ?? true
      const nextMarkerColor = initialSession?.markerColor ?? markerColors[0]
      const nextMarkerWidth = initialSession?.markerWidth ?? 9
      const nextBrushToolId = initialSession?.brushToolId ?? 'marker'

      setActivePath('')
      setActiveStrokeRender(null)
      setPracticeStrokes(nextStrokes)
      setStickers(nextStickers)
      setSelectedStickerId(nextStickers[0]?.stickerId ?? null)
      setSessionId(initialSession?.sessionId ?? null)
      setSessionCreatedAt(initialSession?.createdAt ?? new Date().toISOString())
      setSessionTitle(initialSession?.title ?? makePracticeSessionTitle(practiceSource))
      setGuideOpacity(nextGuideOpacity)
      setGuideOnTop(nextGuideOnTop)
      setMarkerColor(nextMarkerColor)
      setMarkerWidth(nextMarkerWidth)
      setBrushToolId(nextBrushToolId)
      setActivePanel(null)
      savedStickerUrisRef.current = storedUploadedImageUrisFromStickers(nextStickers)
      lastSavedSignatureRef.current = makePracticeSaveSignature({
        source: practiceSource,
        strokes: nextStrokes,
        stickers: nextStickers,
        canvasWidth: initialSession?.canvasWidth ?? 1000,
        canvasHeight: initialSession?.canvasHeight ?? 1000,
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
  }, [initialSession, practiceSource, sourceResetKey])

  useEffect(() => {
    if (!autosaveReadyRef.current) return

    if (practiceStrokes.length === 0 && stickers.length === 0) {
      if (!sessionId) return
      const deleteTimeout = setTimeout(() => {
        void deletePreviousWorkSession(sessionId)
          .then(() => {
            setSessionId(null)
            setSessionCreatedAt(new Date().toISOString())
            savedStickerUrisRef.current = []
            onSessionDeleted(sessionId)
          })
          .catch(() => undefined)
      }, practiceAutosaveDelayMs)

      return () => clearTimeout(deleteTimeout)
    }

    const timeout = setTimeout(() => {
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
        strokes: practiceStrokes,
        stickers,
        canvasWidth: 1000,
        canvasHeight: 1000,
        guideOpacity,
        guideOnTop,
        markerColor,
        markerWidth,
        brushToolId,
      }

      const nextSignature = makePracticeSaveSignature(savedSession)
      if (nextSignature === lastSavedSignatureRef.current) return

      void savePreviousWorkSession(savedSession)
        .then(() => {
          const nextStickerUris = storedUploadedImageUrisFromStickers(stickers)
          const removedStickerUris = savedStickerUrisRef.current.filter((uri) => !nextStickerUris.includes(uri))
          savedStickerUrisRef.current = nextStickerUris
          if (removedStickerUris.length > 0) void cleanupStoredImageUrisIfUnused(removedStickerUris)
          lastSavedSignatureRef.current = nextSignature
          onSessionSaved(savedSession)
        })
        .catch(() => undefined)
    }, practiceAutosaveDelayMs)

    return () => clearTimeout(timeout)
  }, [brushToolId, guideOnTop, guideOpacity, markerColor, markerWidth, onSessionDeleted, onSessionSaved, practiceSource, practiceStrokes, sessionCreatedAt, sessionId, sessionTitle, stickers])

  const committedStrokeLayers = useMemo(() => {
    const eraserStrokes = practiceStrokes.map((stroke, index) => ({ stroke, index })).filter(({ stroke }) => stroke.mode === 'erase')
    const drawGroups: Array<{ strokes: Array<{ stroke: PracticeStroke; index: number }>; endIndex: number }> = []
    let currentGroup: Array<{ stroke: PracticeStroke; index: number }> = []

    const flushDrawGroup = () => {
      if (currentGroup.length === 0) return
      drawGroups.push({ strokes: currentGroup, endIndex: currentGroup[currentGroup.length - 1].index })
      currentGroup = []
    }

    practiceStrokes.forEach((stroke, index) => {
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
          <Defs>
            {maskStrokesByGroup.map((maskStrokes, groupIndex) => maskStrokes.length > 0 && (
              <Mask key={`mask-${groupIndex}`} id={`practice-ink-mask-${groupIndex}`} x={0} y={0} width={1000} height={1000} maskUnits="userSpaceOnUse">
                <Rect x={0} y={0} width={1000} height={1000} fill="#FFFFFF" />
                {maskStrokes.map((stroke, maskIndex) => (
                  <Path key={`mask-stroke-${groupIndex}-${maskIndex}`} d={stroke.path} stroke="#000000" strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                ))}
              </Mask>
            ))}
          </Defs>
        )}
        {drawGroups.map((group, groupIndex) => {
          const maskStrokes = maskStrokesByGroup[groupIndex]
          const groupPaths = group.strokes.map(({ stroke, index }) => (
            <Path key={`stroke-${index}`} d={stroke.path} stroke={stroke.color} strokeWidth={stroke.width} strokeOpacity={stroke.opacity} strokeDasharray={stroke.dasharray} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))

          return maskStrokes.length > 0 ? (
            <G key={`draw-group-${groupIndex}`} mask={`url(#practice-ink-mask-${groupIndex})`}>
              {groupPaths}
            </G>
          ) : (
            <G key={`draw-group-${groupIndex}`}>{groupPaths}</G>
          )
        })}
      </>
    )
  }, [activePath, activeStrokeRender, practiceStrokes])

  const scheduleActivePathUpdate = useCallback(() => {
    if (activePathFrameRef.current !== null) return

    activePathFrameRef.current = requestAnimationFrame(() => {
      activePathFrameRef.current = null
      setActivePath(activePathRef.current)
    })
  }, [])

  const cancelActivePathUpdate = useCallback(() => {
    if (activePathFrameRef.current === null) return
    cancelAnimationFrame(activePathFrameRef.current)
    activePathFrameRef.current = null
  }, [])

  useEffect(() => () => cancelActivePathUpdate(), [cancelActivePathUpdate])

  const clampPracticeViewport = useCallback((next: PracticeViewport) => {
    const { width, height } = canvasSizeRef.current
    const scale = clamp(next.scale, 1, 5)
    const extraX = Math.max(0, (scale - 1) * width)
    const extraY = Math.max(0, (scale - 1) * height)
    const overscroll = 90

    return {
      x: clamp(next.x, -extraX - overscroll, overscroll),
      y: clamp(next.y, -extraY - overscroll, overscroll),
      scale,
    }
  }, [])

  const setPracticeViewport = useCallback((update: PracticeViewport | ((current: PracticeViewport) => PracticeViewport)) => {
    const next = typeof update === 'function' ? update(viewportRef.current) : update
    const clamped = clampPracticeViewport(next)
    viewportRef.current = clamped
    setViewport(clamped)
  }, [clampPracticeViewport])

  const handleCanvasLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    const nextSize = { width: Math.max(1, width), height: Math.max(1, height) }
    canvasSizeRef.current = nextSize
    setCanvasSize(nextSize)
    setPracticeViewport((current) => clampPracticeViewport(current))
  }, [clampPracticeViewport, setPracticeViewport])

  const pointFromLocation = useCallback((point: PracticePoint): PracticePoint => {
    const currentViewport = viewportRef.current
    const { width, height } = canvasSizeRef.current
    const contentX = (point.x - currentViewport.x) / currentViewport.scale
    const contentY = (point.y - currentViewport.y) / currentViewport.scale
    return {
      x: clamp((contentX / Math.max(width, 1)) * 1000, 0, 1000),
      y: clamp((contentY / Math.max(height, 1)) * 1000, 0, 1000),
    }
  }, [])

  const touchPointsFromEvent = useCallback((event: GestureResponderEvent): PracticePoint[] => {
    const nativeEvent = event.nativeEvent as typeof event.nativeEvent & { touches?: Array<{ locationX: number; locationY: number }> }
    const touches = nativeEvent.touches ?? []
    if (touches.length > 0) return touches.map((touch) => ({ x: touch.locationX, y: touch.locationY }))
    return [{ x: nativeEvent.locationX, y: nativeEvent.locationY }]
  }, [])

  const statsFromPoints = useCallback((points: PracticePoint[]) => {
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

  const startViewportGesture = useCallback((points: PracticePoint[]) => {
    const stats = statsFromPoints(points)
    if (stats) {
      viewportGestureRef.current = {
        mode: 'pinch',
        startDistance: stats.distance,
        startCenter: stats.center,
        startViewport: viewportRef.current,
      }
      return
    }

    viewportGestureRef.current = {
      mode: 'pan',
      startPoint: points[0] ?? { x: 0, y: 0 },
      startViewport: viewportRef.current,
    }
  }, [statsFromPoints])

  const finishPracticeStroke = useCallback(() => {
    if (!drawingActiveRef.current) return

    const { color, width, opacity, mode, dasharray } = activeStrokeStyleRef.current
    const simplifiedPoints = simplifyPracticePoints(activePointsRef.current, clamp(width * 0.18, 1.25, 5))
    let path = pointsToSvgPath(simplifiedPoints)
    if (path && simplifiedPoints.length === 1) path = `${path} l 0.1 0`

    if (path) {
      setPracticeStrokes((current) => [...current, { path, color, width, opacity, mode, dasharray }])
    }

    cancelActivePathUpdate()
    activePathRef.current = ''
    activePointsRef.current = []
    activePointCountRef.current = 0
    lastPointRef.current = null
    drawingActiveRef.current = false
    setActivePath('')
    setActiveStrokeRender(null)
  }, [cancelActivePathUpdate])

  const resetViewportGestureState = useCallback(() => {
    viewportGestureRef.current = null
  }, [])

  const toggleViewportMode = useCallback(() => {
    finishPracticeStroke()
    resetViewportGestureState()
    setViewportLocked((locked) => !locked)
  }, [finishPracticeStroke, resetViewportGestureState])

  const startPracticeStroke = useCallback((event: GestureResponderEvent) => {
    setActivePanel(null)
    const touches = touchPointsFromEvent(event)
    if (!viewportLocked) {
      startViewportGesture(touches)
      return
    }

    const point = pointFromLocation(touches[0] ?? { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY })
    const path = `M ${point.x} ${point.y}`
    activePathRef.current = path
    activePointCountRef.current = 1
    lastPointRef.current = point
    drawingActiveRef.current = true
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
    setActivePath(path)
  }, [activeStrokeWidth, brushTool.dasharray, brushTool.mode, brushTool.opacity, markerColor, pointFromLocation, startViewportGesture, touchPointsFromEvent, viewportLocked])

  const movePracticeStroke = useCallback((event: GestureResponderEvent) => {
    const touches = touchPointsFromEvent(event)

    if (!viewportLocked) {
      const gesture = viewportGestureRef.current
      if (!gesture) {
        startViewportGesture(touches)
        return
      }

      const stats = statsFromPoints(touches)
      if (stats) {
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
        setPracticeViewport({
          x: stats.center.x - contentAtStartCenterX * nextScale,
          y: stats.center.y - contentAtStartCenterY * nextScale,
          scale: nextScale,
        })
        return
      }

      if (gesture.mode !== 'pan') {
        startViewportGesture(touches)
        return
      }

      const currentPoint = touches[0]
      if (!currentPoint) return
      setPracticeViewport({
        x: gesture.startViewport.x + currentPoint.x - gesture.startPoint.x,
        y: gesture.startViewport.y + currentPoint.y - gesture.startPoint.y,
        scale: gesture.startViewport.scale,
      })
      return
    }

    if (!drawingActiveRef.current) return

    const point = pointFromLocation(touches[0] ?? { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY })
    const lastPoint = lastPointRef.current
    const minPointDistance = clamp(activeStrokeStyleRef.current.width * 0.2, 1.25, 6)
    if (lastPoint && Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < minPointDistance) return

    activePointsRef.current.push(point)
    activePathRef.current = `${activePathRef.current} L ${point.x} ${point.y}`
    activePointCountRef.current += 1
    lastPointRef.current = point
    scheduleActivePathUpdate()
  }, [pointFromLocation, scheduleActivePathUpdate, setPracticeViewport, startViewportGesture, statsFromPoints, touchPointsFromEvent, viewportLocked])

  const finishPracticeGesture = useCallback(() => {
    if (viewportLocked) {
      finishPracticeStroke()
      return
    }

    resetViewportGestureState()
  }, [finishPracticeStroke, resetViewportGestureState, viewportLocked])

  const undoPracticeStroke = useCallback(() => {
    setPracticeStrokes((current) => current.slice(0, -1))
  }, [])

  const clearPracticeStrokes = useCallback(() => {
    cancelActivePathUpdate()
    activePathRef.current = ''
    activePointsRef.current = []
    activePointCountRef.current = 0
    lastPointRef.current = null
    drawingActiveRef.current = false
    setActivePath('')
    setActiveStrokeRender(null)
    const removedStickerUris = storedUploadedImageUrisFromStickers(stickers)
    setPracticeStrokes([])
    setStickers([])
    setSelectedStickerId(null)
    const deletedSessionId = sessionId
    setSessionId(null)
    setSessionCreatedAt(new Date().toISOString())
    if (deletedSessionId) {
      void deletePreviousWorkSession(deletedSessionId)
        .then(() => {
          savedStickerUrisRef.current = []
          onSessionDeleted(deletedSessionId)
        })
        .catch(() => undefined)
    } else if (removedStickerUris.length > 0) {
      savedStickerUrisRef.current = []
      void cleanupStoredImageUrisIfUnused(removedStickerUris)
    }
  }, [cancelActivePathUpdate, onSessionDeleted, sessionId, stickers])

  const confirmClearPracticeStrokes = useCallback(() => {
    if (practiceStrokes.length === 0 && stickers.length === 0 && !activePath) return

    Alert.alert('Clear drawing?', 'This removes all coloring and added pieces saved in this work.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: clearPracticeStrokes },
    ])
  }, [activePath, clearPracticeStrokes, practiceStrokes.length, stickers.length])

  const lightenGuide = useCallback(() => {
    setGuideOpacity((current) => clamp(current - 0.06, 0.08, 0.66))
  }, [])

  const darkenGuide = useCallback(() => {
    setGuideOpacity((current) => clamp(current + 0.06, 0.08, 0.66))
  }, [])

  const zoomPractice = useCallback((amount: number) => {
    const { width, height } = canvasSizeRef.current
    const center = { x: width / 2, y: height / 2 }
    const startViewport = viewportRef.current
    const nextScale = clamp(startViewport.scale + amount, 1, 5)
    const contentX = (center.x - startViewport.x) / startViewport.scale
    const contentY = (center.y - startViewport.y) / startViewport.scale
    setPracticeViewport({
      x: center.x - contentX * nextScale,
      y: center.y - contentY * nextScale,
      scale: nextScale,
    })
  }, [setPracticeViewport])

  const resetPracticeViewport = useCallback(() => {
    resetViewportGestureState()
    setPracticeViewport(defaultPracticeViewport)
  }, [resetViewportGestureState, setPracticeViewport])

  const togglePracticePanel = useCallback((panel: PracticePanelId) => {
    setActivePanel((current) => (current === panel ? null : panel))
  }, [])

  const addSticker = useCallback((sticker: PracticeSticker) => {
    setStickers((current) => [...current, sticker])
    setSelectedStickerId(sticker.stickerId)
    setActivePanel('add')
  }, [])

  const addShapeSticker = useCallback((shape: (typeof practiceStickerShapes)[number]) => {
    addSticker({
      stickerId: createPracticeSessionId(),
      kind: 'shape',
      label: shape.label,
      svg: shape.svg,
      x: 350,
      y: 350,
      width: 300,
      height: 300,
      rotation: 0,
      opacity: 0.9,
    })
  }, [addSticker])

  const addImageSticker = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Photo permission needed', 'Allow photo access to add a local image to this drawing.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsMultipleSelection: false,
      })

      if (result.canceled || result.assets.length === 0) return
      const asset = result.assets[0]
      const storedUri = await persistUploadedImage(asset.uri, asset.fileName ?? 'Added image')
      if (!storedUri) {
        Alert.alert('Could not add image', 'TraceBuddy could not copy this image into local app storage. Try choosing it again.')
        return
      }

      const aspectRatio = asset.width && asset.height ? asset.width / Math.max(asset.height, 1) : 1
      const width = aspectRatio >= 1 ? 360 : Math.max(180, 300 * aspectRatio)
      const height = aspectRatio >= 1 ? Math.max(180, 300 / aspectRatio) : 360
      addSticker({
        stickerId: createPracticeSessionId(),
        kind: 'image',
        label: asset.fileName ?? 'Added image',
        uri: storedUri,
        x: clamp(500 - width / 2, 40, 760),
        y: clamp(500 - height / 2, 40, 760),
        width,
        height,
        rotation: 0,
        opacity: 0.92,
      })
    } catch {
      Alert.alert('Could not open photos', 'Try again or add a built-in shape instead.')
    }
  }, [addSticker])

  const updateSelectedSticker = useCallback((update: (sticker: PracticeSticker) => PracticeSticker) => {
    if (!selectedStickerId) return
    setStickers((current) => current.map((sticker) => (sticker.stickerId === selectedStickerId ? update(sticker) : sticker)))
  }, [selectedStickerId])

  const moveSelectedSticker = useCallback((dx: number, dy: number) => {
    updateSelectedSticker((sticker) => ({ ...sticker, x: clamp(sticker.x + dx, -120, 1020), y: clamp(sticker.y + dy, -120, 1020) }))
  }, [updateSelectedSticker])

  const resizeSelectedSticker = useCallback((factor: number) => {
    updateSelectedSticker((sticker) => {
      const nextWidth = clamp(sticker.width * factor, 48, 900)
      const nextHeight = clamp(sticker.height * factor, 48, 900)
      return {
        ...sticker,
        x: sticker.x + (sticker.width - nextWidth) / 2,
        y: sticker.y + (sticker.height - nextHeight) / 2,
        width: nextWidth,
        height: nextHeight,
      }
    })
  }, [updateSelectedSticker])

  const rotateSelectedSticker = useCallback((degrees: number) => {
    updateSelectedSticker((sticker) => ({ ...sticker, rotation: sticker.rotation + degrees }))
  }, [updateSelectedSticker])

  const removeSelectedSticker = useCallback(() => {
    if (!selectedStickerId) return
    const removedSticker = stickers.find((sticker) => sticker.stickerId === selectedStickerId)
    setStickers((current) => current.filter((sticker) => sticker.stickerId !== selectedStickerId))
    setSelectedStickerId(null)
    if (removedSticker?.kind === 'image' && removedSticker.uri) void cleanupStoredImageUrisIfUnused([removedSticker.uri])
  }, [selectedStickerId, stickers])

  const savePracticeImage = useCallback(async () => {
    if (!practiceCanvasRef.current || isSavingImage) return
    const restoreStickerId = selectedStickerIdRef.current

    try {
      setIsSavingImage(true)
      const permission = await MediaLibrary.requestPermissionsAsync(true)
      if (!permission.granted) {
        Alert.alert('Photo permission needed', 'Allow TraceBuddy to save drawings to Photos.')
        return
      }

      setSelectedStickerId(null)
      await new Promise((resolve) => requestAnimationFrame(resolve))
      const uri = await captureRef(practiceCanvasRef, { format: 'png', quality: 1, result: 'tmpfile' })
      if (restoreStickerId) setSelectedStickerId(restoreStickerId)
      await MediaLibrary.saveToLibraryAsync(uri)
      Alert.alert('Saved image', 'Your drawing was saved to Photos.')
    } catch {
      if (restoreStickerId) setSelectedStickerId(restoreStickerId)
      Alert.alert('Could not save image', 'Try again in a moment or take a screenshot for now.')
    } finally {
      setIsSavingImage(false)
    }
  }, [isSavingImage])

  return (
    <View style={styles.practiceShell}>
      <StatusBar style="dark" />
      <View style={[styles.practiceHeader, { paddingTop: insetsTop + 12 }]}>
        <Pressable style={styles.practiceHeaderButton} onPress={onPicker} accessibilityRole="button" accessibilityLabel="Back to picture picker">
          <Text style={styles.practiceHeaderButtonText}>Picker</Text>
        </Pressable>
        <View style={styles.practiceTitleCard}>
          <Text style={styles.practiceTitle} numberOfLines={1}>{pictureName}</Text>
          <Text style={styles.practiceSubtitle} numberOfLines={1}>{pictureTheme} · {viewportLocked ? 'Draw locked' : 'Move and zoom'}</Text>
        </View>
        <Pressable style={styles.practiceHeaderButton} onPress={onCameraTrace} accessibilityRole="button" accessibilityLabel="Switch to camera tracing">
          <Text style={styles.practiceHeaderButtonText}>Camera</Text>
        </Pressable>
      </View>

      <View style={styles.practiceStageCard}>
        <View style={styles.practiceRibbon}>
          <Pressable
            style={[styles.practiceModeButton, viewportLocked && styles.practiceModeButtonActive]}
            onPress={toggleViewportMode}
            accessibilityRole="button"
            accessibilityState={{ selected: viewportLocked }}
            accessibilityLabel={viewportLocked ? 'Canvas locked for drawing' : 'Canvas unlocked for moving and zooming'}
          >
            <Text style={[styles.practiceModeButtonText, viewportLocked && styles.practiceModeButtonTextActive]}>{viewportLocked ? 'Locked' : 'Move'}</Text>
            <Text style={styles.practiceModeButtonSubtext}>{viewportLocked ? 'Draw' : 'Pan + zoom'}</Text>
          </Pressable>

          <Pressable
            style={[styles.practiceRibbonButton, styles.practiceRibbonButtonTool, activePanel === 'tool' && styles.practiceRibbonButtonActive]}
            onPress={() => togglePracticePanel('tool')}
            accessibilityRole="button"
            accessibilityState={{ expanded: activePanel === 'tool' }}
            accessibilityLabel={`Open color and brush tools. Current brush ${brushTool.label}.`}
          >
            <View style={[styles.practiceRibbonColorDot, { backgroundColor: markerColor }]} />
            <View style={styles.practiceRibbonCopy}>
              <Text style={[styles.practiceRibbonLabel, activePanel === 'tool' && styles.practiceRibbonLabelActive]}>Tool</Text>
              <Text style={[styles.practiceRibbonValue, activePanel === 'tool' && styles.practiceRibbonValueActive]} numberOfLines={1}>{brushTool.label}</Text>
            </View>
          </Pressable>

          <Pressable
            style={[styles.practiceRibbonButton, activePanel === 'size' && styles.practiceRibbonButtonActive]}
            onPress={() => togglePracticePanel('size')}
            accessibilityRole="button"
            accessibilityState={{ expanded: activePanel === 'size' }}
            accessibilityLabel={`Open brush size tools. Current size ${selectedBrushSize.label}.`}
          >
            <Text style={[styles.practiceRibbonLabel, activePanel === 'size' && styles.practiceRibbonLabelActive]}>Size</Text>
            <Text style={[styles.practiceRibbonValue, activePanel === 'size' && styles.practiceRibbonValueActive]} numberOfLines={1}>{selectedBrushSize.label}</Text>
          </Pressable>

          <Pressable
            style={[styles.practiceRibbonButton, activePanel === 'add' && styles.practiceRibbonButtonActive]}
            onPress={() => togglePracticePanel('add')}
            accessibilityRole="button"
            accessibilityState={{ expanded: activePanel === 'add' }}
            accessibilityLabel="Open shapes and image tools"
          >
            <Text style={[styles.practiceRibbonLabel, activePanel === 'add' && styles.practiceRibbonLabelActive]}>Add</Text>
            <Text style={[styles.practiceRibbonValue, activePanel === 'add' && styles.practiceRibbonValueActive]} numberOfLines={1}>{selectedSticker ? selectedSticker.label : 'Shapes'}</Text>
          </Pressable>

          <Pressable
            style={[styles.practiceRibbonButton, activePanel === 'view' && styles.practiceRibbonButtonActive]}
            onPress={() => togglePracticePanel('view')}
            accessibilityRole="button"
            accessibilityState={{ expanded: activePanel === 'view' }}
            accessibilityLabel="Open lines, guide, and zoom tools"
          >
            <Text style={[styles.practiceRibbonLabel, activePanel === 'view' && styles.practiceRibbonLabelActive]}>View</Text>
            <Text style={[styles.practiceRibbonValue, activePanel === 'view' && styles.practiceRibbonValueActive]} numberOfLines={1}>{guideOnTop ? 'Lines top' : 'Behind'}</Text>
          </Pressable>
        </View>

        {activePanel && (
          <View style={styles.practiceRibbonPanel} pointerEvents="box-none">
            {activePanel === 'tool' && (
              <View style={styles.practicePanelCard}>
                <View style={styles.practicePanelHeader}>
                  <Text style={styles.practicePanelTitle}>Choose color and brush</Text>
                  <Pressable style={styles.practicePanelClose} onPress={() => setActivePanel(null)} accessibilityRole="button" accessibilityLabel="Close tools">
                    <Text style={styles.practicePanelCloseText}>Done</Text>
                  </Pressable>
                </View>
                <View style={styles.practicePanelSwatches}>
                  {markerColors.map((color) => (
                    <Pressable
                      key={color}
                      style={[styles.practicePanelSwatch, { backgroundColor: color }, markerColor === color && styles.practicePanelSwatchActive]}
                      onPress={() => setMarkerColor(color)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: markerColor === color }}
                      accessibilityLabel={`Use marker color ${color}`}
                    />
                  ))}
                </View>
                <View style={styles.practicePanelButtonGrid}>
                  {brushTools.map((tool) => (
                    <Pressable key={tool.id} style={[styles.practicePanelChoice, brushToolId === tool.id && styles.practicePanelChoiceActive]} onPress={() => setBrushToolId(tool.id)} accessibilityRole="button" accessibilityState={{ selected: brushToolId === tool.id }}>
                      <Text style={[styles.practicePanelChoiceText, brushToolId === tool.id && styles.practicePanelChoiceTextActive]}>{tool.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {activePanel === 'size' && (
              <View style={styles.practicePanelCard}>
                <View style={styles.practicePanelHeader}>
                  <Text style={styles.practicePanelTitle}>Brush size</Text>
                  <Pressable style={styles.practicePanelClose} onPress={() => setActivePanel(null)} accessibilityRole="button" accessibilityLabel="Close size tools">
                    <Text style={styles.practicePanelCloseText}>Done</Text>
                  </Pressable>
                </View>
                <View style={styles.practicePanelButtonGrid}>
                  {brushSizes.map((size) => (
                    <Pressable key={size.value} style={[styles.practicePanelChoice, markerWidth === size.value && styles.practicePanelChoiceActive]} onPress={() => setMarkerWidth(size.value)} accessibilityRole="button" accessibilityState={{ selected: markerWidth === size.value }}>
                      <Text style={[styles.practicePanelChoiceText, markerWidth === size.value && styles.practicePanelChoiceTextActive]}>{size.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {activePanel === 'add' && (
              <View style={styles.practicePanelCard}>
                <View style={styles.practicePanelHeader}>
                  <Text style={styles.practicePanelTitle}>Add shapes and images</Text>
                  <Pressable style={styles.practicePanelClose} onPress={() => setActivePanel(null)} accessibilityRole="button" accessibilityLabel="Close add tools">
                    <Text style={styles.practicePanelCloseText}>Done</Text>
                  </Pressable>
                </View>
                <View style={styles.practicePanelButtonGrid}>
                  {practiceStickerShapes.map((shape) => (
                    <Pressable key={shape.id} style={styles.practicePanelChoice} onPress={() => addShapeSticker(shape)} accessibilityRole="button" accessibilityLabel={`Add ${shape.label}`}>
                      <Text style={styles.practicePanelChoiceText}>{shape.label}</Text>
                    </Pressable>
                  ))}
                  <Pressable style={[styles.practicePanelChoice, styles.practicePanelChoiceAccent]} onPress={addImageSticker} accessibilityRole="button" accessibilityLabel="Add an image from photos">
                    <Text style={[styles.practicePanelChoiceText, styles.practicePanelChoiceTextAccent]}>Photo</Text>
                  </Pressable>
                </View>
                {stickers.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.practiceStickerSelectRail}>
                    {stickers.map((sticker) => (
                      <Pressable key={sticker.stickerId} style={[styles.practiceStickerSelectChip, selectedStickerId === sticker.stickerId && styles.practiceStickerSelectChipActive]} onPress={() => setSelectedStickerId(sticker.stickerId)} accessibilityRole="button" accessibilityState={{ selected: selectedStickerId === sticker.stickerId }}>
                        <Text style={[styles.practiceStickerSelectText, selectedStickerId === sticker.stickerId && styles.practiceStickerSelectTextActive]} numberOfLines={1}>{sticker.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
                {selectedSticker ? (
                  <View style={styles.practicePanelButtonGrid}>
                    <Pressable style={styles.practicePanelChoice} onPress={() => moveSelectedSticker(0, -28)} accessibilityRole="button"><Text style={styles.practicePanelChoiceText}>Up</Text></Pressable>
                    <Pressable style={styles.practicePanelChoice} onPress={() => moveSelectedSticker(-28, 0)} accessibilityRole="button"><Text style={styles.practicePanelChoiceText}>Left</Text></Pressable>
                    <Pressable style={styles.practicePanelChoice} onPress={() => moveSelectedSticker(28, 0)} accessibilityRole="button"><Text style={styles.practicePanelChoiceText}>Right</Text></Pressable>
                    <Pressable style={styles.practicePanelChoice} onPress={() => moveSelectedSticker(0, 28)} accessibilityRole="button"><Text style={styles.practicePanelChoiceText}>Down</Text></Pressable>
                    <Pressable style={styles.practicePanelChoice} onPress={() => resizeSelectedSticker(0.86)} accessibilityRole="button"><Text style={styles.practicePanelChoiceText}>Smaller</Text></Pressable>
                    <Pressable style={styles.practicePanelChoice} onPress={() => resizeSelectedSticker(1.16)} accessibilityRole="button"><Text style={styles.practicePanelChoiceText}>Bigger</Text></Pressable>
                    <Pressable style={styles.practicePanelChoice} onPress={() => rotateSelectedSticker(-15)} accessibilityRole="button"><Text style={styles.practicePanelChoiceText}>Turn left</Text></Pressable>
                    <Pressable style={styles.practicePanelChoice} onPress={() => rotateSelectedSticker(15)} accessibilityRole="button"><Text style={styles.practicePanelChoiceText}>Turn right</Text></Pressable>
                    <Pressable style={[styles.practicePanelChoice, styles.practicePanelChoiceDanger]} onPress={removeSelectedSticker} accessibilityRole="button"><Text style={[styles.practicePanelChoiceText, styles.practicePanelChoiceTextDanger]}>Remove</Text></Pressable>
                  </View>
                ) : (
                  <Text style={styles.practicePanelFootnote}>Add a shape or photo, then use these controls to place it.</Text>
                )}
              </View>
            )}

            {activePanel === 'view' && (
              <View style={styles.practicePanelCard}>
                <View style={styles.practicePanelHeader}>
                  <Text style={styles.practicePanelTitle}>Lines, guide, and zoom</Text>
                  <Pressable style={styles.practicePanelClose} onPress={() => setActivePanel(null)} accessibilityRole="button" accessibilityLabel="Close view tools">
                    <Text style={styles.practicePanelCloseText}>Done</Text>
                  </Pressable>
                </View>
                <View style={styles.practicePanelButtonGrid}>
                  <Pressable style={[styles.practicePanelChoice, guideOnTop && styles.practicePanelChoiceActive]} onPress={() => setGuideOnTop((current) => !current)} accessibilityRole="button" accessibilityState={{ selected: guideOnTop }}>
                    <Text style={[styles.practicePanelChoiceText, guideOnTop && styles.practicePanelChoiceTextActive]}>{guideOnTop ? 'Lines on top' : 'Lines behind'}</Text>
                  </Pressable>
                  <Pressable style={styles.practicePanelChoice} onPress={lightenGuide} accessibilityRole="button">
                    <Text style={styles.practicePanelChoiceText}>Guide less</Text>
                  </Pressable>
                  <Pressable style={styles.practicePanelChoice} onPress={darkenGuide} accessibilityRole="button">
                    <Text style={styles.practicePanelChoiceText}>Guide more</Text>
                  </Pressable>
                  <Pressable style={[styles.practicePanelChoice, viewportLocked && styles.practicePanelChoiceDisabled]} disabled={viewportLocked} onPress={() => zoomPractice(-0.35)} accessibilityRole="button">
                    <Text style={styles.practicePanelChoiceText}>Zoom out</Text>
                  </Pressable>
                  <Pressable style={[styles.practicePanelChoice, viewportLocked && styles.practicePanelChoiceDisabled]} disabled={viewportLocked} onPress={() => zoomPractice(0.35)} accessibilityRole="button">
                    <Text style={styles.practicePanelChoiceText}>Zoom in</Text>
                  </Pressable>
                  <Pressable style={[styles.practicePanelChoice, viewport.scale === 1 && viewport.x === 0 && viewport.y === 0 && styles.practicePanelChoiceDisabled]} disabled={viewport.scale === 1 && viewport.x === 0 && viewport.y === 0} onPress={resetPracticeViewport} accessibilityRole="button">
                    <Text style={styles.practicePanelChoiceText}>Reset view</Text>
                  </Pressable>
                </View>
                <Text style={styles.practicePanelFootnote}>{viewportLocked ? 'Switch to Move before zooming or panning.' : `Zoom ${Math.round(viewport.scale * 100)}% · Guide ${Math.round(guideOpacity * 100)}%`}</Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.practiceCanvasHint} numberOfLines={1}>{viewportLocked ? 'Locked: color safely. Tap Add for shapes or photos, Tool for colors.' : 'Move: drag or pinch, then lock to draw.'}</Text>

        <View
          ref={practiceCanvasRef}
          collapsable={false}
          style={styles.practiceCanvas}
          onLayout={handleCanvasLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={startPracticeStroke}
          onResponderMove={movePracticeStroke}
          onResponderRelease={finishPracticeGesture}
          onResponderTerminate={finishPracticeGesture}
        >
          <View
            style={[
              styles.practiceTransformLayer,
              {
                width: canvasSize.width,
                height: canvasSize.height,
                transform: [
                  { translateX: viewport.x },
                  { translateY: viewport.y },
                  { scale: viewport.scale },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <View style={[styles.practiceGuide, { opacity: guideOpacity }]} pointerEvents="none">
              {uploadedImage ? (
                <Image source={{ uri: uploadedImage.uri }} style={styles.practiceGuideImage} resizeMode="contain" />
              ) : (
                <SvgXml xml={selectedDrawing.svg} width="100%" height="100%" />
              )}
            </View>
            {stickers.map((sticker) => (
              <PracticeStickerView key={sticker.stickerId} sticker={sticker} selected={selectedStickerId === sticker.stickerId} frameStyle={sizedStickerFrame(sticker, canvasSize)} />
            ))}
            <Svg
              pointerEvents="none"
              width={canvasSize.width}
              height={canvasSize.height}
              viewBox="0 0 1000 1000"
              style={styles.practiceInkLayer}
            >
              {committedStrokeLayers}
              {activePath && activeStrokeRender?.mode === 'draw' && (
                <Path d={activePath} stroke={activeStrokeRender.color} strokeWidth={activeStrokeRender.width} strokeOpacity={activeStrokeRender.opacity} strokeDasharray={activeStrokeRender.dasharray} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              )}
            </Svg>
            {guideOnTop && (
              <View style={[styles.practiceGuide, { opacity: topGuideOpacity }]} pointerEvents="none">
                {uploadedImage ? (
                  <Image source={{ uri: uploadedImage.uri }} style={styles.practiceGuideImage} resizeMode="contain" />
                ) : (
                  <SvgXml xml={selectedDrawing.svg} width="100%" height="100%" />
                )}
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={[styles.practiceToolbar, { paddingBottom: insetsBottom + 12 }]}>
        <Pressable style={[styles.practiceToolButton, practiceStrokes.length === 0 && styles.practiceToolButtonDisabled]} onPress={undoPracticeStroke} disabled={practiceStrokes.length === 0} accessibilityRole="button">
          <Text style={styles.practiceToolButtonText}>Undo</Text>
        </Pressable>
        <Pressable style={[styles.practiceToolButton, practiceStrokes.length === 0 && stickers.length === 0 && !activePath && styles.practiceToolButtonDisabled]} onPress={confirmClearPracticeStrokes} disabled={practiceStrokes.length === 0 && stickers.length === 0 && !activePath} accessibilityRole="button">
          <Text style={styles.practiceToolButtonText}>Clear</Text>
        </Pressable>
        <Pressable style={[styles.practiceToolButton, isSavingImage && styles.practiceToolButtonDisabled]} onPress={savePracticeImage} disabled={isSavingImage} accessibilityRole="button" accessibilityLabel="Save drawing image to Photos">
          <Text style={styles.practiceToolButtonText}>{isSavingImage ? 'Saving' : 'Save image'}</Text>
        </Pressable>
        <Pressable style={[styles.practiceToolButton, styles.practiceToolButtonPrimary]} onPress={onCameraTrace} accessibilityRole="button">
          <Text style={[styles.practiceToolButtonText, styles.practiceToolButtonPrimaryText]}>Camera</Text>
        </Pressable>
      </View>
    </View>
  )
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.controlGroup}>
      <Text style={styles.controlLabel}>{label}</Text>
      <View style={styles.controlRow}>{children}</View>
    </View>
  )
}

function ControlButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.controlButton} onPress={onPress} accessibilityRole="button">
      <Text style={styles.controlButtonText}>{label}</Text>
    </Pressable>
  )
}

function ControlValue({ value }: { value: string }) {
  return (
    <View style={styles.controlValue}>
      <Text style={styles.controlValueText}>{value}</Text>
    </View>
  )
}

function TraceIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Rect x={5} y={3} width={18} height={22} rx={4} stroke={palette.ink} strokeWidth={2.2} />
      <Path d="M9 17c0-4 2.8-7 6.4-7 3.3 0 5.7 2.6 5.7 6 0 3.7-2.7 6.4-6 6.4-3.6 0-6.1-2.3-6.1-5.4Z" stroke={palette.ink} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 17c-2.3-1.9-4-2.2-5.1-.6-.9 1.3-.6 2.8.7 3.5 1.7.9 3.1 0 4.4-2.9Z" stroke={palette.coral} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function ImageIcon() {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30" fill="none">
      <Rect x={4} y={5} width={22} height={20} rx={5} stroke={palette.ink} strokeWidth={2.2} />
      <Circle cx={11} cy={12} r={2.3} fill={palette.coral} />
      <Path d="m7 22 6-6 4 4 3-3 4 5" stroke={palette.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function BackIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M11.5 3.5 6 9l5.5 5.5" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function LockIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Rect x={4} y={9} width={14} height={10} rx={3} stroke="#FFFFFF" strokeWidth={2.1} />
      <Path d="M7 9V7a4 4 0 0 1 8 0v2" stroke="#FFFFFF" strokeWidth={2.1} strokeLinecap="round" />
    </Svg>
  )
}

function UnlockIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Rect x={4} y={9} width={14} height={10} rx={3} stroke="#FFFFFF" strokeWidth={2.1} />
      <Path d="M8 9V7a4 4 0 0 1 7.4-2.1" stroke="#FFFFFF" strokeWidth={2.1} strokeLinecap="round" />
    </Svg>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <TraceBuddyMobile />
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  pickerContent: {
    paddingHorizontal: 14,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 34,
    padding: 18,
    marginBottom: 16,
    backgroundColor: palette.surface,
    shadowColor: palette.ink,
    shadowOpacity: 0.09,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.paperStrong,
  },
  eyebrow: {
    color: palette.coralDark,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 35,
    lineHeight: 36,
    letterSpacing: -1.6,
    fontWeight: '900',
  },
  heroCopy: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  uploadPill: {
    minHeight: 78,
    marginTop: 18,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 121, 93, 0.28)',
    backgroundColor: palette.paperStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uploadCopy: {
    flex: 1,
  },
  uploadTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  uploadSmall: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 3,
  },
  customTextCard: {
    marginTop: 14,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#FFFDF8',
    padding: 12,
    gap: 10,
  },
  customTextCopy: {
    gap: 3,
  },
  customTextTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  customTextSmall: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  customTextInput: {
    minHeight: 48,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 12,
  },
  customTextButton: {
    minHeight: 46,
    borderRadius: 17,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customTextButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  traceSurfaceSwitch: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  traceSurfaceOption: {
    flex: 1,
    minHeight: 78,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#FFFDF8',
    padding: 12,
    justifyContent: 'center',
  },
  traceSurfaceOptionActive: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  traceSurfaceTitle: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  traceSurfaceTitleActive: {
    color: '#FFFFFF',
  },
  traceSurfaceCopy: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
    fontWeight: '700',
  },
  traceSurfaceCopyActive: {
    color: 'rgba(255,255,255,0.72)',
  },
  previousWorkSection: {
    marginBottom: 16,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(24,36,58,0.1)',
    backgroundColor: '#FFFDF8',
    paddingVertical: 12,
    shadowColor: palette.ink,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  previousWorkHeader: {
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previousWorkEyebrow: {
    color: palette.coralDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  previousWorkTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.7,
    marginTop: 2,
  },
  previousWorkCount: {
    minWidth: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previousWorkCountText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '900',
  },
  previousWorkRail: {
    gap: 10,
    paddingHorizontal: 14,
  },
  previousWorkCard: {
    width: 210,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 9,
  },
  previousWorkPreview: {
    height: 132,
    borderRadius: 18,
    backgroundColor: palette.paper,
    overflow: 'hidden',
  },
  previousWorkPreviewContent: {
    position: 'absolute',
    top: 8,
    right: 8,
    bottom: 8,
    left: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previousWorkGuideImage: {
    width: '100%',
    height: '100%',
  },
  previousWorkInk: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  previousWorkName: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 8,
  },
  previousWorkMeta: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    marginBottom: 8,
  },
  previousWorkActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  previousWorkAction: {
    flex: 1,
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  previousWorkActionPrimary: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  previousWorkActionText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  previousWorkActionTextPrimary: {
    color: '#FFFFFF',
  },
  categoryStrip: {
    gap: 8,
    paddingHorizontal: 2,
    paddingBottom: 10,
  },
  categoryChip: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: 'rgba(255,255,255,0.82)',
    paddingLeft: 14,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryChipActive: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  categoryText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  categoryCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.paperStrong,
  },
  categoryCountActive: {
    backgroundColor: palette.coral,
  },
  categoryCountText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  templateCount: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
    paddingLeft: 2,
  },
  cardRow: {
    gap: 10,
  },
  drawingCard: {
    flex: 1,
    minHeight: 220,
    marginBottom: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 9,
    shadowColor: palette.ink,
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  drawingCardSelected: {
    borderColor: 'rgba(255, 121, 93, 0.55)',
    backgroundColor: '#FFFDF8',
  },
  drawingPreview: {
    aspectRatio: 1,
    borderRadius: 19,
    backgroundColor: palette.paper,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawingMeta: {
    marginTop: 8,
    gap: 2,
  },
  drawingName: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  drawingTheme: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  difficultyBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: palette.paperStrong,
    color: palette.coralDark,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  practiceShell: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  practiceHeader: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    zIndex: 5,
  },
  practiceHeaderButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  practiceHeaderButtonText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  practiceTitleCard: {
    flex: 1,
    minHeight: 52,
    borderRadius: 22,
    backgroundColor: palette.ink,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  practiceTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  practiceSubtitle: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  practiceStageCard: {
    flex: 1,
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 8,
    shadowColor: palette.ink,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  practiceStageIntro: {
    marginBottom: 12,
  },
  practiceStageEyebrow: {
    color: palette.coralDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  practiceStageTitle: {
    color: palette.ink,
    fontSize: 24,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 4,
  },
  practiceStageCopy: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  practiceOptionsPanel: {
    borderRadius: 24,
    backgroundColor: palette.paper,
    padding: 10,
    gap: 10,
    marginBottom: 12,
  },
  practiceRibbon: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 8,
  },
  practiceRibbonButton: {
    flex: 1,
    minWidth: 0,
    height: 56,
    borderRadius: 18,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: 'rgba(24,36,58,0.08)',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  practiceRibbonButtonTool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  practiceRibbonButtonActive: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  practiceRibbonColorDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  practiceRibbonCopy: {
    flex: 1,
    minWidth: 0,
  },
  practiceRibbonLabel: {
    color: palette.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
  },
  practiceRibbonLabelActive: {
    color: 'rgba(255,255,255,0.68)',
  },
  practiceRibbonValue: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  practiceRibbonValueActive: {
    color: '#FFFFFF',
  },
  practiceRibbonPanel: {
    position: 'absolute',
    top: 76,
    left: 8,
    right: 8,
    zIndex: 12,
  },
  practicePanelCard: {
    borderRadius: 24,
    backgroundColor: 'rgba(255,250,242,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(24,36,58,0.12)',
    padding: 12,
    gap: 10,
    shadowColor: palette.ink,
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  practicePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  practicePanelTitle: {
    flex: 1,
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  practicePanelClose: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  practicePanelCloseText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  practicePanelSwatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  practicePanelSwatch: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  practicePanelSwatchActive: {
    borderColor: palette.ink,
    transform: [{ scale: 1.08 }],
  },
  practicePanelButtonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  practicePanelChoice: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 13,
  },
  practicePanelChoiceActive: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  practicePanelChoiceAccent: {
    backgroundColor: palette.mint,
    borderColor: 'rgba(23,99,79,0.22)',
  },
  practicePanelChoiceDanger: {
    backgroundColor: '#FFF1F0',
    borderColor: 'rgba(228,83,54,0.24)',
  },
  practicePanelChoiceDisabled: {
    opacity: 0.42,
  },
  practicePanelChoiceText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  practicePanelChoiceTextActive: {
    color: '#FFFFFF',
  },
  practicePanelChoiceTextAccent: {
    color: '#17634F',
  },
  practicePanelChoiceTextDanger: {
    color: palette.coralDark,
  },
  practiceStickerSelectRail: {
    gap: 8,
    paddingVertical: 2,
  },
  practiceStickerSelectChip: {
    minHeight: 34,
    maxWidth: 140,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: 'rgba(255,255,255,0.82)',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  practiceStickerSelectChipActive: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  practiceStickerSelectText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  practiceStickerSelectTextActive: {
    color: '#FFFFFF',
  },
  practicePanelFootnote: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  practiceToolScroller: {
    flexGrow: 0,
    flexShrink: 0,
    height: 66,
    maxHeight: 66,
  },
  practiceToolRail: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  practiceModeButton: {
    minWidth: 92,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  practiceModeButtonActive: {
    borderColor: 'rgba(107,215,183,0.55)',
    backgroundColor: '#E9FFF7',
  },
  practiceModeButtonText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  practiceModeButtonTextActive: {
    color: '#17634F',
  },
  practiceModeButtonSubtext: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  practiceToolGroupCompact: {
    height: 58,
    borderRadius: 18,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: 'rgba(24,36,58,0.08)',
    padding: 8,
    gap: 6,
    justifyContent: 'center',
  },
  practiceOptionGroup: {
    gap: 8,
  },
  practiceOptionLabel: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  colorSwatches: {
    flexDirection: 'row',
    gap: 8,
  },
  colorSwatchesCompact: {
    flexDirection: 'row',
    gap: 6,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  colorSwatchCompact: {
    width: 25,
    height: 25,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  colorSwatchActive: {
    borderColor: palette.ink,
    transform: [{ scale: 1.08 }],
  },
  practiceSegmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  practiceSegmentedRowCompact: {
    flexDirection: 'row',
    gap: 6,
  },
  practiceMiniButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceMiniButtonCompact: {
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  practiceMiniButtonDisabled: {
    opacity: 0.42,
  },
  practiceMiniButtonActive: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  practiceMiniButtonText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  practiceMiniButtonTextActive: {
    color: '#FFFFFF',
  },
  practiceCanvas: {
    flex: 1,
    minHeight: 430,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#FFFDF7',
    borderWidth: 1,
    borderColor: 'rgba(24,36,58,0.1)',
  },
  practiceCanvasHint: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    minHeight: 20,
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 4,
    includeFontPadding: false,
  },
  practiceTransformLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: [0, 0, 0],
  },
  practiceGuide: {
    position: 'absolute',
    top: 18,
    right: 18,
    bottom: 18,
    left: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceGuideImage: {
    width: '100%',
    height: '100%',
  },
  practiceInkLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  practiceStickerFrame: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceStickerFrameSelected: {
    borderWidth: 2,
    borderColor: palette.coral,
    borderRadius: 14,
    backgroundColor: 'rgba(255,121,93,0.08)',
  },
  practiceStickerImage: {
    width: '100%',
    height: '100%',
  },
  practiceToolbar: {
    paddingHorizontal: 12,
    paddingTop: 2,
    flexDirection: 'row',
    gap: 8,
  },
  practiceToolButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceToolButtonPrimary: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  practiceToolButtonDisabled: {
    opacity: 0.42,
  },
  practiceToolButtonText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  practiceToolButtonPrimaryText: {
    color: '#FFFFFF',
  },
  traceShell: {
    flex: 1,
    backgroundColor: palette.camera,
    overflow: 'hidden',
  },
  pointerBoxNone: {
    pointerEvents: 'box-none',
  },
  pointerBoxOnly: {
    pointerEvents: 'box-only',
  },
  cameraFallback: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: palette.camera,
  },
  fakePaper: {
    position: 'absolute',
    width: '68%',
    height: '46%',
    borderRadius: 28,
    backgroundColor: 'rgba(255,247,234,0.14)',
    transform: [{ rotate: '-4deg' }],
  },
  cameraFallbackTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  cameraFallbackCopy: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  cameraRetryButton: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  cameraRetryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  traceHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    zIndex: 5,
  },
  headerButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: 'rgba(16,25,39,0.68)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  headerButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  traceTitleCard: {
    flex: 1,
    minHeight: 52,
    borderRadius: 22,
    backgroundColor: 'rgba(16,25,39,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  traceTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  traceSubtitle: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: 'rgba(16,25,39,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  overlayWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  overlayWrapLocked: {
    borderColor: 'rgba(255,121,93,0.72)',
  },
  uploadedOverlayImage: {
    width: '100%',
    height: '100%',
  },
  traceControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    zIndex: 6,
    alignItems: 'center',
  },
  openControlsButton: {
    minHeight: 54,
    borderRadius: 999,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  openControlsText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  controlsSheet: {
    width: '100%',
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.96)',
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(24,36,58,0.18)',
    marginBottom: 10,
  },
  controlsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  controlsTitle: {
    color: palette.ink,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  controlsStatus: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 3,
    fontWeight: '700',
  },
  hideButton: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: palette.paperStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  hideButtonText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  controlGrid: {
    gap: 9,
  },
  controlGroup: {
    borderRadius: 22,
    backgroundColor: palette.paper,
    padding: 10,
  },
  controlLabel: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  controlRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  controlButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 8,
  },
  controlButtonText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  controlValue: {
    minWidth: 62,
    minHeight: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.ink,
  },
  controlValueText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  nudgePanel: {
    marginTop: 10,
    borderRadius: 22,
    backgroundColor: '#F4FAF6',
    padding: 10,
    gap: 8,
  },
  nudgeTitle: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  nudgeRowCenter: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  nudgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonActive: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  actionButtonText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  actionButtonTextActive: {
    color: '#FFFFFF',
  },
})
