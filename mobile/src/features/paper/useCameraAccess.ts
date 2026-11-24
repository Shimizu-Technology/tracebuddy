import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { AppState, Linking } from 'react-native'
import { useCameraPermissions } from 'expo-camera'
import type { CameraView } from 'expo-camera'

import type { CameraAccess } from './PermissionCard'
import { paperTheme } from './paperTheme'

/** starting → live (frames are showing), none (no camera at all: the Simulator), or error. */
export type CameraState = 'starting' | 'live' | 'none' | 'error'

/**
 * Camera permission and readiness for a tracing screen. Permission is read again whenever the app returns
 * to the foreground, so turning Camera on in Settings takes effect without leaving the screen.
 */
export function useCameraAccess(cameraRef?: RefObject<CameraView | null>) {
  const [permission, requestPermission, getPermission] = useCameraPermissions()
  const [camera, setCamera] = useState<CameraState>('starting')

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void getPermission().catch(() => undefined)
    })
    return () => subscription.remove()
  }, [getPermission])

  const granted = Boolean(permission?.granted)

  // A change of permission means a new preview: Lock waits for its own onCameraReady again.
  const [grantedBefore, setGrantedBefore] = useState(granted)
  if (grantedBefore !== granted) {
    setGrantedBefore(granted)
    setCamera('starting')
  }

  // With no camera device there are no lenses. Show the table stand-in instead of a black screen.
  useEffect(() => {
    if (!granted || camera !== 'starting') return undefined
    const check = setTimeout(() => {
      void cameraRef?.current?.getAvailableLensesAsync()
        .then((lenses) => setCamera((current) => (current === 'starting' && lenses.length === 0 ? 'none' : current)))
        .catch(() => undefined)
    }, paperTheme.timing.saveDelayMs)
    return () => clearTimeout(check)
  }, [camera, cameraRef, granted])

  const access: CameraAccess | null = !permission ? null
    : permission.granted ? (camera === 'error' ? 'unavailable' : null)
      : permission.canAskAgain ? 'ask' : 'denied'

  const restart = useCallback(() => setCamera('starting'), [])
  const onMountError = useCallback(() => setCamera('error'), [])
  const retry = useCallback(() => {
    setCamera('starting')
    void requestPermission().catch(() => undefined)
  }, [requestPermission])

  return {
    camera,
    access,
    granted,
    /** The camera is usable or still starting: show the preview. */
    cameraOn: granted && camera !== 'error',
    /** Frames are showing, or this device has no camera and shows the stand-in. Only then can Lock start child mode. */
    cameraReady: granted && (camera === 'live' || camera === 'none'),
    /** A new preview is about to mount (after handing the camera to another screen): wait for it to be ready. */
    restart,
    onCameraReady: () => setCamera('live'),
    onMountError,
    retry,
    openSettings: () => { void Linking.openSettings().catch(() => undefined) },
  }
}
