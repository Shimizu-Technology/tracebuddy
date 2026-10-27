/** Local-first models shared by web and native. No platform storage or UI. */
export const modePreferenceKey = 'tracebuddy.modePreference.v1'
export type DrawingMode = 'camera' | 'screen'
export type ModePreference = { version: 1; mode: DrawingMode }
export function normalizeModePreference(value: unknown): ModePreference {
  const record = value && typeof value === 'object' ? value as Partial<ModePreference> : null
  return { version: 1, mode: record?.version === 1 && record.mode === 'screen' ? 'screen' : 'camera' }
}
export function makeModePreference(mode: DrawingMode): ModePreference { return { version: 1, mode } }

export const keepsakeStamps = [
  { id: 'star', label: 'Star', path: 'm16 3 3.8 8 8.7 1.2-6.3 6.1 1.5 8.7-7.7-4.1-7.7 4.1 1.5-8.7-6.3-6.1 8.7-1.2Z' },
  { id: 'heart', label: 'Heart', path: 'M16 27 5 16C-2 8 9-1 16 8 23-1 34 8 27 16Z' },
  { id: 'sun', label: 'Sun', path: 'M22 16a6 6 0 1 0-12 0 6 6 0 0 0 12 0ZM16 2v4m0 20v4M2 16h4m20 0h4M6 6l3 3m14 14 3 3M6 26l3-3M23 9l3-3' },
  { id: 'flower', label: 'Flower', path: 'M16 12C4-4 1 15 12 16-4 28 15 31 16 20c12 16 15-3 4-4C36 4 17 1 16 12Zm3 4a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z' },
  { id: 'smiley', label: 'Smiley', path: 'M29 16A13 13 0 1 0 3 16a13 13 0 0 0 26 0ZM10 12h.1m11.8 0h.1M9 19q7 9 14 0' },
] as const
export type KeepsakeStamp = typeof keepsakeStamps[number]['id']
export function normalizeStamp(value: unknown): KeepsakeStamp | undefined {
  return keepsakeStamps.find((stamp) => stamp.id === value)?.id
}
export function toggleStamp(current: KeepsakeStamp | undefined, picked: KeepsakeStamp): KeepsakeStamp | undefined {
  return current === picked ? undefined : picked
}
export function newestDrawings<T extends { sessionId: string; updatedAt: string }>(sessions: readonly T[]): T[] {
  const time = (value: string) => { const date = Date.parse(value); return Number.isFinite(date) ? date : 0 }
  return [...sessions].sort((a, b) => time(b.updatedAt) - time(a.updatedAt) || a.sessionId.localeCompare(b.sessionId))
}
export function continueTarget<T extends { sessionId: string; updatedAt: string }>(sessions: readonly T[]): T | undefined {
  return newestDrawings(sessions)[0]
}
