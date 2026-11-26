import AsyncStorage from '@react-native-async-storage/async-storage'

import type { DrawingLesson } from '../../../../shared/lessons/drawingLessons'
import { writeIfCurrent } from '../../../practiceOperations'
import type { OperationGuard } from '../../../practiceOperations'
import type { SavedPracticeSession } from '../../../practiceStorageModel'
import { cleanupDrawingImagesInQueue } from '../../data/drawingImageFiles'
import { parseLearningProgress } from '../../data/localSettings'
import { previousWorkStorage, queueDrawingPreferencesOperation, readLocalSetting, writeLocalSetting } from '../../data/nativeStorage'
import { drawingImageUris } from '../../data/practiceImageCleanup'
import { previousWorkSessionKey, serializePreviousWorkIndex, serializePreviousWorkSession } from '../../data/previousWork'
import { learningProgressKey, lessonMutedKey, previousWorkIndexKey } from '../../data/storageKeys'
import { recordLessonProgress } from './lessonPractice'

export async function readLessonProgress() {
  return parseLearningProgress(await readLocalSetting(learningProgressKey))
}

export function saveLessonProgress(lesson: DrawingLesson, step: number, finished = false) {
  return queueDrawingPreferencesOperation(async () => {
    const progress = await readLessonProgress()
    await AsyncStorage.setItem(learningProgressKey, JSON.stringify(recordLessonProgress(progress, lesson, step, finished)))
  })
}

export function restartSavedLesson(lesson: DrawingLesson, drawing: SavedPracticeSession, isCurrent: OperationGuard) {
  // Use the same lock order as Clear All Work and the same native batch for
  // the drawing and progress, so autosave cannot interleave with a restart.
  return previousWorkStorage.queuePreviousWorkWrite(async () => {
    const ids = await previousWorkStorage.readPreviousWorkIds()
    const key = previousWorkSessionKey(drawing.sessionId)
    const written = await queueDrawingPreferencesOperation(async () => {
      const previousProgress = await readLocalSetting(learningProgressKey)
      const progress = parseLearningProgress(previousProgress)
      return writeIfCurrent(isCurrent, async () => {
        try {
          await AsyncStorage.multiSet([
            [learningProgressKey, JSON.stringify(recordLessonProgress(progress, lesson, 0))],
            [previousWorkIndexKey, serializePreviousWorkIndex(ids.filter((id) => id !== drawing.sessionId))],
            [key, 'null'],
          ])
        } catch (error) {
          // iOS can apply entries before reporting a batch failure. Restore the
          // previous values before releasing either queue.
          await AsyncStorage.multiSet([
            [key, serializePreviousWorkSession(drawing)],
            [previousWorkIndexKey, serializePreviousWorkIndex(ids)],
            [learningProgressKey, previousProgress ?? 'null'],
          ])
          throw error
        }
      })
    })
    if (!written) return false
    await AsyncStorage.removeItem(key).catch(() => undefined)
    const images = drawingImageUris(drawing)
    if (images.length) await cleanupDrawingImagesInQueue(images)
    return true
  })
}

export async function readLessonMuted() {
  return await readLocalSetting(lessonMutedKey) === '1'
}

export function saveLessonMuted(muted: boolean) {
  return writeLocalSetting(lessonMutedKey, () => muted ? '1' : '0', () => true)
}
