import { BlendMode, PaintStyle, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia'
import type { SkPaint, SkPath } from '@shopify/react-native-skia'
import type { PracticeStroke } from '../../../practiceStorageModel'

const parsedStrokes = new WeakMap<PracticeStroke, { path: SkPath; paint: SkPaint } | null>()

function parseStroke(stroke: PracticeStroke) {
  if (parsedStrokes.has(stroke)) return parsedStrokes.get(stroke)
  const path = Skia.Path.MakeFromSVGString(stroke.path)
  if (!path) {
    parsedStrokes.set(stroke, null)
    return null
  }
  const paint = Skia.Paint()
  paint.setAntiAlias(true)
  paint.setStyle(PaintStyle.Stroke)
  paint.setStrokeCap(StrokeCap.Round)
  paint.setStrokeJoin(StrokeJoin.Round)
  paint.setStrokeWidth(stroke.width)
  if (stroke.mode === 'erase') {
    paint.setBlendMode(BlendMode.DstOut)
  } else {
    try { paint.setColor(Skia.Color(stroke.color)) } catch { paint.setColor(Skia.Color('#18243A')) }
    paint.setAlphaf(stroke.opacity)
    const dash = stroke.dasharray
    if (dash?.length && dash.every((size) => Number.isFinite(size) && size >= 0) && dash.some((size) => size > 0)) {
      paint.setPathEffect(Skia.PathEffect.MakeDash(dash.length % 2 === 0 ? dash : [...dash, ...dash], 0))
    }
  }
  const parsed = { path, paint }
  parsedStrokes.set(stroke, parsed)
  return parsed
}

export function recordInk(strokes: readonly PracticeStroke[]) {
  const recorder = Skia.PictureRecorder()
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, 1000, 1000))
  for (const stroke of strokes) {
    const parsed = parseStroke(stroke)
    if (parsed) canvas.drawPath(parsed.path, parsed.paint)
  }
  return recorder.finishRecordingAsPicture()
}

export function renderInkImage(strokes: readonly PracticeStroke[], size: number) {
  const surface = Skia.Surface.Make(size, size)
  if (!surface) throw new Error('Could not create ink surface')
  const canvas = surface.getCanvas()
  canvas.clear(Skia.Color('transparent'))
  canvas.scale(size / 1000, size / 1000)
  canvas.drawPicture(recordInk(strokes))
  surface.flush()
  return surface.makeImageSnapshot()
}
