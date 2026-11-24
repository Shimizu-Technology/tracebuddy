import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect, useNavigation } from 'expo-router'

import { openStickToPaper } from './paperNavigation'
import type { PaperParams } from './paperPicture'
import { paperStore } from './paperStore'
import { paperTheme } from './paperTheme'

type Pending = { timer?: ReturnType<typeof setTimeout>; unsubscribe?: () => void }

/**
 * Stick to paper runs its own AR camera session, so the camera screen lets go of its camera first: it unmounts
 * the preview, waits for More to close and the camera session to stop, then opens AR. The timer and the sheet
 * subscription belong to this screen: leaving it, or anything else taking focus while it waits, cancels them,
 * and AR opens only if this is still the screen waiting for it. Coming back gives the camera back.
 */
export function useStickHandoff(params: PaperParams, photoUri: string | undefined, restartCamera: () => void) {
  const navigation = useNavigation()
  const [handedOff, setHandedOff] = useState(false)
  const stage = useRef<'none' | 'waiting' | 'open'>('none')
  const pending = useRef<Pending>({})
  const mounted = useRef(true)

  const clearPending = useCallback(() => {
    if (pending.current.timer) clearTimeout(pending.current.timer)
    pending.current.unsubscribe?.()
    pending.current = {}
  }, [])

  const cancel = useCallback(() => {
    clearPending()
    if (stage.current !== 'waiting') return
    stage.current = 'none'
    setHandedOff(false)
  }, [clearPending])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearPending()
    }
  }, [clearPending])

  useFocusEffect(useCallback(() => {
    // Closing More on the way to AR focuses this screen again; that doesn't end the wait.
    if (stage.current === 'waiting') return () => { if (stage.current === 'waiting') cancel() }
    if (stage.current === 'open') restartCamera()
    stage.current = 'none'
    setHandedOff(false)
    return undefined
  }, [cancel, restartCamera]))

  const start = useCallback(() => {
    if (stage.current !== 'none') return
    stage.current = 'waiting'
    setHandedOff(true)
    const open = () => {
      pending.current.timer = setTimeout(() => {
        pending.current = {}
        if (!mounted.current || stage.current !== 'waiting' || !navigation.isFocused()) return
        stage.current = 'open'
        openStickToPaper(params, photoUri)
      }, paperTheme.timing.cameraHandoffMs)
    }
    if (!paperStore.get().sheetOpen) {
      open()
      return
    }
    pending.current.unsubscribe = paperStore.subscribe(() => {
      if (paperStore.get().sheetOpen) return
      pending.current.unsubscribe?.()
      pending.current.unsubscribe = undefined
      open()
    })
  }, [navigation, params, photoUri])

  return { handedOff, start, cancel }
}
