import { Canvas, Circle, Group, Path } from '@shopify/react-native-skia'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Easing, cancelAnimation, useAnimatedReaction, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import type { DrawingLessonStep, LessonStroke } from '../../../../shared/lessons/drawingLessons'
import { theme } from '../../ui/theme'
import { LessonArt, StillWatchArt } from './LessonArt'
import type { WatchArtProps } from './WatchArt'

const pencilBody = 'M 0 0 L 8 -23 L 53 -68 Q 55 -70 58 -67 L 68 -57 Q 70 -55 68 -53 L 23 -8 Z'
const pencilLead = 'M 0 0 L 4 -13 L 13 -4 Z'
const pencilBand = 'M 45 -60 L 60 -45'
const announceMs = 200
const dotMs = 250

type TimedStroke = LessonStroke & { start: number; duration: number }

function timeStep(step: DrawingLessonStep) {
  let time = 250
  const strokes = step.strokes.map((stroke) => {
    const duration = Math.max(250, stroke.len / 430 * 1000)
    const entry = { ...stroke, start: time + announceMs, duration }
    time = entry.start + duration + 100
    return entry
  })
  return { strokes, speechStart: strokes[0]?.start ?? time, firstDot: time, end: time + step.dots.length * dotMs }
}

function WatchStroke({ stroke, width, clock }: { stroke: TimedStroke; width: number; clock: SharedValue<number> }) {
  const { d, start, duration } = stroke
  const end = useDerivedValue(() => Math.max(0, Math.min(1, (clock.get() - start) / duration)))
  const opacity = useDerivedValue(() => end.get() > 0 ? 1 : 0)
  return <Path path={d} end={end} opacity={opacity} style="stroke" strokeWidth={width}
    strokeCap="round" strokeJoin="round" color={theme.colors.ink} />
}

function WatchDot({ cx, cy, r, clock, start }: {
  cx: number; cy: number; r: number; start: number; clock: SharedValue<number>
}) {
  const opacity = useDerivedValue(() => Math.max(0, Math.min(1, (clock.get() - start) / dotMs)))
  return <Circle cx={cx} cy={cy} r={r} color={theme.colors.ink} opacity={opacity} />
}

function WatchPencil({ clock, strokes, width }: { clock: SharedValue<number>; strokes: TimedStroke[]; width: number }) {
  const active = useDerivedValue(() => {
    const time = clock.get()
    return strokes.find((stroke) => time >= stroke.start - announceMs && time < stroke.start + stroke.duration)
  })
  const opacity = useDerivedValue(() => active.get() ? 1 : 0)
  const startDotOpacity = useDerivedValue(() => {
    const stroke = active.get()
    return stroke && clock.get() < stroke.start ? 1 : 0
  })
  const transform = useDerivedValue(() => {
    const stroke = active.get()
    if (!stroke) return [{ translateX: 0 }, { translateY: 0 }]
    const fraction = Math.max(0, Math.min(1, (clock.get() - stroke.start) / stroke.duration))
    const index = fraction * (stroke.pen.length - 1)
    const low = Math.floor(index)
    const high = Math.min(low + 1, stroke.pen.length - 1)
    const [x, y] = stroke.pen[low]
    const [nextX, nextY] = stroke.pen[high]
    return [{ translateX: x + (nextX - x) * (index - low) }, { translateY: y + (nextY - y) * (index - low) }]
  })
  return (
    <Group opacity={opacity} transform={transform}>
      <Circle cx={0} cy={0} r={Math.max(8, width * 0.85)} color={theme.colors.coral} opacity={startDotOpacity} />
      <Path path={pencilBody} color={theme.colors.coral} />
      <Path path={pencilBody} color={theme.colors.ink} style="stroke" strokeWidth={3} strokeJoin="round" />
      <Path path={pencilBand} color={theme.colors.ink} style="stroke" strokeWidth={3} />
      <Path path={pencilLead} color={theme.colors.ink} />
    </Group>
  )
}

export function WatchArt({ lesson, step, side, still, onStart }: WatchArtProps) {
  if (still) return <StillWatchArt lesson={lesson} step={step} onStart={onStart} />
  return <AnimatedStep lesson={lesson} step={step} side={side} onStart={onStart} />
}

function AnimatedStep({ lesson, step, side, onStart }: Omit<WatchArtProps, 'still'>) {
  const { strokeWidth } = lesson
  const current = lesson.steps[step]
  const timeline = useMemo(() => timeStep(current), [current])
  const { speechStart } = timeline
  const clock = useSharedValue(0)
  const playing = useRef(false)
  const notified = useRef(false)
  const notifyStart = useCallback(() => {
    if (!playing.current || notified.current) return
    notified.current = true
    onStart()
  }, [onStart])

  useAnimatedReaction(
    () => clock.get() >= speechStart,
    (started, wasStarted) => {
      if (started && !wasStarted) scheduleOnRN(notifyStart)
    },
  )

  useEffect(() => {
    playing.current = true
    clock.set(withTiming(timeline.end, { duration: timeline.end, easing: Easing.linear }))
    return () => {
      playing.current = false
      cancelAnimation(clock)
    }
  }, [clock, timeline.end])

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {step > 0 && <LessonArt lesson={lesson} step={step - 1} startDots={false} muted />}
      <Canvas style={[StyleSheet.absoluteFill, { width: side, height: side }]}>
        <Group transform={[{ scale: side / 1000 }]}>
          {timeline.strokes.map((stroke, i) => <WatchStroke key={`stroke-${i}`} stroke={stroke} width={strokeWidth} clock={clock} />)}
          {current.dots.map((dot, i) => <WatchDot key={`dot-${i}`} {...dot} start={timeline.firstDot + i * dotMs} clock={clock} />)}
          <WatchPencil clock={clock} strokes={timeline.strokes} width={strokeWidth} />
        </Group>
      </Canvas>
    </View>
  )
}
