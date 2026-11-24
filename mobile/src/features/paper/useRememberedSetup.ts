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
  write: (raw) => writeLocalSetting(savedAlignmentKey, () => raw, () => true).then(() => undefined),
}, createQueue())

/**
 * Remembers the last position, size, turn, fade and page for each screen orientation, without Save or Resume
 * buttons. Each change is saved shortly after, and right away when the screen closes, the app goes to the
 * background or the device turns. While `frozen` (child mode) a turn doesn't load another setup: the screen
 * keeps the locked alignment and shows it again when the device turns back.
 */
export function useRememberedSetup(orientation: ScreenOrientation, values: GuideValues, geometry: RestoreGeometry, frozen: boolean) {
  const [page, setPage] = useState<PageOrientation>(defaultGuideSetup.page)
  const [loaded, setLoaded] = useState<ScreenOrientation | null>(null)
  const [layoutKey, setLayoutKey] = useState(0)
  const pageRef = useRef(page)
  const loadedRef = useRef<ScreenOrientation | null>(null)
  const generation = useRef(0)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const geometryRef = useRef(geometry)
  useEffect(() => { geometryRef.current = geometry }, [geometry])

  const apply = useCallback((setup: GuideSetup) => {
    values.x.set(setup.x)
    values.y.set(setup.y)
    values.scale.set(setup.scale)
    values.rotation.set(setup.rotation)
    values.opacity.set(setup.opacity)
    pageRef.current = setup.page
    setPage(setup.page)
    setLayoutKey((key) => key + 1)
  }, [values])

  // Captures the values now, for the orientation they belong to, before anything else can change them.
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const orientationNow = loadedRef.current
    if (!dirty.current || !orientationNow) return
    dirty.current = false
    const setup: GuideSetup = {
      x: values.x.get(),
      y: values.y.get(),
      scale: values.scale.get(),
      rotation: values.rotation.get(),
      opacity: values.opacity.get(),
      page: pageRef.current,
    }
    void persistence.save({ orientation: orientationNow, setup }).catch(() => undefined)
  }, [values])

  const persist = useCallback(() => {
    if (!loadedRef.current) return
    dirty.current = true
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, paperTheme.timing.saveDelayMs)
  }, [flush])

  useEffect(() => {
    if (frozen || loadedRef.current === orientation) return undefined
    flush()
    generation.current += 1
    const current = generation.current
    loadedRef.current = null
    setLoaded(null)
    void persistence.load().catch(() => null).then((raw) => {
      if (current !== generation.current) return
      apply(restoreSetup(raw, orientation, geometryRef.current))
      loadedRef.current = orientation
      setLoaded(orientation)
    })
    return undefined
  }, [apply, flush, frozen, orientation])

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

  return { page, loadedOrientation: loaded, hydrated: loaded === orientation, layoutKey, persist, changePage, recenter }
}
