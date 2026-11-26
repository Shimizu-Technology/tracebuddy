import { useIsFocused } from 'expo-router/react-navigation'
import * as Speech from 'expo-speech'
import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'

export function useLessonSpeech(enabled: boolean) {
  const focused = useIsFocused()
  const request = useRef(0)

  const stop = useCallback(() => {
    request.current += 1
    void Speech.stop().catch(() => undefined)
  }, [])

  const speak = useCallback((line: string) => {
    const id = ++request.current
    void Speech.stop().then(() => {
      if (request.current === id && (AppState.currentState === 'active' || AppState.currentState == null)) {
        Speech.speak(line, { language: 'en-US', rate: 0.9, pitch: 1.1 })
      }
    }).catch(() => undefined)
  }, [])

  const speakAutomatically = useCallback((line: string) => {
    if (!focused || !enabled || (AppState.currentState !== 'active' && AppState.currentState != null)) return false
    speak(line)
    return true
  }, [enabled, focused, speak])

  useEffect(() => {
    if (!focused || !enabled) stop()
  }, [enabled, focused, stop])

  useEffect(() => stop, [stop])

  useEffect(() => {
    const listener = AppState.addEventListener('change', (status) => { if (status !== 'active') stop() })
    return () => listener.remove()
  }, [stop])

  return { speak, speakAutomatically, stop }
}
