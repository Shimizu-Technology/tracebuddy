import type { SavedPracticeSession } from '../../practiceStorageModel'
import { drawingImageFolders, rebasePracticeImageUri } from './practiceSource'

export function drawingImageUris(session: Pick<SavedPracticeSession, 'source' | 'stickers' | 'paperPhoto'> | null) {
  return [session?.source.uploadedImage?.uri, session?.paperPhoto?.uri, ...(
    session?.stickers.filter((sticker) => sticker.kind === 'image').map((sticker) => sticker.uri) ?? []
  )].filter((uri): uri is string => Boolean(uri))
}

export function mapDrawingImageUris(session: SavedPracticeSession, map: (uri: string) => string): SavedPracticeSession {
  const photo = session.source.uploadedImage
  return {
    ...session,
    source: photo ? { ...session.source, uploadedImage: { ...photo, uri: map(photo.uri) } } : session.source,
    stickers: session.stickers.map((sticker) =>
      sticker.kind === 'image' && sticker.uri !== undefined ? { ...sticker, uri: map(sticker.uri) } : sticker),
    ...(session.paperPhoto ? { paperPhoto: { ...session.paperPhoto, uri: map(session.paperPhoto.uri) } } : {}),
  }
}

export function createPracticeImageCleanup(documentDirectory: string | null, io: {
  list: (directory: string) => Promise<string[]>
  readReferences: () => Promise<string[]>
  remove: (uri: string) => Promise<void>
}) {
  // The uploads folder and the paper photos folder.
  const directories = documentDirectory ? drawingImageFolders.map((folder) => `${documentDirectory}${folder}/`) : []
  const active = new Map<string, number>()
  const safeFile = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

  function managedUri(uri: string) {
    const resolved = rebasePracticeImageUri(uri, documentDirectory)
    const directory = directories.find((candidate) => resolved.startsWith(candidate))
    return directory && safeFile.test(resolved.slice(directory.length)) ? resolved : null
  }

  function acquire(uris: readonly string[]) {
    const pinned = new Set(uris.map(managedUri).filter((uri): uri is string => Boolean(uri)))
    for (const uri of pinned) active.set(uri, (active.get(uri) ?? 0) + 1)
    return () => {
      for (const uri of pinned) {
        const remaining = (active.get(uri) ?? 0) - 1
        if (remaining > 0) active.set(uri, remaining)
        else active.delete(uri)
      }
      pinned.clear()
    }
  }

  // The caller holds the previous-work queue while inspecting records and unlinking files.
  async function sweep(candidates?: readonly string[]) {
    if (directories.length === 0) return
    const files = candidates ?? (await Promise.all(directories.map(async (directory) =>
      (await io.list(directory)).filter((file) => safeFile.test(file)).map((file) => directory + file)))).flat()
    const managed = new Set(files.map(managedUri).filter((uri): uri is string => Boolean(uri)))
    if (managed.size === 0) return
    const referenced = new Set((await io.readReferences()).map(managedUri))
    for (const uri of managed) {
      if (!referenced.has(uri) && !active.has(uri)) await io.remove(uri)
    }
  }

  return { acquire, sweep }
}
