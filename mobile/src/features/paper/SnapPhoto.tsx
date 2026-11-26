import { useState } from 'react'
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { PaperShot } from '../../data/paperKeepsake'
import { Button } from '../../ui/Button'
import { CaretLeftIcon } from '../../ui/icons'
import { PressTarget } from '../../ui/PressTarget'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import type { Point, Size } from './paperModel'
import { GlassButton, Pill } from './PaperControls'
import { paperTheme } from './paperTheme'

const { size, colors } = paperTheme

/**
 * Aiming the photo: the live camera with the guide hidden, a box the size of the page to fit the paper in,
 * and one big shutter. Back returns to the well-done card.
 */
export function SnapAim({ page, center, ready, busy, onShoot, onBack }: {
  page: Size
  center: Point
  /** The camera is showing frames (or the Simulator's stand-in). */
  ready: boolean
  busy: boolean
  onShoot: () => void
  onBack: () => void
}) {
  const insets = useSafeAreaInsets()
  const frame = { width: page.width + size.snapFrameOutset * 2, height: page.height + size.snapFrameOutset * 2 }
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={[styles.frame, {
        left: center.x - frame.width / 2, top: center.y - frame.height / 2, width: frame.width, height: frame.height,
      }]} />
      <View pointerEvents="box-none" style={[styles.top, { top: insets.top + theme.space.sm, left: insets.left + theme.space.lg }]}>
        <GlassButton glyph={CaretLeftIcon} label="Back" onPress={onBack} />
      </View>
      {/* In the Back button's row, so it never covers the box (held sideways, the box reaches the top). */}
      <Pill text="Fit your paper in the box" announce style={[styles.absolute, { top: insets.top + theme.space.sm * 2 }]} />
      <View pointerEvents="box-none" style={[styles.shutterDock, { paddingBottom: insets.bottom + theme.space.md }]}>
        <PressTarget accessibilityLabel="Take the photo" accessibilityHint={ready ? undefined : 'The camera is starting'} haptic
          disabled={!ready || busy} onPress={onShoot} style={[styles.shutter, (!ready || busy) && styles.dimmed]}>
          <View style={styles.shutterCore} />
        </PressTarget>
        <Text variant="label" style={styles.onCamera} importantForAccessibility="no" accessibilityElementsHidden>Snap</Text>
      </View>
    </View>
  )
}

/** The photo just taken, shown whole, with Retake and Keep it. */
export function SnapReview({ shot, saving, onRetake, onKeep }: { shot: PaperShot; saving: boolean; onRetake: () => void; onKeep: () => void }) {
  const insets = useSafeAreaInsets()
  const [failed, setFailed] = useState(false)
  const { width, height } = useWindowDimensions()
  // Held sideways, the question and buttons move beside the photo so it keeps the full height.
  const wide = width > height
  const question = <Text variant="heading" accessibilityRole="header" style={[styles.onCamera, styles.center]}>Keep this photo?</Text>
  return (
    <View style={[StyleSheet.absoluteFill, styles.review, wide && styles.wide, {
      paddingTop: insets.top + theme.space.md,
      paddingBottom: insets.bottom + theme.space.md,
      paddingLeft: insets.left + theme.space.lg,
      paddingRight: insets.right + theme.space.lg,
    }]}>
      {wide ? null : question}
      <View style={styles.photoArea}>
        {failed ? <Text style={[styles.onCamera, styles.center]}>This photo couldn’t open. Take it again.</Text> : (
          <Image source={{ uri: shot.uri }} resizeMode="contain" style={StyleSheet.absoluteFill}
            accessible accessibilityRole="image" accessibilityLabel="The photo of your drawing" onError={() => setFailed(true)} />
        )}
      </View>
      <View style={wide ? styles.side : styles.actions}>
        {wide ? question : null}
        <Button label="Retake" variant="secondary" disabled={saving} onPress={onRetake} style={!wide && styles.action} />
        <Button label={saving ? 'Keeping…' : 'Keep it'} haptic disabled={saving || failed} onPress={onKeep} style={!wide && styles.action}
          accessibilityHint="Saves the photo in My drawings" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  absolute: { position: 'absolute' },
  frame: {
    position: 'absolute',
    borderRadius: size.frame.radius,
    borderWidth: size.frame.handleStroke,
    borderStyle: 'dashed',
    borderColor: colors.onCamera,
  },
  top: { position: 'absolute' },
  shutterDock: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: theme.space.xs },
  shutter: {
    width: size.lockButton,
    height: size.lockButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    borderWidth: size.shutterRing,
    borderColor: colors.onCamera,
    ...theme.floatingShadow,
  },
  shutterCore: {
    width: size.lockButton - size.shutterRing * 4,
    height: size.lockButton - size.shutterRing * 4,
    borderRadius: theme.radius.full,
    backgroundColor: colors.onCamera,
  },
  dimmed: { opacity: theme.opacity.disabled },
  onCamera: { color: colors.onCamera, textShadowColor: colors.scrim, textShadowRadius: theme.space.xs },
  center: { textAlign: 'center' },
  review: { backgroundColor: colors.backdrop, gap: theme.space.md },
  wide: { flexDirection: 'row' },
  side: { width: size.sideColumn, justifyContent: 'center', gap: theme.space.md },
  photoArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.md, alignSelf: 'center', width: '100%', maxWidth: size.cardMaxWidth },
  action: { flexGrow: 1 },
})
