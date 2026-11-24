import { createOperationQueue } from '../../practiceOperations'

export type PreferenceSnapshot<T> = { value: T; revision: number }

export function createFavoritePreference<T>(
  read: () => Promise<string | null>,
  write: (value: string) => Promise<unknown>,
  parse: (value: string | null) => T,
  toggle: (value: T, id: string) => T,
) {
  const queue = createOperationQueue()
  let revision = 0

  return {
    read: () => queue(async (): Promise<PreferenceSnapshot<T>> => ({ value: parse(await read()), revision: ++revision })),
    toggle: (id: string) => queue(async (): Promise<PreferenceSnapshot<T>> => {
      const value = toggle(parse(await read()), id)
      await write(JSON.stringify(value))
      return { value, revision: ++revision }
    }),
  }
}

export function parseArtFavorites(raw: string | null): string[] {
  if (!raw) return []
  const value: unknown = JSON.parse(raw)
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
}
