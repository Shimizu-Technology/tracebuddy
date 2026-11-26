import type { PaperPhoto, SavedPracticeSession } from '../../practiceStorageModel'
import { photoDrawingName } from './practiceSource'

// A paper keepsake is an ordinary saved drawing with a `paperPhoto`: the photo of what the child drew
// On paper. Its `source` is the picture they traced, so it can be traced again, and it has no ink.

export type PaperKeepsake = SavedPracticeSession & { paperPhoto: PaperPhoto }

export function isPaperKeepsake(session: Pick<SavedPracticeSession, 'paperPhoto'>): session is PaperKeepsake {
  return Boolean(session.paperPhoto)
}

export function paperKeepsakeTitle(source: SavedPracticeSession['source']) {
  return `${source.kind === 'upload' ? photoDrawingName : source.drawingName} (on paper)`
}

/** Turns a new, empty drawing of the traced picture into its paper keepsake. */
export function makePaperKeepsake(drawing: SavedPracticeSession, photo: PaperPhoto): PaperKeepsake {
  return {
    ...drawing,
    title: paperKeepsakeTitle(drawing.source),
    strokes: [],
    stickers: [],
    finishedAt: drawing.createdAt,
    paperPhoto: photo,
  }
}
