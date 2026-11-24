import { useCallback, useEffect, useRef } from 'react'
import { BackHandler } from 'react-native'
import { useNavigation } from 'expo-router'
// The queue every router.* call and <Link> goes through, and the navigator Expo Router runs on.
import { routingQueue } from 'expo-router/build/global-state/routing'
import { usePreventRemove } from 'expo-router/build/react-navigation/core'

import { guardRoutingQueue } from './childModeNavigation'
import type { RoutingQueue } from './childModeNavigation'
import { childModeState } from './childModeState'

// Installed once, when the first screen that can lock is loaded.
guardRoutingQueue(routingQueue as unknown as RoutingQueue, childModeState.isActive, childModeState.reportBlocked)

/**
 * Child-mode containment for a tracing screen. Lock and unlock with the returned `setChildMode`, in the
 * handler itself: it arms everything before the locked UI shows. The child-mode flag goes on first (in-app
 * navigation is refused at its source from then on, see childModeNavigation.ts) and the swipe-back gestures
 * are turned off in the same commit as the lock. Nothing may then remove the screen (swipe, back, a parent
 * dismiss) until a grown-up unlocks. System links are ignored app-wide while locked (app/+native-intent.tsx).
 */
export function useChildModeGuard(owner: object, locked: boolean, onBlocked: () => void) {
  const navigation = useNavigation()
  const blocked = useRef(onBlocked)
  useEffect(() => { blocked.current = onBlocked }, [onBlocked])

  // Also tells the native stack to refuse its own dismissals.
  usePreventRemove(locked, () => blocked.current())

  const setChildMode = useCallback((active: boolean) => {
    childModeState.set(owner, active)
    navigation.setOptions({ gestureEnabled: !active })
    navigation.getParent()?.setOptions({ gestureEnabled: !active })
  }, [navigation, owner])

  useEffect(() => {
    // Registered from mount and reading the flag, so they guard from the moment child mode starts.
    const removal = navigation.addListener('beforeRemove', (event) => {
      if (!childModeState.has(owner)) return
      event.preventDefault()
      blocked.current()
    })
    const refused = childModeState.onBlocked(() => { if (childModeState.has(owner)) blocked.current() })
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!childModeState.has(owner)) return false
      blocked.current()
      return true
    })
    return () => {
      removal()
      refused()
      back.remove()
    }
  }, [navigation, owner])

  // Leaving the screen for good always clears its child-mode flag.
  useEffect(() => () => {
    if (!childModeState.has(owner)) return
    childModeState.set(owner, false)
    navigation.getParent()?.setOptions({ gestureEnabled: true })
  }, [navigation, owner])

  return setChildMode
}
