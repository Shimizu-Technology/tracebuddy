import AsyncStorage from '@react-native-async-storage/async-storage'

import { createOperationQueue, writeIfCurrent } from '../../practiceOperations'
import type { OperationGuard } from '../../practiceOperations'
import { createPreviousWorkStorage } from './previousWork'
import type { LocalSettingKey } from './storageKeys'

export const previousWorkStorage = createPreviousWorkStorage(AsyncStorage)

export const queueDrawingPreferencesOperation = createOperationQueue()

export function readLocalSetting(key: LocalSettingKey) {
  return AsyncStorage.getItem(key)
}

export function writeLocalSetting(key: LocalSettingKey, serialize: () => string, isCurrent: OperationGuard) {
  return queueDrawingPreferencesOperation(() => writeIfCurrent(isCurrent, () => AsyncStorage.setItem(key, serialize())))
}
