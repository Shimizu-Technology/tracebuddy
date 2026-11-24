import type { ReactNode } from 'react'
import type { PressableProps, StyleProp, ViewStyle } from 'react-native'
import { Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { theme } from './theme'
import { useReduceMotion } from './useReduceMotion'

export type PressTargetProps = Pick<PressableProps, 'accessibilityLabel' | 'accessibilityHint' | 'disabled' | 'onPress' | 'onLongPress' | 'delayLongPress' | 'onAccessibilityAction' | 'accessibilityActions' | 'testID'> & {
  children: ReactNode
  haptic?: boolean
  selected?: boolean
  style?: StyleProp<ViewStyle>
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function PressTarget({ disabled, haptic, onPress, selected, style, ...props }: PressTargetProps) {
  const reduceMotion = useReduceMotion()
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))

  function setPressed(pressed: boolean) {
    if (reduceMotion) return
    scale.set(withTiming(pressed ? theme.motion.press.scale : 1, {
      duration: theme.motion.press.duration,
      reduceMotion: ReduceMotion.System,
    }))
  }

  const isDisabled = disabled || !onPress
  return (
    <AnimatedPressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, selected }}
      disabled={isDisabled}
      onPress={(event) => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
        onPress?.(event)
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[style, animatedStyle, isDisabled && { opacity: theme.opacity.disabled }]}
    />
  )
}
