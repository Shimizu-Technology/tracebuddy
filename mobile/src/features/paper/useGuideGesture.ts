import { useMemo } from 'react'
import * as Haptics from 'expo-haptics'
import { Gesture } from 'react-native-gesture-handler'
import type { TouchData } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { dragFrame, handleFrame, pairFrame, startTurn } from './guideMotion'
import type { Pose, ScaleLimits, Turn } from './guideMotion'
import { hitHandle, normalizeDegrees } from './paperModel'
import type { Point, Size } from './paperModel'

export type PoseValues = {
  x: SharedValue<number>
  y: SharedValue<number>
  scale: SharedValue<number>
  rotation: SharedValue<number>
}

type Options = {
  values: PoseValues
  /** Where the guide's center rests with no offset, and the stage it must stay on. */
  rest: Point
  stage: Size
  /** The page at scale 1, for the corner handles. Leave out where the guide has no on-screen frame. */
  handlePage?: Size
  limits: ScaleLimits
  enabled: boolean
  /** Set to 1 while fingers are on the guide. */
  active?: SharedValue<number>
  onStart: () => void
  onEnd: () => void
}

const idle = 0
const dragging = 1
const resizing = 2
const pinching = 3

function snapHaptic() {
  void Haptics.selectionAsync().catch(() => undefined)
}

/**
 * Drag, pinch and twist as one gesture. Each frame turns the fingers' movement into a single transform, so
 * any mix of moving, spreading and turning keeps the picture under the fingers. Adding or lifting a finger
 * starts a fresh baseline, so switching from a corner drag to two fingers never jumps.
 */
export function useGuideGesture({ values, rest, stage, handlePage, limits, enabled, active, onStart, onEnd }: Options) {
  const mode = useSharedValue(idle)
  const touches = useSharedValue<TouchData[]>([])
  const turn = useSharedValue<Turn>({ raw: 0, snappedTo: Number.NaN })
  const handleStart = useSharedValue({ touch: { x: 0, y: 0 }, scale: 1, rotation: 0 })

  return useMemo(() => {
    const pose = (): Pose => {
      'worklet'
      return { x: values.x.get(), y: values.y.get(), scale: values.scale.get(), rotation: values.rotation.get() }
    }
    const apply = (next: Pose) => {
      'worklet'
      values.x.set(next.x)
      values.y.set(next.y)
      values.scale.set(next.scale)
      values.rotation.set(next.rotation)
    }
    const baseline = (active: TouchData[]) => {
      'worklet'
      touches.set(active.slice(0, 2))
      turn.set(startTurn(values.rotation.get()))
      if (active.length >= 2) {
        mode.set(pinching)
        return
      }
      if (active.length === 0) {
        mode.set(idle)
        return
      }
      const touch = { x: active[0].x, y: active[0].y }
      const now = pose()
      const onHandle = handlePage ? hitHandle(touch, { x: rest.x + now.x, y: rest.y + now.y }, handlePage, now.scale, now.rotation) : null
      handleStart.set({ touch, scale: now.scale, rotation: now.rotation })
      mode.set(onHandle ? resizing : dragging)
    }
    const remaining = (all: TouchData[], changed: TouchData[]) => {
      'worklet'
      return all.filter((touch) => !changed.some((lifted) => lifted.id === touch.id))
    }
    const finish = () => {
      'worklet'
      values.rotation.set(normalizeDegrees(values.rotation.get()))
      mode.set(idle)
      touches.set([])
      active?.set(0)
      scheduleOnRN(onEnd)
    }

    return Gesture.Manual()
      .enabled(enabled)
      .onTouchesDown((event, manager) => {
        if (mode.get() === idle) {
          manager.activate()
          active?.set(1)
          scheduleOnRN(onStart)
        }
        baseline(event.allTouches)
      })
      .onTouchesMove((event) => {
        const previous = touches.get()
        const find = (id: number) => event.allTouches.find((touch) => touch.id === id)
        if (mode.get() === pinching && previous.length === 2) {
          const a = find(previous[0].id)
          const b = find(previous[1].id)
          if (!a || !b) return
          const next = pairFrame(pose(), turn.get(), [previous[0], previous[1]], [a, b], rest, stage, limits)
          apply(next.pose)
          turn.set(next.turn)
          if (next.snapped) scheduleOnRN(snapHaptic)
          touches.set([a, b])
          return
        }
        if (previous.length !== 1) return
        const touch = find(previous[0].id)
        if (!touch) return
        if (mode.get() === resizing) {
          const next = handleFrame(pose(), turn.get(), handleStart.get(), touch, rest, limits)
          apply(next.pose)
          turn.set(next.turn)
          if (next.snapped) scheduleOnRN(snapHaptic)
        } else {
          apply(dragFrame(pose(), previous[0], touch, rest, stage))
        }
        touches.set([touch])
      })
      .onTouchesUp((event, manager) => {
        const left = remaining(event.allTouches, event.changedTouches)
        if (left.length === 0) {
          finish()
          manager.end()
          return
        }
        baseline(left)
      })
      .onTouchesCancelled((_event, manager) => {
        finish()
        manager.end()
      })
  }, [active, enabled, handlePage, handleStart, limits, mode, onEnd, onStart, rest, stage, touches, turn, values])
}
