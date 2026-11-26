import { normalizeDrawingPreferences, normalizeLearningProgress } from '../../../shared'
import type { DrawingPreferences, LearningProgress } from '../../../shared'
import type { SavedPracticeSession } from '../../practiceStorageModel'
import { drawingRecordFileName } from './drawingRecords'
import { parseArtFavorites } from './favoritePreference'
import { mapDrawingImageUris, drawingImageUris } from './practiceImageCleanup'
import { normalizePreviousWorkSession } from './previousWork'

export const maxDrawingBackupBytes = 64 * 1024 * 1024
const maxImageBytes = 24 * 1024 * 1024
const maxImageCharacters = maxImageBytes / 3 * 4
const backupFormat = 'TraceBuddy drawings'
const maxVectorCharacters = 1024 * 1024
const drawingSvgElements = new Set([
  'svg', 'g', 'path', 'rect', 'line', 'circle', 'ellipse', 'polygon', 'polyline', 'text', 'tspan',
  'defs', 'linearGradient', 'radialGradient', 'stop', 'title', 'desc', 'metadata',
])

type BackupImage = { extension: string; base64: string | null }
export type DrawingBackupSettings = {
  progress: LearningProgress
  artFavorites: string[]
  legacyFavorites: string[]
}
type DrawingBackupContents = DrawingBackupSettings & { drawings: SavedPracticeSession[] }
export type DrawingBackup = DrawingBackupContents & {
  format: typeof backupFormat
  version: 1
  images: BackupImage[]
}

export class DrawingBackupError extends Error {
  constructor(readonly reason: 'invalid' | 'too-large') {
    super(reason === 'invalid' ? 'Invalid drawing backup' : 'Drawing backup is too large')
  }
}

function invalid(): never {
  throw new DrawingBackupError('invalid')
}

function checkSize(size: number, limit = maxDrawingBackupBytes) {
  if (size > limit) throw new DrawingBackupError('too-large')
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}

function stringList(value: unknown) {
  if (!Array.isArray(value) || value.length > 5000 || !value.every((id) => typeof id === 'string' && id.length <= 512)) return invalid()
  return value as string[]
}

function imageReference(index: number) {
  return `tracebuddy-image:${index}`
}

function referenceIndex(uri: string, count: number) {
  const match = /^tracebuddy-image:(0|[1-9][0-9]{0,5})$/.exec(uri)
  if (!match || Number(match[1]) >= count) return invalid()
  return Number(match[1])
}

function validImage(image: unknown): BackupImage {
  const { extension, base64 } = object(image)
  if (typeof extension !== 'string' || !/^[a-z0-9]{1,8}$/.test(extension)) return invalid()
  if (base64 === null) return { extension, base64 }
  if (typeof base64 !== 'string' || base64.length === 0) return invalid()
  checkSize(base64.length, maxImageCharacters)
  const paddingAt = base64.indexOf('=')
  if (base64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(base64)
    || (paddingAt !== -1 && !/^={1,2}$/.test(base64.slice(paddingAt)))) return invalid()
  return { extension, base64 }
}

function checkSvg(svg: string | undefined) {
  if (svg === undefined || svg === '') return
  checkSize(svg.length, maxVectorCharacters)
  // Saved guides are embedded line art. Reject external references and
  // elements such as <use> that can recursively expand into native views.
  const markup = svg.replace(/^\s*<\?xml\s[^>]*\?>/, '').replace(/<!--[\s\S]*?-->/g, '')
  if (!/^\s*<svg[\s>]/.test(markup) || /\b(?:href|src|on[a-z]+)\s*=/i.test(markup)
    || /url\s*\(/i.test(markup.replace(/url\s*\(\s*#[\w:.-]+\s*\)/gi, ''))) return invalid()

  const tags = []
  let rootEnded = false
  for (const [tag, close, name] of markup.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)?[^<>]*>?/g)) {
    if (rootEnded || !drawingSvgElements.has(name) || !tag.endsWith('>') || tags.length > 48) return invalid()
    if (close) {
      if (tags.pop() !== name) return invalid()
    } else if (!tag.endsWith('/>')) tags.push(name)
    rootEnded = tags.length === 0
  }
  if (!rootEnded) return invalid()
}

function decodeDrawing(value: unknown, imageCount: number) {
  const candidate = object(value)
  if (candidate.version !== 2 || typeof candidate.sessionId !== 'string' || candidate.sessionId.length > 230
    || typeof candidate.createdAt !== 'string' || !Number.isFinite(Date.parse(candidate.createdAt))
    || typeof candidate.updatedAt !== 'string' || !Number.isFinite(Date.parse(candidate.updatedAt))
    || !Array.isArray(candidate.strokes) || !Array.isArray(candidate.stickers)) return invalid()
  let drawing: SavedPracticeSession | null
  try {
    drawingRecordFileName(candidate.sessionId)
    drawing = normalizePreviousWorkSession(candidate)
  } catch { return invalid() }
  if (!drawing) return invalid()
  for (const stroke of drawing.strokes) {
    checkSize(stroke.path.length, maxVectorCharacters)
    if (/[^MZLHVCSQTAEmzlhvcsqtae\d+.\-,\s]/.test(stroke.path)) return invalid()
  }
  checkSvg(drawing.source.drawingSvg)
  for (const sticker of drawing.stickers) checkSvg(sticker.svg)
  const source = object(candidate.source)
  // In particular, do not accept an upload that the normalizer removed.
  if (source.uploadedImage !== undefined && !drawing.source.uploadedImage) return invalid()
  for (const uri of drawingImageUris(drawing)) referenceIndex(uri, imageCount)
  return drawing
}

export function parseDrawingBackup(raw: string): DrawingBackup {
  checkSize(raw.length)
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return invalid() }
  const data = object(parsed)
  if (data.format !== backupFormat || data.version !== 1 || !Array.isArray(data.images)
    || !Array.isArray(data.drawings) || data.drawings.length > 20_000 || data.images.length > 20_000) return invalid()
  const images = data.images.map(validImage)
  const ids = new Set<string>()
  const drawings = data.drawings.map((candidate) => {
    const drawing = decodeDrawing(candidate, images.length)
    if (ids.has(drawing.sessionId)) return invalid()
    ids.add(drawing.sessionId)
    return drawing
  })
  const progress = object(data.progress)
  const steps = object(progress.stepByLessonId)
  stringList(progress.completedLessonIds)
  if (progress.version !== 1 || Object.keys(steps).length > 5000
    || !Object.values(steps).every((step) => typeof step === 'number' && Number.isFinite(step))) return invalid()
  return {
    format: backupFormat,
    version: 1,
    drawings,
    images,
    progress: normalizeLearningProgress(progress),
    artFavorites: parseArtFavorites(JSON.stringify(stringList(data.artFavorites))),
    legacyFavorites: normalizeDrawingPreferences({ favoriteIds: stringList(data.legacyFavorites) }).favoriteIds,
  }
}

export async function buildDrawingBackup(
  contents: DrawingBackupContents,
  resolveUri: (uri: string) => string,
  readImage: (uri: string, maxBytes: number) => Promise<BackupImage>,
) {
  const refs = new Map<string, number>()
  const drawings = contents.drawings.map((drawing) => mapDrawingImageUris(drawing, (uri) => {
    const resolved = resolveUri(uri)
    if (!refs.has(resolved)) refs.set(resolved, refs.size)
    return imageReference(refs.get(resolved)!)
  }))
  for (const drawing of drawings) decodeDrawing(drawing, refs.size)
  const backup: DrawingBackup = { ...contents, format: backupFormat, version: 1, drawings, images: [] }
  let characters = JSON.stringify(backup).length
  checkSize(characters)
  for (const uri of refs.keys()) {
    const remainingBytes = Math.floor((maxDrawingBackupBytes - characters) * 3 / 4)
    const image = validImage(await readImage(uri, Math.min(maxImageBytes, remainingBytes)))
    characters += JSON.stringify(image).length + 1
    checkSize(characters)
    backup.images.push(image)
  }
  return backup
}

export function mergeDrawingBackupSettings(local: DrawingBackupSettings, incoming: DrawingBackupSettings): DrawingBackupSettings {
  const stepByLessonId = { ...local.progress.stepByLessonId }
  for (const [lesson, step] of Object.entries(incoming.progress.stepByLessonId)) {
    stepByLessonId[lesson] = Math.max(stepByLessonId[lesson] ?? 0, step)
  }
  return {
    progress: normalizeLearningProgress({
      version: 1,
      completedLessonIds: [...new Set([...local.progress.completedLessonIds, ...incoming.progress.completedLessonIds])],
      stepByLessonId,
    }),
    artFavorites: [...new Set([...local.artFavorites, ...incoming.artFavorites])],
    legacyFavorites: [...new Set([...local.legacyFavorites, ...incoming.legacyFavorites])],
  }
}

export type DrawingRestoreResult = { added: number; updated: number; kept: number; missingPhotos: number }

export class DrawingRestoreWriteError extends Error {
  constructor(readonly result: DrawingRestoreResult, options: { cause: unknown }) {
    super('Could not finish restoring drawings', options)
  }
}

type DrawingRestoreIO = {
  readDrawing: (id: string) => Promise<SavedPracticeSession | null>
  writeDrawing: (drawing: SavedPracticeSession) => Promise<unknown>
  writeImage: (image: BackupImage) => Promise<string>
  writeSettings: (contents: DrawingBackupSettings) => Promise<void>
}

/** The caller holds the drawing and preference queues. Each committed drawing survives a retry. */
export async function mergeDrawingBackup(backup: DrawingBackup, io: DrawingRestoreIO): Promise<DrawingRestoreResult> {
  const result = { added: 0, updated: 0, kept: 0, missingPhotos: 0 }
  const restoredImages = new Map<string, string>()
  const missing = new Set<string>()
  try {
    for (const drawing of backup.drawings) {
      const local = await io.readDrawing(drawing.sessionId)
      if (local && Date.parse(drawing.updatedAt) <= Date.parse(local.updatedAt)) {
        result.kept += 1
        continue
      }
      const refs = drawingImageUris(drawing)
      for (const ref of new Set(refs)) {
        if (restoredImages.has(ref)) continue
        const image = backup.images[referenceIndex(ref, backup.images.length)]
        restoredImages.set(ref, await io.writeImage(image))
        if (image.base64 === null) missing.add(ref)
      }
      await io.writeDrawing(mapDrawingImageUris(drawing, (ref) => restoredImages.get(ref)!))
      if (local) result.updated += 1
      else result.added += 1
    }
    await io.writeSettings(backup)
    result.missingPhotos = missing.size
    return result
  } catch (cause) {
    throw new DrawingRestoreWriteError(result, { cause })
  }
}

export function withBackupFavorites(preferences: DrawingPreferences, favorites: string[]) {
  return normalizeDrawingPreferences({ ...preferences, favoriteIds: favorites })
}
