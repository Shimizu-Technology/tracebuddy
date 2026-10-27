/** Camera adjustments share one guard, including accessibility activation. */
export function adjustUnlocked<T>(locked: boolean, current: T, update: (value: T) => T): T {
  return locked ? current : update(current)
}

export const childExitHoldMs = 1500
export function holdProgress(elapsedMs: number) {
  return Math.max(0, Math.min(1, elapsedMs / childExitHoldMs))
}

export function parentModeHelp(arSupported: boolean) {
  return arSupported
    ? 'Choose Trace on paper, Draw on screen, or Paper Lock (Beta). Paper Lock can drift; check alignment on your device.'
    : 'Choose Trace on paper or Draw on screen. Paper Lock (Beta) needs a device with AR world tracking.'
}

export function selectedFamilyActivity(value: unknown, ids: readonly string[]) {
  return typeof value === 'string' && ids.includes(value) ? value : ids[0]
}

/** Export always captures an untransformed square in document units. */
export const documentCapture = { side: 1000, width: 1000, height: 1000 } as const

export const placeholderColor = '#667085'
