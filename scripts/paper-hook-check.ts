import assert from 'node:assert/strict'

import * as paperModel from '../mobile/src/features/paper/paperModel'
import { readRememberedSetup } from '../mobile/src/features/paper/paperModel'
import type { GuideSetup, ScreenOrientation } from '../mobile/src/features/paper/paperModel'
import { paperStore } from '../mobile/src/features/paper/paperStore'
import * as paperStoreModule from '../mobile/src/features/paper/paperStore'
import * as paperThemeModule from '../mobile/src/features/paper/paperTheme'
import { paperTheme } from '../mobile/src/features/paper/paperTheme'
import * as setupPersistence from '../mobile/src/features/paper/setupPersistence'
import * as setupTracker from '../mobile/src/features/paper/setupTracker'
import { createFakeTimers, createHookRuntime, loadHookModule } from './paper-hook-harness'

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
const ticks = async (count = 6) => { for (let i = 0; i < count; i += 1) await tick() }
const shared = (value: number) => {
  let current = value
  return { get: () => current, set: (next: number) => { current = next } }
}

// 1. useRememberedSetup itself: the app goes to the background in the middle of a gesture (fingers down, the
//    gesture hasn't finished, so nothing has called persist). The AppState listener's flush saves the guide as
//    it is right then, for the orientation that owns it.
await (async () => {
  let stored: string | null = null
  const appState = new Set<(state: string) => void>()
  const runtime = createHookRuntime()
  const { useRememberedSetup } = loadHookModule<typeof import('../mobile/src/features/paper/useRememberedSetup')>(
    'mobile/src/features/paper/useRememberedSetup.ts',
    {
      react: runtime.React,
      'react-native': {
        AppState: {
          addEventListener: (_type: string, listener: (state: string) => void) => {
            appState.add(listener)
            return { remove: () => appState.delete(listener) }
          },
        },
      },
      '../../data/nativeStorage': {
        readLocalSetting: async () => { await tick(); return stored },
        writeLocalSetting: async (_key: string, serialize: () => string) => { await tick(); stored = serialize(); return true },
      },
      '../../data/storageKeys': { savedAlignmentKey: 'tracebuddy.savedAlignment.v1' },
      './paperModel': paperModel,
      './paperTheme': paperThemeModule,
      './setupPersistence': setupPersistence,
      './setupTracker': setupTracker,
    },
  )
  const values = { x: shared(0), y: shared(0), scale: shared(1), rotation: shared(0), opacity: shared(0.5) }
  const geometry = { stage: { width: 390, height: 844 }, rest: { x: 195, y: 400 }, artWidth: 300 }
  const run = (orientation: ScreenOrientation) => runtime.render(useRememberedSetup, orientation, values as never, geometry, false)

  run('portrait')
  await ticks()
  const hook = run('portrait')
  assert.equal(hook.hydrated, true, 'loaded')
  assert.equal(appState.size, 1, 'listening to AppState')

  hook.markDirty() // the gesture starts (useGuideGesture's onStart)
  values.x.set(33) // fingers move; the gesture never finishes
  values.y.set(-12)
  values.scale.set(1.3)
  for (const listener of appState) listener('background')
  await ticks()
  const saved: GuideSetup | undefined = readRememberedSetup(stored, 'portrait')?.setup
  assert.ok(saved, 'the background flush saved')
  assert.deepEqual({ x: saved.x, y: saved.y, scale: saved.scale }, { x: 33, y: -12, scale: 1.3 }, 'the in-progress gesture, as it was')
  assert.equal(readRememberedSetup(stored, 'landscape')?.setup, undefined, 'for portrait only')

  // Leaving the screen flushes too.
  hook.markDirty()
  values.x.set(40)
  runtime.unmount()
  await ticks()
  assert.equal(readRememberedSetup(stored, 'portrait')?.setup.x, 40, 'closing mid-gesture saves it')
  assert.equal(appState.size, 0, 'and stops listening')
})()

// 2. useStickHandoff: the camera comes back whenever the hand-off to Stick to paper doesn't happen.
await (async () => {
  const load = (focus: { focused: boolean }) => {
    const runtime = createHookRuntime()
    const timers = createFakeTimers()
    const opened: unknown[] = []
    let restarted = 0
    let focusEffect: (() => void | (() => void)) | null = null
    let focusCleanup: void | (() => void)
    const navigation = { isFocused: () => focus.focused }
    const { useStickHandoff } = loadHookModule<typeof import('../mobile/src/features/paper/useStickHandoff')>(
      'mobile/src/features/paper/useStickHandoff.ts',
      {
        react: runtime.React,
        'expo-router': {
          useNavigation: () => navigation,
          useFocusEffect: (effect: () => void | (() => void)) => { focusEffect = effect },
        },
        './paperNavigation': { canStickToPaper: true, openStickToPaper: (...args: unknown[]) => { opened.push(args) } },
        './paperStore': paperStoreModule,
        './paperTheme': paperThemeModule,
      },
      timers,
    )
    const params = { id: 'happy-crab' }
    const restartCamera = () => { restarted += 1 }
    const render = () => runtime.render(useStickHandoff, params, undefined, restartCamera)
    const screen = {
      hook: render(),
      render() { screen.hook = render() },
      focus() {
        focus.focused = true
        focusCleanup = focusEffect?.()
        screen.render()
      },
      blur() {
        focus.focused = false
        if (typeof focusCleanup === 'function') focusCleanup()
        focusCleanup = undefined
        screen.render()
      },
    }
    if (focus.focused) screen.focus()
    return { screen, timers, opened, restarted: () => restarted, runtime }
  }

  // Waiting starts after this focus began (iPad card: no native sheet, the screen keeps focus), then something
  // else takes focus before AR opens. The camera must come back.
  {
    paperStore.set({ sheetOpen: false })
    const { screen, timers, opened } = load({ focused: true })
    screen.hook.start()
    screen.render()
    assert.equal(screen.hook.handedOff, true, 'the camera lets go')
    screen.blur()
    assert.equal(screen.hook.handedOff, false, 'blur while waiting gives the camera back')
    timers.advance(paperTheme.timing.cameraHandoffMs * 2)
    assert.equal(opened.length, 0, 'and AR never opens')
    assert.equal(timers.pending(), 0)
  }

  // The timer fires while the screen isn't focused (no blur reached it first): it declines and resets.
  {
    paperStore.set({ sheetOpen: false })
    const focus = { focused: true }
    const { screen, timers, opened } = load(focus)
    screen.hook.start()
    screen.render()
    focus.focused = false
    timers.advance(paperTheme.timing.cameraHandoffMs)
    screen.render()
    assert.equal(opened.length, 0, 'AR doesn\'t open over another screen')
    assert.equal(screen.hook.handedOff, false, 'and the camera comes back')
    screen.hook.start()
    assert.equal(timers.pending(), 1, 'Stick to paper can be tried again')
  }

  // The phone's native More sheet: the screen is blurred while More is open. Stick to paper waits for More to
  // close, the screen gets focus back, and AR opens.
  {
    paperStore.set({ sheetOpen: true })
    const { screen, timers, opened, restarted } = load({ focused: true })
    screen.blur() // More opened over it
    screen.hook.start()
    screen.render()
    paperStore.set({ sheetOpen: false }) // More closes...
    screen.focus() // ...and the screen is focused again: still waiting
    assert.equal(screen.hook.handedOff, true)
    timers.advance(paperTheme.timing.cameraHandoffMs)
    assert.equal(opened.length, 1, 'AR opens')
    screen.blur() // AR on top
    screen.focus() // back from AR
    assert.equal(screen.hook.handedOff, false, 'coming back gives the camera back')
    assert.equal(restarted(), 1, 'and restarts it')
  }
})()

console.log('Paper hook checks passed: background flush mid-gesture, Stick hand-off focus.')
