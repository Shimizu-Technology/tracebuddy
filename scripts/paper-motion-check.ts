import assert from 'node:assert/strict'

import {
  accessibilityPose, dragFrame, frameBounds, handleFrame, liftedPoint, pairFrame, sheetLift, snapStep, startTurn, toGuideLocal,
} from '../mobile/src/features/paper/guideMotion'
import type { Pose } from '../mobile/src/features/paper/guideMotion'
import { arPoseFor, arPoseToSend, canAdjust, initialStickState, screenPoseFrom, showsControls, stickTransition } from '../mobile/src/features/paper/paperLockModel'
import {
  fitArt, fitPage, legacyOverlayBase, pageCorner, readRememberedSetup, restoreSetup, serializeRememberedSetup,
} from '../mobile/src/features/paper/paperModel'
import type { GuideSetup, Point } from '../mobile/src/features/paper/paperModel'
import { paperTheme } from '../mobile/src/features/paper/paperTheme'
import { createSetupPersistence } from '../mobile/src/features/paper/setupPersistence'

const near = (actual: number, expected: number, tolerance: number, message: string) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`)
const phone = { width: 390, height: 844 }
const rest = { x: 195, y: 420 }
const limits = paperTheme.scale
const start: Pose = { x: 0, y: 0, scale: 1, rotation: 10 }

// 1. Drag, pinch and twist together keep the page point under each finger under it.
{
  let pose = start
  let turn = startTurn(pose.rotation)
  let a: Point = { x: 150, y: 380 }
  let b: Point = { x: 250, y: 470 }
  const underA = toGuideLocal(a, pose, rest)
  const underB = toGuideLocal(b, pose, rest)
  for (let frame = 1; frame <= 20; frame += 1) {
    // Both fingers drift down-right, spread apart and turn together, in every frame at once.
    const nextA = { x: a.x + 2 - frame * 0.3, y: a.y + 3 + frame * 0.4 }
    const nextB = { x: b.x + 5 + frame * 0.2, y: b.y + 1 + frame * 0.5 }
    const next = pairFrame(pose, turn, [a, b], [nextA, nextB], rest, phone, limits)
    pose = next.pose
    turn = next.turn
    a = nextA
    b = nextB
  }
  const nowA = toGuideLocal(a, pose, rest)
  const nowB = toGuideLocal(b, pose, rest)
  near(nowA.x, underA.x, 0.01, 'finger A stays on its spot (x)')
  near(nowA.y, underA.y, 0.01, 'finger A stays on its spot (y)')
  near(nowB.x, underB.x, 0.01, 'finger B stays on its spot (x)')
  near(nowB.y, underB.y, 0.01, 'finger B stays on its spot (y)')
  assert.ok(pose.scale > 1.2 && pose.x > 20 && pose.y > 40, 'the guide moved, grew and turned')
}

// 2. A corner drag handing off to two fingers starts from the current pose, so nothing jumps.
{
  const page = fitPage(phone, 'portrait')
  const corner = pageCorner('bottomRight', rest, page, 1, 0)
  const turn = startTurn(0)
  const resize = handleFrame({ x: 0, y: 0, scale: 1, rotation: 0 }, turn, { touch: corner, scale: 1, rotation: 0 }, { x: corner.x + 40, y: corner.y + 50 }, rest, limits)
  assert.ok(resize.pose.scale > 1.15, 'the corner drag resized the guide')
  // The second finger lands: a fresh baseline, so the first pair frame with no movement changes nothing.
  const fingers: [Point, Point] = [{ x: corner.x + 40, y: corner.y + 50 }, { x: 120, y: 300 }]
  const handoff = pairFrame(resize.pose, startTurn(resize.pose.rotation), fingers, fingers, rest, phone, limits)
  near(handoff.pose.x, resize.pose.x, 1e-9, 'no jump in x')
  near(handoff.pose.y, resize.pose.y, 1e-9, 'no jump in y')
  near(handoff.pose.scale, resize.pose.scale, 1e-9, 'no jump in size')
  near(handoff.pose.rotation, resize.pose.rotation, 1e-9, 'no jump in turn')
  const drag = dragFrame(handoff.pose, { x: 100, y: 100 }, { x: 130, y: 90 }, rest, phone)
  assert.deepEqual([drag.x - handoff.pose.x, drag.y - handoff.pose.y], [30, -10], 'one finger drags')
}

// 3. Snap with hysteresis: settles within 4°, lets go past 7°, and one haptic for hovering at the edge.
{
  let turn = { raw: 0, snappedTo: Number.NaN }
  let haptics = 0
  for (const raw of [10, 3.9, 4.1, 3.9, 4.1, 3.9, 4.1, 6.9]) {
    const step = snapStep(raw, turn.snappedTo)
    if (Number.isNaN(turn.snappedTo) && !Number.isNaN(step.snappedTo)) haptics += 1
    turn = { raw, snappedTo: step.snappedTo }
    if (raw < 7) assert.equal(step.rotation, 0, `held square at ${raw}°`)
  }
  assert.equal(haptics, 1, 'hovering around 4° fires one haptic')
  assert.equal(snapStep(7.2, 0).rotation, 7.2, 'past 7° it lets go')
  assert.ok(Number.isNaN(snapStep(7.2, 0).snappedTo))
  assert.equal(snapStep(-3, Number.NaN).rotation, 0)
  assert.equal(snapStep(86.5, Number.NaN).rotation, 90)
  assert.ok(!Number.isNaN(startTurn(90).snappedTo) && Number.isNaN(startTurn(12).snappedTo), 'a square start counts as held')
}

// 4. More stays clear of the guide, live: 390×844 with 15 downward nudges, a big guide, and one dragged sideways.
{
  const page = fitPage(phone, 'portrait')
  const sheetHeight = phone.height * paperTheme.moreSheetDetent
  const topLimit = 59 + 12 + 52
  const margin = 12
  const visible = (pose: Pose, label: string) => {
    const bounds = frameBounds(page, pose.scale, pose.rotation)
    const center = { x: rest.x + pose.x, y: rest.y + pose.y }
    const lift = sheetLift({ screen: phone, sheetHeight, topLimit, center, bounds, margin })
    const middle = liftedPoint(center, phone, lift)
    const halfWidth = (bounds.width * lift.scale) / 2
    const halfHeight = (bounds.height * lift.scale) / 2
    assert.ok(middle.y + halfHeight <= phone.height - sheetHeight - margin + 1e-6, `${label}: bottom clears the sheet`)
    assert.ok(middle.y - halfHeight >= topLimit + margin - 1e-6, `${label}: top stays below the buttons`)
    assert.ok(middle.x - halfWidth >= margin - 1e-6 && middle.x + halfWidth <= phone.width - margin + 1e-6, `${label}: inside the screen sideways`)
  }
  for (let nudges = 0; nudges <= 15; nudges += 1) visible({ x: 0, y: nudges * paperTheme.nudgeStep, scale: 1, rotation: 0 }, `${nudges} nudges down`)
  visible({ x: 0, y: 0, scale: 2, rotation: 30 }, 'a big turned guide')
  visible({ x: 160, y: 0, scale: 0.8, rotation: 0 }, 'a guide dragged to the right edge')
  const handles = frameBounds(page, 1, 0)
  assert.ok(handles.height > page.height + 2 * paperTheme.size.frame.outset, 'the bounds include the handles')
}

// 5. Restoring keeps the guide on screen, and 1.x setups convert into 2.0's coordinates.
{
  const page = fitPage(phone, 'portrait')
  const geometry = { stage: phone, rest, artWidth: fitArt(page).width }
  const offscreen = JSON.stringify({ version: 1, x: 500, y: -500, scale: 0.5, rotation: 0, opacity: 0.6 })
  const restored = restoreSetup(offscreen, 'portrait', geometry)
  const centerX = rest.x + restored.x
  const centerY = rest.y + restored.y
  const keep = Math.min(phone.width, phone.height) / 4
  assert.ok(centerX >= keep && centerX <= phone.width - keep && centerY >= keep && centerY <= phone.height - keep, 'the 1.x offscreen setup comes back well on screen')
  const centered = restoreSetup(JSON.stringify({ version: 1, x: 0, y: 0, scale: 1, rotation: 0, opacity: 0.6 }), 'portrait', geometry)
  const base = legacyOverlayBase(phone)
  near(centered.scale * geometry.artWidth, base.size, 1e-6, 'a 1.x picture keeps its on-screen size')
  near(rest.y + centered.y, base.center.y, 1e-6, 'and its on-screen position')
  const saved: GuideSetup = { x: 9000, y: 9000, scale: 1, rotation: 0, opacity: 0.6, page: 'portrait' }
  const fromTwo = restoreSetup(serializeRememberedSetup(null, 'portrait', saved), 'portrait', geometry)
  assert.ok(rest.x + fromTwo.x <= phone.width - keep && rest.y + fromTwo.y <= phone.height - keep, 'a 2.0 setup is clamped to this screen too')
  assert.equal(readRememberedSetup(offscreen, 'portrait')?.legacy, true)
  assert.equal(restoreSetup(null, 'landscape', geometry).scale, 1, 'nothing saved: the default')
}

// 6. The rotate-while-saving race: a slow storage where the landscape read starts before the portrait write lands.
await (async () => {
  const portrait: GuideSetup = { x: 11, y: 22, scale: 1.3, rotation: 0, opacity: 0.7, page: 'portrait' }
  const landscape: GuideSetup = { x: -5, y: 4, scale: 0.9, rotation: 90, opacity: 0.5, page: 'landscape' }
  const makeStorage = () => {
    let stored: string | null = null
    const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 1))
    return {
      read: async () => { const value = stored; await tick(); return value },
      write: async (raw: string) => { await tick(); stored = raw },
      get: () => stored,
    }
  }

  // The 1.3 build's approach: the write is queued but the orientation load reads outside the queue.
  const old = makeStorage()
  let oldRecord: string | null = null
  const oldWrite = (async () => {
    const raw = serializeRememberedSetup(oldRecord, 'portrait', portrait)
    oldRecord = raw
    await old.write(raw)
  })()
  oldRecord = await old.read() // the landscape load, racing the write
  await oldWrite
  await old.write(serializeRememberedSetup(oldRecord, 'landscape', landscape))
  assert.equal(readRememberedSetup(old.get(), 'portrait'), null, 'reproduced: the old flow lost the portrait setup')

  // 2.0's persistence: read, merge and write in one queued step; loads wait behind saves.
  const storage = makeStorage()
  let tail: Promise<unknown> = Promise.resolve()
  const queue = <T>(operation: () => Promise<T>) => {
    const result = tail.then(operation, operation)
    tail = result.then(() => undefined, () => undefined)
    return result
  }
  const persistence = createSetupPersistence(storage, queue)
  const pendingSave = persistence.save({ orientation: 'portrait', setup: portrait })
  const loaded = persistence.load()
  const landscapeSave = loaded.then(() => persistence.save({ orientation: 'landscape', setup: landscape }))
  await Promise.all([pendingSave, landscapeSave])
  assert.deepEqual(readRememberedSetup(storage.get(), 'portrait')?.setup, portrait, 'the portrait setup survives the turn')
  assert.deepEqual(readRememberedSetup(storage.get(), 'landscape')?.setup, landscape, 'and the landscape setup is saved beside it')
  assert.deepEqual(readRememberedSetup(await loaded, 'portrait')?.setup, portrait, 'the load saw the save queued before it')
})()

// 7. Stick to paper: placing, child mode and the celebration exclude each other, and every placement request
//    has its own attempt; answers to older or cancelled attempts never start child mode.
{
  type Step = Parameters<typeof stickTransition>[1]
  const run = (steps: Step[], from = initialStickState) => steps.reduce((state, step) => stickTransition(state, step).state, from)
  const last = (steps: Step[], from = initialStickState) => {
    const state = run(steps.slice(0, -1), from)
    return stickTransition(state, steps[steps.length - 1])
  }
  const lock = (nativeAttempt = -1, placementReady = true, childModeReady = false): Step => ({ type: 'lock', placementReady, childModeReady, nativeAttempt })
  const tracked = (nativeAttempt: number): Step => ({ type: 'tracking', childModeReady: true, trackingOk: true, placement: 'locked', nativeAttempt })
  const preview = (nativeAttempt: number): Step => ({ type: 'tracking', childModeReady: false, trackingOk: true, placement: 'preview', nativeAttempt })
  const noPaper = (nativeAttempt: number): Step => ({ type: 'tracking', childModeReady: false, trackingOk: true, placement: 'none', nativeAttempt })
  const lost: Step = { type: 'tracking', childModeReady: false, trackingOk: false, placement: 'none', nativeAttempt: 1 }

  assert.deepEqual(last([lock()]), { state: { phase: 'placing', attempt: 1, cancelledThrough: 0 }, effect: 'place' })
  assert.equal(last([lock(), tracked(1)]).effect, 'enterChild')
  assert.equal(last([lock(), preview(1)]).state.phase, 'placing')
  assert.equal(last([lock(), tracked(0)]).state.phase, 'placing', 'an answer from before this request doesn\'t count')
  assert.deepEqual(last([lock(), noPaper(1)]).effect, 'notFound', 'no paper found: back to adjusting')
  assert.equal(last([lock(), noPaper(0)]).state.phase, 'placing', 'a stale "no paper" from before the request is ignored too')
  assert.equal(last([lock(), lost]).effect, 'cancelled', 'tracking loss cancels a pending lock')
  // The reported escape: Lock, time out, Lock again, then the first attempt's late acknowledgment.
  const retried = run([lock(), { type: 'placementTimeout', attempt: 1 }, lock()])
  assert.deepEqual(retried, { phase: 'placing', attempt: 2, cancelledThrough: 1 })
  assert.equal(stickTransition(retried, tracked(1)).state.phase, 'placing', 'the cancelled attempt\'s answer is rejected')
  assert.equal(stickTransition(retried, { type: 'placementTimeout', attempt: 1 }).state.phase, 'placing', 'the old timeout can\'t cancel the new attempt')
  assert.equal(stickTransition(retried, tracked(2)).state.phase, 'child', 'only the current attempt finishes placing')
  // A placement left from a cancelled attempt doesn't let Lock skip placing.
  const afterTimeout = run([lock(), { type: 'placementTimeout', attempt: 1 }])
  assert.deepEqual(last([lock(1, false, true)], afterTimeout), { state: { phase: 'placing', attempt: 2, cancelledThrough: 1 }, effect: 'place' })
  // After an unlock, the same live placement goes straight back to child mode.
  const unlocked = run([lock(), tracked(1), { type: 'unlock' }])
  assert.equal(last([lock(1, false, true)], unlocked).state.phase, 'child')
  // Lock, then Done before the acknowledgment: the late answer can't start child mode behind Done.
  const celebrating = run([lock(), { type: 'done' }])
  assert.deepEqual(celebrating, { phase: 'celebrating', attempt: 1, cancelledThrough: 1 })
  assert.equal(stickTransition(celebrating, tracked(1)).state.phase, 'celebrating')
  assert.equal(last([lock(), tracked(1), { type: 'done' }]).state.phase, 'child', 'Done does nothing in child mode')
  assert.equal(last([lock(), tracked(1), preview(1)]).effect, 'trackingLost')
  assert.equal(last([lock(), { type: 'blur' }]).effect, 'cancelled')
  assert.equal(last([lock(), tracked(1), { type: 'blur' }]).state.phase, 'child', 'leaving focus doesn\'t unlock')
  assert.equal(last([lock(), { type: 'reset' }]).state.cancelledThrough, 1, 'reset cancels the attempt')
  assert.equal(last([lock(-1, false, false)]).effect, 'waiting')
  assert.equal(last([lock(), lock()]).effect, null, 'a second Lock doesn\'t place twice')
  assert.equal(last([{ type: 'done' }, { type: 'keepTracing' }]).state.phase, 'adjusting')
  for (const phase of ['adjusting', 'placing', 'child', 'celebrating'] as const) {
    assert.equal(canAdjust(phase), phase === 'adjusting', `gestures only while adjusting (${phase})`)
    assert.equal(showsControls(phase), phase === 'adjusting' || phase === 'placing', `controls (${phase})`)
  }
}

// 7a. From Lock on, the guide's pose in meters is frozen: a turn of the device (a new points-to-meters factor)
//     and late gesture or fade frames send exactly the same pose to ARKit.
{
  const portraitMpp = 0.2159 / 304
  const landscapeMpp = 0.2159 / 200
  const pose = { x: 100, y: 40, scale: 0.9, rotation: 12 }
  const frozen = arPoseFor(pose, portraitMpp, 0.25, 0.7)
  for (const phase of ['placing', 'child', 'celebrating'] as const) {
    const portrait = arPoseToSend(phase, arPoseFor(pose, portraitMpp, 0.25, 0.7), frozen)
    const landscape = arPoseToSend(phase, arPoseFor({ ...pose, x: 140, rotation: 30 }, landscapeMpp, 0.25, 0.2), frozen)
    assert.deepEqual(landscape, portrait, `the same pose is sent in portrait and landscape while ${phase}`)
  }
  const live = arPoseFor(pose, landscapeMpp, 0.25, 0.7)
  assert.notDeepEqual(live.offsetXmeters, frozen.offsetXmeters, '(the live conversion would have moved it)')
  assert.deepEqual(arPoseToSend('adjusting', live, frozen), live, 'adjusting follows the live pose')
  const back = screenPoseFrom(frozen, landscapeMpp)
  near(arPoseFor(back, landscapeMpp, 0.25, 0.7).offsetXmeters, frozen.offsetXmeters, 1e-12, 'unlocking after a turn keeps the guide where it was on the paper')
}

// 7b. What ARKit receives: a twist across ±180° keeps turning smoothly instead of sticking at 180° and jumping.
{
  let previous = arPoseFor({ x: 0, y: 0, scale: 1, rotation: 170 }, 0.001, 0.25).rotationDegrees
  for (let raw = 171; raw <= 210; raw += 1) {
    const sent = arPoseFor({ x: 0, y: 0, scale: 1, rotation: raw }, 0.001, 0.25).rotationDegrees
    assert.ok(sent > -180 && sent <= 180, `${raw}° is sent inside ARKit's range (${sent})`)
    const step = ((((sent - previous) + 180) % 360) + 360) % 360 - 180
    near(step, 1, 1e-9, `turning from ${raw - 1}° to ${raw}° moves 1° on screen`)
    previous = sent
  }
  assert.equal(arPoseFor({ x: 0, y: 0, scale: 1, rotation: 210 }, 0.001, 0.25).rotationDegrees, -150)
  assert.equal(arPoseFor({ x: 0, y: 0, scale: 1, rotation: -200 }, 0.001, 0.25).rotationDegrees, 160)
  const far = arPoseFor({ x: 900, y: -900, scale: 1, rotation: 0 }, 0.001, 0.25)
  assert.deepEqual([far.offsetXmeters, far.offsetYmeters], [0.25, -0.25], 'offsets stay within the page\'s reach')
}

// 8. VoiceOver size and turn steps.
{
  const pose: Pose = { x: 0, y: 0, scale: 1, rotation: 3 }
  near(accessibilityPose(pose, 'bigger', limits).scale, 1.1, 1e-9, 'bigger')
  near(accessibilityPose({ ...pose, scale: limits.min }, 'smaller', limits).scale, limits.min, 1e-9, 'smaller stops at the minimum')
  assert.equal(accessibilityPose(pose, 'turnRight', limits).rotation, 90, 'a quarter turn from the nearest square angle')
  assert.equal(accessibilityPose(pose, 'turnLeft', limits).rotation, -90)
  assert.deepEqual(accessibilityPose(pose, 'unknown', limits), pose)
}

console.log('Paper motion checks passed.')
