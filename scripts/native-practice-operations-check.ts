import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import type { SavedPracticeSession } from '../mobile/practiceStorageModel.ts'
import { createOperationQueue, followLatestSave, operationGuard, queueSessionWrite, shouldPersistResume, writeIfCurrent } from '../mobile/practiceOperations.ts'
import { createPracticePreviewCache } from '../mobile/practicePreviewCache.ts'
import { normalizeResumeContext, strokePointAction } from '../mobile/practiceModel.ts'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

// Use the same queues, guard and read/commit pipeline as native AsyncStorage.
// Pause before queueing, during index reads, and during the storage commit.
// The retained save closure reads only parent-owned generation state; protection
// does not depend on a transient mounted flag or surviving screen instance.
for (const pauseAt of ['cleanup', 'index', 'commit'] as const) {
  const sessions = createOperationQueue()
  const preferences = createOperationQueue()
  const store = new Map<string, unknown>([['resume', { lessonId: 'flower' }]])
  const pause = deferred()
  const started = deferred()
  let generation = 0
  let clearing = false
  let enabled = true
  assert.equal(shouldPersistResume(enabled, 'picker', clearing), true)
  const isCurrent = operationGuard(generation, () => generation, () => !clearing)
  const waitAt = async (stage: string) => {
    if (stage !== pauseAt) return
    started.resolve()
    await pause.promise
  }
  const save = (async () => {
    await waitAt('cleanup')
    const saved = await queueSessionWrite(sessions, isCurrent, 'drawing', async () => {
      await waitAt('index')
      return []
    }, async (ids) => {
      await waitAt('commit')
      store.set('drawing', 'ink')
      store.set('index', ids)
    })
    // Same parent callback guard: stale completion cannot re-add work or resume.
    if (saved && isCurrent()) {
      store.set('in-memory-session', 'drawing')
      await preferences(() => writeIfCurrent(isCurrent, async () => { store.set('resume', 'drawing') }))
    }
  })()
  await started.promise
  generation++
  clearing = true
  enabled = false
  const clear = sessions(async () => {
    await preferences(async () => { store.delete('resume') })
    store.clear()
  })
  if (pauseAt === 'cleanup') {
    // Reproduce the report exactly: clear finishes, then the old save resumes.
    await clear
    clearing = false
    pause.resolve()
  } else pause.resolve()
  await Promise.all([save, clear])
  clearing = false
  assert.equal(store.size, 0, `${pauseAt}: cleared work must not resurrect`)
  assert.equal(shouldPersistResume(enabled, 'picker', clearing), false)
  assert.equal(normalizeResumeContext(store.get('resume'), ['line', 'flower']), null)
  assert.equal(isCurrent(), false, 'ending clear does not revalidate old saves')
  // New intentional work must save normally after Clear, including its lesson.
  const next = operationGuard(generation, () => generation, () => !clearing)
  assert.equal(shouldPersistResume(enabled, 'learn', clearing), true)
  await preferences(() => writeIfCurrent(next, async () => { store.set('resume', { mode: 'learn', lessonId: 'flower' }) }))
  assert.equal(normalizeResumeContext(store.get('resume'), ['line', 'flower'])?.lessonId, 'flower')
}

// A queued preference/resume operation must recheck after clear, even once its
// transient clearing flag is false.
{
  let generation = 0
  const queue = createOperationQueue()
  const pause = deferred()
  const blocker = queue(() => pause.promise)
  const guard = operationGuard(generation, () => generation)
  const writes: string[] = []
  const pending = ['preferences', 'resume', 'alignment', 'lesson', 'setup'].map((key) => queue(() => writeIfCurrent(guard, async () => { writes.push(key) })))
  generation++
  pause.resolve()
  await Promise.all([blocker, ...pending])
  assert.deepEqual(writes, [])
}

// Exiting the screen alone must not discard a pending save. The captured
// parent generation stays valid until Clear, regardless of screen lifetime.
{
  const generation = 0
  const queue = createOperationQueue()
  const pause = deferred()
  const started = deferred()
  const guard = operationGuard(generation, () => generation)
  const store = new Map<string, unknown>()
  const pending = queueSessionWrite(queue, guard, 'ordinary-leave', async () => {
    started.resolve()
    await pause.promise
    return ['older-session']
  }, async (ids) => { store.set('index', ids); store.set('ordinary-leave', 'ink') })
  await started.promise
  // The screen exits while the storage operation still owns its captured guard.
  pause.resolve()
  assert.equal(await pending, true)
  assert.deepEqual(store.get('index'), ['ordinary-leave', 'older-session'])
  assert.equal(store.get('ordinary-leave'), 'ink')
}

// Same transition decision as the touch handler: commit and reset at each exit,
// retain ownership, and start new points/path/stats on re-entry. No gap segment.
const segments: Array<Array<{ x: number; y: number }>> = []
let active: Array<{ x: number; y: number }> = []
for (const point of [{ x: 100, y: 100 }, { x: 200, y: 100 }, null, null, { x: 800, y: 800 }, { x: 900, y: 800 }, null]) {
  const action = strokePointAction(active.length > 0, point)
  if (action === 'finish') { segments.push(active); active = [] }
  else if (action === 'start') active = [point!]
  else if (action === 'append') active.push(point!)
}
assert.deepEqual(segments, [[{ x: 100, y: 100 }, { x: 200, y: 100 }], [{ x: 800, y: 800 }, { x: 900, y: 800 }]])
assert.equal(segments.reduce((length, points) => length + Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y), 0), 200)

// Cache only exact immutable revisions; eviction bounds retained raster results.
const cache = createPracticePreviewCache(2)
const revision = [{ mode: 'draw' }, { mode: 'erase' }, { mode: 'draw' }]
const original = structuredClone(revision)
cache.set('one', revision, 'png:all-strokes')
assert.equal(cache.get('one', revision), 'png:all-strokes')
assert.equal(cache.get('one', [...revision]), undefined)
assert.equal(cache.key('one', revision), cache.key('one', revision))
assert.notEqual(cache.key('one', revision), cache.key('one', [...revision]))
cache.set('two', revision, 'png:two')
cache.set('three', revision, 'png:three')
assert.equal(cache.get('one', revision), undefined)
assert.deepEqual(revision, original, 'thumbnail caching never edits resumed strokes')
cache.clear()
assert.equal(cache.get('three', revision), undefined)
console.log('Native operation models passed: pending save/clear overlaps, queued preference/resume fences, screen-independent clear fences, ordinary leave saves, lesson resume, stroke gaps and bounded revision cache (no native render coverage)')

// Leave/Done: a superseded attempt follows the newest save; a revoked one stays false.
{
  let current = true
  const newer = Promise.resolve(true)
  assert.equal(await followLatestSave(Promise.resolve(false), () => newer, () => current), true, 'superseded save follows the newer successful save')
  const failing = Promise.resolve(false)
  assert.equal(await followLatestSave(Promise.resolve(false), () => failing, () => current), false, 'superseded save reports a newer failure')
  const only = Promise.resolve(false)
  assert.equal(await followLatestSave(only, () => only, () => current), false, 'a genuine failure stays false')
  current = false
  assert.equal(await followLatestSave(Promise.resolve(false), () => newer, () => current), false, 'Clear revokes even a successful newer save')
  current = true
  assert.equal(await followLatestSave(Promise.resolve(true), () => null, () => current), true, 'plain success')
  console.log('followLatestSave: superseded, failed, revoked and plain saves behave as expected')
}

// Exercise the real 2.0 hook callbacks with storage paused mid-operation.
// UI state is inert here; refs keep the same lifetimes as a mounted canvas.
const sessionHookSource = readFileSync(new URL('../mobile/src/features/draw/useDrawSession.ts', import.meta.url), 'utf8')
const sessionHookJs = ts.transpileModule(sessionHookSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText
function mountDrawSession(io: {
  readDrawing: (id: string) => Promise<SavedPracticeSession | null>
  saveDrawing: (session: SavedPracticeSession, current: () => boolean) => Promise<boolean>
  deleteDrawing: (id: string, current: () => boolean) => Promise<boolean>
}) {
  const initial = {
    sessionId: 'before-clear', stamp: undefined, strokes: [], updatedAt: '2026-06-01T09:00:00.000Z',
  } as unknown as SavedPracticeSession
  const exports: { useDrawSession?: typeof import('../mobile/src/features/draw/useDrawSession').useDrawSession } = {}
  const ref = <T,>(current: T) => ({ current })
  runInNewContext(sessionHookJs, {
    exports,
    require(name: string) {
      if (name === 'react') return {
        useCallback: (callback: unknown) => callback, useEffect: () => undefined,
        useRef: ref, useState: (initialState: unknown) => [initialState, () => undefined],
      }
      if (name === '../../../practiceOperations') return { operationGuard, followLatestSave }
      assert.equal(name, '../../data/drawingLibrary')
      return {
        ...io, hasDrawingContent: () => true,
        newDrawing: () => ({ ...initial, sessionId: 'after-clear' }),
      }
    },
  })
  assert.ok(exports.useDrawSession)
  return { initial, hook: exports.useDrawSession(initial, true) }
}

const oldWrite = deferred()
const stampsWritten: Array<SavedPracticeSession['stamp']> = []
const stamped = mountDrawSession({
  readDrawing: async () => externalStamp,
  saveDrawing: async (session) => {
    stampsWritten.push(session.stamp)
    if (stampsWritten.length === 1) await oldWrite.promise
    return true
  },
  deleteDrawing: async () => true,
})
const externalStamp: SavedPracticeSession = { ...stamped.initial, stamp: 'heart' }
stamped.hook.change((session) => ({ ...session, markerWidth: 13 }))
const savingOldStamp = stamped.hook.save()
await stamped.hook.refreshStamp(stamped.initial.sessionId)
assert.ok(await stamped.hook.save(), 'A refreshed stamp can be written while an older revision is still pending')
oldWrite.resolve()
await savingOldStamp
assert.deepEqual(stampsWritten, [undefined, 'heart'], 'An in-flight save cannot mark the new stamp revision as saved')

const waitingDelete = deferred()
const writesAfterClear: string[] = []
let deletedId: string | undefined
const clearingCanvas = mountDrawSession({
  readDrawing: async () => null,
  saveDrawing: async (session) => { writesAfterClear.push(session.sessionId); return true },
  deleteDrawing: async (id) => { deletedId = id; await waitingDelete.promise; return true },
})
clearingCanvas.hook.change((session) => ({ ...session, markerWidth: 13 }))
const clearing = clearingCanvas.hook.clear()
assert.equal(deletedId, 'before-clear')
assert.equal(await clearingCanvas.hook.save(), false, 'An autosave during clear cannot reserve the old strokes under the new generation')
waitingDelete.resolve()
assert.ok(await clearing)
assert.ok(await clearingCanvas.hook.save(), 'A clean empty canvas can leave without a write')
assert.deepEqual(writesAfterClear, [])
clearingCanvas.hook.change((session) => ({ ...session, markerWidth: 13 }))
assert.ok(await clearingCanvas.hook.save())
assert.deepEqual(writesAfterClear, ['after-clear'])

const drawScreenSource = readFileSync(new URL('../mobile/src/features/draw/DrawScreen.tsx', import.meta.url), 'utf8')
const drawScreenAst = ts.createSourceFile('DrawScreen.tsx', drawScreenSource, ts.ScriptTarget.ES2023, true, ts.ScriptKind.TSX)
const sourceCalls = new Map<string, ts.CallExpression>()
function findDrawCallbacks(node: ts.Node) {
  if (ts.isCallExpression(node) && node.expression.getText() === 'usePreventRemove') sourceCalls.set('remove', node)
  if (ts.isVariableDeclaration(node) && node.name.getText() === 'flushAndSave' && node.initializer && ts.isCallExpression(node.initializer)) {
    sourceCalls.set('flushAndSave', node.initializer)
  }
  ts.forEachChild(node, findDrawCallbacks)
}
findDrawCallbacks(drawScreenAst)
const remove = sourceCalls.get('remove')
assert.equal(remove?.arguments[0].kind, ts.SyntaxKind.TrueKeyword, 'Removal is intercepted before ink reaches saved session state')
const endOfFlush = deferred()
const departure: string[] = []
const canvas = { current: { flush: async () => { departure.push('flush'); await endOfFlush.promise } } }
function evaluateDrawCallback(source: string, bindings: Record<string, unknown>) {
  return runInNewContext(ts.transpileModule(`const callback = ${source}; callback`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023 },
  }).outputText, { ...bindings })
}
const flushAndSave = evaluateDrawCallback(sourceCalls.get('flushAndSave')!.arguments[0].getText(), {
  canvas, save: async () => { departure.push('save'); return true },
})
const action = { type: 'GO_BACK' }
evaluateDrawCallback(remove!.arguments[1].getText(), {
  running: { current: false }, transact: (task: () => Promise<boolean>) => task(), flushAndSave,
  navigation: { dispatch: (event: unknown) => { assert.equal(event, action); departure.push('back') } },
})({ data: { action } })
assert.deepEqual(departure, ['flush'])
endOfFlush.resolve()
await new Promise<void>((resolve) => setImmediate(resolve))
assert.deepEqual(departure, ['flush', 'save', 'back'])
console.log('TraceBuddy 2.0: actual draw callbacks guard clear, invalidate old stamp saves, and flush before removal')

const holdButtonSource = readFileSync(new URL('../mobile/src/ui/HoldButton.tsx', import.meta.url), 'utf8')
const holdButtonAst = ts.createSourceFile('HoldButton.tsx', holdButtonSource, ts.ScriptTarget.ES2023, true, ts.ScriptKind.TSX)
let confirmBody: string | undefined
const holdHandlers = new Map<string, string>()
function findHoldHandlers(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'askToConfirm') confirmBody = node.getText()
  if (ts.isJsxAttribute(node) && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
    holdHandlers.set(node.name.getText(), node.initializer.expression.getText())
  }
  ts.forEachChild(node, findHoldHandlers)
}
findHoldHandlers(holdButtonAst)
assert.ok(confirmBody)
type AlertButton = { text: string; style: string; onPress: () => void }
function holdButtonHarness(os: 'ios' | 'web', browserConfirm = true) {
  const alerts: AlertButton[][] = []
  const state = { destructiveCalls: 0, browserPrompts: 0 }
  const bindings: Record<string, unknown> = {
    disabled: false, label: 'Delete', held: { current: false }, dialogOpen: { current: false },
    Platform: { OS: os },
    confirm: () => { state.browserPrompts += 1; return browserConfirm },
    Alert: { alert: (_title: string, _message: string | undefined, buttons: AlertButton[]) => { alerts.push(buttons) } },
    onConfirm: () => { state.destructiveCalls += 1 },
  }
  bindings.globalThis = bindings
  bindings.askToConfirm = evaluateDrawCallback(confirmBody!, bindings)
  return {
    alerts, state,
    activate: evaluateDrawCallback(holdHandlers.get('onAccessibilityAction')!, bindings),
    press: evaluateDrawCallback(holdHandlers.get('onPress')!, bindings),
    longPress: evaluateDrawCallback(holdHandlers.get('onLongPress')!, bindings),
  }
}

const ios = holdButtonHarness('ios')
ios.press()
assert.equal(ios.alerts.length, 0, 'A touch tap never opens a confirmation, so a child cannot clear work with two taps')
ios.activate({ nativeEvent: { actionName: 'activate' } })
ios.activate({ nativeEvent: { actionName: 'activate' } })
ios.longPress()
assert.equal(ios.alerts.length, 1, 'Accessibility activation and a hold cannot duplicate an open confirmation')
assert.equal(ios.state.destructiveCalls, 0)
assert.equal(ios.alerts[0][0].style, 'cancel')
ios.alerts[0][0].onPress()
assert.equal(ios.state.destructiveCalls, 0)
ios.activate({ nativeEvent: { actionName: 'activate' } })
assert.equal(ios.alerts.length, 2)
assert.equal(ios.alerts[1][1].style, 'destructive')
ios.alerts[1][1].onPress()
assert.equal(ios.state.destructiveCalls, 1)
ios.longPress()
ios.press()
assert.equal(ios.state.destructiveCalls, 2, 'A completed touch hold confirms without a dialog')
assert.equal(ios.alerts.length, 2)

const web = holdButtonHarness('web')
web.press()
assert.equal(web.state.browserPrompts, 1, 'Web keyboard and clicks use the browser confirm because Alert is a no-op there')
assert.equal(web.state.destructiveCalls, 1)
assert.equal(web.alerts.length, 0)
const webCancel = holdButtonHarness('web', false)
webCancel.press()
assert.equal(webCancel.state.destructiveCalls, 0, 'Cancelling the browser confirm keeps the work')
webCancel.press()
assert.equal(webCancel.state.browserPrompts, 2, 'A cancelled web confirm does not block later attempts')
console.log('TraceBuddy 2.0: actual HoldButton callbacks keep touch on hold-only, confirm accessibility activations once, and use the browser confirm on web')
