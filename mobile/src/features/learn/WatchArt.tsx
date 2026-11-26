import type { DrawingLesson } from '../../../../shared/lessons/drawingLessons'
import { StillWatchArt } from './LessonArt'

export type WatchArtProps = { lesson: DrawingLesson; step: number; side: number; still: boolean; onStart: () => void; onFinish: () => void }

// The native renderer uses Skia. The Expo web renderer draws the full instruction.
export function WatchArt({ lesson, step, onStart, onFinish }: WatchArtProps) {
  return <StillWatchArt lesson={lesson} step={step} onStart={onStart} onFinish={onFinish} />
}
