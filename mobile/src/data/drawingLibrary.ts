import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { useWindowDimensions } from 'react-native'

import type { SavedPracticeSession } from '../../practiceStorageModel'
import { cleanupDrawingImagesInQueue, cleanupOrphanedDrawingImages } from './drawingImageFiles'
import { previousWorkStorage } from './nativeStorage'
import { drawingCopy } from './drawingSession'
import { drawingImageUris } from './practiceImageCleanup'

export function readDrawing(sessionId: string) {
  return previousWorkStorage.readPreviousWorkSession(sessionId)
}

export function saveDrawing(session: SavedPracticeSession, isCurrent = () => true) {
  return previousWorkStorage.savePreviousWorkSession(session, isCurrent)
}

export { hasDrawingContent, newDrawing } from './drawingSession'

export function copyDrawing(original: SavedPracticeSession) {
  return saveDrawing(drawingCopy(original))
}

export function deleteDrawing(id: string, isCurrent = () => true) {
  return previousWorkStorage.queuePreviousWorkWrite(async () => {
    if (!isCurrent()) return false
    const deleted = await previousWorkStorage.readSessionInQueue(id)
    if (!isCurrent()) return false
    await previousWorkStorage.deleteSessionInQueue(id)
    await cleanupDrawingImagesInQueue(drawingImageUris(deleted))
    return isCurrent()
  })
}

let orphanSweepStarted = false

export function useDrawingLibrary() {
  const { width, height } = useWindowDimensions()
  const [drawings, setDrawings] = useState<SavedPracticeSession[]>()
  const [failed, setFailed] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useFocusEffect(useCallback(() => {
    let current = true
    if (reloadToken) setFailed(false)
    // Match the legacy migration's dimensions for pre-v2 pixel paths.
    const legacySize = { width: Math.max(1, width - 20), height: Math.max(430, height - 280) }
    let unreadable = false
    void previousWorkStorage.loadPreviousWorkSessionsWithLegacyMigration(legacySize, () => current, () => { unreadable = true }).then((sessions) => {
      if (current) {
        setDrawings(sessions)
        setFailed(unreadable)
        if (!orphanSweepStarted) {
          orphanSweepStarted = true
          void cleanupOrphanedDrawingImages()
        }
      }
    }).catch(() => { if (current) setFailed(true) })
    return () => { current = false }
  }, [width, height, reloadToken]))

  return { drawings, failed, reload: () => setReloadToken((token) => token + 1) }
}
