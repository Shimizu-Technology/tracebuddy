import assert from 'node:assert/strict'
import { continueDrawing, finishAfterSave, hasKeepsakeContent, keepsakeStamps, makeNativeModePreference, newestDrawings, normalizeModePreference, normalizeStamp, toggleStamp } from '../mobile/finishFindModel.ts'
import { normalizeSavedPracticeSession } from '../mobile/practiceStorageModel.ts'
import { normalizeResumeContext, navigate, goBack } from '../mobile/practiceModel.ts'

const old = {
  version: 2, sessionId: 'old', updatedAt: '2026-10-26T10:00:00Z',
  source: { kind: 'drawing', drawingId: 'flower', drawingName: 'Flower', drawingTheme: 'Nature' },
  strokes: [{ path: 'M 100 100 L 900 900', width: 30, color: '#18243A', opacity: 0.9, mode: 'draw' }],
}
const loaded = normalizeSavedPracticeSession(old)!
assert.equal(loaded.sessionId, old.sessionId)
assert.equal(loaded.stamp, undefined)
assert.equal(loaded.finishedAt, undefined)
assert.deepEqual(loaded.strokes, old.strokes.map((stroke) => ({ ...stroke, dasharray: undefined })))
for (const stamp of keepsakeStamps) {
  const session = normalizeSavedPracticeSession(JSON.parse(JSON.stringify({ ...loaded, stamp, finishedAt: '2026-10-27T10:00:00Z' })))!
  assert.equal(session.stamp, stamp)
  assert.equal(normalizeSavedPracticeSession(JSON.parse(JSON.stringify(session)))?.stamp, stamp)
  assert.equal(session.finishedAt, '2026-10-27T10:00:00Z')
  assert.equal(toggleStamp(stamp, stamp), undefined)
  assert.equal(toggleStamp(undefined, stamp), stamp)
}
for (const value of ['unknown', null, {}, 1, true]) {
  assert.equal(normalizeStamp(value), undefined)
  assert.equal(normalizeSavedPracticeSession({ ...old, stamp: value })?.stamp, undefined)
}
assert.equal(normalizeSavedPracticeSession({ ...old, finishedAt: 'invalid' })?.finishedAt, undefined)
assert.equal(continueDrawing([]), undefined)
const input = [old, { ...old, sessionId: 'latest', updatedAt: '2026-10-27T10:00:00Z' }, { ...old, sessionId: 'bad', updatedAt: 'invalid' }]
assert.equal(continueDrawing(input)?.sessionId, 'latest')
assert.deepEqual(newestDrawings(input).map((item) => item.sessionId), ['latest', 'old', 'bad'])
assert.equal(input[0].sessionId, 'old')
assert.deepEqual(newestDrawings([{ ...old, sessionId: 'b' }, { ...old, sessionId: 'a' }]).map((item) => item.sessionId), ['a', 'b'])
for (const surface of ['camera', 'screen', 'ar'] as const) {
  const persisted = JSON.stringify(makeNativeModePreference(surface))
  assert.equal(normalizeModePreference(persisted, true), surface)
  assert.equal(normalizeModePreference(persisted, false), surface === 'ar' ? 'camera' : surface)
}
assert.equal(normalizeModePreference({ version: 1, mode: 'screen' }, false), 'screen')
for (const value of [null, '{broken', { version: 99, mode: 'screen' }, { version: 99, nativeSurface: 'ar' }]) assert.equal(normalizeModePreference(value, true), 'camera')
// Clear removes the session records and key; absence restores the default with no stamp.
assert.equal(normalizeModePreference(undefined, true), 'camera')
assert.equal(normalizeSavedPracticeSession(undefined), null)
const context = normalizeResumeContext({ mode: 'gallery', history: ['picker'], lessonId: 'line' }, ['line'])!
assert.equal(context.mode, 'gallery')
assert.equal(goBack(navigate({ current: 'picker', history: [] }, 'gallery')).current, 'picker')
console.log('Native Finish & find: old sessions, five stamp round trips/toggles, unknown values, sorting/continue, shared mode compatibility + AR fallback, clear defaults, gallery navigation passed')

assert.equal(hasKeepsakeContent(0, 0), false)
assert.equal(hasKeepsakeContent(1, 0), true)
assert.equal(hasKeepsakeContent(0, 1), true)
assert.equal(hasKeepsakeContent(0, 0, 'heart'), true)
assert.equal(hasKeepsakeContent(0, 0, undefined, '2026-10-27T10:00:00Z'), true)
let opened = 0
let resolveSave!: (saved: boolean) => void
const saving = new Promise<boolean>((resolve) => { resolveSave = resolve })
const pending = finishAfterSave(() => saving, () => { opened++ })
await Promise.resolve()
assert.equal(opened, 0, 'Done must not open while a write is pending')
resolveSave(false)
assert.equal(await pending, false)
assert.equal(opened, 0, 'Failed save keeps Retry on the canvas')
assert.equal(await finishAfterSave(async () => true, () => { opened++ }), true)
assert.equal(opened, 1)
await assert.rejects(finishAfterSave(async () => { throw Error('storage offline') }, () => { opened++ }))
assert.equal(opened, 1)
console.log('Done waits for save, leaves failures recoverable, and retains blank finished/stamp-only keepsakes')

// Run the App's real save/Done/Clear/leave callbacks with native IO replaced
// by deferred storage. Synthetic true/false saves cannot detect revoked writes.
const { readFileSync } = await import('node:fs')
const { runInNewContext } = await import('node:vm')
const ts = await import('typescript')
const source = readFileSync(new URL('../mobile/App.tsx', import.meta.url), 'utf8')
const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function callback(name: string, bindings: Record<string, unknown>) {
  let text = ''
  function visit(node: import('typescript').Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && ts.isCallExpression(node.initializer)) text = node.initializer.arguments[0].getText(ast)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(text, `${name} exists`)
  return runInNewContext(ts.transpileModule(`var callback = ${text}; callback`, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText, bindings) as (...args: unknown[]) => Promise<unknown>
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))
for (const phase of ['cleanup', 'write'] as const) {
  for (const interruption of ['none', 'clear', 'navigation', 'unmount', 'parent-clear', 'session', 'generation'] as const) {
    let resume!: () => void
    const deferred = new Promise<void>((resolve) => { resume = resolve })
    const events: string[] = []
    const ref = <T,>(current: T) => ({ current })
    let currentWork = true
    let cleanupCalls = 0
    let writeCalls = 0
    const bindings: Record<string, unknown> = {
      autosaveReadyRef: ref(true), saveRequestRef: ref(0), saveGenerationRef: ref(0),
      workOperationGeneration: 7, isWorkOperationCurrent: () => currentWork,
      completingRef: ref(false), finishLifetimeRef: ref({ mounted: true, token: 0 }),
      leaveInProgressRef: ref(false), imageExportRef: ref({ token: 0, readiness: null }),
      sessionIdRef: ref('original'), sessionCreatedAtRef: ref('2026-10-27T10:00:00Z'),
      finishedAtRef: ref<string | undefined>(undefined), stampRef: ref<string | undefined>('heart'),
      persistedSessionRef: ref(true), lastSavedSignatureRef: ref('old'), savedStickerUrisRef: ref([]),
      pendingClearRef: ref(null), practiceStrokesRef: ref(old.strokes), stickersRef: ref([]),
      activePathRef: ref(''), activePointsRef: ref([]), activePointCountRef: ref(0), lastPointRef: ref(null), drawingActiveRef: ref(false), touchOwnerRef: ref(null),
      practiceSource: loaded.source, sessionTitle: 'Flower', guideOpacity: 0.24, guideOnTop: true, markerColor: '#18243A', markerWidth: 9, brushToolId: 'marker', stickers: [],
      setSaveStatus: () => undefined, setCompleting: () => { events.push('completing') },
      setKeepsakeDate: () => undefined, setActivePanel: () => undefined,
      setKeepsakeOpen: () => { events.push('keepsake') }, milestoneHaptic: () => { events.push('haptic') },
      finishPracticeStroke: () => undefined, materializeActivePracticeStroke: () => null,
      retryPendingImageCleanup: async () => { if (++cleanupCalls === 1 && phase === 'cleanup') await deferred },
      savePreviousWorkSession: async () => { if (++writeCalls === 1 && phase === 'write') await deferred; events.push('write') },
      deletePreviousWorkSession: async () => ({ imageCleanupPending: false, pendingImageUris: [] }),
      cleanupStoredImageUrisIfUnused: async () => undefined, rememberPendingImageCleanup: () => undefined,
      storedUploadedImageUrisFromStickers: () => [], makePracticeSaveSignature: JSON.stringify,
      hasKeepsakeContent, finishAfterSave, formatPreviousWorkDate: (value: string) => value,
      onSessionSaved: () => { events.push('saved') }, onSessionDeleted: () => undefined,
      Alert: { alert: () => { events.push('alert') } }, cancelActivePathUpdate: () => undefined,
      setActivePath: () => undefined, setActiveStrokeRender: () => undefined, setPracticeStrokes: () => undefined,
      setStickers: () => undefined, setStamp: () => undefined, setSelectedStickerId: () => undefined,
      createPracticeSessionId: () => 'replacement',
    }
    const saveResults: unknown[] = []
    const save = callback('savePracticeSessionNow', bindings)
    bindings.savePracticeSessionNow = async () => { const result = await save(); saveResults.push(result); return result }
    const done = callback('finishDrawing', bindings)
    const finishing = done()
    await flush()
    assert.ok(!events.includes('keepsake') && !events.includes('haptic'), 'Pending storage cannot finish')
    if (interruption === 'clear') await callback('clearPracticeStrokes', bindings)()
    if (interruption === 'navigation') await callback('leavePractice', bindings)(() => { events.push('navigate') })
    if (interruption === 'parent-clear') currentWork = false
    if (interruption === 'session') (bindings.sessionIdRef as { current: string }).current = 'replacement'
    if (interruption === 'generation') (bindings.saveGenerationRef as { current: number }).current++
    if (interruption === 'unmount') {
      let effect = ''
      function find(node: import('typescript').Node) {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0]?.getText(ast).includes('finishLifetimeRef.current.mounted = false')) effect = node.arguments[0].getText(ast)
        ts.forEachChild(node, find)
      }
      find(ast)
      assert.ok(effect, 'Finish teardown is wired')
      runInNewContext(ts.transpileModule(`const effect = ${effect}; effect`, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText, bindings)()()
    }
    await flush()
    const completingUpdates = events.filter((event) => event === 'completing').length
    resume(); await finishing; await flush()
    if (interruption === 'none') {
      assert.equal(events.filter((event) => event === 'keepsake').length, 1)
      assert.equal(events.filter((event) => event === 'haptic').length, 1)
      assert.equal(saveResults.at(-1), true)
    } else {
      assert.ok(!events.includes('keepsake') && !events.includes('haptic'), `${phase}/${interruption}: revoked Done cannot celebrate`)
      if (['clear', 'generation', 'parent-clear', 'navigation'].includes(interruption)) assert.equal(saveResults.at(-1), false, 'Revoked actual save returns false')
      if (interruption === 'clear' && phase === 'cleanup') assert.equal(writeCalls, 0, 'Cleared finish never starts a session write')
      if (interruption === 'navigation') assert.ok(events.includes('navigate'), 'The actual leave callback completes')
      if (interruption === 'unmount') assert.equal(events.filter((event) => event === 'completing').length, completingUpdates, 'No finish state update after unmount')
    }
  }
}
console.log('Actual Done/save callbacks: deferred cleanup + write → Clear/navigation/unmount/session/generation/parent clear suppress revoked finish; successful finish still opens once')
