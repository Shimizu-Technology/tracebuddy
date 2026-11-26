import { memo } from 'react'
import { Image, View } from 'react-native'
import type { SavedPracticeSession } from '../../../practiceStorageModel'
import { lineForSource } from '../../data/catalog'
import { currentDrawingImageUri } from '../../data/drawingPhotos'
import { usePictureLine } from '../../data/usePictureLine'
import { DrawingDocument } from '../draw/DrawingDocument'
import { PictureLineFeedback } from '../picture/PictureLineFeedback'

export const DrawingThumbnail = memo(function DrawingThumbnail({ side, session }: { side: number; session: SavedPracticeSession }) {
  if (session.paperPhoto) {
    return <Image accessibilityElementsHidden importantForAccessibility="no-hide-descendants" resizeMode="cover"
      source={{ uri: currentDrawingImageUri(session.paperPhoto.uri) }} style={{ width: side, height: side }} />
  }
  return <InkThumbnail side={side} session={session} />
})

function InkThumbnail({ side, session }: { side: number; session: SavedPracticeSession }) {
  const line = usePictureLine({ line: lineForSource(session.source) })
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: side, height: side }}>
    {line.status === 'ready' ? <DrawingDocument side={side} session={session} guideSvg={line.xml} /> : <PictureLineFeedback status={line.status} />}
  </View>
}
