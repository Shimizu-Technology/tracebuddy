import type { SharedValue } from 'react-native-reanimated'
import type { PracticeStroke } from '../../../practiceStorageModel'

export type LiveInk = {
  path: SharedValue<string>
  width: SharedValue<number>
  style: Omit<PracticeStroke, 'path' | 'width'>
}

export type InkProps = { side: number; strokes: readonly PracticeStroke[]; live?: LiveInk }
