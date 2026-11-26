import * as FileSystem from 'expo-file-system/legacy'

import type { Picture } from './catalog'
import { sourceForPicture } from './catalog'
import { keepDrawingImages } from './drawingImageFiles'
import { newDrawing, saveDrawing } from './drawingLibrary'
import { previousWorkStorage } from './nativeStorage'
import { makePaperKeepsake } from './paperKeepsakeModel'
import { createPracticeSessionId, keepsakeImageFolder } from './practiceSource'

export type PaperShot = { uri: string; width: number; height: number }

/**
 * Keeps a snapped photo of a paper drawing in My drawings: the photo is copied to Documents/tracebuddy-keepsakes
 * (out of reach of the 1.x uploads sweep) and saved as a new drawing of the traced picture. Its file is held
 * until the record is written, so a cleanup sweep can't remove it first, and is removed if the save fails.
 */
export async function savePaperKeepsake(picture: Picture, guideSvg: string, shot: PaperShot) {
  if (!FileSystem.documentDirectory) throw new Error('App storage is unavailable')
  const directory = `${FileSystem.documentDirectory}${keepsakeImageFolder}/`
  const extension = /\.(png|jpe?g)$/i.exec(shot.uri)?.[1]?.toLowerCase() ?? 'jpg'
  const uri = `${directory}${createPracticeSessionId()}.${extension}`
  const release = keepDrawingImages([uri])
  try {
    await previousWorkStorage.queuePreviousWorkWrite(async () => {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
      await FileSystem.copyAsync({ from: shot.uri, to: uri })
    })
    const keepsake = makePaperKeepsake(newDrawing(sourceForPicture(picture, guideSvg)), { uri, width: shot.width, height: shot.height })
    if (!await saveDrawing(keepsake)) throw new Error('Could not save the photo')
    return keepsake
  } finally {
    await release()
  }
}

/** A snapped photo that wasn't kept. */
export function discardPaperShot(shot: Pick<PaperShot, 'uri'>) {
  return FileSystem.deleteAsync(shot.uri, { idempotent: true }).catch(() => undefined)
}
