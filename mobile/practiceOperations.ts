export type OperationGuard = () => boolean

/** Capture once, before any await. A completed clear never makes old work current again. */
export function operationGuard(generation: number, readGeneration: () => number, available: OperationGuard = () => true): OperationGuard {
  return () => generation === readGeneration() && available()
}

export function createOperationQueue() {
  let tail = Promise.resolve()
  return function queue<T>(operation: () => Promise<T>) {
    const result = tail.then(operation, operation)
    tail = result.then(() => undefined, () => undefined)
    return result
  }
}

export function queueSessionWrite(queue: ReturnType<typeof createOperationQueue>, isCurrent: OperationGuard, sessionId: string, readIds: () => Promise<string[]>, write: (ids: string[]) => Promise<unknown>) {
  return queue(async () => {
    if (!isCurrent()) return false
    const currentIds = await readIds()
    return writeIfCurrent(isCurrent, () => write([sessionId, ...currentIds.filter((id) => id !== sessionId)]))
  })
}

export async function writeIfCurrent(isCurrent: OperationGuard, write: () => Promise<unknown>) {
  if (!isCurrent()) return false
  await write()
  return isCurrent()
}

/** An idle picker after Clear must stay absent from storage, including its old lesson. */
export function shouldPersistResume(enabled: boolean, mode: string, clearing: boolean) {
  return !clearing && (enabled || mode !== 'picker')
}

/**
 * A save attempt resolves false both when it fails and when a newer attempt
 * supersedes it. Follow superseding attempts while the work is still current so
 * leave and Done report the newest snapshot; a revoked operation stays false.
 */
export async function followLatestSave(first: Promise<boolean>, latest: () => Promise<boolean> | null, stillCurrent: OperationGuard) {
  let attempt = first
  let saved = await attempt
  while (!saved && stillCurrent()) {
    const newer = latest()
    if (!newer || newer === attempt) break
    attempt = newer
    saved = await attempt
  }
  return saved && stillCurrent()
}
