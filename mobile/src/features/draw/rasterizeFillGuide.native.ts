import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia'
import { fillResolution, guideBarriers } from './floodFill'

export async function rasterizeFillGuide(xml: string) {
  const svg = Skia.SVG.MakeFromString(xml)
  if (!svg) return null
  try {
    const surface = Skia.Surface.Make(fillResolution, fillResolution)
    if (!surface) return null
    try {
      const canvas = surface.getCanvas()
      canvas.clear(Skia.Color('transparent'))
      canvas.drawSvg(svg, fillResolution, fillResolution)
      surface.flush()
      const image = surface.makeImageSnapshot()
      try {
        const rgba = image.readPixels(0, 0, {
          width: fillResolution, height: fillResolution,
          alphaType: AlphaType.Unpremul, colorType: ColorType.RGBA_8888,
        })
        return rgba instanceof Uint8Array ? guideBarriers(rgba) : null
      } finally {
        image.dispose()
      }
    } finally {
      surface.dispose()
    }
  } finally {
    svg.dispose()
  }
}
