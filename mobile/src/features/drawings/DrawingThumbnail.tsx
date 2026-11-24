import { memo } from 'react'
import { View } from 'react-native'
import type { SavedPracticeSession } from '../../../practiceStorageModel'
import { lineForSource } from '../../data/catalog'
import { usePictureLine } from '../../data/usePictureLine'
import { DrawingDocument } from '../draw/DrawingDocument'
import { PictureLineFeedback } from '../picture/PictureLineFeedback'

export const DrawingThumbnail = memo(function DrawingThumbnail({ side, session }: { side: number; session: SavedPracticeSession }) {
  const line = usePictureLine({ line: lineForSource(session.source) })
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: side, height: side }}>
    {line.status === 'ready' ? <DrawingDocument side={side} session={session} guideSvg={line.xml} /> : <PictureLineFeedback status={line.status} />}
  </View>
})
