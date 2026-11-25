import { photoDrawingName } from './practiceSource'
import { createTextDrawing, drawingById, sanitizeTraceText } from '../../../shared'
import type { Drawing } from '../../../shared'
import type { PracticeSource, UploadedImage } from '../../practiceStorageModel'
import { generatedArt } from './art.generated'
import { letterPictures, textStyleForLevel } from './letterPictures'
import type { PictureLine } from './pictureLineModel'
import { drawingFromPracticeSource, makePracticeSource } from './practiceSource'
import { textGuideSvg } from './textGuide'

export const artLevels = ['simple', 'detailed'] as const
export type ArtLevel = typeof artLevels[number]
export type PictureCategory = 'ocean' | 'animals' | 'bugs' | 'dinosaurs' | 'magic' | 'go' | 'space' | 'nature' | 'guam' | 'food' | 'holidays'
  | 'people' | 'patterns' | 'fun' | 'letters' | 'shapes'

export const pictureCategories: { id: PictureCategory; label: string }[] = [
  { id: 'animals', label: 'Animals' },
  { id: 'bugs', label: 'Bugs' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'magic', label: 'Magic' },
  { id: 'go', label: 'Things that go' },
  { id: 'space', label: 'Space' },
  { id: 'guam', label: 'Guam' },
  { id: 'letters', label: 'Letters and numbers' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'dinosaurs', label: 'Dinosaurs' },
  { id: 'nature', label: 'Nature' },
  { id: 'food', label: 'Food' },
  { id: 'holidays', label: 'Holidays' },
  { id: 'people', label: 'People' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'fun', label: 'Toys and fun' },
]

export type GeneratedArt = {
  id: string
  name: string
  category: PictureCategory
  line: Extract<PictureLine, { kind: 'asset' }>
  color: () => number
}

export type Picture = Pick<GeneratedArt, 'id' | 'name' | 'category'> & {
  line: PictureLine
  level?: ArtLevel
  color?: () => number
  colorXml?: () => string
  text?: string
  uploadedImage?: UploadedImage
}

export type PictureParams = {
  id: string
  level?: ArtLevel
  text?: string
  photo?: string
  photoName?: string
  photoWidth?: string
  photoHeight?: string
  legacy?: '1'
  sessionId?: string
}

type IncomingParams = Record<string, string | string[] | undefined>

const legacyCategory: Record<Drawing['category'], PictureCategory> = {
  animals: 'animals', ocean: 'ocean', nature: 'nature', magic: 'magic', vehicles: 'go',
  island: 'guam', seasonal: 'fun', letters: 'letters', starters: 'shapes',
}

function legacyPicture(drawing: Drawing): Picture {
  return { id: drawing.id, name: drawing.name, category: legacyCategory[drawing.category], line: { kind: 'inline', xml: drawing.svg } }
}

export function catalogPictures(level: ArtLevel): readonly Picture[] {
  return picturesByLevel[level]
}

// Legacy drawings stay resolvable by id for saved work. Big artist shows each curated
// subject's Detailed version where one exists and its Simple version otherwise.
function curatedPictures(level: ArtLevel): Picture[] {
  const simple = generatedArt.simple.map((art): Picture => ({ ...art, level: 'simple' }))
  if (level === 'simple') return simple
  const detailed = new Map(generatedArt.detailed.map((art) => [art.id, art]))
  const listed = simple.map((picture) => {
    const art = detailed.get(picture.id)
    return art ? { ...art, level: 'detailed' as const } : picture
  })
  const extra = generatedArt.detailed.filter((art) => !simple.some((picture) => picture.id === art.id))
  return [...listed, ...extra.map((art): Picture => ({ ...art, level: 'detailed' }))]
}

const picturesByLevel: Record<ArtLevel, readonly Picture[]> = {
  simple: [...curatedPictures('simple'), ...letterPictures('simple')],
  detailed: [...curatedPictures('detailed'), ...letterPictures('detailed')],
}

export function pictureLevels(id: string) {
  return id === 'my-name' ? artLevels : artLevels.filter((level) => picturesByLevel[level]
    .some((picture) => picture.id === id && picture.level === level))
}

function readParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined
}

export function resolvePicture(params: IncomingParams): Picture | null {
  const level = readParam(params.level) === 'detailed' ? 'detailed' : 'simple'
  const legacy = readParam(params.legacy) === '1'
  const text = sanitizeTraceText(readParam(params.text) ?? '')
  if (text) {
    if (legacy) return legacyPicture(createTextDrawing(text))
    return {
      id: 'my-name', name: text, category: 'letters', level, text,
      line: { kind: 'inline', xml: textGuideSvg(text, textStyleForLevel[level]) },
    }
  }

  const uri = readParam(params.photo)
  if (uri) {
    if (!uri.startsWith('file://')) return null
    const name = photoDrawingName
    return {
      id: 'my-photo', name, category: 'fun', line: { kind: 'inline', xml: '' },
      uploadedImage: {
        uri, name,
        width: Number(readParam(params.photoWidth)) || undefined,
        height: Number(readParam(params.photoHeight)) || undefined,
      },
    }
  }

  const id = readParam(params.id)
  if (!id) return null
  if (!legacy) {
    const selected = picturesByLevel[level].find((picture) => picture.id === id)
    if (selected) return selected
    const otherLevel = level === 'simple' ? 'detailed' : 'simple'
    const other = picturesByLevel[otherLevel].find((picture) => picture.id === id)
    if (other) return other
  }
  const drawing = drawingById(id)
  return drawing ? legacyPicture(drawing) : null
}

export function paramsForPicture(picture: Picture): PictureParams {
  const photo = picture.uploadedImage
  return photo ? {
    id: picture.id, photo: photo.uri, photoName: photo.name,
    ...(photo.width ? { photoWidth: String(photo.width) } : {}),
    ...(photo.height ? { photoHeight: String(photo.height) } : {}),
  } : picture.level ? { id: picture.id, level: picture.level, ...(picture.text && { text: picture.text }) }
    : { id: picture.id, legacy: '1' }
}

export function sourceForPicture(picture: Picture, guideSvg: string): PracticeSource {
  // A typed guide keeps the full text for cross-mode navigation. Legacy slugs never contain colons.
  const drawingId = picture.text ? `custom-text-tb2:${picture.level}:${picture.text}`
    : picture.level ? `tb2-${picture.level}-${picture.id}` : picture.id
  const legacy = drawingById(drawingId)
  return makePracticeSource(legacy ?? {
    id: drawingId, name: picture.name, theme: picture.uploadedImage ? 'Local image' : picture.text ? 'Custom words' : picture.name,
    category: picture.category === 'letters' ? 'letters' : 'starters',
    difficulty: picture.level === 'detailed' ? 'Detailed' : 'Starter',
    // Saved work keeps a snapshot so future catalog changes and older app
    // versions still open it over the exact guide it was drawn on.
    svg: guideSvg,
  }, picture.uploadedImage ?? null)
}

function catalogDrawingParams(drawingId: string): PictureParams | undefined {
  const typed = /^custom-text-tb2:(simple|detailed):(.+)$/.exec(drawingId)
  if (typed) return { id: 'my-name', level: typed[1] as ArtLevel, text: typed[2] }
  const match = /^tb2-(simple|detailed)-(.+)$/.exec(drawingId)
  if (match) return { id: match[2], level: match[1] as ArtLevel }
}

export function lineForSource(source: PracticeSource): PictureLine {
  if (source.kind === 'upload' && source.uploadedImage) return { kind: 'inline', xml: '' }
  if (source.drawingSvg === undefined) {
    const params = catalogDrawingParams(source.drawingId)
    const picture = params && resolvePicture(params)
    if (picture) return picture.line
  }
  return { kind: 'inline', xml: drawingFromPracticeSource(source).drawing.svg }
}

export function paramsForSource(source: PracticeSource): PictureParams {
  const { drawing, uploadedImage } = drawingFromPracticeSource(source)
  if (uploadedImage) return paramsForPicture({ ...legacyPicture(drawing), uploadedImage })
  const params = catalogDrawingParams(source.drawingId)
  if (params) return params
  if (source.kind === 'custom' && source.drawingId.startsWith('custom-text-')) {
    const svgText = [...(source.drawingSvg ?? '').matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)]
      .map(([, line]) => line.replace(/&(?:lt|gt|quot|apos|amp);/g, (entity) =>
        ({ '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&amp;': '&' })[entity] ?? entity))
      .join(' ')
    return { id: 'my-name', text: svgText || source.drawingName, legacy: '1' }
  }
  return { id: source.drawingId, legacy: '1' }
}
