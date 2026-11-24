import { useRef } from 'react'
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native'
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

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

  const held = useRef(false)
  const dialogOpen = useRef(false)

  function askToConfirm() {
    if (disabled || dialogOpen.current) return
    // React Native Web's Alert does nothing, so use the browser's confirm there.
    if (Platform.OS === 'web') {
      const confirm = (globalThis as { confirm?: (message: string) => boolean }).confirm
      if (confirm?.(`${label}?`)) onConfirm()
      return
    }
    dialogOpen.current = true
    Alert.alert(`${label}?`, undefined, [
      { text: 'Cancel', style: 'cancel', onPress: () => { dialogOpen.current = false } },
      { text: label, style: 'destructive', onPress: () => {
        dialogOpen.current = false
        onConfirm()
      } },
    ], { cancelable: false })
  }

  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label}
      accessibilityHint="Opens a confirmation."
      accessibilityActions={[{ name: 'activate', label: `Confirm ${label}` }]}
      onAccessibilityAction={({ nativeEvent }) => { if (nativeEvent.actionName === 'activate') askToConfirm() }}
      accessibilityState={{ disabled }}
      disabled={disabled} delayLongPress={holdMs}
      // A touch tap never confirms, so a child can't clear work with two taps. VoiceOver, Switch Control and
      // Full Keyboard Access use the activate action; on web, Enter and clicks use the browser confirm.
      onPress={() => { if (Platform.OS === 'web' && !held.current) askToConfirm() }}
      onPressIn={() => {
        held.current = false
        if (!reduceMotion) progress.set(withTiming(1, { duration: holdMs, easing: Easing.linear, reduceMotion: ReduceMotion.Never }))
      }}
      onPressOut={() => {
        cancelAnimation(progress)
        progress.set(0)
      }}
      onLongPress={() => {
        if (held.current || dialogOpen.current) return
        held.current = true
        onConfirm()
      }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {({ pressed }) => (
        <>
          <Animated.View pointerEvents="none" style={[styles.progress, fill]} />
          <Icon glyph={glyph} />
          <View style={styles.text}>
            <Text variant="body" style={styles.label}>{label}</Text>
            <Text variant="label" tone="muted">{reduceMotion && pressed ? 'Keep holding…' : 'Hold to confirm'}</Text>
          </View>
        </>
      )}
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
