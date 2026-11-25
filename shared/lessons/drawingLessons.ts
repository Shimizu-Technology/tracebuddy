import generated from './lessons.generated.json'

export type LessonPoint = readonly [x: number, y: number]
export type LessonStroke = { d: string; len: number; pen: readonly LessonPoint[] }
export type LessonDot = { cx: number; cy: number; r: number }
export type DrawingLessonStep = { say: string; strokes: readonly LessonStroke[]; dots: readonly LessonDot[] }
export type DrawingLesson = {
  id: string
  pictureId: string
  level: 'simple' | 'detailed'
  title: string
  strokeWidth: number
  steps: readonly DrawingLessonStep[]
}

// The raw JSON is validated by scripts/drawing-lessons-check.ts.
export const drawingLessons = generated as unknown as readonly DrawingLesson[]

export function drawingLessonById(id: string | undefined) {
  return drawingLessons.find((lesson) => lesson.id === id)
}

export function drawingLessonForPicture(pictureId: string, level: DrawingLesson['level'] | undefined) {
  return drawingLessons.find((lesson) => lesson.pictureId === pictureId && lesson.level === level)
}
