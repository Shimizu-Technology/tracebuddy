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

  async function readSessions(keys: string[]) {
    if (!keys.length) return []
    const entries = await storage.multiGet(keys)
    return entries
      .flatMap(([, rawSession]) => {
        try {
          const session = parsePreviousWorkSession(rawSession)
          return session ? [session] : []
        } catch {
          return []
        }
      })
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }

  async function loadPreviousWorkSessions(isCurrent: () => boolean = () => true) {
    async function readIndex() {
      const rawIndex = await storage.getItem(previousWorkIndexKey)
      try {
        return parsePreviousWorkIndex(rawIndex)
      } catch {
        return null
      }
    }

    const ids = await readIndex()
    const sessions = ids ? await readSessions(ids.map(previousWorkSessionKey)) : []
    const matchesIndex = (index: string[] | null, records: SavedPracticeSession[]) =>
      index?.length === records.length && records.every((record, position) => record.sessionId === index[position])
    if (matchesIndex(ids, sessions) || (ids && !isCurrent())) return sessions

    // A write can restore a missing row without changing the IDs in the index.
    // Reread both the index and its records while writes are excluded.
    return queuePreviousWorkWrite(async () => {
      const latestIds = await readIndex()
      const keys = latestIds
        ? latestIds.map(previousWorkSessionKey)
        : (await storage.getAllKeys()).filter((key) => key.startsWith(previousWorkSessionPrefix))
      const latestSessions = await readSessions(keys)
      if (!matchesIndex(latestIds, latestSessions)) {
        await writeIfCurrent(isCurrent, () => storage.setItem(
          previousWorkIndexKey, serializePreviousWorkIndex(latestSessions.map(({ sessionId }) => sessionId)),
        )).catch(() => undefined)
      }
      return latestSessions
    })
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
