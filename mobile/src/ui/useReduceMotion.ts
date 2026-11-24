import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

// Follows the system Reduce Motion setting while the app runs. Reanimated's useReducedMotion is read once at launch.
export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (active) setReduceMotion(enabled) }).catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => {
      active = false
      subscription.remove()
    }
  }, [])
  return reduceMotion
}
