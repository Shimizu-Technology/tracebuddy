import { useEffect, useRef } from 'react'
import { BackHandler } from 'react-native'
import { useNavigation } from 'expo-router'

import { childModeState } from './childModeState'

/**
 * In child mode nothing may leave the tracing screen: no edge swipe, no hardware back, and no navigation
 * action from anywhere (a parent dismiss, a system link; see app/+native-intent.tsx) until a grown-up unlocks.
 */
export function useChildModeGuard(locked: boolean, onBlocked: () => void) {
  const navigation = useNavigation()
  const blocked = useRef(onBlocked)
  useEffect(() => { blocked.current = onBlocked }, [onBlocked])

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !locked })
    navigation.getParent()?.setOptions({ gestureEnabled: !locked })
  }, [locked, navigation])

  useEffect(() => {
    if (!locked) return undefined
    childModeState.enter()
    const removal = navigation.addListener('beforeRemove', (event) => {
      event.preventDefault()
      blocked.current()
    })
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      blocked.current()
      return true
    })
    return () => {
      childModeState.exit()
      removal()
      back.remove()
    }
  }, [locked, navigation])
}
