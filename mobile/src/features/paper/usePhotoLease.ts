import { useEffect } from 'react'

import { keepDrawingImages } from '../../data/drawingImageFiles'
import { createPhotoHandoff } from './photoHandoff'

const handoffLapseMs = 10000

export const photoHandoff = createPhotoHandoff(keepDrawingImages, (run, ms) => {
  const timer = setTimeout(run, ms)
  return () => clearTimeout(timer)
}, handoffLapseMs)

/** Holds this screen's photo while it is mounted, and takes over a hand-off from the screen before. */
export function usePhotoLease(uri: string | undefined) {
  useEffect(() => {
    if (!uri) return undefined
    const release = photoHandoff.hold(uri)
    return () => { void release() }
  }, [uri])
}
