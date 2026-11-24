import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

import { readLocalSetting, writeLocalSetting } from '../../data/nativeStorage'
import { savedAlignmentKey } from '../../data/storageKeys'
import type { GuideValues } from './GuideLayer'
import { defaultGuideSetup, restoreSetup } from './paperModel'
import type { GuideSetup, PageOrientation, RestoreGeometry, ScreenOrientation } from './paperModel'
import { paperTheme } from './paperTheme'
import { createSetupPersistence } from './setupPersistence'
import type { OperationQueue } from './setupPersistence'
import { createSetupTracker } from './setupTracker'

// writeLocalSetting already runs on the shared settings queue, so this queue only orders this screen's steps.
function createQueue(): OperationQueue {
  let tail: Promise<unknown> = Promise.resolve()
  return (operation) => {
    const result = tail.then(operation, operation)
    tail = result.then(() => undefined, () => undefined)
    return result
  }
}

const persistence = createSetupPersistence({
  read: () => readLocalSetting(savedAlignmentKey),
  write: async (raw) => {
    if (!await writeLocalSetting(savedAlignmentKey, () => raw, () => true)) throw new Error('The setup was not saved')
  },
}, createQueue())

/**
 * Remembers the last position, size, turn, fade and page for each screen orientation, without Save or Resume
 * buttons (rules in setupTracker). Changes save shortly after they happen, and right away when the screen
 * closes, the app goes to the background or the device turns. While `frozen` (child mode) a turn doesn't load
 * another setup: the screen keeps the locked alignment and shows it again when the device turns back.
 */
export function useRememberedSetup(orientation: ScreenOrientation, values: GuideValues, geometry: RestoreGeometry, frozen: boolean) {
  const [page, setPage] = useState<PageOrientation>(defaultGuideSetup.page)
  const [loaded, setLoaded] = useState<ScreenOrientation | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [layoutKey, setLayoutKey] = useState(0)
  const pageRef = useRef(page)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null)
  const geometryRef = useRef(geometry)
  useEffect(() => { geometryRef.current = geometry }, [geometry])

  // Created on first use (never during render), because its callbacks read this hook's refs.
  const trackerRef = useRef<ReturnType<typeof createSetupTracker> | null>(null)
  const tracker = useCallback(() => {
    trackerRef.current ??= createSetupTracker({
      persistence,
      read: (): GuideSetup => ({
        x: values.x.get(),
        y: values.y.get(),
        scale: values.scale.get(),
        rotation: values.rotation.get(),
        opacity: values.opacity.get(),
        page: pageRef.current,
      }),
      apply: (setup) => {
        values.x.set(setup.x)
        values.y.set(setup.y)
        values.scale.set(setup.scale)
        values.rotation.set(setup.rotation)
        values.opacity.set(setup.opacity)
        pageRef.current = setup.page
        setPage(setup.page)
        setLayoutKey((key) => key + 1)
      },
      restore: (raw, owner) => restoreSetup(raw, owner, geometryRef.current),
    })
    return trackerRef.current
  }, [values])

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    void tracker().flush()
  }, [tracker])

  const markDirty = useCallback(() => tracker().markDirty(), [tracker])

  /** A change finished: save it shortly. */
  const persist = useCallback(() => {
    tracker().markDirty()
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, paperTheme.timing.saveDelayMs)
  }, [flush, tracker])

  useEffect(() => {
    if (frozen || tracker().owner() === orientation) return undefined
    let active = true
    const attempt = () => {
      setLoaded(null)
      void tracker().load(orientation).then((ok) => {
        if (!active) return
        if (ok) {
          setLoaded(orientation)
          setLoadFailed(false)
          return
        }
        if (tracker().owner() === null) {
          // A failed read: keep the controls gated and try again rather than showing defaults.
          setLoadFailed(true)
          retry.current = setTimeout(attempt, paperTheme.timing.loadRetryMs)
        }
      })
    }
    attempt()
    return () => {
      active = false
      if (retry.current) clearTimeout(retry.current)
    }
  }, [frozen, orientation, tracker])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') flush() })
    return () => {
      subscription.remove()
      flush()
    }
  }, [flush])

  const changePage = useCallback((next: PageOrientation) => {
    pageRef.current = next
    setPage(next)
    values.x.set(0)
    values.y.set(0)
    values.scale.set(1)
    values.rotation.set(0)
    setLayoutKey((key) => key + 1)
    persist()
  }, [persist, values])

  /** Back to the middle of the screen, keeping size, turn and page. */
  const recenter = useCallback(() => {
    values.x.set(0)
    values.y.set(0)
    setLayoutKey((key) => key + 1)
    persist()
  }, [persist, values])

  return {
    page,
    loadedOrientation: loaded,
    hydrated: loaded === orientation,
    loadFailed,
    layoutKey,
    /** A gesture started: an edit is in progress and a flush now must save it. */
    markDirty,
    persist,
    changePage,
    recenter,
  }
}
