import { hasKeepsakeContent } from '../../finishFindModel'
import { defaultMarkerColor, makePracticeSessionTitle } from '../../practiceStorageModel'
import type { PracticeSource, SavedPracticeSession } from '../../practiceStorageModel'
import { createPracticeSessionId, drawingTitle, photoDrawingName } from './practiceSource'

export function hasDrawingContent(session: SavedPracticeSession) {
  return Boolean(session.lessonFinished) || hasKeepsakeContent(session.strokes.length, session.stickers.length, session.stamp, session.finishedAt)
}

export function newDrawing(source: PracticeSource): SavedPracticeSession {
  const now = new Date().toISOString()
  return {
    version: 2,
    sessionId: createPracticeSessionId(),
    // 2.0 uses "Practice" for a letter style, so typed words keep their own name instead of the 1.x "… practice" title.
    title: source.kind === 'upload' ? photoDrawingName : source.kind === 'custom' ? source.drawingName : makePracticeSessionTitle(source),
    source,
    createdAt: now,
    updatedAt: now,
    strokes: [],
    stickers: [],
    canvasWidth: 1000,
    canvasHeight: 1000,
    guideOpacity: 0.24,
    guideOnTop: true,
    markerColor: defaultMarkerColor,
    markerWidth: 9,
    brushToolId: 'marker',
  }
}

export function drawingCopy(original: SavedPracticeSession) {
  const copy = newDrawing(original.source)
  return { ...original, lessonFinished: undefined, sessionId: copy.sessionId, title: `${drawingTitle(original)} copy`, createdAt: copy.createdAt, updatedAt: copy.updatedAt }
}
