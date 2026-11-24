import { memo, useMemo } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { SvgXml } from 'react-native-svg'

import { KeepsakeStampBadge } from '../../../KeepsakeStamp'
import type { SavedPracticeSession } from '../../../practiceStorageModel'
import { currentDrawingImageUri } from '../../data/drawingPhotos'
import { drawingFromPracticeSource } from '../../data/practiceSource'
import { theme } from '../../ui/theme'
import type { LiveInk } from './inkTypes'
import { PracticeInk } from './PracticeInk'

type Props = {
  side: number
  session: SavedPracticeSession
  live?: LiveInk
  inkUri?: string
  onImageLoad?: (key: string) => void
  onImageError?: (key: string) => void
}

export const DrawingDocument = memo(function DrawingDocument({ side, session, live, inkUri, onImageLoad, onImageError }: Props) {
  const { drawing, uploadedImage } = useMemo(() => drawingFromPracticeSource(session.source), [session.source])
  return (
    <View pointerEvents="none" style={[styles.page, { width: side, height: side }]}>
      <View style={[styles.cover, { opacity: session.guideOpacity }]}>
        {uploadedImage ? (
          <Image source={{ uri: currentDrawingImageUri(uploadedImage.uri) }} resizeMode="contain" style={styles.cover}
            onLoad={() => onImageLoad?.('guide-base')} onError={() => onImageError?.('guide-base')} />
        ) : <SvgXml xml={drawing.svg} width="100%" height="100%" />}
      </View>
      {session.stickers.map((sticker) => (
        <View key={sticker.stickerId} style={{
          position: 'absolute', left: side * sticker.x / 1000, top: side * sticker.y / 1000,
          width: side * sticker.width / 1000, height: side * sticker.height / 1000,
          opacity: sticker.opacity, transform: [{ rotate: `${sticker.rotation}deg` }],
        }}>
          {sticker.kind === 'image' && sticker.uri ? (
            <Image source={{ uri: currentDrawingImageUri(sticker.uri) }} resizeMode="contain" style={styles.cover}
              onLoad={() => onImageLoad?.(`sticker-${sticker.stickerId}`)} onError={() => onImageError?.(`sticker-${sticker.stickerId}`)} />
          ) : sticker.svg ? <SvgXml xml={sticker.svg} width="100%" height="100%" /> : null}
        </View>
      ))}
      {inkUri ? (
        <Image source={{ uri: inkUri }} resizeMode="contain" style={styles.cover}
          onLoad={() => onImageLoad?.('ink')} onError={() => onImageError?.('ink')} />
      ) : <PracticeInk side={side} strokes={session.strokes} live={live} />}
      {!uploadedImage && (
        <View style={[styles.cover, { opacity: Math.min(0.78, session.guideOpacity * 2) }]}>
          <SvgXml xml={drawing.svg} width="100%" height="100%" />
        </View>
      )}
      <KeepsakeStampBadge stamp={session.stamp} size={side * 0.13} />
    </View>
  )
})

const styles = StyleSheet.create({
  page: { overflow: 'hidden', backgroundColor: theme.colors.surface },
  cover: StyleSheet.absoluteFill,
})
