import { File, Paths } from 'expo-file-system'

import type { PracticeStroke } from '../../../practiceStorageModel'
import { createPracticeSessionId } from '../../data/practiceSource'
import type { InkExport } from './createInkExport'
import { renderInkPng } from './recordInk'

export function createInkExport(strokes: readonly PracticeStroke[], size: number): InkExport {
  const png = renderInkPng(strokes, size)
  const file = new File(Paths.cache, `ink-${createPracticeSessionId()}.png`)
  const release = () => {
    try { if (file.exists) file.delete() } catch { /* Temp storage remains purgeable. */ }
  }
  try {
    file.write(png)
    return { uri: file.uri, release }
  } catch (error) {
    release()
    throw error
  }
}
