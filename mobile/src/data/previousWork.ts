import type AsyncStorage from '@react-native-async-storage/async-storage'
import { createOperationQueue, writeIfCurrent } from '../../practiceOperations'
import type { OperationGuard } from '../../practiceOperations'
import { normalizeSavedPracticeSession } from '../../practiceStorageModel'
import type { SavedPracticeSession } from '../../practiceStorageModel'
import type { createDrawingRecords } from './drawingRecords'
import { legacyPracticeSessionId, normalizeLegacyPracticeAutosave } from './legacyPractice'
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

export function parsePreviousWorkSession(rawSession: string | null) {
  return rawSession ? normalizePreviousWorkSession(JSON.parse(rawSession)) : null
}

export function normalizePreviousWorkSession(value: Partial<SavedPracticeSession> | null) {
  if (value === null) return null // A tombstone written by an older 2.0 lesson restart.
  const session = normalizeSavedPracticeSession(value)
  if (!session || (value.strokes !== undefined && (!Array.isArray(value.strokes) || value.strokes.length !== session.strokes.length))
    || (value.stickers !== undefined && (!Array.isArray(value.stickers) || value.stickers.length !== session.stickers.length))) {
    throw new Error('Saved drawing has unreadable content')
  }
  return session
}

type PreviousWorkIO = Pick<typeof AsyncStorage, 'getAllKeys' | 'getItem' | 'setItem' | 'removeItem'>

export function createPreviousWorkStorage(storage: PreviousWorkIO, files?: ReturnType<typeof createDrawingRecords>) {
  const queuePreviousWorkWrite = createOperationQueue()

  async function readSessionInQueue(id: string) {
    const raw = await files?.read(id) ?? await storage.getItem(previousWorkSessionKey(id))
    const session = parsePreviousWorkSession(raw)
    if (session && session.sessionId !== id) throw new Error('Drawing ID does not match its record')
    return session
  }

  async function listSessionIdsInQueue() {
    const keys = await storage.getAllKeys()
    const oldIds = keys.filter((key) => key.startsWith(previousWorkSessionPrefix)).map((key) => key.slice(previousWorkSessionPrefix.length))
    return [...new Set([...oldIds, ...(await files?.listIds() ?? [])])]
  }

  async function readSessionsInQueue(onUnreadable?: () => void) {
    // The old index is only a cache. A missing entry or a failed index write
    // cannot hide a committed drawing, even when the index parses correctly.
    const ids = await listSessionIdsInQueue()
    const sessions: SavedPracticeSession[] = []
    for (let offset = 0; offset < ids.length; offset += 8) {
      const batch = await Promise.all(ids.slice(offset, offset + 8).map(async (id) => {
        try { return await readSessionInQueue(id) } catch (error) {
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
    return files ? files.write(session.sessionId, value) : storage.setItem(previousWorkSessionKey(session.sessionId), value)
  }

  async function deleteSessionInQueue(id: string) {
    // Keep the original AsyncStorage row during normal writes. Remove it first
    // on explicit deletion so it can never reappear underneath the newer file.
    const key = previousWorkSessionKey(id)
    if (id.startsWith('legacy-')) {
      for (const legacyKey of await storage.getAllKeys()) {
        if (legacyKey.startsWith(legacyPracticeAutosavePrefix) && legacyPracticeSessionId(legacyKey) === id) await storage.removeItem(legacyKey)
      }
    }
    if (await storage.getItem(key) !== null) await storage.removeItem(key)
    await files?.remove(id)
  }

  async function migrateLegacyPracticeAutosaves(legacyCanvasSize: { width: number; height: number }, isCurrent: OperationGuard, requireWritable = false) {
    const keys = await storage.getAllKeys()
    for (const key of keys.filter((key) => key.startsWith(legacyPracticeAutosavePrefix))) {
      if (!isCurrent()) return
      try {
        const raw = await storage.getItem(key)
        const session = raw ? normalizeLegacyPracticeAutosave(JSON.parse(raw), key, legacyCanvasSize) : null
        if (!session || !isCurrent()) continue
        // A kill after the drawing write can leave an old autosave behind.
        // Never overwrite a newer drawing when conversion is retried.
        if (!await readSessionInQueue(session.sessionId) && isCurrent()) await writeSessionInQueue(session)
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
