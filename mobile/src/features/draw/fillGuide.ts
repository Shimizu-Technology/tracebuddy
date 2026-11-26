import { rasterizeFillGuide } from './rasterizeFillGuide'

const cache = new Map<string, Promise<Uint8Array | null>>()
const maxGuideChars = 500_000

export function supportsFill(guideSvg: string | undefined, isPhoto: boolean) {
  // Older typed guides can contain font-dependent SVG text. Generated word
  // guides are paths and work the same way as a picture.
  return !isPhoto && Boolean(guideSvg && guideSvg.length <= maxGuideChars && !/<(?:text|image|foreignObject)\b/i.test(guideSvg))
}

export function prepareFillGuide(guideSvg: string) {
  const existing = cache.get(guideSvg)
  if (existing) {
    cache.delete(guideSvg)
    cache.set(guideSvg, existing)
    return existing
  }
  const pending = rasterizeFillGuide(guideSvg).catch(() => null).then((mask) => {
    if (!mask && cache.get(guideSvg) === pending) cache.delete(guideSvg)
    return mask
  })
  cache.set(guideSvg, pending)
  if (cache.size > 6) cache.delete(cache.keys().next().value!)
  return pending
}
