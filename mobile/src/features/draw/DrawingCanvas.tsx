import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets'

import { documentPoint } from '../../../practiceModel'
import type { Point, Viewport } from '../../../practiceModel'
import { coloringBrushTools, documentStrokeWidth } from '../../../practiceStorageModel'
import type { PracticeStroke, SavedPracticeSession } from '../../../practiceStorageModel'
import { CanvasButton } from '../../ui/CanvasButton'
import { MagnifyingGlassMinusIcon } from '../../ui/icons'
import { theme } from '../../ui/theme'
import { DrawingDocument } from './DrawingDocument'
import { prepareFillGuide, supportsFill } from './fillGuide'
import { fillResolution, floodFill } from './floodFill'
import type { LiveInk } from './inkTypes'
import { keepStrokeOnPinch, keepStrokeSample, pointDistance, roundedPoint, strokePath, unturnPoint, withFinalPoint } from './strokeGeometry'
import { watercolorPigment } from './watercolor'

const emptyPath = 'M 0 0'
const fit: Viewport = { x: 0, y: 0, scale: 1 }

type Pair = { ids: [number, number]; middle: Point; distance: number; viewport: Viewport }
type Active = {
  id: number; serial: number; points: Point[]; startedAt: number
  lastFinger: Point; travel: number; stroke: PracticeStroke; pending: Point | null
}
export type CanvasHandle = { fit: () => void; flush: () => Promise<void>; turn: () => void }

type Props = {
  ref: Ref<CanvasHandle>
  /** The whole space around the square. Pinch and pan work anywhere in it, so a finger just outside the picture still counts. */
  area: { width: number; height: number }
  side: number
  session: SavedPracticeSession
  guideSvg?: string
  guideLayer?: ReactNode
  readOnly?: boolean
  disabled: boolean
  onStroke: (stroke: PracticeStroke) => void
  onFillHint?: (hint: string | null) => void
}

function touchTime() {
  'worklet'
  return performance.now()
}

function pairPosition(first: Point, second: Point) {
  'worklet'
  return {
    middle: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)),
  }
}

function squarePoint(finger: Point, offset: Point) {
  'worklet'
  return { x: finger.x - offset.x, y: finger.y - offset.y }
}

function boundTranslation(value: number, scale: number, side: number) {
  'worklet'
  return Math.max(side * (1 - scale), Math.min(0, value))
}

export function DrawingCanvas({ ref, area, side, session, guideSvg, guideLayer, readOnly, disabled, onStroke, onFillHint }: Props) {
  const viewport = useSharedValue(fit)
  // Counts up so every turn spins clockwise; mapping only uses it modulo four. View only: ink stays upright.
  const turns = useSharedValue(0)
  const rotation = useSharedValue(0)
  const [zoomed, setZoomed] = useState(false)
  const offset = { x: (area.width - side) / 2, y: (area.height - side) / 2 }
  const livePath = useSharedValue(emptyPath)
  const liveWidth = useSharedValue(1)
  const active = useSharedValue<Active | null>(null)
  const fillTap = useSharedValue<{ id: number; finger: Point } | null>(null)
  const fillMask = useRef<{ guide: string; mask: Uint8Array | null }>(null)
  const sequence = useSharedValue(0)
  const pair = useSharedValue<Pair | null>(null)
  const blockedUntilLift = useSharedValue(false)
  const [lastCommit, setLastCommit] = useState(0)
  const brush = coloringBrushTools.find(({ id }) => id === session.brushToolId) ?? coloringBrushTools[0]
  const filling = brush.id === 'fill'
  const fillGuide = supportsFill(guideSvg, session.source.kind === 'upload') ? guideSvg : undefined
  const canFill = Boolean(fillGuide)
  useEffect(() => {
    if (!filling || readOnly || !fillGuide) return
    let current = true
    void prepareFillGuide(fillGuide).then((mask) => {
      if (current) fillMask.current = { guide: fillGuide, mask }
    })
    return () => { current = false }
  }, [fillGuide, filling, readOnly])

  const markerWidth = session.markerWidth
  const color = session.markerColor
  const style = useMemo<LiveInk['style']>(() => ({
    color: brush.id === 'paint' ? watercolorPigment(color) : color,
    opacity: brush.opacity, mode: brush.mode, dasharray: brush.dasharray,
    ...(brush.id === 'paint' && { blend: 'multiply' }),
  }), [brush, color])
  const live = useMemo(() => ({ path: livePath, width: liveWidth, style }), [livePath, liveWidth, style])

  function pictureFinger(finger: Point) {
    'worklet'
    const square = squarePoint(finger, offset)
    // The margin around the picture takes pinches, but only the visible picture takes ink.
    // Without this, a touch in the margin while zoomed lands on a part of the picture that is scrolled out of view.
    if (square.x < 0 || square.x > side || square.y < 0 || square.y > side) return null
    const value = viewport.get()
    const unzoomed = { x: (square.x - value.x) / value.scale, y: (square.y - value.y) / value.scale }
    return documentPoint(unturnPoint(unzoomed, side, turns.get()), { width: side, height: side }, fit)
  }

  function commit(stroke: PracticeStroke, serial: number) {
    setLastCommit(serial)
    onStroke(stroke)
  }

  function applyFill(point: Point) {
    if (readOnly || !fillGuide) return
    const ready = fillMask.current
    if (ready?.guide !== fillGuide) {
      onFillHint?.('Getting Fill ready. Tap again in a moment.')
      return
    }
    if (!ready.mask) {
      onFillHint?.('Fill couldn’t read this picture. Try a brush.')
      return
    }
    const result = floodFill(ready.mask, fillResolution, fillResolution, point.x, point.y)
    if (result.status === 'limit') onFillHint?.('Couldn’t fill this area. Try a brush.')
    if (result.status === 'filled') {
      onFillHint?.(null)
      onStroke({ kind: 'fill', mode: 'draw', path: result.path, color, opacity: 1, width: 1 })
    }
  }

  function finishStroke(reason: 'finish' | 'pinch' | 'cancel') {
    'worklet'
    const current = active.get()
    if (!current) return
    active.set(null)
    const points = withFinalPoint(current.points, current.pending)
    const moved = points.length > 1
    const keep = reason === 'pinch'
      ? keepStrokeOnPinch(touchTime() - current.startedAt, current.travel)
      : moved || reason === 'finish'
    if (keep) {
      scheduleOnRN(commit, { ...current.stroke, path: strokePath(points, current.stroke.width) }, current.serial)
    } else {
      livePath.set(emptyPath)
    }
  }

  useImperativeHandle(ref, () => ({
    fit: () => viewport.set(fit),
    turn: () => scheduleOnUI(() => {
      'worklet'
      settleFingers()
      const next = turns.get() + 1
      turns.set(next)
      rotation.set(withSpring(next * 90, theme.motion.spring))
    }),
    flush: () => new Promise<void>((resolve) => {
      // The completion runs on the JS queue after every commit already sent
      // by the UI recognizer, including one finalized by this flush.
      scheduleOnUI(() => {
        'worklet'
        if (active.get() || fillTap.get()) {
          finishStroke('finish')
          fillTap.set(null)
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

  // Turn and Zoom out live outside the gesture area, so a second hand can press them mid-stroke or mid-pinch.
  // End the stroke and ignore the fingers still down, so the view change can't bend a line across the picture.
  function settleFingers() {
    'worklet'
    if (!active.get() && !pair.get() && !fillTap.get()) return
    finishStroke('finish')
    fillTap.set(null)
    pair.set(null)
    blockedUntilLift.set(true)
  }

  function zoomOut() {
    scheduleOnUI(() => {
      'worklet'
      settleFingers()
      viewport.set(fit)
    })
  }

  useAnimatedReaction(() => viewport.get().scale > 1.01, (now, before) => {
    if (now !== before) scheduleOnRN(setZoomed, now)
  })

  const turned = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }))

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
        // Two fingers can land in the same event; claim the gesture so other recognizers can't take the pinch.
        manager.begin()
        manager.activate()
        finishStroke('pinch')
        fillTap.set(null)
        blockedUntilLift.set(true)
        if (!pair.get()) pair.set({ ids: [first.id, second.id], ...pairPosition(squarePoint(first, offset), squarePoint(second, offset)), viewport: viewport.get() })
        return
      }
      if (readOnly || blockedUntilLift.get() || active.get()) return
      // A new touch during the turn animation meets the picture where it is going, not where it is mid-spin.
      rotation.set(turns.get() * 90)
      manager.begin()
      manager.activate()
      const point = pictureFinger(first)
      if (!point) return
      if (filling) {
        if (canFill) fillTap.set({ id: first.id, finger: { x: first.x, y: first.y } })
        return
      }
      const width = documentStrokeWidth(markerWidth, brush.widthMultiplier, side, viewport.get().scale)
      const points = [roundedPoint(point)]
      // A tiny segment gives an unmoved finger the same round dot in both renderers.
      const path = strokePath(points, width)
      const serial = sequence.get() + 1
      sequence.set(serial)
      active.set({
        id: first.id, serial, points, startedAt: touchTime(), lastFinger: { x: first.x, y: first.y },
        travel: 0, stroke: { ...style, path, width }, pending: null,
      })
      liveWidth.set(width)
      livePath.set(path)
    })
    .onTouchesMove(({ allTouches }) => {
      const multi = pair.get()
      if (multi) {
        const first = allTouches.find(({ id }) => id === multi.ids[0])
        const second = allTouches.find(({ id }) => id === multi.ids[1])
        if (!first || !second) return
        const next = pairPosition(squarePoint(first, offset), squarePoint(second, offset))
        const scale = Math.min(5, Math.max(1, multi.viewport.scale * next.distance / multi.distance))
        const ratio = scale / multi.viewport.scale
        const x = next.middle.x - (multi.middle.x - multi.viewport.x) * ratio
        const y = next.middle.y - (multi.middle.y - multi.viewport.y) * ratio
        viewport.set({ scale, x: boundTranslation(x, scale, side), y: boundTranslation(y, scale, side) })
        return
      }
      const tap = fillTap.get()
      if (tap) {
        const finger = allTouches.find(({ id }) => id === tap.id)
        if (finger && pointDistance(tap.finger, finger) > 12) fillTap.set(null)
        return
      }
      const current = active.get()
      if (!current || blockedUntilLift.get()) return
      const finger = allTouches.find(({ id }) => id === current.id)
      if (!finger) return
      const point = pictureFinger(finger)
      if (!point) {
        finishStroke('finish')
        blockedUntilLift.set(true)
        return
      }
      const travel = current.travel + pointDistance(current.lastFinger, finger)
      const lastFinger = { x: finger.x, y: finger.y }
      const last = current.points[current.points.length - 1]
      if (!keepStrokeSample(last, point, current.stroke.width)) {
        active.set({ ...current, travel, lastFinger, pending: roundedPoint(point) })
        return
      }
      const next = roundedPoint(point)
      const path = current.points.length === 1
        ? `M ${last.x} ${last.y} L ${next.x} ${next.y}`
        : `${current.stroke.path} L ${next.x} ${next.y}`
      active.set({ ...current, points: [...current.points, next], travel, lastFinger, pending: null, stroke: { ...current.stroke, path } })
      livePath.set(path)
    })
    .onTouchesUp(({ changedTouches, allTouches }, manager) => {
      const left = (id: number) => changedTouches.some((finger) => finger.id === id)
      const current = active.get()
      if (current && left(current.id)) finishStroke('finish')
      const tap = fillTap.get()
      if (tap && left(tap.id)) {
        fillTap.set(null)
        const finger = changedTouches.find(({ id }) => id === tap.id)
        if (filling && !readOnly && finger && pointDistance(tap.finger, finger) <= 12) {
          const point = pictureFinger(finger)
          if (point) scheduleOnRN(applyFill, point)
        }
      }
      const multi = pair.get()
      if (multi && multi.ids.some(left)) pair.set(null)
      if (allTouches.every(({ id }) => left(id))) {
        blockedUntilLift.set(false)
        manager.end()
      }
    })
    .onTouchesCancelled((_event, manager) => {
      finishStroke('cancel')
      fillTap.set(null)
      pair.set(null)
      blockedUntilLift.set(false)
      manager.fail()
    })
    .onFinalize(() => {
      finishStroke('cancel')
      fillTap.set(null)
      pair.set(null)
      blockedUntilLift.set(false)
    })

  return (
    <View style={{ width: area.width, height: area.height }}>
      <GestureDetector gesture={gesture}>
        <View
          collapsable={false}
          accessible
          accessibilityLabel={readOnly ? 'Lesson picture' : 'Drawing canvas'}
          accessibilityHint={readOnly ? 'Pinch to zoom.' : filling ? 'Tap an area to fill it. Pinch with two fingers to zoom.' : 'Draw with one finger. Pinch and drag with two fingers to zoom and move.'}
          style={[styles.area, { width: area.width, height: area.height }]}
        >
          <View style={[styles.viewport, { width: side, height: side }]}>
            <Animated.View pointerEvents="none" style={[styles.document, transform]}>
              <Animated.View style={[{ width: side, height: side }, turned]}>
                <DrawingDocument side={side} session={session} guideSvg={guideSvg} guideLayer={guideLayer} live={readOnly || filling ? undefined : live} />
              </Animated.View>
            </Animated.View>
          </View>
        </View>
      </GestureDetector>
      {/* A sibling of the gesture area, so tapping it never leaves a dot on the picture. */}
      {zoomed && !disabled && (
        <CanvasButton glyph={MagnifyingGlassMinusIcon} label="Zoom out" haptic onPress={zoomOut}
          style={[styles.zoomOut, { top: offset.y + theme.space.sm, right: offset.x + theme.space.sm }]} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  area: { alignItems: 'center', justifyContent: 'center' },
  viewport: { overflow: 'hidden', backgroundColor: theme.colors.surface, borderRadius: theme.radius.tile },
  zoomOut: { position: 'absolute', ...theme.floatingShadow },
  document: { transformOrigin: 'top left' },
})
