import { useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Ref } from 'react'
import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import type { GestureTouchEvent } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets'

import { documentPoint } from '../../../practiceModel'
import type { Point, Viewport } from '../../../practiceModel'
import { brushTools, documentStrokeWidth } from '../../../practiceStorageModel'
import type { PracticeStroke, SavedPracticeSession } from '../../../practiceStorageModel'
import { theme } from '../../ui/theme'
import { DrawingDocument } from './DrawingDocument'
import type { LiveInk } from './inkTypes'

const emptyPath = 'M 0 0'
const fit: Viewport = { x: 0, y: 0, scale: 1 }

type Finger = GestureTouchEvent['allTouches'][number]
type Pair = { ids: [number, number]; middle: Point; distance: number; viewport: Viewport }
type Active = { id: number; serial: number; point: Point; moved: boolean; stroke: PracticeStroke }
export type CanvasHandle = { fit: () => void; flush: () => Promise<void> }

type Props = {
  ref: Ref<CanvasHandle>
  side: number
  session: SavedPracticeSession
  disabled: boolean
  onStroke: (stroke: PracticeStroke) => void
}

function coordinate(value: number) {
  'worklet'
  return Math.round(value * 100) / 100
}

function pairPosition(first: Finger, second: Finger) {
  'worklet'
  return {
    middle: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)),
  }
}

function boundTranslation(value: number, scale: number, side: number) {
  'worklet'
  return Math.max(side * (1 - scale), Math.min(0, value))
}

export function DrawingCanvas({ ref, side, session, disabled, onStroke }: Props) {
  const viewport = useSharedValue(fit)
  const livePath = useSharedValue(emptyPath)
  const liveWidth = useSharedValue(1)
  const active = useSharedValue<Active | null>(null)
  const sequence = useSharedValue(0)
  const pair = useSharedValue<Pair | null>(null)
  const blockedUntilLift = useSharedValue(false)
  const [lastCommit, setLastCommit] = useState(0)
  const brush = brushTools.find(({ id }) => id === session.brushToolId) ?? brushTools[1]
  const markerWidth = session.markerWidth
  const style = useMemo<LiveInk['style']>(() => ({
    color: session.markerColor, opacity: brush.opacity, mode: brush.mode, dasharray: brush.dasharray,
  }), [brush, session.markerColor])
  const live = useMemo(() => ({ path: livePath, width: liveWidth, style }), [livePath, liveWidth, style])

  function commit(stroke: PracticeStroke, serial: number) {
    setLastCommit(serial)
    onStroke(stroke)
  }

  function finishStroke(allowDot: boolean) {
    'worklet'
    const current = active.get()
    if (!current) return
    active.set(null)
    if (current.moved || allowDot) {
      scheduleOnRN(commit, current.stroke, current.serial)
    } else {
      livePath.set(emptyPath)
    }
  }

  useImperativeHandle(ref, () => ({
    fit: () => viewport.set(fit),
    flush: () => new Promise<void>((resolve) => {
      // The completion runs on the JS queue after every commit already sent
      // by the UI recognizer, including one finalized by this flush.
      scheduleOnUI(() => {
        'worklet'
        if (active.get()) {
          finishStroke(true)
          blockedUntilLift.set(true)
        }
        scheduleOnRN(resolve)
      })
    }),
  }))

  useLayoutEffect(() => {
    const serial = lastCommit
    if (!serial) return
    scheduleOnUI(() => {
      'worklet'
      if (sequence.get() === serial && !active.get()) livePath.set(emptyPath)
    })
  }, [active, lastCommit, livePath, sequence])

  const previousSide = useRef(side)
  useLayoutEffect(() => {
    const ratio = side / previousSide.current
    previousSide.current = side
    if (ratio === 1) return
    scheduleOnUI(() => {
      'worklet'
      const old = viewport.get()
      viewport.set({ ...old, x: old.x * ratio, y: old.y * ratio })
    })
  }, [side, viewport])

  const transform = useAnimatedStyle(() => {
    const value = viewport.get()
    return { transform: [{ translateX: value.x }, { translateY: value.y }, { scale: value.scale }] }
  })

  const gesture = Gesture.Manual()
    .enabled(!disabled)
    .shouldCancelWhenOutside(false)
    .onTouchesDown((event, manager) => {
      const [first, second] = event.allTouches
      if (!first) return
      if (second) {
        finishStroke(false)
        blockedUntilLift.set(true)
        if (!pair.get()) pair.set({ ids: [first.id, second.id], ...pairPosition(first, second), viewport: viewport.get() })
        return
      }
      if (blockedUntilLift.get() || active.get()) return
      manager.begin()
      manager.activate()
      const point = documentPoint(first, { width: side, height: side }, viewport.get())
      if (!point) return
      const width = documentStrokeWidth(markerWidth, brush.widthMultiplier, side, viewport.get().scale)
      const x = coordinate(point.x)
      const y = coordinate(point.y)
      // A tiny segment gives an unmoved finger the same round dot in both renderers.
      const path = `M ${x} ${y} L ${coordinate(x + 0.01)} ${y}`
      const serial = sequence.get() + 1
      sequence.set(serial)
      active.set({ id: first.id, serial, point, moved: false, stroke: { ...style, path, width } })
      liveWidth.set(width)
      livePath.set(path)
    })
    .onTouchesMove(({ allTouches }) => {
      const multi = pair.get()
      if (multi) {
        const first = allTouches.find(({ id }) => id === multi.ids[0])
        const second = allTouches.find(({ id }) => id === multi.ids[1])
        if (!first || !second) return
        const next = pairPosition(first, second)
        const scale = Math.min(5, Math.max(1, multi.viewport.scale * next.distance / multi.distance))
        const ratio = scale / multi.viewport.scale
        const x = next.middle.x - (multi.middle.x - multi.viewport.x) * ratio
        const y = next.middle.y - (multi.middle.y - multi.viewport.y) * ratio
        viewport.set({ scale, x: boundTranslation(x, scale, side), y: boundTranslation(y, scale, side) })
        return
      }
      const current = active.get()
      if (!current || blockedUntilLift.get()) return
      const finger = allTouches.find(({ id }) => id === current.id)
      if (!finger) return
      const point = documentPoint(finger, { width: side, height: side }, viewport.get())
      if (!point) {
        finishStroke(true)
        blockedUntilLift.set(true)
        return
      }
      if (Math.hypot(point.x - current.point.x, point.y - current.point.y) < 0.4) return
      const path = `${current.stroke.path} L ${coordinate(point.x)} ${coordinate(point.y)}`
      active.set({ ...current, point, moved: true, stroke: { ...current.stroke, path } })
      livePath.set(path)
    })
    .onTouchesUp(({ changedTouches, allTouches }, manager) => {
      const left = (id: number) => changedTouches.some((finger) => finger.id === id)
      const current = active.get()
      if (current && left(current.id)) finishStroke(true)
      const multi = pair.get()
      if (multi && multi.ids.some(left)) pair.set(null)
      if (allTouches.every(({ id }) => left(id))) {
        blockedUntilLift.set(false)
        manager.end()
      }
    })
    .onTouchesCancelled((_event, manager) => {
      finishStroke(false)
      pair.set(null)
      blockedUntilLift.set(false)
      manager.fail()
    })
    .onFinalize(() => {
      finishStroke(false)
      pair.set(null)
      blockedUntilLift.set(false)
    })

  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        accessible
        accessibilityLabel="Drawing canvas"
        accessibilityHint="Draw with one finger. Pinch and drag with two fingers to zoom and move."
        style={[styles.viewport, { width: side, height: side }]}
      >
        <Animated.View pointerEvents="none" style={[styles.document, transform]}>
          <DrawingDocument side={side} session={session} live={live} />
        </Animated.View>
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  viewport: { overflow: 'hidden', backgroundColor: theme.colors.surface, borderRadius: theme.radius.tile },
  document: { transformOrigin: 'top left' },
})
