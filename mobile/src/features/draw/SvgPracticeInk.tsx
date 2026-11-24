import { memo, useId, useMemo } from 'react'
import Animated, { useAnimatedProps } from 'react-native-reanimated'
import { Defs, G, Mask, Path, Rect, Svg } from 'react-native-svg'

import type { PracticeStroke } from '../../../practiceStorageModel'
import type { InkProps, LiveInk } from './inkTypes'

const AnimatedPath = Animated.createAnimatedComponent(Path)

const History = memo(function History({ strokes, prefix }: { strokes: InkProps['strokes']; prefix: string }) {
  return useMemo(() => {
    const erasers: { stroke: PracticeStroke; index: number }[] = []
    const batches: { strokes: PracticeStroke[]; end: number }[] = []
    let batch: PracticeStroke[] = []

    strokes.forEach((stroke, index) => {
      if (stroke.mode === 'erase') {
        erasers.push({ stroke, index })
        if (batch.length) batches.push({ strokes: batch, end: index - 1 })
        batch = []
      } else batch.push(stroke)
    })
    if (batch.length) batches.push({ strokes: batch, end: strokes.length - 1 })

    return batches.map(({ strokes: paths, end }, batchIndex) => {
      const remove = erasers.filter(({ index }) => index > end)
      const mask = `${prefix}-${batchIndex}`
      return (
        <G key={mask}>
          {remove.length > 0 && (
            <Defs><Mask id={mask} x={0} y={0} width={1000} height={1000} maskUnits="userSpaceOnUse">
              <Rect width={1000} height={1000} fill="white" />
              {remove.map(({ stroke, index }) => <Path key={index} d={stroke.path} fill="none" stroke="black" strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}
            </Mask></Defs>
          )}
          <G mask={remove.length ? `url(#${mask})` : undefined}>
            {paths.map((stroke, index) => <Path key={index} d={stroke.path} fill="none" stroke={stroke.color} strokeWidth={stroke.width}
              strokeOpacity={stroke.opacity} strokeDasharray={stroke.dasharray} strokeLinecap="round" strokeLinejoin="round" />)}
          </G>
        </G>
      )
    })
  }, [prefix, strokes])
})

function LivePath({ live, erase }: { live: LiveInk; erase?: boolean }) {
  const props = useAnimatedProps(() => ({ d: live.path.get(), strokeWidth: live.width.get() }))
  return <AnimatedPath animatedProps={props} fill="none" stroke={erase ? 'black' : live.style.color}
    strokeOpacity={live.style.opacity} strokeDasharray={live.style.dasharray} strokeLinecap="round" strokeLinejoin="round" />
}

export const SvgPracticeInk = memo(function SvgPracticeInk({ side, strokes, live }: InkProps) {
  const prefix = useId().replaceAll(':', '')
  const erase = live?.style.mode === 'erase'
  return (
    <Svg pointerEvents="none" width={side} height={side} viewBox="0 0 1000 1000">
      {live && erase && (
        <Defs><Mask id={`${prefix}-active`} x={0} y={0} width={1000} height={1000} maskUnits="userSpaceOnUse">
          <Rect width={1000} height={1000} fill="white" /><LivePath live={live} erase />
        </Mask></Defs>
      )}
      <G mask={erase ? `url(#${prefix}-active)` : undefined}><History strokes={strokes} prefix={prefix} /></G>
      {live && !erase && <LivePath live={live} />}
    </Svg>
  )
})
