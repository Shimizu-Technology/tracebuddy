import { memo, useEffect, useEffectEvent } from 'react'
import Svg, { Circle, G, Path } from 'react-native-svg'

import type { DrawingLesson, DrawingLessonStep } from '../../../../shared/lessons/drawingLessons'
import { theme } from '../../ui/theme'

export const earlierInk = '#CACED8'
const earlierGuide = '#E6DEDA'
const currentGuide = '#E9BFAF'

export const LessonArt = memo(function LessonArt({ lesson, step, guide = false, startDots = true, muted = false, focus = false, allInk = false }: {
  lesson: DrawingLesson; step: number; guide?: boolean; startDots?: boolean; muted?: boolean; focus?: boolean; allInk?: boolean
}) {
  const { strokeWidth } = lesson
  const viewBox = focus ? focusBox(lesson.steps[step]) : "0 0 1000 1000"
  return (
    <Svg viewBox={viewBox} width="100%" height="100%" pointerEvents="none">
      {lesson.steps.slice(0, step + 1).map(({ strokes, dots }, index) => {
        const current = index === step && !muted
        const color = guide ? (current ? currentGuide : earlierGuide) : (current || allInk ? theme.colors.ink : earlierInk)
        return (
          <G key={index}>
            {strokes.map(({ d }, i) => <Path key={`stroke-${i}`} d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />)}
            {dots.map(({ cx, cy, r }, i) => <Circle key={`dot-${i}`} cx={cx} cy={cy} r={r} fill={color} />)}
            {current && startDots && strokes.map(({ pen: [[cx, cy]] }, i) => <Circle key={`start-${i}`} cx={cx} cy={cy}
              r={Math.max(8, strokeWidth * 0.8)} fill={theme.colors.coral} />)}
          </G>
        )
      })}
    </Svg>
  )
})

export function StillWatchArt({ lesson, step, onStart, onFinish }: { lesson: DrawingLesson; step: number; onStart: () => void; onFinish: () => void }) {
  const start = useEffectEvent(() => {
    onStart()
    onFinish()
  })
  useEffect(() => { start() }, [])
  return <LessonArt lesson={lesson} step={step} />
}

function focusBox(step: DrawingLessonStep) {
  const points = [...step.strokes.flatMap(({ pen }) => pen), ...step.dots.map(({ cx, cy }) => [cx, cy])]
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)
  const side = Math.min(1000, Math.max(420, Math.max(right - left, bottom - top) * 1.35))
  const x = Math.max(0, Math.min(1000 - side, (left + right - side) / 2))
  const y = Math.max(0, Math.min(1000 - side, (top + bottom - side) / 2))
  return `${x} ${y} ${side} ${side}`
}
