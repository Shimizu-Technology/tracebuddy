import { useEffect, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import type { AccessibilityActionEvent } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { SvgXml } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'

import { theme } from '../../ui/theme'
import {
  clampOffset, clampScale, fitArt, handleTransform, hitHandle, isSnapped, lightLinesSvg, normalizeDegrees,
  rotatePoint, scaleAbout, snapRotation,
} from './paperModel'
import type { Point, Size } from './paperModel'
import type { PaperPicture } from './pictureSource'
import { paperTheme } from './paperTheme'

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
  onGestureStart: () => void
  onGestureEnd: () => void
}

const moveMode = 0
const handleMode = 1
const accessibilityScaleStep = 0.1
const accessibilityTurnStep = 90

function snapHaptic() {
  void Haptics.selectionAsync().catch(() => undefined)
}

export function GuideLayer({ picture, values, page, center, stage, locked, lightLines, mirror, reduceMotion, layoutKey, onGestureStart, onGestureEnd }: Props) {
  const { x, y, scale, rotation, opacity } = values
  const art = fitArt(page)
  const mode = useSharedValue(moveMode)
  const start = useSharedValue<Point>({ x: 0, y: 0 })
  const startScale = useSharedValue(1)
  const startRotation = useSharedValue(0)
  const rawRotation = useSharedValue(0)
  const wasSnapped = useSharedValue(true)
  // The picture is laid out at this scale and only transformed in between, so it is redrawn sharp after each gesture.
  const renderScale = useSharedValue(scale.get())
  useEffect(() => { renderScale.set(scale.get()) }, [layoutKey, renderScale, scale])

  const gesture = useMemo(() => {
    const guideCenter = () => {
      'worklet'
      return { x: center.x + x.get(), y: center.y + y.get() }
    }
    const moveCenterTo = (next: Point) => {
      'worklet'
      const offset = clampOffset({ x: next.x - center.x, y: next.y - center.y }, stage)
      x.set(offset.x)
      y.set(offset.y)
    }
    const applyRotation = (raw: number) => {
      'worklet'
      const snapped = isSnapped(raw)
      if (snapped && !wasSnapped.get()) scheduleOnRN(snapHaptic)
      wasSnapped.set(snapped)
      rotation.set(snapRotation(raw))
    }
    const begin = () => {
      'worklet'
      rawRotation.set(rotation.get())
      wasSnapped.set(isSnapped(rotation.get()))
    }
    const finish = () => {
      'worklet'
      rotation.set(normalizeDegrees(rotation.get()))
      renderScale.set(scale.get())
      scheduleOnRN(onGestureEnd)
    }

    const pan = Gesture.Pan()
      .enabled(!locked)
      .maxPointers(2)
      .onBegin((event) => {
        const touch = { x: event.x, y: event.y }
        mode.set(hitHandle(touch, guideCenter(), page, scale.get(), rotation.get()) ? handleMode : moveMode)
        start.set(touch)
        startScale.set(scale.get())
        startRotation.set(rotation.get())
        begin()
      })
      .onStart(() => { scheduleOnRN(onGestureStart) })
      .onChange((event) => {
        if (mode.get() === handleMode && event.numberOfPointers === 1) {
          const next = handleTransform(start.get(), { x: event.x, y: event.y }, guideCenter(), startScale.get(), startRotation.get())
          scale.set(next.scale)
          applyRotation(next.rotation)
          return
        }
        mode.set(moveMode)
        moveCenterTo({ x: guideCenter().x + event.changeX, y: guideCenter().y + event.changeY })
      })
      .onEnd(finish)

    const pinch = Gesture.Pinch()
      .enabled(!locked)
      .onStart(() => { scheduleOnRN(onGestureStart) })
      .onChange((event) => {
        const previous = scale.get()
        const next = clampScale(previous * event.scaleChange)
        scale.set(next)
        moveCenterTo(scaleAbout(guideCenter(), { x: event.focalX, y: event.focalY }, next / previous))
      })
      .onEnd(finish)

    const turn = Gesture.Rotation()
      .enabled(!locked)
      .onBegin(begin)
      .onStart(() => { scheduleOnRN(onGestureStart) })
      .onChange((event) => {
        const previous = rotation.get()
        rawRotation.set(rawRotation.get() + (event.rotationChange * 180) / Math.PI)
        applyRotation(rawRotation.get())
        moveCenterTo(rotatePoint(guideCenter(), { x: event.anchorX, y: event.anchorY }, rotation.get() - previous))
      })
      .onEnd(finish)

    return Gesture.Simultaneous(pan, pinch, turn)
  }, [center, locked, mode, onGestureEnd, onGestureStart, page, rawRotation, renderScale, rotation, scale, stage, start, startRotation, startScale, wasSnapped, x, y])

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
    const action = event.nativeEvent.actionName
    if (action === 'bigger' || action === 'smaller') {
      scale.set(clampScale(scale.get() + (action === 'bigger' ? accessibilityScaleStep : -accessibilityScaleStep)))
    } else if (action === 'turnLeft' || action === 'turnRight') {
      rotation.set(normalizeDegrees(snapRotation(rotation.get()) + (action === 'turnRight' ? accessibilityTurnStep : -accessibilityTurnStep)))
    }
    renderScale.set(scale.get())
    onGestureEnd()
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
          accessibilityActions={locked ? [] : [
            { name: 'bigger', label: 'Make bigger' },
            { name: 'smaller', label: 'Make smaller' },
            { name: 'turnLeft', label: 'Turn left' },
            { name: 'turnRight', label: 'Turn right' },
          ]}
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
