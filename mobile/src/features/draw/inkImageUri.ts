import type { PracticeStroke } from '../../../practiceStorageModel'

// On web, capture can use the regular SVG layer.
export const inkImageUri: (strokes: readonly PracticeStroke[], size: number) => string | undefined = () => undefined
