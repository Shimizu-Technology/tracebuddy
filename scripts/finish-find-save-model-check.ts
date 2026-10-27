import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { settleCurrentSave, type SaveOutcome } from '../src/practice/saveCompletion'

// Execute the actual App save/Done callbacks with controlled persistence promises.
// This reproduces the upload await -> autosave supersession -> replacement failure
// ordering, rather than a separate implementation of the intended contract.
const source = readFileSync(process.env.CHECK_APP_SOURCE ?? new URL('../src/App.tsx', import.meta.url), 'utf8')
const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function callback(name: string) {
  let found = ''
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer) found = node.initializer.getText(ast)
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(ast)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert(found, `Actual callback ${name} must exist`)
  return ts.transpile(`const actualCallback = (${found});`, { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX })
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const ref = <T>(current: T) => ({ current })
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
for (const emptyDraft of [false, true]) for (const replacementSucceeds of [false, true]) {
  const uploads: ReturnType<typeof deferred<void>>[] = []
  const commits: unknown[] = []
  let opened = false, finishing = false, status = ''
  const env = {
    useCallback: (fn: unknown) => fn,
    settleCurrentSave,
    saveGenerationRef: ref(0), saveRequestRef: ref(0), latestSaveRef: ref<Promise<SaveOutcome> | null>(null),
    preserveEmptyDraftRef: ref(false), conflictRef: ref(false), autosaveReadyRef: ref(true),
    commitQueueRef: ref<Promise<unknown>>(Promise.resolve()), uploadedImage: { imageId: 'delayed-upload' },
    onEnsureUploadedImageSaved: () => { const next = deferred<void>(); uploads.push(next); return next.promise },
    setSaveStatus: (next: string) => { status = next },
    materializeActiveStroke: () => null, strokesRef: ref(emptyDraft ? [] : [{ path: 'M1 1 L2 2' }]),
    sessionIdRef: ref('owned-fixture'), documentSizeRef: ref({ width: 1000, height: 1000 }),
    sessionTitle: 'Delayed photo', activityId: undefined, stampRef: ref(undefined), practiceSource: { kind: 'upload' },
    sessionCreatedAtRef: ref('2026-10-27T00:00:00Z'), guideOpacity: .26, guideOnTop: true,
    markerColor: '#123', markerWidth: 12, brushToolId: 'marker', persistedSessionRef: ref(false),
    lastSavedSignatureRef: ref(''), makePracticeSaveSignature: JSON.stringify,
    revisionRef: ref<number | null>(null), clearGenerationRef: ref('same-generation'),
    savePreviousWorkSession: async (snapshot: object, _revision: unknown, _generation: unknown, current: () => boolean) => {
      if (!current()) return null
      commits.push(snapshot)
      return { ...snapshot, revision: 1, updatedAt: '2026-10-27T00:01:00Z' }
    },
    window: { localStorage: { removeItem() {}, setItem() {} } }, journalKeyRef: ref('fixture-journal'), activePracticeKey: 'fixture-active',
    sessionUpdatedAtRef: ref(''), onSessionSaved() {}, StaleDrawingError: class extends Error {},
    finishing, setFinishing: (value: boolean) => { finishing = value }, finishStroke() {},
    formatPreviousWorkDate: (value: string) => value, setKeepsakeDate() {}, setKeepsakeOpen: (value: boolean) => { opened = value },
  }
  const evaluate = (code: string, extra = {}) => { const context = { ...env, ...extra }; return new Function(...Object.keys(context), `${code}; return actualCallback`)(...Object.values(context)) }
  const save = evaluate(callback('savePracticeSessionNow')) as () => Promise<boolean>
  const finish = evaluate(callback('finishDrawing'), { savePracticeSessionNow: save }) as () => Promise<void>
  const done = finish()
  assert.equal(uploads.length, 1)
  const autosave = save()
  assert.equal(uploads.length, 2)
  uploads[0].resolve()
  await tick()
  assert.equal(opened, false, 'Done must stay pending while its replacement upload is unresolved')
  assert.equal(finishing, true)
  assert.equal(commits.length, 0)
  if (replacementSucceeds) uploads[1].resolve()
  else uploads[1].reject(new Error('Replacement image write failed'))
  assert.equal(await autosave, replacementSucceeds)
  await done
  assert.equal(opened, replacementSucceeds)
  assert.equal(commits.length, replacementSucceeds ? 1 : 0)
  assert.equal(status, replacementSucceeds ? 'saved' : 'error')
}
// A retained pre-clear mode callback must also be rejected after Clear finishes.
for (const [clearing, renderedGeneration, currentGeneration] of [[true, 0, 1], [false, 0, 1], [false, 1, 1]] as const) {
  let writes = 0
  const env = {
    drawingPreferencesClearInProgressRef: ref(clearing), surfaceChoiceGeneration: renderedGeneration,
    previousWorkOperationGenerationRef: ref(currentGeneration), setTraceSurface() {},
    window: { localStorage: { setItem() { writes++ } } }, modePreferenceKey: 'fixture-mode',
    makeModePreference: (mode: string) => ({ version: 1, mode }), setDrawingPreferencesMessage() {},
  }
  new Function(...Object.keys(env), `${callback('chooseTraceSurface')}; return actualCallback`)(...Object.values(env))('screen')
  assert.equal(writes, !clearing && renderedGeneration === currentGeneration ? 1 : 0)
}
console.log('Actual web callbacks pass: delayed Done/autosave replacement failure and success; Clear mode ref/generation guards.')

for (const initial of ['This choice will last for this visit only.', 'Favorites and recent picks will last for this visit only.']) {
  let message = initial
  const env = {
    drawingPreferencesClearInProgressRef: ref(false), surfaceChoiceGeneration: 1,
    previousWorkOperationGenerationRef: ref(1), setTraceSurface() {},
    window: { localStorage: { setItem() {} } }, modePreferenceKey: 'fixture-mode',
    makeModePreference: (mode: string) => ({ version: 1, mode }),
    setDrawingPreferencesMessage: (update: (current: string) => string) => { message = update(message) },
  }
  new Function(...Object.keys(env), `${callback('chooseTraceSurface')}; return actualCallback`)(...Object.values(env))('screen')
  assert.equal(message, initial.startsWith('This choice') ? '' : initial, 'Surface recovery must preserve an unrelated preferences warning')
}
