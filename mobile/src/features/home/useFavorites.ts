import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import type { PreferenceSnapshot } from '../../data/favoritePreference'
import { artFavoritePreference } from '../../data/nativeStorage'

export function useFavorites() {
  const [snapshot, setSnapshot] = useState<PreferenceSnapshot<string[]>>({ value: [], revision: 0 })
  const apply = useCallback((next: PreferenceSnapshot<string[]>) => {
    setSnapshot((current) => next.revision > current.revision ? next : current)
  }, [])

  useFocusEffect(useCallback(() => {
    let active = true
    void artFavoritePreference.read().then((next) => { if (active) apply(next) }).catch(() => undefined)
    return () => { active = false }
  }, [apply]))

  return {
    favorites: snapshot.value,
    toggle: (id: string) => {
      // Even during hydration, the queued edit starts with the stored record.
      void artFavoritePreference.toggle(id).then(apply).catch(() => Alert.alert('Could not save favorites', 'Try again in a moment.'))
    },
  }
}
