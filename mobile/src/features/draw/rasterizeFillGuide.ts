import { fillResolution, guideBarriers } from './floodFill'

export async function rasterizeFillGuide(xml: string) {
  if (typeof document === 'undefined') return null
  const image = new Image()
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
  try {
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = fillResolution
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(image, 0, 0, fillResolution, fillResolution)
    return guideBarriers(context.getImageData(0, 0, fillResolution, fillResolution).data)
  } finally {
    URL.revokeObjectURL(url)
  }
}
