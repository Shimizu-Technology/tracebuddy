/** Keep a view-shot tmpfile alive until Photos finishes, including rejected saves. */
export async function saveTemporaryCapture(
  capture: () => Promise<string>,
  save: (uri: string) => Promise<void>,
  release: (uri: string) => void,
) {
  let uri: string | null = null
  try {
    uri = await capture()
    await save(uri)
  } finally {
    if (uri) release(uri)
  }
}

export function captureImageKeys(guideUri: string | undefined, guideOnTop: boolean, stickers: readonly { kind: string; stickerId: string; uri?: string }[]) {
  return [
    ...(guideUri ? ['guide-base', ...(guideOnTop ? ['guide-top'] : [])] : []),
    ...stickers.filter((sticker) => sticker.kind === 'image' && sticker.uri).map((sticker) => `sticker-${sticker.stickerId}`),
  ]
}

/** A fresh export tree must decode every image; elapsed frames are insufficient. */
export function createCaptureReadiness(keys: readonly string[], timeoutMs = 10_000) {
  const pending = new Set(keys)
  let settled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let resolve!: () => void
  let reject!: (reason: Error) => void
  const ready = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  // Permission UI can remain open after an image fails. Keep that rejection
  // handled until the save handler reaches its explicit await.
  void ready.catch(() => undefined)
  const finish = (error?: Error) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    if (error) reject(error)
    else resolve()
  }
  if (pending.size === 0) finish()
  else timer = setTimeout(() => finish(new Error('The picture did not finish loading. Try Save picture again.')), timeoutMs)
  return {
    ready,
    loaded: (key: string) => { pending.delete(key); if (pending.size === 0) finish() },
    failed: (key: string) => { if (pending.has(key)) finish(new Error('An image could not load. Your drawing is kept.')) },
    dispose: () => finish(new Error('Capture cancelled')),
  }
}
