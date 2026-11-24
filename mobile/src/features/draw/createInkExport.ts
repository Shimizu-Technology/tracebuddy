import type { PracticeStroke } from '../../../practiceStorageModel'

export type InkExport = { uri: string; release: () => void }

// Web capture uses the regular SVG ink layer.
export const createInkExport: (strokes: readonly PracticeStroke[], size: number) => InkExport | undefined = () => undefined
