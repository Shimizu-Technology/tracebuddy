import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Alert, Pressable, StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

import { childExitHoldMs } from '../../../nativeSafetyModel'
import { Icon } from '../../ui/Icon'
import { LockIcon } from '../../ui/icons'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { paperTheme } from './paperTheme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const size = paperTheme.size.badge
const ringWidth = paperTheme.size.ring + 2
const radius = (size - ringWidth) / 2
const circumference = 2 * Math.PI * radius

function confirmUnlock(onUnlock: () => void) {
  Alert.alert('Unlock the controls?', 'The picture can move again and the buttons come back.', [
    { text: 'Stay locked', style: 'cancel' },
    { text: 'Unlock', onPress: onUnlock },
  ])
}

/** The only control in child mode. A 1.5-second hold unlocks; a tap only explains how. */
export function LockBadge({ onUnlock, style }: { onUnlock: () => void; style?: StyleProp<ViewStyle> }) {
  const progress = useSharedValue(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completed = useRef(false)
  const [hint, setHint] = useState(false)
  const [screenReader, setScreenReader] = useState(false)

  useEffect(() => {
    let active = true
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => { if (active) setScreenReader(enabled) }).catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader)
    return () => {
      active = false
      subscription.remove()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  useEffect(() => {
    if (!hint) return undefined
    const hide = setTimeout(() => setHint(false), paperTheme.timing.toastMs)
    return () => clearTimeout(hide)
  }, [hint])

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.get()) }))

  function startHold() {
    if (screenReader) return
    completed.current = false
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    progress.set(withTiming(1, { duration: childExitHoldMs, easing: Easing.linear }))
    timer.current = setTimeout(() => {
      completed.current = true
      timer.current = null
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      onUnlock()
    }, childExitHoldMs)
  }

  function endHold() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    // Letting go is quick; holding is slow and deliberate.
    progress.set(withTiming(0, { duration: theme.motion.press.duration, easing: Easing.out(Easing.cubic) }))
  }

  function press() {
    if (screenReader) confirmUnlock(onUnlock)
    else if (!completed.current) setHint(true)
  }

  return (
    <View style={[styles.row, style]} pointerEvents="box-none">
      {hint ? (
        <View style={styles.hint} accessibilityLiveRegion="polite">
          <Text variant="label" style={styles.hintText}>Hold to unlock</Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Locked"
        accessibilityHint="Double-tap to unlock the controls."
        accessibilityActions={[{ name: 'activate' }, { name: 'unlock', label: 'Unlock controls' }]}
        onAccessibilityAction={() => confirmUnlock(onUnlock)}
        onPressIn={startHold}
        onPressOut={endHold}
        onPress={press}
        style={styles.badge}
      >
        <Svg width={size} height={size} style={styles.ring}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={theme.colors.coral}
            strokeWidth={ringWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            fill="none"
            animatedProps={ringProps}
          />
        </Svg>
        <Icon glyph={LockIcon} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  hint: {
    flexShrink: 1,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.full,
    backgroundColor: paperTheme.colors.toast,
  },
  hintText: { color: paperTheme.colors.onCamera },
  badge: {
    width: size,
    height: size,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paperTheme.colors.glass,
    ...theme.floatingShadow,
  },
  ring: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
})
