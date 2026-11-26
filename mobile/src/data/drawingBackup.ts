import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'

import {
  buildDrawingBackup, DrawingBackupError, maxDrawingBackupBytes, mergeDrawingBackup, mergeDrawingBackupSettings,
  parseDrawingBackup, withBackupFavorites,
} from './drawingBackupModel'
import type { DrawingBackupSettings } from './drawingBackupModel'
import { cleanupDrawingImagesInQueue } from './drawingImageFiles'
import { parseArtFavorites } from './favoritePreference'
import { parseDrawingPreferences, parseLearningProgress } from './localSettings'
import {
  previousWorkStorage, queueDrawingPreferencesOperation, readLocalSetting, writeLocalSettingInQueue,
} from './nativeStorage'
import { drawingImageUris } from './practiceImageCleanup'
import { createPracticeSessionId, practiceImageFolder, rebasePracticeImageUri } from './practiceSource'
import { artFavoritesKey, drawingPreferencesKey, learningProgressKey } from './storageKeys'

async function readBackupSettings() {
  const [progress, art, legacy] = await Promise.all([
    readLocalSetting(learningProgressKey).then(parseLearningProgress),
    readLocalSetting(artFavoritesKey).then(parseArtFavorites),
    readLocalSetting(drawingPreferencesKey).then(parseDrawingPreferences),
  ])
  return { progress, artFavorites: art, legacyFavorites: legacy.favoriteIds, preferences: legacy }
}

async function writeMergedSettings(incoming: DrawingBackupSettings) {
  const local = await readBackupSettings()
  const merged = mergeDrawingBackupSettings(local, incoming)
  const entries = [
    [learningProgressKey, local.progress, merged.progress],
    [artFavoritesKey, local.artFavorites, merged.artFavorites],
    [drawingPreferencesKey, local.preferences, withBackupFavorites(local.preferences, merged.legacyFavorites)],
  ] as const
  for (const [key, previous, value] of entries) {
    const serialized = JSON.stringify(value)
    if (serialized !== JSON.stringify(previous)) await writeLocalSettingInQueue(key, serialized)
  }
}

async function readImage(uri: string, maxBytes: number) {
  const root = `${FileSystem.documentDirectory}${practiceImageFolder}/`
  const name = uri.slice(root.length)
  if (!FileSystem.documentDirectory || !uri.startsWith(root) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
    throw new Error('A drawing photo is outside app storage')
  }
  const extension = /\.([a-z0-9]{1,8})$/i.exec(name)?.[1].toLowerCase() ?? 'jpg'
  const info = await FileSystem.getInfoAsync(uri)
  if (!info.exists) return { extension, base64: null }
  if (info.isDirectory) throw new Error('A drawing photo could not be opened')
  if (info.size > maxBytes) throw new DrawingBackupError('too-large')
  return { extension, base64: await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }) }
}

export async function shareDrawingBackup(legacyCanvasSize: { width: number; height: number }) {
  const cache = FileSystem.cacheDirectory
  if (!cache || !await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable')
  const backup = await previousWorkStorage.queuePreviousWorkWrite(async () => {
    await previousWorkStorage.migrateLegacyPracticeAutosavesInQueue(legacyCanvasSize, () => true, true)
    return queueDrawingPreferencesOperation(async () => {
      const drawings = await previousWorkStorage.readSessionsInQueue()
      const { progress, artFavorites, legacyFavorites } = await readBackupSettings()
      return buildDrawingBackup({ drawings, progress, artFavorites, legacyFavorites },
        (uri) => rebasePracticeImageUri(uri, FileSystem.documentDirectory), readImage)
    })
  })

  const directory = `${cache}drawing-backup-${createPracticeSessionId()}/`
  const date = new Date()
  const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((part) => String(part).padStart(2, '0')).join('-')
  const uri = `${directory}TraceBuddy-drawings-${day}.json`
  try {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup))
    const info = await FileSystem.getInfoAsync(uri)
    if (!info.exists || info.isDirectory) throw new Error('Backup file is unavailable')
    if (info.size > maxDrawingBackupBytes) throw new DrawingBackupError('too-large')
    await Sharing.shareAsync(uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Back up drawings' })
    return { missingPhotos: backup.images.filter((image) => image.base64 === null).length }
  } finally {
    await FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => undefined)
  }
}

export async function pickAndRestoreDrawingBackup() {
  // iOS already imports a private copy in its picker. Android's content URI
  // may need the Expo cache copy before the file can be inspected and read.
  const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: Platform.OS !== 'ios' })
  if (picked.canceled) return null

  const { uri, size } = picked.assets[0]
  let backup
  try {
    if (size !== undefined && size > maxDrawingBackupBytes) throw new DrawingBackupError('too-large')
    const info = await FileSystem.getInfoAsync(uri)
    if (!info.exists || info.isDirectory || info.size === 0) throw new DrawingBackupError('invalid')
    if (info.size > maxDrawingBackupBytes) throw new DrawingBackupError('too-large')
    backup = parseDrawingBackup(await FileSystem.readAsStringAsync(uri))
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)
  }

  const root = FileSystem.documentDirectory
  if (!root) throw new Error('App storage is unavailable')
  const directory = `${root}${practiceImageFolder}/`
  return previousWorkStorage.queuePreviousWorkWrite(() => queueDrawingPreferencesOperation(async () => {
    const imageCandidates = new Set<string>()
    try {
      return await mergeDrawingBackup(backup, {
        readDrawing: async (id) => {
          const drawing = await previousWorkStorage.readSessionInQueue(id)
          drawingImageUris(drawing).forEach((uri) => imageCandidates.add(uri))
          return drawing
        },
        writeDrawing: previousWorkStorage.writeSessionInQueue,
        async writeImage(image) {
          const destination = `${directory}${createPracticeSessionId()}.${image.extension}`
          if (image.base64 === null) return destination
          imageCandidates.add(destination)
          await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
          await FileSystem.writeAsStringAsync(destination, image.base64, { encoding: FileSystem.EncodingType.Base64 })
          return destination
        },
        writeSettings: writeMergedSettings,
      })
    } finally {
      await cleanupDrawingImagesInQueue([...imageCandidates])
    }
  }))
}
