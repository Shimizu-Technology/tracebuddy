import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { useWindowDimensions } from 'react-native'

import { hasKeepsakeContent } from '../../finishFindModel'
import type { PracticeSource, SavedPracticeSession } from '../../practiceStorageModel'
import { defaultMarkerColor, makePracticeSessionTitle } from '../../practiceStorageModel'
import { cleanupDrawingImagesInQueue, cleanupOrphanedDrawingImages } from './drawingImageFiles'
import { previousWorkStorage } from './nativeStorage'
import { createPracticeSessionId, drawingTitle, photoDrawingName } from './practiceSource'
import { drawingImageUris } from './practiceImageCleanup'
import { parsePreviousWorkSession, previousWorkSessionKey, serializePreviousWorkIndex } from './previousWork'
import { previousWorkIndexKey } from './storageKeys'

export function readDrawing(sessionId: string) {
  return AsyncStorage.getItem(previousWorkSessionKey(sessionId)).then(parsePreviousWorkSession)
}

export function saveDrawing(session: SavedPracticeSession, isCurrent = () => true) {
  return previousWorkStorage.savePreviousWorkSession(session, isCurrent)
}

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

export function copyDrawing(original: SavedPracticeSession) {
  const copy = newDrawing(original.source)
  return saveDrawing({ ...original, lessonFinished: undefined, sessionId: copy.sessionId, title: `${drawingTitle(original)} copy`, createdAt: copy.createdAt, updatedAt: copy.updatedAt })
}

export function deleteDrawing(id: string, isCurrent = () => true) {
  return previousWorkStorage.queuePreviousWorkWrite(async () => {
    if (!isCurrent()) return false
    const ids = await previousWorkStorage.readPreviousWorkIds()
    const key = previousWorkSessionKey(id)
    const deleted = await readDrawing(id).catch(() => null)
    // Hide the item from the index only after removing its session record. A
    // failed index write leaves a dangling key that the existing reader repairs.
    if (!isCurrent()) return false
    await AsyncStorage.removeItem(key)
    await AsyncStorage.setItem(previousWorkIndexKey, serializePreviousWorkIndex(ids.filter((candidate) => candidate !== id))).catch(() => undefined)
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
    void previousWorkStorage.loadPreviousWorkSessionsWithLegacyMigration(legacySize, () => current).then((sessions) => {
      if (current) {
        setDrawings(sessions)
        setFailed(false)
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
