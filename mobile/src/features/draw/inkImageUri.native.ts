import type { PracticeStroke } from '../../../practiceStorageModel'
import { renderInkImage } from './recordInk'

export function inkImageUri(strokes: readonly PracticeStroke[], size: number) {
  return `data:image/png;base64,${renderInkImage(strokes, size).encodeToBase64()}`
}
