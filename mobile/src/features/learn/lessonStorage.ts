import AsyncStorage from '@react-native-async-storage/async-storage'

import type { DrawingLesson } from '../../../../shared/lessons/drawingLessons'
import { parseLearningProgress } from '../../data/localSettings'
import { queueDrawingPreferencesOperation, readLocalSetting, writeLocalSetting } from '../../data/nativeStorage'
import { learningProgressKey, lessonMutedKey } from '../../data/storageKeys'
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

export async function readLessonMuted() {
  return await readLocalSetting(lessonMutedKey) === '1'
}

export function saveLessonMuted(muted: boolean) {
  return writeLocalSetting(lessonMutedKey, () => muted ? '1' : '0', () => true)
}
