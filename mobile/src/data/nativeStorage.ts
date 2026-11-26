import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'

import { createOperationQueue, writeIfCurrent } from '../../practiceOperations'
import type { OperationGuard } from '../../practiceOperations'
import { createDrawingRecords, drawingRecordFolder } from './drawingRecords'
import { createPreviousWorkStorage } from './previousWork'
import type { LocalSettingKey } from './storageKeys'

const directory = FileSystem.documentDirectory && `${FileSystem.documentDirectory}${drawingRecordFolder}/`
const files = directory ? createDrawingRecords({
  async list() {
    return (await FileSystem.getInfoAsync(directory)).exists ? FileSystem.readDirectoryAsync(directory) : []
  },
  exists: async (name) => (await FileSystem.getInfoAsync(directory + name)).exists,
  async read(name) {
    const uri = directory + name
    return (await FileSystem.getInfoAsync(uri)).exists ? FileSystem.readAsStringAsync(uri) : null
  },
  async write(name, value) {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
    await FileSystem.writeAsStringAsync(directory + name, value)
  },
  move: (from, to) => FileSystem.moveAsync({ from: directory + from, to: directory + to }),
  remove: (name) => FileSystem.deleteAsync(directory + name, { idempotent: true }),
}) : undefined

export const previousWorkStorage = createPreviousWorkStorage(AsyncStorage, files)

export const queueDrawingPreferencesOperation = createOperationQueue()

export function readLocalSetting(key: LocalSettingKey) {
  return AsyncStorage.getItem(key)
}

export function writeLocalSetting(key: LocalSettingKey, serialize: () => string, isCurrent: OperationGuard) {
  return queueDrawingPreferencesOperation(() => writeIfCurrent(isCurrent, () => writeLocalSettingInQueue(key, serialize())))
}

export function writeLocalSettingInQueue(key: LocalSettingKey, value: string) {
  return AsyncStorage.setItem(key, value)
}
