import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import { toggleFavoriteDrawing } from '../../../../shared'
import { createFavoritePreference, isLegacyFavoriteId, parseArtFavorites } from '../../data/favoritePreference'
import type { PreferenceSnapshot } from '../../data/favoritePreference'
import { parseDrawingPreferences } from '../../data/localSettings'
import { queueDrawingPreferencesOperation, readLocalSetting, writeLocalSettingInQueue } from '../../data/nativeStorage'
import { artFavoritesKey, drawingPreferencesKey } from '../../data/storageKeys'

const legacyFavorites = createFavoritePreference(
  () => readLocalSetting(drawingPreferencesKey),
  (value) => writeLocalSettingInQueue(drawingPreferencesKey, value),
  parseDrawingPreferences,
  toggleFavoriteDrawing,
  queueDrawingPreferencesOperation,
)
const artFavorites = createFavoritePreference(
  () => readLocalSetting(artFavoritesKey),
  (value) => writeLocalSettingInQueue(artFavoritesKey, value),
  parseArtFavorites,
  (ids, id) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
  queueDrawingPreferencesOperation,
)

function usePreference<T>(preference: { read: () => Promise<PreferenceSnapshot<T>>; toggle: (id: string) => Promise<PreferenceSnapshot<T>> }, initial: T) {
  const [snapshot, setSnapshot] = useState({ value: initial, revision: 0 })
  const apply = useCallback((next: PreferenceSnapshot<T>) => {
    setSnapshot((current) => next.revision > current.revision ? next : current)
  }, [])

  useFocusEffect(useCallback(() => {
    let active = true
    void preference.read().then((next) => { if (active) apply(next) }).catch(() => undefined)
    return () => { active = false }
  }, [apply, preference]))

  return {
    value: snapshot.value,
    toggle: (id: string) => {
      // Even during hydration, the queued edit starts with the stored record.
      void preference.toggle(id).then(apply).catch(() => Alert.alert('Could not save favorites', 'Try again in a moment.'))
    },
  }
}

export function useFavorites() {
  const legacy = usePreference(legacyFavorites, parseDrawingPreferences(null))
  const art = usePreference(artFavorites, [])
  return {
    favorites: [...legacy.value.favoriteIds, ...art.value],
    toggle: (id: string) => (isLegacyFavoriteId(id) ? legacy : art).toggle(id),
  }
}
