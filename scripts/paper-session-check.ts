import assert from 'node:assert/strict'

import { createPracticeImageCleanup } from '../mobile/src/data/practiceImageCleanup'
import { bandInScene, clampToBand, dragFrame, frameBounds, liftedPoint, sheetLift } from '../mobile/src/features/paper/guideMotion'
import type { Pose } from '../mobile/src/features/paper/guideMotion'
import { defaultGuideSetup, fitPage, readRememberedSetup, serializeRememberedSetup } from '../mobile/src/features/paper/paperModel'
import type { GuideSetup } from '../mobile/src/features/paper/paperModel'
import { createPhotoHandoff } from '../mobile/src/features/paper/photoHandoff'
import { createSetupTracker } from '../mobile/src/features/paper/setupTracker'

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

// 1. Dragging down with the More card open: the frame (handles included) stays in the visible band above it.
{
  const screen = { width: 834, height: 1194 }
  const rest = { x: 417, y: 560 }
  const page = fitPage(screen, 'portrait')
  const cover = 420
  const topLimit = 24 + 12 + 52
  const margin = 12
  const screenBand = { top: topLimit + margin, bottom: screen.height - cover - margin, left: margin, right: screen.width - margin }
  let pose: Pose = { x: 0, y: 0, scale: 1, rotation: 0 }
  // The lift settled before the gesture; the band is in scene coordinates under that lift.
  const lift = sheetLift({ screen, sheetHeight: cover, topLimit, center: rest, bounds: frameBounds(page, 1, 0), margin })
  const band = bandInScene(screenBand, screen, lift)
  let finger = { x: 417, y: 600 }
  for (let frame = 0; frame < 40; frame += 1) {
    const next = { x: finger.x + 3, y: finger.y + 12 }
    pose = clampToBand(dragFrame(pose, finger, next, rest, screen), page, rest, band)
    finger = next
  }
  const bounds = frameBounds(page, pose.scale, pose.rotation)
  const bottom = liftedPoint({ x: rest.x + pose.x, y: rest.y + pose.y + bounds.height / 2 }, screen, lift)
  const top = liftedPoint({ x: rest.x + pose.x, y: rest.y + pose.y - bounds.height / 2 }, screen, lift)
  assert.ok(bottom.y <= screen.height - cover - margin + 1e-6, `dragged down 480 pt, the frame stays above the card (${bottom.y})`)
  assert.ok(top.y >= topLimit + margin - 1e-6, 'and below the top buttons')
  const grown = clampToBand({ x: 0, y: 0, scale: 2.2, rotation: 30 }, page, rest, band)
  const grownBounds = frameBounds(page, grown.scale, grown.rotation)
  assert.ok(grownBounds.height <= band.bottom - band.top + 1e-6 && grownBounds.width <= band.right - band.left + 1e-6, 'a pinch can\'t grow it past the band')
  const inside: Pose = { x: 0, y: 0, scale: 0.5, rotation: 0 }
  const kept = clampToBand(inside, page, rest, band)
  assert.ok(Math.abs(kept.x - inside.x) < 1e-9 && Math.abs(kept.scale - inside.scale) < 1e-9, 'a guide already inside is left alone')
}

// 2. Remembered setup, through the tracker the hook uses.
await (async () => {
  const makeStore = () => {
    let stored: string | null = null
    let failSaves = 0
    let failLoads = 0
    return {
      persistence: {
        save: async ({ orientation, setup }: { orientation: 'portrait' | 'landscape'; setup: GuideSetup }) => {
          await tick()
          if (failSaves > 0) {
            failSaves -= 1
            throw new Error('disk full')
          }
          stored = serializeRememberedSetup(stored, orientation, setup)
        },
        load: async () => {
          await tick()
          if (failLoads > 0) {
            failLoads -= 1
            throw new Error('read failed')
          }
          return stored
        },
      },
      saved: (orientation: 'portrait' | 'landscape') => readRememberedSetup(stored, orientation)?.setup,
      failNextSaves: (count: number) => { failSaves = count },
      failNextLoads: (count: number) => { failLoads = count },
    }
  }
  const make = (store: ReturnType<typeof makeStore>) => {
    let onScreen: GuideSetup = { ...defaultGuideSetup }
    const tracker = createSetupTracker({
      persistence: store.persistence,
      read: () => onScreen,
      apply: (setup) => { onScreen = setup },
      restore: (raw, orientation) => readRememberedSetup(raw, orientation)?.setup ?? defaultGuideSetup,
    })
    return { tracker, move: (setup: Partial<GuideSetup>) => { onScreen = { ...onScreen, ...setup } }, screen: () => onScreen }
  }

  // A flush in the middle of a gesture (the app goes to the background before the fingers lift).
  {
    const store = makeStore()
    const { tracker, move } = make(store)
    assert.equal(await tracker.load('portrait'), true)
    tracker.markDirty() // the gesture starts
    move({ x: 33, y: 44, scale: 1.4 }) // the fingers move; nothing has finalized yet
    await tracker.flush() // background
    assert.deepEqual(store.saved('portrait'), { ...defaultGuideSetup, x: 33, y: 44, scale: 1.4 }, 'the in-progress edit is saved')
  }

  // A turn in the middle of a gesture saves the edit for the orientation that owns it.
  {
    const store = makeStore()
    const { tracker, move } = make(store)
    await tracker.load('portrait')
    tracker.markDirty()
    move({ x: -20 })
    const loading = tracker.load('landscape')
    assert.equal(tracker.owner(), null, 'controls stay gated while the new orientation loads')
    await loading
    await tick()
    assert.equal(store.saved('portrait')?.x, -20, 'the edit went to portrait')
    assert.equal(store.saved('landscape'), undefined, 'not to landscape')
    assert.equal(tracker.owner(), 'landscape')
  }

  // A failed save stays pending for its orientation and is retried, but never over a newer save.
  {
    const store = makeStore()
    const { tracker, move } = make(store)
    await tracker.load('portrait')
    move({ x: 10 })
    tracker.markDirty()
    store.failNextSaves(1)
    assert.deepEqual(await tracker.flush(), [false])
    move({ x: 11 })
    await tracker.load('landscape') // turns: the failed portrait snapshot is retried here
    await tick()
    assert.equal(store.saved('portrait')?.x, 10, 'the failed portrait save is retried with its own orientation')
    // An older failure never lands after a newer success.
    move({ x: 5 })
    tracker.markDirty()
    store.failNextSaves(1)
    const older = tracker.flush()
    move({ x: 6 })
    tracker.markDirty()
    const newer = tracker.flush()
    await Promise.all([older, newer])
    await tracker.flush()
    assert.equal(store.saved('landscape')?.x, 6, 'the newer setup stays saved')
  }

  // A failed load is not "nothing saved": nothing is applied, the controls stay gated, and a retry loads it.
  {
    const store = makeStore()
    const first = make(store)
    await first.tracker.load('portrait')
    first.move({ x: 77, scale: 0.8 })
    first.tracker.markDirty()
    await first.tracker.flush()
    const { tracker, move, screen } = make(store)
    store.failNextLoads(1)
    assert.equal(await tracker.load('portrait'), false)
    assert.equal(tracker.owner(), null, 'gated: no owner after a failed read')
    move({ x: 0, scale: 1 })
    tracker.markDirty()
    await tracker.flush()
    assert.equal(store.saved('portrait')?.x, 77, 'an edit while gated can\'t overwrite the real saved setup')
    assert.equal(await tracker.load('portrait'), true)
    assert.equal(screen().x, 77, 'the retry restores the real setup')
  }
})()

// 3. A photo survives the move from the Picture sheet to On paper to Draw or Stick to paper, and the cleanup
//    sweep removes it only after the last screen lets go (and only if no saved drawing uses it).
await (async () => {
  const documents = 'file:///Documents/'
  const photo = `${documents}tracebuddy-uploads/photo-1.jpg`
  const files = new Set([photo])
  const cleanup = createPracticeImageCleanup(documents, {
    list: async () => [...files].map((uri) => uri.split('/').pop() ?? ''),
    readReferences: async () => [],
    remove: async (uri) => { files.delete(uri) },
  })
  const timers: (() => void)[] = []
  const keep = (uris: readonly string[]) => {
    const release = cleanup.acquire(uris)
    return () => {
      release()
      return cleanup.sweep(uris)
    }
  }
  const handoff = createPhotoHandoff(keep, (run) => {
    timers.push(run)
    return () => { timers.splice(timers.indexOf(run), 1) }
  }, 10000)

  // Picture sheet → On paper: the sheet hands off, unmounts (its own lease ends), a sweep runs mid-transition.
  const sheet = keep([photo])
  handoff.handOff(photo)
  await sheet()
  await cleanup.sweep()
  assert.ok(files.has(photo), 'kept during the sheet → On paper switch')
  const paper = handoff.hold(photo)
  assert.equal(handoff.pending(photo), false, 'On paper took over the hand-off')
  // On paper → Stick to paper (AR): hand off, On paper stays mounted underneath.
  handoff.handOff(photo)
  const stick = handoff.hold(photo)
  await cleanup.sweep()
  assert.ok(files.has(photo), 'kept while Stick to paper is open')
  await stick()
  // On paper → Draw instead: hand off, On paper unmounts before Draw's lease, a sweep runs in between.
  handoff.handOff(photo)
  await paper()
  await cleanup.sweep()
  assert.ok(files.has(photo), 'kept during the On paper → Draw switch')
  // Draw never claims it through this hand-off (it takes its own lease); the hand-off lapses on its own.
  const draw = keep([photo])
  timers.splice(0).forEach((run) => run())
  await tick()
  await cleanup.sweep()
  assert.ok(files.has(photo), 'Draw still holds it')
  await draw()
  await cleanup.sweep()
  assert.equal(files.has(photo), false, 'after the last screen lets go, an unsaved photo is cleaned up')
})()

console.log('Paper session checks passed.')
