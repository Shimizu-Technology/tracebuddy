import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import { theme } from '../../ui/theme'
import { paperTheme } from './paperTheme'

type Props = {
  children: ReactNode
  reduceMotion: boolean
  /** Swiping down calls this. Leave it out for a card that must stay, like the camera question. */
  onDismiss?: () => void
  /** Actions stay pinned under the scrolling content, so they are reachable at the largest text sizes. */
  footer?: ReactNode
  /** Reports the card's height, so the screen can keep the guide above it. */
  onHeight?: (height: number) => void
  accessibilityLabel: string
}

const enterOffset = theme.space.xl

/** A short floating card over the bottom of the camera. It never grows past the lower part of the screen. */
export function BottomCard({ children, reduceMotion, onDismiss, footer, onHeight, accessibilityLabel }: Props) {
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const offset = useSharedValue(reduceMotion ? 0 : enterOffset)
  const shown = useSharedValue(reduceMotion ? 1 : 0)

  useEffect(() => {
    offset.set(reduceMotion ? 0 : withSpring(0, theme.motion.spring))
    shown.set(reduceMotion ? 1 : withTiming(1, { duration: theme.motion.press.duration }))
  }, [offset, reduceMotion, shown])

  const gesture = useMemo(() => Gesture.Pan()
    .enabled(Boolean(onDismiss))
    .activeOffsetY(theme.space.md)
    .failOffsetX([-theme.space.xl, theme.space.xl])
    .onChange((event) => { offset.set(Math.max(0, offset.get() + event.changeY)) })
    .onEnd((event) => {
      const { cardDismissPx, cardDismissVelocity } = paperTheme.timing
      if (onDismiss && (offset.get() > cardDismissPx || event.velocityY > cardDismissVelocity)) {
        scheduleOnRN(onDismiss)
        return
      }
      offset.set(withSpring(0, theme.motion.spring))
    }), [offset, onDismiss])

  const style = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateY: offset.get() }] }))

  return (
    <View pointerEvents="box-none" style={[styles.dock, { paddingBottom: insets.bottom + theme.space.sm, paddingLeft: insets.left + theme.space.sm, paddingRight: insets.right + theme.space.sm }]}>
      <GestureDetector gesture={gesture}>
        <Animated.View accessibilityViewIsModal={false} accessibilityLabel={accessibilityLabel} onLayout={onHeight && ((event) => onHeight(event.nativeEvent.layout.height))} style={[styles.card, { maxHeight: height * paperTheme.size.cardMaxHeightFraction }, style]}>
          {onDismiss ? <View style={styles.grabber} /> : null}
          <ScrollView bounces={false} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: paperTheme.size.cardMaxWidth,
    borderRadius: theme.radius.sheet,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    ...theme.floatingShadow,
  },
  grabber: {
    alignSelf: 'center',
    width: theme.space.xxl + theme.space.sm,
    height: theme.space.xs + 1,
    marginTop: theme.space.sm,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.hairline,
  },
  content: { padding: theme.space.xl, gap: theme.space.md },
  footer: { paddingHorizontal: theme.space.xl, paddingBottom: theme.space.xl },
})
