import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { completeGuidedLesson, guidedLessons, normalizeLearningProgress } from '../shared/lessons'
import generated from '../shared/lessons/lessons.generated.json'
import drawingLessonStepCounts from '../shared/lessons/step-counts.generated.json'
import { drawingLessons } from '../shared/lessons/drawingLessons'
import { normalizeSavedPracticeSession } from '../mobile/practiceStorageModel'
import {
  lessonForSession, lessonResume, lessonSessionId, recordLessonProgress, undoLessonStroke,
} from '../mobile/src/features/learn/lessonPractice'

const manifests = Object.fromEntries(['simple', 'detailed'].map((level) => {
  const rows = JSON.parse(readFileSync(new URL(`../shared/art/${level}/manifest.json`, import.meta.url), 'utf8')) as { id: string }[]
  return [level, new Set(rows.map(({ id }) => id))]
}))
const coordinate = (value: unknown): value is number => typeof value === 'number' && value >= 0 && value <= 1000
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const tokenPattern = /[MLQCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g
const commandSize = { M: 2, L: 2, Q: 4, C: 6, Z: 0 }
const ids = new Set(guidedLessons.map(({ id }) => id))
const pictures = new Set<string>()

function object(value: unknown, keys: string[], context: string) {
  assert(value && typeof value === 'object' && !Array.isArray(value), context)
  const record = value as Record<string, unknown>
  assert.deepEqual(Object.keys(record).sort(), keys.sort(), context)
  return record
}

function checkPath(d: string, context: string) {
  // The builder emits absolute commands. Bounded endpoints and control points
  // bound the entire line or Bézier by its convex hull.
  const tokens = [...d.matchAll(tokenPattern)].map((match) => match[0])
  assert.equal(d.replace(tokenPattern, '').replace(/[\s,]+/g, ''), '', context)
  assert(tokens[0] === 'M' && tokens.length >= 6, context)
  const start = tokens.slice(1, 3).map(Number)
  let end = start
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++] as keyof typeof commandSize
    assert(Object.hasOwn(commandSize, command), context)
    assert(command !== 'M' || i === 1, context)
    assert(command !== 'Z' || i === tokens.length, context)
    const size = commandSize[command]
    const values = tokens.slice(i, i + size).map(Number)
    assert(values.length === size && values.every(coordinate), context)
    end = command === 'Z' ? start : values.slice(-2)
    i += size
  }
  return { start, end }
}

assert(Array.isArray(generated) && generated.length > 0, 'Provide at least one lesson')
for (const [i, data] of (generated as unknown[]).entries()) {
  const lesson = object(data, ['id', 'pictureId', 'level', 'title', 'strokeWidth', 'steps'], `Lesson ${i + 1}`)
  const { id, pictureId, level, title, strokeWidth, steps } = lesson
  assert(text(id) && !ids.has(id), `Invalid or duplicate lesson ID: ${id}`)
  ids.add(id)
  assert((level === 'simple' || level === 'detailed') && text(pictureId) && manifests[level].has(pictureId),
    `${id} must reference an existing ${level} picture: ${pictureId}`)
  const pictureKey = `${level}/${pictureId}`
  assert.equal(id, pictureKey, "Lesson IDs use level/pictureId")
  assert(!pictures.has(pictureKey), `Duplicate lesson for ${pictureKey}`)
  pictures.add(pictureKey)
  assert(text(title) && positive(strokeWidth) && strokeWidth <= 1000, id)
  assert(Array.isArray(steps) && steps.length > 0, `${id} needs steps`)
  for (const [j, rawStep] of steps.entries()) {
    const context = `${id}, step ${j + 1}`
    const { say, strokes, dots } = object(rawStep, ['say', 'strokes', 'dots'], context)
    assert(text(say) && say.trim().split(/\s+/).length <= 10, `${context} needs a sentence of at most 10 words`)
    assert(Array.isArray(strokes) && Array.isArray(dots) && strokes.length + dots.length > 0, `${context} needs a stroke or dot`)
    for (const [k, rawStroke] of strokes.entries()) {
      const label = `${context}, stroke ${k + 1}`
      const { d, len, pen } = object(rawStroke, ['d', 'len', 'pen'], label)
      assert(text(d) && positive(len) && Array.isArray(pen) && pen.length >= 2, label)
      assert(pen.every((p: unknown) => Array.isArray(p) && p.length === 2 && p.every(coordinate)), `Out-of-bounds pencil point in ${label}`)
      const { start, end } = checkPath(d, `Invalid or out-of-bounds path in ${label}`)
      assert(start.every((n, axis) => Math.abs(n - pen[0][axis]) < 0.1), `Pencil should start on the path in ${label}`)
      assert(end.every((n, axis) => Math.abs(n - pen.at(-1)[axis]) < 0.1), `Pencil should end on the path in ${label}`)
    }
    for (const rawDot of dots) {
      const { cx, cy, r } = object(rawDot, ['cx', 'cy', 'r'], context)
      assert(coordinate(cx) && coordinate(cy) && positive(r)
        && coordinate(cx - r) && coordinate(cx + r) && coordinate(cy - r) && coordinate(cy + r), `Out-of-bounds dot in ${context}`)
    }
  }
}

assert.deepEqual(drawingLessonStepCounts, Object.fromEntries(drawingLessons.map(({ id, steps }) => [id, steps.length])))
const cat = drawingLessons.find(({ id }) => id === 'simple/cat')!
assert.notEqual(lessonSessionId(cat), lessonSessionId({ ...cat, id: 'detailed/cat', level: 'detailed' }))
const legacy = completeGuidedLesson(normalizeLearningProgress(null), guidedLessons[0])
const inProgress = recordLessonProgress(legacy, cat, 2)
assert.deepEqual(normalizeLearningProgress(JSON.parse(JSON.stringify(inProgress))), inProgress)
assert.deepEqual(lessonResume(inProgress, cat, null), { step: 2, finished: false })
assert.equal(lessonResume(recordLessonProgress(inProgress, cat, 999), cat, null).step, cat.steps.length - 1)
assert.equal(lessonForSession(lessonSessionId(cat)), cat)
assert.equal(lessonForSession('ordinary-drawing'), undefined)

const stroke = { path: 'M 2 2 L 3 3', width: 6 }
const session = {
  sessionId: lessonSessionId(cat),
  source: { kind: 'drawing', drawingId: 'tb2-simple-cat', drawingName: 'Cat', drawingTheme: 'Cat' },
  strokes: [{ ...stroke, lessonStep: 0 }, { ...stroke, lessonStep: 2 }, { ...stroke, lessonStep: 1 }, { ...stroke, lessonStep: 2 }, stroke],
}
const reopened = normalizeSavedPracticeSession(JSON.parse(JSON.stringify(session)))!
assert.deepEqual(reopened.strokes.map(({ lessonStep }) => lessonStep), [0, 2, 1, 2, undefined])
assert.deepEqual(undoLessonStroke(reopened.strokes, 2).map(({ lessonStep }) => lessonStep), [0, 2, 1, undefined])
assert.deepEqual(lessonResume(inProgress, cat, reopened), { step: 2, finished: false })

const completed = recordLessonProgress(inProgress, cat, 2, true)
assert.deepEqual(completed.completedLessonIds, [guidedLessons[0].id, cat.id])
assert.deepEqual(recordLessonProgress(completed, cat, 999, true), completed)
const colored = normalizeSavedPracticeSession({ ...session, lessonFinished: true })!
assert.deepEqual(lessonResume(completed, cat, colored), { step: cat.steps.length - 1, finished: true })
const restarted = recordLessonProgress(completed, cat, 0)
assert.deepEqual(restarted.completedLessonIds, completed.completedLessonIds)
assert.deepEqual(lessonResume(restarted, cat, null), { step: 0, finished: false })
console.log(`Validated ${generated.length} drawing lessons, legacy progress, step-scoped ink and lesson resume.`)
