import AsyncStorage from '@react-native-async-storage/async-storage'

import type { DrawingLesson } from '../../../../shared/lessons/drawingLessons'
import type { OperationGuard } from '../../../practiceOperations'
import type { SavedPracticeSession } from '../../../practiceStorageModel'
import { parseLearningProgress } from '../../data/localSettings'
import { previousWorkStorage, queueDrawingPreferencesOperation, readLocalSetting, writeLocalSetting } from '../../data/nativeStorage'
import { learningProgressKey, lessonMutedKey } from '../../data/storageKeys'
import { preserveLessonDrawing, recordLessonProgress } from './lessonPractice'

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
  // Keep the finished picture in My drawings before resetting the reusable
  // lesson slot. A retry uses the same archive ID if the app stops mid-reset.
  return previousWorkStorage.queuePreviousWorkWrite(() => queueDrawingPreferencesOperation(() => preserveLessonDrawing(
    previousWorkStorage, drawing, isCurrent,
    async () => {
      const progress = await readLessonProgress()
      await AsyncStorage.setItem(learningProgressKey, JSON.stringify(recordLessonProgress(progress, lesson, 0)))
    },
  )))
}

export async function readLessonMuted() {
  return await readLocalSetting(lessonMutedKey) === '1'
}

export function saveLessonMuted(muted: boolean) {
  return writeLocalSetting(lessonMutedKey, () => muted ? '1' : '0', () => true)
}
