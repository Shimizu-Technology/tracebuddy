/** The directory version describes the file layout. Contents are still v2 session JSON. */
export const drawingRecordFolder = 'tracebuddy-drawings-v1'

class InvalidDrawingRecordIdError extends Error {
  constructor() { super('Invalid drawing ID') }
}

export function drawingRecordFileName(id: string) {
  // Escape characters such as '/' without passing URI escapes to the filesystem.
  const name = encodeURIComponent(id).replace(/%[0-9A-F]{2}|[A-Z~]/g, (part) =>
    '~' + (part.length === 1 ? part.charCodeAt(0).toString(16) : part.slice(1).toLowerCase()))
  if (!name || name.length > 230) throw new InvalidDrawingRecordIdError()
  return name + '.json'
}

export function canUseDrawingRecordFile(id: string) {
  try { return Boolean(drawingRecordFileName(id)) } catch (error) {
    if (error instanceof InvalidDrawingRecordIdError || error instanceof URIError) return false
    throw error
  }
}

function drawingIdFromFile(name: string) {
  const match = /^([A-Za-z0-9_.!~*'()-]+)\.json(?:\.previous)?$/.exec(name)
  if (!match) return undefined
  try {
    const id = decodeURIComponent(match[1].replaceAll('~', '%'))
    return drawingRecordFileName(id) === match[1] + '.json' ? id : undefined
  } catch {
    return undefined
  }
}

type DrawingFileIO = {
  list: () => Promise<string[]>
  exists: (name: string) => Promise<boolean>
  read: (name: string) => Promise<string | null>
  write: (name: string, value: string) => Promise<void>
  move: (from: string, to: string) => Promise<void>
  remove: (name: string) => Promise<void>
}

/** Calls are serialized by the Previous Work queue, including reference scans. */
export function createDrawingRecords(io: DrawingFileIO) {
  return {
    async listIds() {
      const names = await io.list()
      // An interrupted write has no committed version in its temporary file.
      // Remove abandoned staging files without touching either committed name.
      for (const name of names) {
        if (name.endsWith('.pending') && drawingIdFromFile(name.slice(0, -'.pending'.length))) {
          await io.remove(name).catch(() => undefined)
        }
      }
      return [...new Set(names.map(drawingIdFromFile).filter((id): id is string => id !== undefined))]
    },
    async read(id: string, copy: 'primary' | 'previous') {
      const file = drawingRecordFileName(id)
      return io.read(copy === 'primary' ? file : file + '.previous')
    },
    async write(id: string, value: string, isReadable: (raw: string | null) => boolean) {
      const file = drawingRecordFileName(id)
      const previous = file + '.previous'
      const pending = file + '.pending'
      try {
        // Write beside the destination so the final move publishes a complete
        // file. Keep the old version reachable even on platforms whose move
        // replaces an existing destination by unlinking it first.
        await io.write(pending, value)
        // When recovering from a corrupt primary, keep an existing fallback
        // until the replacement has been published successfully.
        if (await io.exists(file) && (!await io.exists(previous) || isReadable(await io.read(file)))) {
          await io.move(file, previous)
        }
        await io.move(pending, file)
        await io.remove(previous).catch(() => undefined)
      } finally {
        await io.remove(pending).catch(() => undefined)
      }
    },
    async remove(id: string) {
      const file = drawingRecordFileName(id)
      // Removing the fallback first prevents an older copy from reappearing.
      await io.remove(file + '.pending')
      await io.remove(file + '.previous')
      await io.remove(file)
    },
  }
}
