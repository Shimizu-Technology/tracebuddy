import { Fragment, memo, useId, useMemo } from 'react'
import type { ComponentProps, ComponentType } from 'react'
import type { ViewStyle } from 'react-native'
import Animated, { useAnimatedProps } from 'react-native-reanimated'
import { Defs, G, Mask, Path, Rect, Svg } from 'react-native-svg'

import type { PracticeStroke } from '../../../practiceStorageModel'
import type { InkProps, LiveInk } from './inkTypes'

// react-native-svg forwards CSS on web, but Path's props only describe its SVG attributes.
const StyledPath = Path as ComponentType<ComponentProps<typeof Path> & { style?: ViewStyle }>
const AnimatedPath = Animated.createAnimatedComponent(StyledPath)
const multiply = { mixBlendMode: 'multiply' } as const
const isolate = { isolation: 'isolate' } as const

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
        <Fragment key={mask}>
          {remove.length > 0 && (
            <Defs><Mask id={mask} x={0} y={0} width={1000} height={1000} maskUnits="userSpaceOnUse">
              <Rect width={1000} height={1000} fill="white" />
              {remove.map(({ stroke, index }) => <Path key={index} d={stroke.path} fill="none" stroke="black" strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}
            </Mask></Defs>
          )}
          {/* Apply any committed erase mask to each stroke before it blends with earlier ink. */}
          {paths.map((stroke, index) => <StyledPath key={index} d={stroke.path}
            mask={remove.length ? `url(#${mask})` : undefined} style={stroke.blend === 'multiply' ? multiply : undefined}
            fill={stroke.kind === 'fill' ? stroke.color : 'none'} fillOpacity={stroke.opacity}
            stroke={stroke.kind === 'fill' ? 'none' : stroke.color} strokeWidth={stroke.width}
            strokeOpacity={stroke.opacity} strokeDasharray={stroke.dasharray} strokeLinecap="round" strokeLinejoin="round" />)}
        </Fragment>
      )
    })
  }, [prefix, strokes])
})

function LivePath({ live, erase }: { live: LiveInk; erase?: boolean }) {
  const props = useAnimatedProps(() => ({ d: live.path.get(), strokeWidth: live.width.get() }))
  return <AnimatedPath animatedProps={props} fill="none" stroke={erase ? 'black' : live.style.color}
    style={live.style.blend === 'multiply' ? multiply : undefined}
    strokeOpacity={live.style.opacity} strokeDasharray={live.style.dasharray} strokeLinecap="round" strokeLinejoin="round" />
}

export const SvgPracticeInk = memo(function SvgPracticeInk({ side, strokes, live }: InkProps) {
  const prefix = useId().replaceAll(':', '')
  const erase = live?.style.mode === 'erase'
  return (
    <Svg pointerEvents="none" width={side} height={side} viewBox="0 0 1000 1000" style={isolate}>
      {live && erase && (
        <Defs><Mask id={`${prefix}-active`} x={0} y={0} width={1000} height={1000} maskUnits="userSpaceOnUse">
          <Rect width={1000} height={1000} fill="white" /><LivePath live={live} erase />
        </Mask></Defs>
      )}
      {erase
        ? <G mask={`url(#${prefix}-active)`}><History strokes={strokes} prefix={prefix} /></G>
        : <History strokes={strokes} prefix={prefix} />}
      {live && !erase && <LivePath live={live} />}
    </Svg>
  )
})
