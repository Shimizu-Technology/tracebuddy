import { useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { drawingById, toggleFavoriteDrawing } from '../../../../shared'
import type { DrawingPreferences } from '../../../../shared'
import { parseDrawingPreferences } from '../../data/localSettings'
import { readLocalSetting, writeLocalSetting } from '../../data/nativeStorage'
import { drawingPreferencesKey } from '../../data/storageKeys'

const newArtFavoritesKey = 'tracebuddy.artFavorites.v1'

export function useFavorites() {
  const [legacy, setLegacy] = useState<DrawingPreferences>(() => parseDrawingPreferences(null))
  const [art, setArt] = useState<string[]>([])
  const legacyRef = useRef(legacy)
  const artRef = useRef(art)
  const revision = useRef(0)

  useFocusEffect(useCallback(() => {
    let active = true
    const version = revision.current
    void Promise.all([readLocalSetting(drawingPreferencesKey), AsyncStorage.getItem(newArtFavoritesKey)])
      .then(([preferences, ids]) => {
        if (!active || version !== revision.current) return
        const rawArt: unknown = ids ? JSON.parse(ids) : []
        legacyRef.current = parseDrawingPreferences(preferences)
        artRef.current = Array.isArray(rawArt) ? rawArt.filter((id): id is string => typeof id === 'string') : []
        setLegacy(legacyRef.current)
        setArt(artRef.current)
      }).catch(() => undefined)
    return () => { active = false }
  }, []))

  function toggle(id: string) {
    const version = ++revision.current
    const failure = () => { if (version === revision.current) Alert.alert('Could not save favorites', 'Try again in a moment.') }
    if (drawingById(id)) {
      const previous = legacyRef.current
      const next = toggleFavoriteDrawing(previous, id)
      legacyRef.current = next
      setLegacy(next)
      void writeLocalSetting(drawingPreferencesKey, () => JSON.stringify(next), () => true).catch(() => {
        if (version === revision.current) { legacyRef.current = previous; setLegacy(previous) }
        failure()
      })
    } else {
      const previous = artRef.current
      const next = previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]
      artRef.current = next
      setArt(next)
      void AsyncStorage.setItem(newArtFavoritesKey, JSON.stringify(next)).catch(() => {
        if (version === revision.current) { artRef.current = previous; setArt(previous) }
        failure()
      })
    }
  }

  return { favorites: [...legacy.favoriteIds, ...art], toggle }
}
