import { useEffect } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'

import { Button } from '../../ui/Button'
import { PictureArt } from '../picture/PictureArt'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { BottomCard } from './BottomCard'
import type { PaperPicture } from './paperPicture'
import { paperTheme } from './paperTheme'

type Piece = { vx: number; vy: number; spin: number; color: string }

const pieceCount = 28
const gravity = 1.1
// The Reduce Motion version shows the burst frozen part-way, as a still picture.
const stillMoment = 0.32

// A fixed pseudo-random spread so the burst looks the same every time and tests stay stable.
function makePieces(): Piece[] {
  const colors = paperTheme.colors.confetti
  return Array.from({ length: pieceCount }, (_, index) => {
    const a = Math.sin(index * 12.9898) * 43758.5453
    const b = Math.sin(index * 78.233) * 12345.6789
    const r1 = a - Math.floor(a)
    const r2 = b - Math.floor(b)
    return { vx: (r1 - 0.5) * 1.4, vy: -0.55 - r2 * 0.7, spin: (r1 - 0.5) * 720, color: colors[index % colors.length] }
  })
}

const pieces = makePieces()

function ConfettiPiece({ piece, progress, origin, reach }: { piece: Piece; progress: SharedValue<number>; origin: { x: number; y: number }; reach: number }) {
  const style = useAnimatedStyle(() => {
    const t = progress.get()
    return {
      opacity: t < stillMoment ? 1 : Math.max(0, 1 - (t - stillMoment) / (1 - stillMoment)),
      transform: [
        { translateX: origin.x + piece.vx * reach * t },
        { translateY: origin.y + (piece.vy * t + gravity * t * t) * reach },
        { rotate: `${piece.spin * t}deg` },
      ],
    }
  })
  return <Animated.View style={[styles.piece, { backgroundColor: piece.color }, style]} />
}

function Confetti({ reduceMotion }: { reduceMotion: boolean }) {
  const { width, height } = useWindowDimensions()
  const progress = useSharedValue(reduceMotion ? stillMoment : 0)
  useEffect(() => {
    if (reduceMotion) progress.set(stillMoment)
    else progress.set(withTiming(1, { duration: paperTheme.timing.confettiMs, easing: Easing.out(Easing.quad) }))
  }, [progress, reduceMotion])
  const origin = { x: width / 2, y: height * 0.38 }
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, reduceMotion && styles.still]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((piece, index) => <ConfettiPiece key={index} piece={piece} progress={progress} origin={origin} reach={Math.min(width, height) * 0.9} />)}
    </View>
  )
}

type Props = {
  picture: PaperPicture
  reduceMotion: boolean
  onKeepTracing: () => void
  onNewPicture: () => void
}

/** A short, gentle well-done moment after tracing on paper. */
export function Celebration({ picture, reduceMotion, onKeepTracing, onNewPicture }: Props) {
  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
  }, [])

  return (
    <>
      <BottomCard
        reduceMotion={reduceMotion}
        onDismiss={onKeepTracing}
        accessibilityLabel="Great tracing!"
        footer={(
          <View style={styles.actions}>
            <Button label="Keep tracing" variant="secondary" onPress={onKeepTracing} style={styles.action} />
            <Button label="New picture" haptic onPress={onNewPicture} style={styles.action} />
          </View>
        )}
      >
        <Text variant="title" accessibilityRole="header" style={styles.center} accessibilityLiveRegion="polite">Great tracing!</Text>
        <View style={styles.preview}>
          <PictureArt picture={picture.picture} />
        </View>
      </BottomCard>
      <Confetti reduceMotion={reduceMotion} />
    </>
  )
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  preview: {
    alignSelf: 'center',
    width: paperTheme.size.previewArt,
    height: paperTheme.size.previewArt,
    padding: theme.space.md,
    borderRadius: theme.radius.tile,
    backgroundColor: theme.colors.background,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.md },
  // Natural width, so the buttons stack instead of breaking words at large text sizes.
  action: { flexGrow: 1 },
  piece: { position: 'absolute', left: 0, top: 0, width: paperTheme.size.confettiPiece.width, height: paperTheme.size.confettiPiece.height, borderRadius: 1 },
  still: { opacity: paperTheme.opacity.stillConfetti },
})
