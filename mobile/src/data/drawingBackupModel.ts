import { drawingById, normalizeLearningProgress } from '../../../shared'
import type { LearningProgress } from '../../../shared'
import type { SavedPracticeSession } from '../../practiceStorageModel'
import { canUseDrawingRecordFile } from './drawingRecords'
import { legacyFavoriteSubjects, mergeLegacyFavoriteSubjects } from './legacyFavoriteSubjects'
import { isHistoricalLegacyPracticeSessionId } from './legacyPractice'
import { drawingImageRefs, mapDrawingImageUris, drawingImageUris } from './practiceImageCleanup'
import type { DrawingImageKind } from './practiceImageCleanup'
import { drawingImageFolders } from './practiceSource'
import { isUnreadableDrawingRecordError, normalizePreviousWorkSession } from './previousWork'

export const maxDrawingBackupMiB = 32
export const maxDrawingBackupBytes = maxDrawingBackupMiB * 1024 * 1024
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
  artFavoritesMigrated: true
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

function utf8ByteLength(value: string) {
  // Count directly to avoid allocating another copy of the backup's bytes.
  let bytes = value.length
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code < 0x80) continue
    const next = value.charCodeAt(i + 1)
    if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
      bytes += 2
      i += 1
    } else bytes += code < 0x800 ? 1 : 2
  }
  return bytes
}

type BackupImageFileIO = {
  getInfo: (uri: string) => Promise<{ exists: false } | { exists: true; isDirectory: boolean; size: number }>
  readBase64: (uri: string) => Promise<string>
}

export async function readDrawingBackupImage(uri: string, documentDirectory: string | null, maxBytes: number, io: BackupImageFileIO): Promise<BackupImage> {
  // Uploads and paper photos (tracebuddy-keepsakes) are the drawing image folders.
  const root = documentDirectory ? drawingImageFolders.map((folder) => `${documentDirectory}${folder}/`).find((folder) => uri.startsWith(folder)) : undefined
  const extension = /\.([a-z0-9]{1,8})$/i.exec(uri)?.[1].toLowerCase() ?? 'jpg'
  if (!root || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(uri.slice(root.length))) {
    return { extension, base64: null }
  }
  const info = await io.getInfo(uri)
  if (!info.exists || info.isDirectory || info.size === 0) return { extension, base64: null }
  checkSize(info.size, maxBytes)
  return { extension, base64: await io.readBase64(uri) || null }
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
  if (!/^\s*<svg[\s/>]/.test(markup)) return invalid()

  const tags = []
  let rootEnded = false
  for (const [tag, close, name, attributes] of markup.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)(?=[\s/>])((?:"[^"<>]*"|'[^'<>]*'|[^"'<>])*)>|</g)) {
    if (rootEnded || !drawingSvgElements.has(name) || tags.length > 48) return invalid()
    // Scan markup attributes only. Words such as "one =" and "url(x)" are
    // normal drawing text, while the same syntax in an attribute can load a resource.
    if (/\b(?:href|src|on[a-z]+)\s*=/i.test(attributes)
      || /url\s*\(/i.test(attributes.replace(/url\s*\(\s*#[\w:.-]+\s*\)/gi, ''))) return invalid()
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
  if (!canUseDrawingRecordFile(candidate.sessionId) && !isHistoricalLegacyPracticeSessionId(candidate.sessionId)) return invalid()
  let drawing: SavedPracticeSession | null
  try {
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
  if (candidate.paperPhoto !== undefined && !drawing.paperPhoto) return invalid()
  for (const uri of drawingImageUris(drawing)) referenceIndex(uri, imageCount)
  return drawing
}

export function parseDrawingBackup(raw: string): DrawingBackup {
  checkSize(utf8ByteLength(raw))
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
  const artFavorites = stringList(data.artFavorites)
  const legacyFavorites = stringList(data.legacyFavorites)
  return {
    format: backupFormat,
    version: 1,
    artFavoritesMigrated: true,
    drawings,
    images,
    progress: normalizeLearningProgress(progress),
    // Older backups can have subjects in the legacy list. New backups carry
    // the current art list, including removals made since the one-time import.
    artFavorites: data.artFavoritesMigrated === true ? artFavorites : mergeLegacyFavoriteSubjects(artFavorites, legacyFavorites),
    legacyFavorites: [...new Set(legacyFavorites.filter((id) => drawingById(id) || legacyFavoriteSubjects.has(id)))],
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
  const backup: DrawingBackup = { ...contents, format: backupFormat, version: 1, artFavoritesMigrated: true, drawings, images: [] }
  let bytes = utf8ByteLength(JSON.stringify({ ...backup, drawings: [] }))
  for (const [index, drawing] of drawings.entries()) {
    decodeDrawing(drawing, refs.size)
    bytes += utf8ByteLength(JSON.stringify(drawing)) + (index === 0 ? 0 : 1)
    checkSize(bytes)
  }
  checkSize(bytes)
  for (const uri of refs.keys()) {
    const remainingBytes = maxDrawingBackupBytes - bytes
    const image = validImage(await readImage(uri, Math.min(maxImageBytes, Math.floor(remainingBytes / 4) * 3)))
    const metadata = { extension: image.extension, base64: image.base64 === null ? null : '' }
    bytes += utf8ByteLength(JSON.stringify(metadata)) + (image.base64?.length ?? 0) + (backup.images.length === 0 ? 0 : 1)
    checkSize(bytes)
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
  /** `keepsake` is a photo of a paper drawing, which has its own folder. */
  writeImage: (image: BackupImage, kind: DrawingImageKind) => Promise<string>
  writeSettings: (contents: DrawingBackupSettings) => Promise<void>
}

/** The caller holds the drawing and preference queues. Each committed drawing survives a retry. */
export async function mergeDrawingBackup(backup: DrawingBackup, io: DrawingRestoreIO): Promise<DrawingRestoreResult> {
  const result = { added: 0, updated: 0, kept: 0, missingPhotos: 0 }
  const restoredImages = new Map<string, string>()
  const missing = new Set<string>()
  try {
    for (const drawing of backup.drawings) {
      const local = await io.readDrawing(drawing.sessionId).catch((error: unknown) => {
        if (isUnreadableDrawingRecordError(error)) return null
        throw error
      })
      if (local && Date.parse(drawing.updatedAt) <= Date.parse(local.updatedAt)) {
        result.kept += 1
        continue
      }
      const refs = drawingImageUris(drawing)
      // Each folder gets its own file: one image used as both a picture and a paper photo is written to both.
      for (const { uri: ref, kind } of drawingImageRefs(drawing)) {
        const key = `${kind}:${ref}`
        if (restoredImages.has(key)) continue
        const image = backup.images[referenceIndex(ref, backup.images.length)]
        restoredImages.set(key, await io.writeImage(image, kind))
      }
      await io.writeDrawing(mapDrawingImageUris(drawing, (ref, kind) => restoredImages.get(`${kind}:${ref}`)!))
      for (const ref of refs) {
        if (backup.images[referenceIndex(ref, backup.images.length)].base64 === null) missing.add(ref)
      }
      result.missingPhotos = missing.size
      if (local) result.updated += 1
      else result.added += 1
    }
    await io.writeSettings(backup)
    return result
  } catch (cause) {
    throw new DrawingRestoreWriteError(result, { cause })
  }
}
