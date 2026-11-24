import type AsyncStorage from '@react-native-async-storage/async-storage'
import { createOperationQueue, queueSessionWrite, writeIfCurrent } from '../../practiceOperations'
import type { OperationGuard } from '../../practiceOperations'
import { normalizeSavedPracticeSession } from '../../practiceStorageModel'
import type { SavedPracticeSession } from '../../practiceStorageModel'
import { normalizeLegacyPracticeAutosave } from './legacyPractice'
import { legacyPracticeAutosavePrefix, previousWorkIndexKey, previousWorkSessionPrefix } from './storageKeys'

export function previousWorkSessionKey(sessionId: string) {
  return `${previousWorkSessionPrefix}${sessionId}`
}

export function makePracticeSaveSignature(session: Pick<SavedPracticeSession, 'source' | 'strokes' | 'stickers' | 'canvasWidth' | 'canvasHeight' | 'guideOpacity' | 'guideOnTop' | 'markerColor' | 'markerWidth' | 'brushToolId' | 'stamp' | 'finishedAt'>) {
  return JSON.stringify(session)
}

export function parsePreviousWorkIndex(rawIndex: string | null): string[] {
  if (!rawIndex) return []
  const parsed = JSON.parse(rawIndex) as { ids?: unknown }
  if (!Array.isArray(parsed.ids) || parsed.ids.some((id) => typeof id !== 'string')) {
    throw new Error('Previous Work index is invalid')
  }
  return parsed.ids
}

export function serializePreviousWorkIndex(ids: string[]) {
  return JSON.stringify({ version: 1, ids })
}

export function parsePreviousWorkSession(rawSession: string | null) {
  return rawSession ? normalizeSavedPracticeSession(JSON.parse(rawSession)) : null
}

export function serializePreviousWorkSession(session: SavedPracticeSession) {
  return JSON.stringify(session)
}

type PreviousWorkIO = Pick<typeof AsyncStorage, 'getAllKeys' | 'getItem' | 'setItem' | 'multiGet' | 'multiSet' | 'removeItem'>

export function createPreviousWorkStorage(storage: PreviousWorkIO) {
  const queuePreviousWorkWrite = createOperationQueue()

  async function migrateLegacyPracticeAutosaves(legacyCanvasSize: { width: number; height: number }, isCurrent: () => boolean = () => true) {
    const keys = await storage.getAllKeys()
    const legacyKeys = keys.filter((key) => key.startsWith(legacyPracticeAutosavePrefix))

    for (const key of legacyKeys) {
      if (!isCurrent()) return
      try {
        const rawSession = await storage.getItem(key)
        const migratedSession = rawSession ? normalizeLegacyPracticeAutosave(JSON.parse(rawSession), key, legacyCanvasSize) : null
        if (!migratedSession || !isCurrent()) continue

        await savePreviousWorkSession(migratedSession, isCurrent)
        if (isCurrent()) await storage.removeItem(key)
      } catch {
        // Leave the legacy autosave in place if migration cannot complete.
      }
    }
  }

  async function readPreviousWorkIds() {
    return parsePreviousWorkIndex(await storage.getItem(previousWorkIndexKey))
  }

  async function recoverPreviousWorkIdsFromSessions() {
    const keys = await storage.getAllKeys()
    const sessionKeys = keys.filter((key) => key.startsWith(previousWorkSessionPrefix))
    const entries = await storage.multiGet(sessionKeys)
    return entries
      .map(([, rawSession]) => {
        if (!rawSession) return null
        try {
          return parsePreviousWorkSession(rawSession)
        } catch {
          return null
        }
      })
      .filter((session): session is SavedPracticeSession => Boolean(session))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map((session) => session.sessionId)
  }

  async function loadPreviousWorkSessions(isCurrent: () => boolean = () => true) {
    const ids = await readPreviousWorkIds().catch(async () => {
      const recoveredIds = await recoverPreviousWorkIdsFromSessions()
      await queuePreviousWorkWrite(() => writeIfCurrent(isCurrent, () => storage.setItem(previousWorkIndexKey, serializePreviousWorkIndex(recoveredIds)))).catch(() => undefined)
      return recoveredIds
    })
    if (ids.length === 0) return []

    const entries = await storage.multiGet(ids.map(previousWorkSessionKey))
    const sessions = entries
      .map(([, rawSession]) => {
        if (!rawSession) return null
        try {
          return parsePreviousWorkSession(rawSession)
        } catch {
          return null
        }
      })
      .filter((session): session is SavedPracticeSession => Boolean(session))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))

    const validIds = sessions.map((session) => session.sessionId)
    if (isCurrent() && (validIds.length !== ids.length || validIds.some((id, index) => id !== ids[index]))) {
      await queuePreviousWorkWrite(async () => {
        const currentIds = await readPreviousWorkIds()
        // A save or delete may have changed the index since multiGet started.
        if (currentIds.length !== ids.length || currentIds.some((id, index) => id !== ids[index])) return
        await writeIfCurrent(isCurrent, () => storage.setItem(previousWorkIndexKey, serializePreviousWorkIndex(validIds)))
      }).catch(() => undefined)
    }

    return sessions
  }

  async function loadPreviousWorkSessionsWithLegacyMigration(legacyCanvasSize: { width: number; height: number }, isCurrent: () => boolean = () => true) {
    await migrateLegacyPracticeAutosaves(legacyCanvasSize, isCurrent)
    return loadPreviousWorkSessions(isCurrent)
  }

  async function savePreviousWorkSession(session: SavedPracticeSession, isCurrent: OperationGuard) {
    return queueSessionWrite(queuePreviousWorkWrite, isCurrent, session.sessionId, readPreviousWorkIds, (ids) => storage.multiSet([
      [previousWorkSessionKey(session.sessionId), serializePreviousWorkSession(session)],
      [previousWorkIndexKey, serializePreviousWorkIndex(ids)],
    ]))
  }

  return {
    loadPreviousWorkSessions,
    loadPreviousWorkSessionsWithLegacyMigration,
    queuePreviousWorkWrite,
    readPreviousWorkIds,
    savePreviousWorkSession,
  }
}
