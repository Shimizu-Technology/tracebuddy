import { useCallback, useEffect, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import type { AccessibilityActionEvent } from 'react-native'
import { Image } from 'expo-image'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { SvgXml } from 'react-native-svg'

import { theme } from '../../ui/theme'
import { accessibilityPose, guideAccessibilityActions } from './guideMotion'
import { fitArt, lightLinesSvg } from './paperModel'
import type { Point, Size } from './paperModel'
import type { PaperPicture } from './pictureSource'
import { paperTheme } from './paperTheme'
import { useGuideGesture } from './useGuideGesture'

const cameraLimits = paperTheme.scale

export type GuideValues = {
  x: SharedValue<number>
  y: SharedValue<number>
  scale: SharedValue<number>
  rotation: SharedValue<number>
  opacity: SharedValue<number>
}

type Props = {
  picture: PaperPicture
  values: GuideValues
  /** The fitted page at scale 1, and its resting center in stage coordinates. */
  page: Size
  center: Point
  stage: Size
  locked: boolean
  lightLines: boolean
  mirror: boolean
  reduceMotion: boolean
  /** Changes when the setup is replaced from outside a gesture (restored, page flip), so the picture is laid out again. */
  layoutKey: number
  gestureActive: SharedValue<number>
  onGestureStart: () => void
  onGestureEnd: () => void
}

export function GuideLayer({ picture, values, page, center, stage, locked, lightLines, mirror, reduceMotion, layoutKey, gestureActive, onGestureStart, onGestureEnd }: Props) {
  const { x, y, scale, rotation, opacity } = values
  const art = fitArt(page)
  // The picture is laid out at this scale and only transformed in between, so it is redrawn sharp after each gesture.
  const renderScale = useSharedValue(scale.get())
  useEffect(() => { renderScale.set(scale.get()) }, [layoutKey, renderScale, scale])

  const onEnd = useCallback(() => {
    renderScale.set(scale.get())
    onGestureEnd()
  }, [onGestureEnd, renderScale, scale])
  const gesture = useGuideGesture({ values, rest: center, stage, handlePage: page, limits: cameraLimits, enabled: !locked, active: gestureActive, onStart: onGestureStart, onEnd })

  const artStyle = useAnimatedStyle(() => {
    const laidOut = renderScale.get()
    const width = art.width * laidOut
    const height = art.height * laidOut
    const ratio = scale.get() / laidOut
    return {
      left: center.x - width / 2,
      top: center.y - height / 2,
      width,
      height,
      opacity: opacity.get(),
      transform: [
        { translateX: x.get() },
        { translateY: y.get() },
        { rotate: `${rotation.get()}deg` },
        { scaleX: mirror ? -ratio : ratio },
        { scaleY: ratio },
      ],
    }
  }, [art.height, art.width, center.x, center.y, mirror])

  // The frame resizes instead of scaling, so its line and handles keep the same weight at any size.
  const frameStyle = useAnimatedStyle(() => {
    const { outset } = paperTheme.size.frame
    const width = page.width * scale.get() + outset * 2
    const height = page.height * scale.get() + outset * 2
    return {
      left: center.x - width / 2,
      top: center.y - height / 2,
      width,
      height,
      transform: [{ translateX: x.get() }, { translateY: y.get() }, { rotate: `${rotation.get()}deg` }],
    }
  }, [center.x, center.y, page.height, page.width])

  const frameVisibility = useAnimatedStyle(() => ({
    opacity: reduceMotion ? (locked ? 0 : 1) : withTiming(locked ? 0 : 1, { duration: theme.motion.press.duration }),
  }), [locked, reduceMotion])

  const xml = useMemo(() => picture.kind === 'drawing' ? (lightLines ? lightLinesSvg(picture.svg) : picture.svg) : '', [lightLines, picture])

  function onAccessibilityAction(event: AccessibilityActionEvent) {
    if (locked) return
    const next = accessibilityPose({ x: x.get(), y: y.get(), scale: scale.get(), rotation: rotation.get() }, event.nativeEvent.actionName, cameraLimits)
    scale.set(next.scale)
    rotation.set(next.rotation)
    onEnd()
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill} collapsable={false}>
        <Animated.View pointerEvents="none" style={[styles.art, artStyle]}>
          {picture.kind === 'drawing'
            ? <SvgXml xml={xml} width="100%" height="100%" />
            : <Image source={{ uri: picture.uri }} contentFit="contain" style={styles.fill} />}
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.frameBox, frameStyle, frameVisibility]}>
          <View style={styles.frame} />
          <View style={[styles.handle, styles.topLeft]} />
          <View style={[styles.handle, styles.bottomRight]} />
        </Animated.View>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${picture.name} picture`}
          accessibilityHint={locked ? 'Locked.' : 'Drag to move, pinch to resize, twist to turn. Swipe up or down for more actions.'}
          accessibilityActions={locked ? [] : guideAccessibilityActions}
          onAccessibilityAction={onAccessibilityAction}
          pointerEvents="none"
          style={[styles.accessibilityBox, { left: center.x - page.width / 2, top: center.y - page.height / 2, width: page.width, height: page.height }]}
        />
      </View>
    </GestureDetector>
  )
}

const { frame } = paperTheme.size
const handleOffset = -frame.handle / 2 - frame.handleStroke / 2

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  art: { position: 'absolute' },
  frameBox: { position: 'absolute' },
  frame: {
    ...StyleSheet.absoluteFill,
    borderWidth: frame.stroke,
    borderStyle: 'dashed',
    borderColor: paperTheme.colors.frame,
    borderRadius: frame.radius,
  },
  handle: {
    position: 'absolute',
    width: frame.handle + frame.handleStroke,
    height: frame.handle + frame.handleStroke,
    borderRadius: theme.radius.full,
    borderWidth: frame.handleStroke,
    borderColor: paperTheme.colors.frame,
    backgroundColor: theme.colors.surface,
    ...theme.floatingShadow,
  },
  topLeft: { left: handleOffset, top: handleOffset },
  bottomRight: { right: handleOffset, bottom: handleOffset },
  accessibilityBox: { position: 'absolute' },
})
