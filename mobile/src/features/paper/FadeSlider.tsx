import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { AccessibilityActionEvent, StyleProp, ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { Icon } from '../../ui/Icon'
import { SunDimIcon, SunIcon } from '../../ui/icons'
import { theme } from '../../ui/theme'
import { fadeFromTrack, fadePercent, stepFade, trackFraction } from './paperModel'
import { paperTheme } from './paperTheme'

type Props = {
  opacity: SharedValue<number>
  /** Changes when the fade is replaced from outside the slider, so the spoken value catches up. */
  syncKey: number
  onChangeEnd: () => void
  style?: StyleProp<ViewStyle>
}

const { fader } = paperTheme.size

/** Picture fade: up for a stronger picture, down for a fainter one. Always on screen while unlocked. */
export function FadeSlider({ opacity, syncKey, onChangeEnd, style }: Props) {
  const trackHeight = useSharedValue(1)
  const [percent, setPercent] = useState(() => fadePercent(opacity.get()))
  const [syncedKey, setSyncedKey] = useState(syncKey)
  if (syncedKey !== syncKey) {
    setSyncedKey(syncKey)
    setPercent(fadePercent(opacity.get()))
  }

  const gesture = useMemo(() => {
    const settle = () => {
      setPercent(fadePercent(opacity.get()))
      onChangeEnd()
    }
    return Gesture.Pan()
      .minDistance(0)
      .onBegin((event) => { opacity.set(fadeFromTrack(event.y, trackHeight.get())) })
      .onChange((event) => { opacity.set(fadeFromTrack(event.y, trackHeight.get())) })
      .onFinalize(() => { scheduleOnRN(settle) })
  }, [onChangeEnd, opacity, trackHeight])

  const fillStyle = useAnimatedStyle(() => ({ height: `${trackFraction(opacity.get()) * 100}%` }))
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -trackFraction(opacity.get()) * trackHeight.get() + fader.knob / 2 }],
  }))

  function onAccessibilityAction(event: AccessibilityActionEvent) {
    const direction = event.nativeEvent.actionName === 'increment' ? 1 : -1
    opacity.set(stepFade(opacity.get(), direction))
    setPercent(fadePercent(opacity.get()))
    onChangeEnd()
  }

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Picture fade"
      accessibilityHint="Swipe up for a stronger picture, down for a fainter one."
      accessibilityValue={{ min: Math.round(paperTheme.fade.min * 100), max: 100, now: percent, text: `${percent} percent` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
      style={[styles.pill, style]}
    >
      <Icon glyph={SunIcon} />
      <GestureDetector gesture={gesture}>
        <View style={styles.trackArea} onLayout={(event) => trackHeight.set(Math.max(1, event.nativeEvent.layout.height))}>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, fillStyle]} />
          </View>
          <Animated.View style={[styles.knob, knobStyle]} />
        </View>
      </GestureDetector>
      <Icon glyph={SunDimIcon} tone="muted" />
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    width: fader.width,
    alignItems: 'center',
    paddingVertical: theme.space.md,
    gap: theme.space.sm,
    borderRadius: theme.radius.full,
    backgroundColor: paperTheme.colors.glass,
    ...theme.floatingShadow,
  },
  trackArea: { flex: 1, alignSelf: 'stretch', alignItems: 'center', marginVertical: fader.knob / 2 },
  track: {
    flex: 1,
    width: fader.track,
    borderRadius: theme.radius.full,
    backgroundColor: paperTheme.colors.track,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: { width: '100%', backgroundColor: theme.colors.ink },
  knob: {
    position: 'absolute',
    bottom: 0,
    width: fader.knob,
    height: fader.knob,
    borderRadius: theme.radius.full,
    borderWidth: paperTheme.size.ring,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    ...theme.floatingShadow,
  },
})
