import { StyleSheet, View } from 'react-native'
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Pressable } from 'react-native'

import { Icon } from './Icon'
import type { IconGlyph } from './Icon'
import { Text } from './Text'
import { theme } from './theme'
import { useReduceMotion } from './useReduceMotion'

const holdMs = 1500

export function HoldButton({ label, glyph, disabled, onConfirm }: { label: string; glyph: IconGlyph; disabled?: boolean; onConfirm: () => void }) {
  const progress = useSharedValue(0)
  const reduceMotion = useReduceMotion()
  const fill = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }))

  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label}
      accessibilityHint="Press and hold for one and a half seconds to confirm"
      accessibilityState={{ disabled }}
      disabled={disabled} delayLongPress={holdMs}
      onPressIn={() => {
        if (!reduceMotion) progress.set(withTiming(1, { duration: holdMs, easing: Easing.linear, reduceMotion: ReduceMotion.Never }))
      }}
      onPressOut={() => {
        cancelAnimation(progress)
        progress.set(0)
      }}
      onLongPress={onConfirm}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Animated.View pointerEvents="none" style={[styles.progress, fill]} />
      <Icon glyph={glyph} />
      <View style={styles.text}>
        <Text variant="body" style={styles.label}>{label}</Text>
        <Text variant="label" tone="muted">Hold to confirm</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: theme.target.child, minWidth: theme.target.child, paddingHorizontal: theme.space.lg, paddingVertical: theme.space.sm,
    borderRadius: theme.radius.tile, overflow: 'hidden', backgroundColor: theme.colors.background,
    flexDirection: 'row', alignItems: 'center', gap: theme.space.md,
  },
  pressed: { backgroundColor: theme.pastels.peach },
  label: { fontFamily: theme.fontFamily[800] },
  progress: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: theme.pastels.rose },
  text: { flex: 1 },
  disabled: { opacity: theme.opacity.disabled },
})
