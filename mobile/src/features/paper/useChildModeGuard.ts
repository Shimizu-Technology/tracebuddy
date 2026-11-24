import { useEffect, useRef } from 'react'
import { BackHandler } from 'react-native'
import { router, useNavigation } from 'expo-router'
// The navigator Expo Router runs on. usePreventRemove also tells the native stack to refuse its own dismissals.
import { usePreventRemove } from 'expo-router/build/react-navigation/core'

import { childModeState } from './childModeState'

/**
 * Child-mode containment for a tracing screen. Call `setChildMode(owner, …)` synchronously when locking or
 * unlocking; this hook adds the navigation side: nothing may remove the screen (swipe, back, a parent
 * dismiss), and anything pushed over it is taken off again, until a grown-up unlocks.
 * System links are ignored app-wide while locked (app/+native-intent.tsx).
 */
export function useChildModeGuard(owner: object, locked: boolean, onBlocked: () => void) {
  const navigation = useNavigation()
  const blocked = useRef(onBlocked)
  useEffect(() => { blocked.current = onBlocked }, [onBlocked])

  usePreventRemove(locked, () => blocked.current())

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !locked })
    navigation.getParent()?.setOptions({ gestureEnabled: !locked })
  }, [locked, navigation])

  useEffect(() => {
    // Registered from mount and reading the flag set in the lock handler itself, so it guards from the same
    // moment child mode starts, before any effect has run.
    const removal = navigation.addListener('beforeRemove', (event) => {
      if (!childModeState.has(owner)) return
      event.preventDefault()
      blocked.current()
    })
    // Something was pushed over the locked screen: take it off again.
    const blur = navigation.addListener('blur', () => {
      if (!childModeState.has(owner)) return
      blocked.current()
      if (router.canGoBack()) router.back()
    })
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!childModeState.has(owner)) return false
      blocked.current()
      return true
    })
    return () => {
      removal()
      blur()
      back.remove()
    }
  }, [navigation, owner])

  // Leaving the screen for good always clears its child-mode flag.
  useEffect(() => () => childModeState.set(owner, false), [owner])
}
