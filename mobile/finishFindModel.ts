// Native storage adapter around W5's shared Finish & find definitions.
import { continueTarget, keepsakeStamps as sharedStamps, makeModePreference, modePreferenceKey, normalizeModePreference as normalizeSharedMode } from '../shared/finishFind'
export { normalizeStamp, newestDrawings, toggleStamp } from '../shared/finishFind'
export type { KeepsakeStamp } from '../shared/finishFind'
export { modePreferenceKey }
export const keepsakeStamps = sharedStamps.map((stamp) => stamp.id)
export const continueDrawing = continueTarget
export type NativeTraceMode = 'camera' | 'screen' | 'ar'

export function normalizeModePreference(value: unknown, arSupported: boolean): NativeTraceMode {
  if (typeof value === 'string') {
    if (value === 'camera' || value === 'screen' || value === 'ar') value = makeNativeModePreference(value)
    else { try { value = JSON.parse(value) } catch { value = undefined } }
  }
  const record = value && typeof value === 'object' ? value as { version?: unknown; nativeSurface?: unknown } : null
  return arSupported && record?.version === 1 && record.nativeSurface === 'ar' ? 'ar' : normalizeSharedMode(value).mode
}

export function makeNativeModePreference(surface: NativeTraceMode) {
  return { ...makeModePreference(surface === 'screen' ? 'screen' : 'camera'), ...(surface === 'ar' ? { nativeSurface: 'ar' } : {}) }
}

export function hasKeepsakeContent(strokeCount: number, stickerCount: number, stamp?: import('../shared/finishFind').KeepsakeStamp, finishedAt?: string) {
  return strokeCount > 0 || stickerCount > 0 || stamp !== undefined || finishedAt !== undefined
}

export async function finishAfterSave(save: () => Promise<boolean>, showKeepsake: () => void) {
  if (!await save()) return false
  showKeepsake()
  return true
}
