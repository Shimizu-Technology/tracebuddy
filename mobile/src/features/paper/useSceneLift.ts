import { useEffect } from 'react'
import { cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'

import { theme } from '../../ui/theme'
import { bandInScene, frameBounds, sheetLift } from './guideMotion'
import type { Band } from './guideMotion'
import type { PoseValues } from './useGuideGesture'
import type { Point, Size } from './paperModel'

type Options = {
  open: boolean
  /** Screen height covered from the bottom by the sheet or card. */
  cover: number
  values: PoseValues
  /** 1 while fingers are on the guide. */
  gestureActive: SharedValue<number>
  rest: Point
  page: Size
  stage: Size
  topLimit: number
  reduceMotion: boolean
}

/**
 * Moves the whole scene (camera and guide together) so the full frame stays between the top buttons and the
 * More sheet, following nudges and size changes live. While fingers are on the guide the scene holds still
 * (any running lift animation stops where it is) and `band` gives the gesture the visible area, so it clamps
 * the guide inside it instead of letting it slide under the sheet.
 */
export function useSceneLift({ open, cover, values, gestureActive, rest, page, stage, topLimit, reduceMotion }: Options) {
  const isOpen = useSharedValue(open ? 1 : 0)
  useEffect(() => { isOpen.set(open ? 1 : 0) }, [isOpen, open])
  const dx = useSharedValue(0)
  const dy = useSharedValue(0)
  const scale = useSharedValue(1)
  const band = useSharedValue<Band | null>(null)

  useAnimatedReaction(() => ({
    open: isOpen.get(),
    active: gestureActive.get(),
    x: values.x.get(),
    y: values.y.get(),
    scale: values.scale.get(),
    rotation: values.rotation.get(),
  }), (now, previous) => {
    const margin = theme.space.md
    if (now.open && now.active) {
      if (!previous?.active) {
        cancelAnimation(dx)
        cancelAnimation(dy)
        cancelAnimation(scale)
        const screenBand = { top: topLimit + margin, bottom: stage.height - cover - margin, left: margin, right: stage.width - margin }
        band.set(bandInScene(screenBand, stage, { dx: dx.get(), dy: dy.get(), scale: scale.get() }))
      }
      return
    }
    band.set(null)
    const target = now.open ? sheetLift({
      screen: stage,
      sheetHeight: cover,
      topLimit,
      center: { x: rest.x + now.x, y: rest.y + now.y },
      bounds: frameBounds(page, now.scale, now.rotation),
      margin,
    }) : { dx: 0, dy: 0, scale: 1 }
    if (reduceMotion) {
      dx.set(target.dx)
      dy.set(target.dy)
      scale.set(target.scale)
      return
    }
    dx.set(withSpring(target.dx, theme.motion.spring))
    dy.set(withSpring(target.dy, theme.motion.spring))
    scale.set(withSpring(target.scale, theme.motion.spring))
  }, [cover, page, reduceMotion, rest, stage, topLimit])

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: dx.get() }, { translateY: dy.get() }, { scale: scale.get() }] }))
  return { style, band }
}
