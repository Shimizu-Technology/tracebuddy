import { resolvePicture } from '../../data/catalog'
import type { Picture } from '../../data/catalog'

/** The route params, exactly as the Picture sheet sends them (see PictureSheet and paramsForPicture). */
export type PaperParams = Record<string, string | string[] | undefined>

export type PaperPicture =
  | { kind: 'drawing'; key: string; name: string; svg: string; aspect: number; picture: Picture }
  | { kind: 'photo'; key: string; name: string; uri: string; aspect: number; picture: Picture }

// The catalog's picture params. Anything else on the route (like the dev kit's `fault`) stays on this screen.
const pictureKeys = ['id', 'level', 'text', 'photo', 'photoName', 'photoWidth', 'photoHeight', 'legacy'] as const

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

/**
 * The picture to trace, through the same catalog as the Picture sheet and Draw: the chosen level
 * ('simple' | 'detailed'), legacy ids, a typed word or name, or a local photo with its size.
 * `rebase` moves a stored photo path into this install's Documents folder.
 */
export function resolvePaperPicture(params: PaperParams, rebase: (uri: string) => string = (uri) => uri): PaperPicture | null {
  const picture = resolvePicture(params)
  if (!picture) return null
  const photo = picture.uploadedImage
  if (photo) {
    const aspect = photo.width && photo.height ? photo.width / photo.height : 1
    return { kind: 'photo', key: `photo:${photo.uri}`, name: picture.name, uri: rebase(photo.uri), aspect, picture }
  }
  return { kind: 'drawing', key: `drawing:${picture.level ?? 'legacy'}:${picture.id}`, name: picture.name, svg: picture.line(), aspect: 1, picture }
}

/** The same picture's params for another route, such as /draw/[id] or Stick to paper. */
export function pictureRouteParams(params: PaperParams) {
  const next: Record<string, string> = {}
  for (const key of pictureKeys) {
    const value = first(params[key])
    if (value !== undefined) next[key] = value
  }
  return next
}
