import { createOperationQueue } from '../../practiceOperations'
import { mergeLegacyFavoriteSubjects } from './legacyFavoriteSubjects'
import { artFavoritesKey, drawingPreferencesKey, legacyArtFavoritesKey } from './storageKeys'
import type { LocalSettingKey } from './storageKeys'

export type PreferenceSnapshot<T> = { value: T; revision: number }

function readStringIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
}

function parseLegacyJson(raw: string | null): unknown {
  try {
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    if ((error as Error)?.name !== 'SyntaxError') throw error
    return null
  }
}

export function parseLegacyFavoritePreferences(raw: string | null) {
  const value = parseLegacyJson(raw)
  const preferences = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return {
    version: 1,
    recentIds: [],
    ...preferences,
    favoriteIds: readStringIds(preferences.favoriteIds),
  }
}

export function createArtFavoritePreference(
  read: (key: LocalSettingKey) => Promise<string | null>,
  write: (key: LocalSettingKey, value: string) => Promise<unknown>,
  queue = createOperationQueue(),
) {
  let revision = 0

  function writeInQueue(ids: string[]) {
    return write(artFavoritesKey, JSON.stringify(ids))
  }

  // Backup calls this while it already owns the preference queue.
  async function readInQueue() {
    const current = await read(artFavoritesKey)
    // The new key is the migration marker. An empty list is a valid saved choice.
    // A damaged list reads as empty rather than blocking every later toggle.
    if (current !== null) return readStringIds(parseLegacyJson(current))

    const [legacy, art] = await Promise.all([read(drawingPreferencesKey), read(legacyArtFavoritesKey)])
    const existingIds = readStringIds(parseLegacyJson(art))
    const ids = mergeLegacyFavoriteSubjects(existingIds, parseLegacyFavoritePreferences(legacy).favoriteIds)
    await writeInQueue(ids)
    return ids
  }

  return {
    readInQueue,
    read: () => queue(async (): Promise<PreferenceSnapshot<string[]>> => ({ value: await readInQueue(), revision: ++revision })),
    toggle: (id: string) => queue(async (): Promise<PreferenceSnapshot<string[]>> => {
      const ids = await readInQueue()
      const value = ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
      await writeInQueue(value)
      return { value, revision: ++revision }
    }),
  }
}
