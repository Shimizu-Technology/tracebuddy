import assert from 'node:assert/strict'
import { adjustUnlocked, childExitHoldMs, documentCapture, holdProgress, parentModeHelp, placeholderColor, selectedFamilyActivity } from '../mobile/nativeSafetyModel.ts'
const original = { x: 12, y: 5, scale: 1, rotation: 10, opacity: 0.7 }
for (const key of ['x', 'y', 'scale', 'rotation', 'opacity'] as const) {
  assert.equal(adjustUnlocked(true, original, (value) => ({ ...value, [key]: 99 })), original)
  assert.equal(adjustUnlocked(false, original, (value) => ({ ...value, [key]: 99 }))[key], 99)
}
assert.equal(holdProgress(-1), 0)
assert.ok(holdProgress(1499) < 1)
assert.equal(holdProgress(childExitHoldMs), 1)
assert.equal(holdProgress(2000), 1)
assert.match(parentModeHelp(true), /Paper Lock \(Beta\).*device/)
assert.match(parentModeHelp(false), /needs a device/)
assert.equal(selectedFamilyActivity('mirror', ['pass', 'mirror']), 'mirror')
assert.equal(selectedFamilyActivity('gone', ['pass', 'mirror']), 'pass')
assert.deepEqual(documentCapture, { side: 1000, width: 1000, height: 1000 })
console.log('Native round 2 safety: locked geometry/opacity, deliberate hold, support copy, activity validation, document capture contract passed')

const channels = placeholderColor.slice(1).match(/../g)!.map((hex) => parseInt(hex, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
const contrast = 1.05 / (channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 + 0.05)
assert.ok(contrast >= 4.5, `Placeholder on white: ${contrast}`)
console.log(`Placeholder on white: ${contrast.toFixed(2)}:1`)

// Execute the current App callbacks without loading native Expo modules in Node.
// This catches a caller that stops forwarding the lock state to its guard.
const { readFileSync } = await import('node:fs')
const { runInNewContext } = await import('node:vm')
const ts = await import('typescript')
const appSource = readFileSync(new URL('../mobile/App.tsx', import.meta.url), 'utf8')
const ast = ts.createSourceFile('App.tsx', appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function appCallback(name: string, bindings: Record<string, unknown>) {
  let text = ''
  function visit(node: import('typescript').Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && ts.isCallExpression(node.initializer)) text = node.initializer.arguments[0].getText(ast)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(text, `App callback ${name} exists`)
  const js = ts.transpileModule(`const callback = ${text}; callback`, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.None } }).outputText
  return runInNewContext(js, bindings) as (...args: unknown[]) => unknown
}
for (const name of ['adjustOpacity', 'adjustScale', 'adjustRotation', 'nudgeOverlay', 'restoreSavedAlignment', 'applyPagePreset', 'startOverlayDrag', 'moveOverlayDrag']) {
  const transform = { current: { ...original } }
  const dragging = { current: name === 'moveOverlayDrag' }
  const start = { current: { x: 1, y: 2, pageX: 0, pageY: 0 } }
  const before = JSON.stringify({ transform, dragging, start })
  const handler = appCallback(name, {
    overlayLockedRef: { current: true }, overlayDraggingRef: dragging, dragStartRef: start, transformRef: transform,
    savedAlignment: { ...original, scale: 2 }, adjustUnlocked,
    clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
    setOverlayTransform: (update: typeof original | ((value: typeof original) => typeof original)) => { transform.current = typeof update === 'function' ? update(transform.current) : update },
    setOverlayLocked: () => assert.fail('Locked geometry callback must not unlock'),
  })
  if (name === 'applyPagePreset') handler('landscape')
  else if (name.endsWith('OverlayDrag')) handler({ nativeEvent: { pageX: 200, pageY: 300 } })
  else handler(0.1, 8)
  assert.equal(JSON.stringify({ transform, dragging, start }), before, `${name} stays unchanged while locked`)
}
console.log('Eight App-level locked callers passed without loading a native runtime')

const { captureImageKeys, createCaptureReadiness, saveTemporaryCapture } = await import('../mobile/captureUtils.ts')
const keys = captureImageKeys('file://guide.jpg', true, [{ kind: 'shape', stickerId: 'star' }, { kind: 'image', stickerId: 'photo', uri: 'file://piece.jpg' }])
assert.deepEqual(keys, ['guide-base', 'guide-top', 'sticker-photo'])
const images = createCaptureReadiness(keys, 100)
let ready = false
void images.ready.then(() => { ready = true })
images.loaded('guide-base'); images.loaded('guide-base'); images.loaded('unknown')
await Promise.resolve()
assert.equal(ready, false)
images.loaded('guide-top'); images.loaded('sticker-photo')
await images.ready
assert.equal(ready, true)
images.dispose()
const failedImage = createCaptureReadiness(['guide-base'], 100)
failedImage.failed('guide-base')
await assert.rejects(failedImage.ready, /could not load/)
const timedImage = createCaptureReadiness(['guide-base'], 5)
await assert.rejects(timedImage.ready, /did not finish loading/)
await createCaptureReadiness([]).ready

// Drive the actual export handler with deferred image-load events. Two RAFs
// alone must never reach capture, and an error must never report Photos success.
for (const fail of [false, true]) {
  const events: string[] = []
  let gate: ReturnType<typeof createCaptureReadiness> | null = null
  const handler = appCallback('savePracticeImage', {
    finishPracticeStroke: () => undefined, savePracticeSessionNow: async () => true,
    imageExportRef: { current: { token: 0, readiness: null } }, leaveInProgressRef: { current: false }, selectedStickerIdRef: { current: null }, uploadedImage: { uri: 'file://guide.jpg' }, guideOnTop: true, stickers: [],
    captureImageKeys, createCaptureReadiness,
    setExportReadiness: (next: typeof gate) => { if (next) gate = next }, setIsSavingImage: () => undefined, setSelectedStickerId: () => undefined,
    MediaLibrary: { requestPermissionsAsync: async () => ({ granted: true }), saveToLibraryAsync: async () => { events.push('photos') } },
    photoAccessAllowed: (permission: { granted: boolean }) => permission.granted,
    showPhotosPermissionRecovery: () => assert.fail('Granted permission must not show recovery'),
    requestAnimationFrame: (callback: () => void) => queueMicrotask(callback), documentCapture,
    exportDocumentRef: { current: {} }, saveTemporaryCapture,
    captureRef: async () => { events.push('capture'); return 'tmp.png' }, releaseCapture: () => { events.push('release') },
    milestoneHaptic: () => { events.push('haptic') }, Alert: { alert: (title: string) => { events.push(title) } },
  })
  const saving = handler() as Promise<void>
  await Promise.resolve(); await Promise.resolve()
  assert.deepEqual(events, [])
  assert.ok(gate)
  const readiness = gate as ReturnType<typeof createCaptureReadiness>
  if (fail) readiness.failed('guide-base')
  else { readiness.loaded('guide-base'); readiness.loaded('guide-top') }
  await saving
  assert.deepEqual(events, fail ? ['Could not save image'] : ['capture', 'photos', 'release', 'haptic', 'Saved image'])
}
console.log('Export caller waits for image decode; image error/timeout cannot report a saved photo')

// Exercise navigation and teardown against the actual callbacks, at each await.
for (const phase of ['decode', 'frame', 'permission', 'capture', 'photos'] as const) {
  for (const unmount of [false, true]) {
    const events: string[] = []
    const imageExportRef: { current: { token: number; readiness: ReturnType<typeof createCaptureReadiness> | null } } = { current: { token: 0, readiness: null } }
    const leaveInProgressRef = { current: false }
    let resume!: () => void
    const deferred = new Promise<void>((resolve) => { resume = resolve })
    let stateUpdates = 0
    const update = () => { stateUpdates++ }
    const flush = () => new Promise<void>((resolve) => setImmediate(resolve))
    const save = appCallback('savePracticeImage', {
      imageExportRef, leaveInProgressRef, selectedStickerIdRef: { current: 'piece' },
      uploadedImage: { uri: 'guide.jpg' }, guideOnTop: false, stickers: [], captureImageKeys, createCaptureReadiness,
      setExportReadiness: update, setIsSavingImage: update, setSelectedStickerId: update,
      MediaLibrary: {
        requestPermissionsAsync: async () => { if (phase === 'permission') await deferred; return { granted: true } },
        saveToLibraryAsync: async () => { events.push('photos'); if (phase === 'photos') await deferred },
      },
      photoAccessAllowed: () => true, showPhotosPermissionRecovery: () => assert.fail('No recovery'),
      requestAnimationFrame: (callback: () => void) => { if (phase === 'frame') void deferred.then(callback); else queueMicrotask(callback) },
      documentCapture, exportDocumentRef: { current: {} }, saveTemporaryCapture,
      captureRef: async () => { events.push('capture'); if (phase === 'capture') await deferred; return 'tmp.png' },
      releaseCapture: () => { events.push('release') }, milestoneHaptic: () => { events.push('haptic') },
      Alert: { alert: (title: string) => { events.push(title) } },
    })
    const leave = appCallback('leavePractice', {
      imageExportRef, leaveInProgressRef,
      savePracticeSessionNow: async () => { events.push('flush'); return true },
      Alert: { alert: () => assert.fail('Blocked navigation cannot alert') },
    })
    const saving = save() as Promise<void>
    await flush()
    const readiness = imageExportRef.current.readiness!
    if (phase !== 'decode') readiness.loaded('guide-base')
    await flush()
    leave(() => { events.push('navigate') })
    await flush()
    assert.ok(!events.includes('navigate'), `${phase}: Back retains the export tree`)
    assert.ok(!events.includes('flush'), `${phase}: Back cannot start a conflicting flush`)
    if (unmount) {
      let effect = ''
      function find(node: import('typescript').Node) {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0]?.getText(ast).includes('imageExportRef.current.token += 1')) effect = node.arguments[0].getText(ast)
        ts.forEachChild(node, find)
      }
      find(ast)
      assert.ok(effect, 'Export teardown is registered')
      const js = ts.transpileModule(`const effect = ${effect}; effect`, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText
      runInNewContext(js, { imageExportRef })()()
    }
    const updatesBeforeResume = stateUpdates
    readiness.loaded('guide-base'); resume()
    await saving
    if (unmount) {
      assert.equal(stateUpdates, updatesBeforeResume, `${phase}: no state updates after unmount`)
      assert.ok(!events.includes('haptic') && !events.some((event) => event.includes('image')), `${phase}: no late feedback`)
      if (!['capture', 'photos'].includes(phase)) assert.ok(!events.includes('capture'), `${phase}: no dead capture`)
      if (phase === 'capture') assert.deepEqual(events, ['capture', 'release'], 'Unmounted capture releases its file without starting Photos')
    } else {
      assert.deepEqual(events, ['capture', 'photos', 'release', 'haptic', 'Saved image'])
      leave(() => { events.push('navigate') })
      await flush()
      assert.equal(events.at(-1), 'navigate', 'Navigation resumes once export finishes')
    }
  }
}
console.log('Actual export/leave callbacks: Back blocked during decode/pre-capture; teardown cancels all five await phases without late feedback')

let familyEffectText = ''
function findFamilyEffect(node: import('typescript').Node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0]?.getText(ast).includes('getItem(familyActivityKey)')) familyEffectText = node.arguments[0].getText(ast)
  ts.forEachChild(node, findFamilyEffect)
}
findFamilyEffect(ast)
assert.ok(familyEffectText)
let restored = ''
const familyBindings = {
  familyActivityKey: 'family', savedAlignmentKey: 'alignment', parentSetupSeenKey: 'setup',
  familyActivities: [{ id: 'pass' }, { id: 'mirror' }], selectedFamilyActivity,
  captureWorkOperation: () => () => true, activityInteractionRef: { current: false },
  AsyncStorage: { getItem: (key: string) => key === 'alignment' ? Promise.reject(Error('alignment read failed')) : Promise.resolve(key === 'family' ? 'mirror' : '1') },
  setSelectedActivityId: (id: string) => { restored = id }, setActivityStorageMessage: () => undefined,
  parentSetupSeenRef: { current: false }, setSavedAlignment: () => undefined, normalizeTraceAlignment: () => null, setParentSetupHydrated: () => undefined,
}
const familyJs = ts.transpileModule(`const callback = ${familyEffectText}; callback`, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.None } }).outputText
const cleanupFamily = runInNewContext(familyJs, familyBindings)() as () => void
await new Promise<void>((resolve) => setImmediate(resolve))
assert.equal(restored, 'mirror', 'An unrelated alignment-read rejection must not skip activity restore')
cleanupFamily()
let warning = ''
const chooseActivity = appCallback('chooseFamilyActivity', {
  ...familyBindings, drawingPreferencesClearInProgressRef: { current: false },
  queueDrawingPreferencesWrite: async () => { throw Error('disk full') },
  setActivityStorageMessage: (message: string) => { warning = message },
})
chooseActivity('pass')
assert.equal(restored, 'pass', 'Selection responds before storage finishes')
await new Promise<void>((resolve) => setImmediate(resolve))
assert.match(warning, /visit only/)
console.log('Activity caller restores independently of alignment errors and reports write failure')
