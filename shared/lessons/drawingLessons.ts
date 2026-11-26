import generated from './lesson-index.generated.json'

export type LessonPoint = readonly [x: number, y: number]
export type LessonStroke = { d: string; len: number; pen: readonly LessonPoint[] }
export type LessonDot = { cx: number; cy: number; r: number }
export type DrawingLessonStep = { say: string; strokes: readonly LessonStroke[]; dots: readonly LessonDot[] }
export type DrawingLessonMetadata = {
  id: string
  pictureId: string
  level: 'simple' | 'detailed'
  title: string
  stepCount: number
}

export type LessonGeometry = { id: string; strokeWidth: number; steps: readonly DrawingLessonStep[] }
export type DrawingLesson = DrawingLessonMetadata & LessonGeometry

// The raw JSON is validated by scripts/drawing-lessons-check.ts.
export const drawingLessonIndex = generated as readonly DrawingLessonMetadata[]

export function drawingLessonById(id: string | undefined) {
  return drawingLessonIndex.find((lesson) => lesson.id === id)
}

export function drawingLessonForPicture(pictureId: string, level: DrawingLessonMetadata['level'] | undefined) {
  return drawingLessonIndex.find((lesson) => lesson.pictureId === pictureId && lesson.level === level)
}
