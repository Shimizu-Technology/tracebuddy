export type PictureLine =
  | { kind: 'inline'; xml: string }
  | { kind: 'asset'; moduleId: () => number }

export type SettledPictureLineState =
  | { status: 'ready'; xml: string }
  | { status: 'error'; error: unknown }

export type PictureLineState = SettledPictureLineState | { status: 'loading' }

type AssetKey = Extract<PictureLine, { kind: 'asset' }>['moduleId']

export function createPictureLineCache(readAsset: (moduleId: number) => Promise<string>, capacity = 32) {
  const ready = new Map<AssetKey, string>()
  const pending = new Map<AssetKey, Promise<SettledPictureLineState>>()

  function peek(line: PictureLine | undefined): string | undefined {
    return !line ? '' : line.kind === 'inline' ? line.xml : ready.get(line.moduleId)
  }

  async function read(line: PictureLine | undefined): Promise<SettledPictureLineState> {
    if (!line || line.kind === 'inline') return { status: 'ready', xml: peek(line) ?? '' }
    const key = line.moduleId
    const cached = ready.get(key)
    if (cached !== undefined) {
      ready.delete(key)
      ready.set(key, cached)
      return { status: 'ready', xml: cached }
    }
    const inFlight = pending.get(key)
    if (inFlight) return inFlight

    const load = Promise.resolve().then(async (): Promise<SettledPictureLineState> => {
      const xml = await readAsset(key())
      if (!/<svg\b/i.test(xml)) throw new Error('The line art asset does not contain an SVG.')
      ready.set(key, xml)
      if (ready.size > capacity) {
        const oldest = ready.keys().next()
        if (!oldest.done) ready.delete(oldest.value)
      }
      return { status: 'ready', xml }
    }).catch((error: unknown): SettledPictureLineState => ({ status: 'error', error }))
      .finally(() => pending.delete(key))
    pending.set(key, load)
    return load
  }

  return { peek, read }
}
