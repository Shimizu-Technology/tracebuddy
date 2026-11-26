import type AsyncStorage from '@react-native-async-storage/async-storage'
import { createOperationQueue, writeIfCurrent } from '../../practiceOperations'
import type { OperationGuard } from '../../practiceOperations'
import { normalizeSavedPracticeSession } from '../../practiceStorageModel'
import type { SavedPracticeSession } from '../../practiceStorageModel'
import { canUseDrawingRecordFile } from './drawingRecords'
import type { createDrawingRecords } from './drawingRecords'
import { historicalLegacyPracticeSessionId, legacyPracticeSessionId, normalizeLegacyPracticeAutosave } from './legacyPractice'
import { legacyPracticeAutosavePrefix, previousWorkIndexKey, previousWorkSessionPrefix } from './storageKeys'

export function previousWorkSessionKey(sessionId: string) {
  return `${previousWorkSessionPrefix}${sessionId}`
}

export function makePracticeSaveSignature(session: Pick<SavedPracticeSession, 'source' | 'strokes' | 'stickers' | 'canvasWidth' | 'canvasHeight' | 'guideOpacity' | 'guideOnTop' | 'markerColor' | 'markerWidth' | 'brushToolId' | 'stamp' | 'finishedAt'>) {
  return JSON.stringify(session)
}

export function serializePreviousWorkIndex(ids: string[]) {
  return JSON.stringify({ version: 1, ids })
}

export class UnreadableDrawingRecordError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnreadableDrawingRecordError'
  }
}

// Match by name as well as class: a module loaded twice (tsx, Metro fast
// refresh) has two copies of the class, and instanceof fails across them.
export function isUnreadableDrawingRecordError(error: unknown): error is UnreadableDrawingRecordError {
  return error instanceof Error && error.name === 'UnreadableDrawingRecordError'
}

export function parsePreviousWorkSession(rawSession: string | null) {
  if (rawSession === null) return null
  let value: unknown
  try { value = JSON.parse(rawSession) } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    throw new UnreadableDrawingRecordError('Saved drawing is not valid JSON')
  }
  return normalizePreviousWorkSession(value)
}

export function normalizePreviousWorkSession(value: unknown) {
  if (value === null) return null // A tombstone written by an older 2.0 lesson restart.
  const session = normalizeSavedPracticeSession(value)
  const raw = value as Partial<SavedPracticeSession>
  if (!session || (raw.strokes !== undefined && (!Array.isArray(raw.strokes) || raw.strokes.length !== session.strokes.length))
    || (raw.stickers !== undefined && (!Array.isArray(raw.stickers) || raw.stickers.length !== session.stickers.length))) {
    throw new UnreadableDrawingRecordError('Saved drawing has unreadable content')
  }
  return session
}

function parseRecord(raw: string, id: string, allowTombstone: boolean) {
  const session = parsePreviousWorkSession(raw)
  if (!session && !allowTombstone) throw new UnreadableDrawingRecordError('Drawing file has no drawing')
  if (session && session.sessionId !== id) throw new UnreadableDrawingRecordError('Drawing ID does not match its record')
  return session
}

type PreviousWorkIO = Pick<typeof AsyncStorage, 'getAllKeys' | 'getItem' | 'setItem' | 'removeItem'>

export function createPreviousWorkStorage(storage: PreviousWorkIO, files?: ReturnType<typeof createDrawingRecords>) {
  const queuePreviousWorkWrite = createOperationQueue()

  async function readSessionInQueue(id: string, forImageCleanup = false) {
    let corrupt: UnreadableDrawingRecordError | undefined
    function tryRecord(raw: string | null, allowTombstone = false) {
      if (raw === null) return null
      try { return parseRecord(raw, id, allowTombstone) } catch (error) {
        if (forImageCleanup || !isUnreadableDrawingRecordError(error)) throw error
        corrupt ??= error
        return null
      }
    }

    if (files && canUseDrawingRecordFile(id)) {
      for (const copy of ['primary', 'previous'] as const) {
        const session = tryRecord(await files.read(id, copy))
        if (session) return session
      }
    }
    const legacy = tryRecord(await storage.getItem(previousWorkSessionKey(id)), true)
    if (!legacy && corrupt) throw corrupt
    return legacy
  }

  async function listSessionIdsInQueue() {
    const keys = await storage.getAllKeys()
    const oldIds = keys.filter((key) => key.startsWith(previousWorkSessionPrefix)).map((key) => key.slice(previousWorkSessionPrefix.length))
    return [...new Set([...oldIds, ...(await files?.listIds() ?? [])])]
  }

  async function readSessionsInQueue(onUnreadable?: () => void, forImageCleanup = false) {
    // The old index is only a cache. A missing entry or a failed index write
    // cannot hide a committed drawing, even when the index parses correctly.
    const ids = await listSessionIdsInQueue()
    const sessions: SavedPracticeSession[] = []
    for (let offset = 0; offset < ids.length; offset += 8) {
      const batch = await Promise.all(ids.slice(offset, offset + 8).map(async (id) => {
        try { return await readSessionInQueue(id, forImageCleanup) } catch (error) {
          if (!onUnreadable) throw error
          onUnreadable()
          return null
        }
      }))
      for (const session of batch) if (session) sessions.push(session)
    }
    return sessions.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }

  function writeSessionInQueue(session: SavedPracticeSession) {
    const value = JSON.stringify(session)
    const { sessionId } = session
    if (!files || !canUseDrawingRecordFile(sessionId)) return storage.setItem(previousWorkSessionKey(sessionId), value)
    return files.write(sessionId, value, (raw) => {
      if (raw === null) return false
      try { return Boolean(parseRecord(raw, sessionId, false)) } catch (error) {
        if (isUnreadableDrawingRecordError(error)) return false
        throw error
      }
    })
  }

  async function deleteSessionInQueue(id: string) {
    // Keep the original AsyncStorage row during normal writes. Remove it first
    // on explicit deletion so it can never reappear underneath the newer file.
    const key = previousWorkSessionKey(id)
    if (id.startsWith('legacy-')) {
      for (const legacyKey of await storage.getAllKeys()) {
        if (legacyKey.startsWith(legacyPracticeAutosavePrefix)
          && (legacyPracticeSessionId(legacyKey) === id || historicalLegacyPracticeSessionId(legacyKey) === id)) {
          await storage.removeItem(legacyKey)
        }
      }
    }
    if (await storage.getItem(key) !== null) await storage.removeItem(key)
    if (files && canUseDrawingRecordFile(id)) await files.remove(id)
  }

  async function migrateLegacyPracticeAutosaves(legacyCanvasSize: { width: number; height: number }, isCurrent: OperationGuard, requireWritable = false) {
    const keys = await storage.getAllKeys()
    for (const key of keys.filter((key) => key.startsWith(legacyPracticeAutosavePrefix))) {
      if (!isCurrent()) return
      let raw: string | null
      try { raw = await storage.getItem(key) } catch (error) {
        if (requireWritable) throw error
        continue
      }
      if (raw === null) continue
      let value: unknown
      try { value = JSON.parse(raw) } catch (error) {
        if (!(error instanceof SyntaxError)) throw error
        continue // Keep unreadable legacy bytes without blocking healthy drawings.
      }
      const session = normalizeLegacyPracticeAutosave(value, key, legacyCanvasSize)
      if (!session || !isCurrent()) continue
      try {
        // A kill after the drawing write can leave an old autosave behind.
        // Never overwrite a newer drawing when conversion is retried.
        const historicalId = historicalLegacyPracticeSessionId(key)
        const existing = await readSessionInQueue(session.sessionId)
          ?? (historicalId && historicalId !== session.sessionId ? await readSessionInQueue(historicalId) : null)
        if (!existing && isCurrent()) await writeSessionInQueue(session)
        if (isCurrent()) await storage.removeItem(key)
      } catch (error) {
        // Leave the legacy autosave in place if migration cannot complete.
        if (requireWritable) throw error
      }
    }
  }

  async function loadSessionsInQueue(isCurrent: OperationGuard, onUnreadable?: () => void) {
    let unreadable = false
    const sessions = await readSessionsInQueue(onUnreadable && (() => {
      unreadable = true
      onUnreadable()
    }))
    const index = serializePreviousWorkIndex(sessions.map(({ sessionId }) => sessionId))
    // Preserve the old cache for compatibility. Failure to refresh it is harmless.
    try {
      if (!unreadable && isCurrent() && await storage.getItem(previousWorkIndexKey) !== index && isCurrent()) {
        await storage.setItem(previousWorkIndexKey, index)
      }
    } catch { /* Drawing records are already committed. */ }
    return sessions
  }

  return {
    queuePreviousWorkWrite,
    readSessionInQueue,
    readSessionsInQueue,
    readSessionsForImageCleanupInQueue: () => readSessionsInQueue(undefined, true),
    writeSessionInQueue,
    deleteSessionInQueue,
    async clearSessionFilesInQueue() {
      for (const id of await files?.listIds() ?? []) await files?.remove(id)
    },
    readPreviousWorkSession: (id: string) => queuePreviousWorkWrite(() => readSessionInQueue(id)),
    loadPreviousWorkSessions: (isCurrent: OperationGuard = () => true) =>
      queuePreviousWorkWrite(() => loadSessionsInQueue(isCurrent)),
    loadPreviousWorkSessionsWithLegacyMigration: (size: { width: number; height: number }, isCurrent: OperationGuard = () => true, onUnreadable?: () => void) =>
      queuePreviousWorkWrite(async () => {
        await migrateLegacyPracticeAutosaves(size, isCurrent)
        return loadSessionsInQueue(isCurrent, onUnreadable)
      }),
    migrateLegacyPracticeAutosavesInQueue: migrateLegacyPracticeAutosaves,
    savePreviousWorkSession: (session: SavedPracticeSession, isCurrent: OperationGuard) =>
      queuePreviousWorkWrite(() => writeIfCurrent(isCurrent, () => writeSessionInQueue(session))),
  }
}
