import assert from 'node:assert/strict'

import {
  completeGuidedLesson,
  emptyLearningProgress,
  guidedLessonPreviewDrawing,
  guidedLessons,
  guidedLessonStepDrawing,
  normalizeLearningProgress,
  updateLearningStep,
} from '../shared/index.ts'

assert.equal(guidedLessons.length, 8)
assert.equal(new Set(guidedLessons.map(({ id }) => id)).size, guidedLessons.length)
assert(guidedLessons.every((lesson) => lesson.steps.length >= 4 && lesson.steps.length <= 6))
assert(guidedLessons.every((lesson) => lesson.steps.every((step) => step.title && step.instruction && step.fragment)))

const lesson = guidedLessons[0]
assert.deepEqual(normalizeLearningProgress(null), emptyLearningProgress)
assert.deepEqual(normalizeLearningProgress({
  completedLessonIds: [lesson.id, 'missing', lesson.id],
  stepByLessonId: { [lesson.id]: 999, missing: 2 },
}), {
  version: 1,
  completedLessonIds: [lesson.id],
  stepByLessonId: { [lesson.id]: lesson.steps.length - 1 },
})

const atSecondStep = updateLearningStep(emptyLearningProgress, lesson, 1)
assert.equal(atSecondStep.stepByLessonId[lesson.id], 1)
const finished = completeGuidedLesson(atSecondStep, lesson)
assert.deepEqual(finished.completedLessonIds, [lesson.id])
assert.equal(finished.stepByLessonId[lesson.id], lesson.steps.length - 1)
assert.deepEqual(completeGuidedLesson(finished, lesson).completedLessonIds, [lesson.id])

const preview = guidedLessonPreviewDrawing(lesson)
const firstStep = guidedLessonStepDrawing(lesson, 0)
const lastStep = guidedLessonStepDrawing(lesson, 999)
assert(preview.svg.startsWith('<svg') && preview.svg.includes('#18243A'))
assert(firstStep.svg.includes('#FF795D'))
assert(!firstStep.svg.includes(lesson.steps[1].fragment))
assert(lastStep.svg.includes(lesson.steps.at(-1)?.fragment ?? 'missing'))

console.log('Guided lesson model checks passed')
