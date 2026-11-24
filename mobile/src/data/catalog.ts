import { photoDrawingName } from './practiceSource'
import { createTextDrawing, drawingById, sanitizeTraceText } from '../../../shared'
import type { Drawing } from '../../../shared'
import type { PracticeSource, UploadedImage } from '../../practiceStorageModel'
import { generatedArt } from './art.generated'
import { drawingFromPracticeSource, makePracticeSource } from './practiceSource'

export const artLevels = ['simple', 'detailed'] as const
export type ArtLevel = typeof artLevels[number]
export type PictureCategory = 'ocean' | 'animals' | 'dinosaurs' | 'magic' | 'go' | 'nature' | 'guam' | 'fun' | 'letters' | 'shapes'

export const pictureCategories: { id: PictureCategory; label: string }[] = [
  { id: 'animals', label: 'Animals' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'magic', label: 'Magic' },
  { id: 'go', label: 'Things that go' },
  { id: 'guam', label: 'Guam' },
  { id: 'letters', label: 'Letters and numbers' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'dinosaurs', label: 'Dinosaurs' },
  { id: 'nature', label: 'Nature' },
  { id: 'fun', label: 'Fun' },
]

export type GeneratedArt = {
  id: string
  name: string
  category: PictureCategory
  line: () => string
  color: () => number
}

export type Picture = Pick<GeneratedArt, 'id' | 'name' | 'category' | 'line'> & {
  level?: ArtLevel
  color?: () => number
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
  return { id: drawing.id, name: drawing.name, category: legacyCategory[drawing.category], line: () => drawing.svg }
}

export function catalogPictures(level: ArtLevel): readonly Picture[] {
  return picturesByLevel[level]
}

// Only curated art appears in 2.0. The legacy drawings stay resolvable by id (resolvePicture) so saved
// drawings reopen over the guide they were drawn on, but they are never listed. Big artist shows each
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
  simple: curatedPictures('simple'),
  detailed: curatedPictures('detailed'),
}

export function pictureLevels(id: string) {
  return artLevels.filter((level) => generatedArt[level].some((art) => art.id === id))
}

function readParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined
}

export function resolvePicture(params: IncomingParams): Picture | null {
  const word = readParam(params.text)
  if (word && sanitizeTraceText(word)) return legacyPicture(createTextDrawing(word))

  const uri = readParam(params.photo)
  if (uri) {
    if (!uri.startsWith('file://')) return null
    const name = photoDrawingName
    return {
      id: 'my-photo', name, category: 'fun', line: () => '',
      uploadedImage: {
        uri, name,
        width: Number(readParam(params.photoWidth)) || undefined,
        height: Number(readParam(params.photoHeight)) || undefined,
      },
    }
  }

  const id = readParam(params.id)
  if (!id) return null
  const level = readParam(params.level) === 'detailed' ? 'detailed' : 'simple'
  if (readParam(params.legacy) !== '1') {
    const selected = generatedArt[level].find((art) => art.id === id)
    if (selected) return { ...selected, level }
    const otherLevel = level === 'simple' ? 'detailed' : 'simple'
    const other = generatedArt[otherLevel].find((art) => art.id === id)
    if (other) return { ...other, level: otherLevel }
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
  } : picture.level ? { id: picture.id, level: picture.level } : { id: picture.id, legacy: '1' }
}

export function sourceForPicture(picture: Picture): PracticeSource {
  // Legacy IDs must continue finding the original guide, including reused subject names.
  const drawingId = picture.level ? `tb2-${picture.level}-${picture.id}` : picture.id
  const legacy = drawingById(drawingId)
  return makePracticeSource(legacy ?? {
    id: drawingId, name: picture.name, theme: picture.uploadedImage ? 'Local image' : picture.name,
    category: picture.category === 'letters' ? 'letters' : 'starters',
    difficulty: picture.level === 'detailed' ? 'Detailed' : 'Starter',
    svg: picture.line(),
  }, picture.uploadedImage ?? null)
}

export function paramsForSource(source: PracticeSource): PictureParams {
  const { drawing, uploadedImage } = drawingFromPracticeSource(source)
  if (uploadedImage) return paramsForPicture({ ...legacyPicture(drawing), uploadedImage })
  const generatedId = /^tb2-(simple|detailed)-(.+)$/.exec(source.drawingId)
  if (generatedId) return { id: generatedId[2], level: generatedId[1] === 'detailed' ? 'detailed' : 'simple' }
  if (source.kind === 'custom' && source.drawingId.startsWith('custom-text-')) {
    const svgText = [...(source.drawingSvg ?? '').matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)]
      .map(([, line]) => line.replace(/&(?:lt|gt|quot|apos|amp);/g, (entity) =>
        ({ '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&amp;': '&' })[entity] ?? entity))
      .join(' ')
    return { id: 'my-name', text: svgText || source.drawingName }
  }
  return { id: source.drawingId, legacy: '1' }
}
