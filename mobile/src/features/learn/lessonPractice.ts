import { completeGuidedLesson, normalizeLearningProgress, updateLearningStep } from '../../../../shared/lessons'
import type { LearningProgress } from '../../../../shared/lessons'
import { drawingLessonById } from '../../../../shared/lessons/drawingLessons'
import type { DrawingLesson, DrawingLessonMetadata } from '../../../../shared/lessons/drawingLessons'
import type { PracticeStroke, SavedPracticeSession } from '../../../practiceStorageModel'

const lessonSessionPrefix = 'lesson:'

export function lessonDestination(lesson: DrawingLessonMetadata) {
  return { pathname: '/learn/[level]/[id]' as const, params: { level: lesson.level, id: lesson.pictureId } }
}

export function lessonSessionId(lesson: Pick<DrawingLessonMetadata, 'id'>) {
  return lessonSessionPrefix + lesson.id
}

export function lessonForSession(sessionId: string) {
  if (sessionId.startsWith(lessonSessionPrefix)) return drawingLessonById(sessionId.slice(lessonSessionPrefix.length))
}

export function lessonResume(progress: LearningProgress, lesson: DrawingLesson, drawing: SavedPracticeSession | null) {
  const step = normalizeLearningProgress(progress).stepByLessonId[lesson.id] ?? 0
  const finished = drawing?.sessionId === lessonSessionId(lesson) && drawing.lessonFinished === true
  return { step: finished ? lesson.steps.length - 1 : step, finished }
}

export function recordLessonProgress(progress: LearningProgress, lesson: DrawingLesson, step: number, finished = false) {
  return finished ? completeGuidedLesson(progress, lesson) : updateLearningStep(progress, lesson, step)
}

export function undoLessonStroke(strokes: PracticeStroke[], step: number) {
  const last = strokes.findLastIndex((stroke) => stroke.lessonStep === step)
  return last === -1 ? strokes : [...strokes.slice(0, last), ...strokes.slice(last + 1)]
}

type LessonDrawingRecords = {
  readSessionInQueue: (id: string) => Promise<SavedPracticeSession | null>
  writeSessionInQueue: (drawing: SavedPracticeSession) => Promise<unknown>
  deleteSessionInQueue: (id: string) => Promise<void>
}

export async function preserveLessonDrawing(
  records: LessonDrawingRecords,
  drawing: SavedPracticeSession,
  isCurrent: () => boolean,
  resetProgress: () => Promise<void>,
) {
  if (!isCurrent()) return false
  const latest = await records.readSessionInQueue(drawing.sessionId)
  const original = latest && Date.parse(latest.updatedAt) > Date.parse(drawing.updatedAt) ? latest : drawing
  const archiveId = `keepsake-${original.sessionId}-${original.createdAt}-${original.updatedAt}`
  if (!await records.readSessionInQueue(archiveId)) {
    if (!isCurrent()) return false
    await records.writeSessionInQueue({ ...original, sessionId: archiveId })
  }
  if (!isCurrent()) return false
  await resetProgress()
  if (!isCurrent()) return false
  await records.deleteSessionInQueue(drawing.sessionId)
  return isCurrent()
}
