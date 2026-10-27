import assert from 'node:assert/strict'
import { createOperationQueue, operationGuard, queueSessionWrite, shouldPersistResume, writeIfCurrent } from '../mobile/practiceOperations.ts'
import { createPracticePreviewCache } from '../mobile/practicePreviewCache.ts'
import { normalizeResumeContext, strokePointAction } from '../mobile/practiceModel.ts'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

// Use the same queues, guard and read/commit pipeline as native AsyncStorage.
// Pause before queueing, during index reads, and during the storage commit.
for (const pauseAt of ['cleanup', 'index', 'commit'] as const) {
  const sessions = createOperationQueue()
  const preferences = createOperationQueue()
  const store = new Map<string, unknown>([['resume', { lessonId: 'flower' }]])
  const pause = deferred()
  const started = deferred()
  let generation = 0
  let mounted = true
  let clearing = false
  let enabled = true
  assert.equal(shouldPersistResume(enabled, 'picker', clearing), true)
  const isCurrent = operationGuard(generation, () => generation, () => mounted && !clearing)
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
  mounted = false
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
  mounted = true
  const next = operationGuard(generation, () => generation, () => mounted && !clearing)
  assert.equal(shouldPersistResume(enabled, 'learn', clearing), true)
  await preferences(() => writeIfCurrent(next, async () => { store.set('resume', { mode: 'learn', lessonId: 'flower' }) }))
  assert.equal(normalizeResumeContext(store.get('resume'), ['line', 'flower'])?.lessonId, 'flower')
}

// A queued preference/resume operation must recheck after clear, even once its
// transient clearing flag is false. Also cover unmount without any clear.
for (const invalidate of ['clear', 'unmount']) {
  let generation = 0
  let mounted = true
  const queue = createOperationQueue()
  const pause = deferred()
  const blocker = queue(() => pause.promise)
  const guard = operationGuard(generation, () => generation, () => mounted)
  const writes: string[] = []
  const pending = ['preferences', 'resume', 'alignment', 'lesson', 'setup'].map((key) => queue(() => writeIfCurrent(guard, async () => { writes.push(key) })))
  if (invalidate === 'clear') generation++
  else mounted = false
  pause.resolve()
  await Promise.all([blocker, ...pending])
  assert.deepEqual(writes, [])
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
console.log('Native operation models passed: pending save/clear overlaps, queued preference/resume fences, unmount, lesson resume, stroke gaps and bounded revision cache (no native render coverage)')
