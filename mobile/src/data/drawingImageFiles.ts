import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'

import { normalizePracticeSource } from '../../practiceStorageModel'
import { parseResumeContext } from './localSettings'
import { previousWorkStorage } from './nativeStorage'
import { createPracticeImageCleanup, drawingImageUris } from './practiceImageCleanup'
import { resumeContextKey } from './storageKeys'

const cleanup = createPracticeImageCleanup(FileSystem.documentDirectory, {
  async list(directory) {
    const info = await FileSystem.getInfoAsync(directory)
    return info.exists ? FileSystem.readDirectoryAsync(directory) : []
  },
  async readReferences() {
    const savedUris = (await previousWorkStorage.readSessionsInQueue()).flatMap(drawingImageUris)
    const resume = parseResumeContext(await AsyncStorage.getItem(resumeContextKey))
    const resumeUri = normalizePracticeSource(resume?.source)?.uploadedImage?.uri
    return resumeUri ? [...savedUris, resumeUri] : savedUris
  },
  remove: (uri) => FileSystem.deleteAsync(uri, { idempotent: true }),
})

export async function cleanupDrawingImagesInQueue(candidates?: readonly string[]) {
  // Never delete from an incomplete reference scan. The next load retries.
  await cleanup.sweep(candidates).catch(() => undefined)
}

export function cleanupOrphanedDrawingImages() {
  return previousWorkStorage.queuePreviousWorkWrite(() => cleanupDrawingImagesInQueue())
}

export function keepDrawingImages(uris: readonly string[]) {
  const release = cleanup.acquire(uris)
  return () => {
    release()
    return previousWorkStorage.queuePreviousWorkWrite(() => cleanupDrawingImagesInQueue(uris))
  }
}
