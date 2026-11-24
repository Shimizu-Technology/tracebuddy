import { memo } from 'react'
import { View } from 'react-native'
import type { SavedPracticeSession } from '../../../practiceStorageModel'
import { DrawingDocument } from '../draw/DrawingDocument'

export const DrawingThumbnail = memo(function DrawingThumbnail({ side, session }: { side: number; session: SavedPracticeSession }) {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><DrawingDocument side={side} session={session} /></View>
})
