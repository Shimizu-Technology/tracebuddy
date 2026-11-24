import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import * as MediaLibrary from 'expo-media-library/legacy'
import { Alert, Linking } from 'react-native'

import { photoAccessAllowed } from '../../practiceModel'
import type { UploadedImage } from '../../practiceStorageModel'
import { previousWorkStorage } from './nativeStorage'
import { createPracticeSessionId, practiceImageFolder, rebasePracticeImageUri } from './practiceSource'

function showPermissionRecovery(canAskAgain: boolean, message: string) {
  Alert.alert('Photo permission needed', message, [
    { text: 'Cancel', style: 'cancel' },
    ...(!canAskAgain ? [{
      text: 'Open Settings',
      onPress: () => void Linking.openSettings().catch(() => Alert.alert('Open Settings', 'Choose TraceBuddy in Settings to change Photos access.')),
    }] : []),
  ])
}

function extension(value: string | null | undefined) {
  const name = value?.split(/[?#]/, 1)[0]?.split('/').pop() ?? ''
  let decoded = name
  try { decoded = decodeURIComponent(name) } catch { /* The original filename can still have a valid extension. */ }
  return /[^/.]\.([a-zA-Z0-9]{1,8})$/.exec(decoded)?.[1]?.toLowerCase()
}

export function currentDrawingImageUri(uri: string) {
  return rebasePracticeImageUri(uri, FileSystem.documentDirectory)
}

export async function pickDrawingPhoto(): Promise<UploadedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!photoAccessAllowed(permission)) {
    showPermissionRecovery(permission.canAskAgain, 'Allow photo access to pick a picture to draw.')
    return null
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], quality: 1, allowsMultipleSelection: false,
  })
  if (result.canceled || !result.assets[0]) return null
  const photo = result.assets[0]
  if (!FileSystem.documentDirectory) throw new Error('App storage is unavailable')
  const directory = `${FileSystem.documentDirectory}${practiceImageFolder}/`
  const uri = photo.uri.startsWith(directory) ? photo.uri
    : `${directory}${createPracticeSessionId()}.${extension(photo.fileName) ?? extension(photo.uri) ?? 'jpg'}`
  if (uri !== photo.uri) {
    await previousWorkStorage.queuePreviousWorkWrite(async () => {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
      await FileSystem.copyAsync({ from: photo.uri, to: uri })
    })
  }
  return { uri, name: photo.fileName ?? 'My photo', width: photo.width, height: photo.height }
}

export async function requestDrawingPhotoExport() {
  const permission = await MediaLibrary.requestPermissionsAsync(true)
  if (photoAccessAllowed(permission)) return true
  showPermissionRecovery(permission.canAskAgain, 'Allow TraceBuddy to save your drawing to Photos. Your drawing is already kept in My drawings.')
  return false
}

export { saveToLibraryAsync } from 'expo-media-library/legacy'
