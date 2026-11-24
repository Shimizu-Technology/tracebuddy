import { useEffect } from 'react'
import { router } from 'expo-router'

// Unknown links return to the existing home route. A replace would mount a second legacy app.
export default function UnmatchedRoute() {
  useEffect(() => {
    if (router.canDismiss()) router.dismissTo('/')
    else router.replace('/')
  }, [])
  return null
}
