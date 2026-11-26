import { coloringBrushTools } from '../../../practiceStorageModel'
import { DropIcon, EraserIcon, HighlighterIcon, PaintBucketIcon, PencilLineIcon, PencilSimpleIcon } from '../../ui/icons'

export const drawingBrushes = coloringBrushTools.filter(({ id }) => id !== 'eraser')
export const brushGlyphs = {
  marker: HighlighterIcon, crayon: PencilLineIcon, paint: DropIcon,
  pencil: PencilSimpleIcon, fill: PaintBucketIcon, eraser: EraserIcon,
}
