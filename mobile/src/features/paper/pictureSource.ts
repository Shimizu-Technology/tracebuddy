import { createTextDrawing, drawingById } from '../../../../shared/drawings'

// TODO(2.0 catalog): resolve picture ids and levels through src/data/catalog.ts once it lands.
// Until then this adapter reads the legacy shared drawings, which have one level each, so `level` is
// accepted and passed through but does not change the art yet.

export type PictureLevel = 'simple' | 'detailed'

export type PaperParams = {
  id?: string | string[]
  level?: string | string[]
  photo?: string | string[]
  text?: string | string[]
  /** Dev kit only: simulate a failure (`camera`). */
  fault?: string | string[]
}

export type PaperPicture =
  | { kind: 'drawing'; key: string; name: string; svg: string; aspect: 1 }
  | { kind: 'photo'; key: string; name: string; uri: string }

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export function pictureLevel(params: PaperParams): PictureLevel {
  return first(params.level) === 'detailed' ? 'detailed' : 'simple'
}

/** Photos must be local files from the picker or the app's own storage, never a web address. */
export function isLocalPhotoUri(uri: string) {
  return /^(file|ph|assets-library):\/\//i.test(uri)
}

export function resolvePaperPicture(params: PaperParams): PaperPicture | null {
  const photo = first(params.photo)?.trim()
  if (photo) return isLocalPhotoUri(photo) ? { kind: 'photo', key: `photo:${photo}`, name: 'My photo', uri: photo } : null

  const text = first(params.text)
  if (text !== undefined) {
    const drawing = createTextDrawing(text)
    return { kind: 'drawing', key: `text:${drawing.id}`, name: drawing.name, svg: drawing.svg, aspect: 1 }
  }

  const id = first(params.id)
  const drawing = id ? drawingById(id) : undefined
  return drawing ? { kind: 'drawing', key: `drawing:${drawing.id}`, name: drawing.name, svg: drawing.svg, aspect: 1 } : null
}

/** The same picture params, for handing off to another route such as /draw/[id]. */
export function paperRouteParams(params: PaperParams) {
  const next: Record<string, string> = { id: first(params.id) ?? 'picture', level: pictureLevel(params) }
  const photo = first(params.photo)
  const text = first(params.text)
  if (photo) next.photo = photo
  if (text !== undefined) next.text = text
  return next
}
