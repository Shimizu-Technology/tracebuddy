import { useCallback, useEffect, useRef, useState } from 'react'

import { readLocalSetting, writeLocalSetting } from '../../data/nativeStorage'
import { savedAlignmentKey } from '../../data/storageKeys'
import type { GuideValues } from './GuideLayer'
import { defaultGuideSetup, parseRememberedSetup, serializeRememberedSetup } from './paperModel'
import type { GuideSetup, PageOrientation, ScreenOrientation } from './paperModel'
import { paperTheme } from './paperTheme'

const alwaysCurrent = () => true

/**
 * Remembers the last position, size, turn and fade for each screen orientation, without Save or Resume
 * buttons. The setup loads when the screen opens or the device turns, and saves shortly after each change.
 */
export function useRememberedSetup(orientation: ScreenOrientation, values: GuideValues) {
  const [page, setPage] = useState<PageOrientation>(defaultGuideSetup.page)
  const [hydrated, setHydrated] = useState(false)
  const [layoutKey, setLayoutKey] = useState(0)
  const stored = useRef<string | null>(null)
  const pageRef = useRef(page)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const orientationRef = useRef(orientation)

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

  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const setup: GuideSetup = {
      x: values.x.get(),
      y: values.y.get(),
      scale: values.scale.get(),
      rotation: values.rotation.get(),
      opacity: values.opacity.get(),
      page: pageRef.current,
    }
    const next = serializeRememberedSetup(stored.current, orientationRef.current, setup)
    stored.current = next
    void writeLocalSetting(savedAlignmentKey, () => next, alwaysCurrent).catch(() => undefined)
  }, [values])

  const hydratedRef = useRef(false)
  const persist = useCallback(() => {
    if (!hydratedRef.current) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(saveNow, paperTheme.timing.saveDelayMs)
  }, [saveNow])

  useEffect(() => {
    let active = true
    // Finish the previous orientation's pending save before loading the new one.
    if (timer.current) saveNow()
    orientationRef.current = orientation
    hydratedRef.current = false
    void readLocalSetting(savedAlignmentKey)
      .catch(() => null)
      .then((raw) => {
        if (!active) return
        stored.current = raw
        apply(parseRememberedSetup(raw, orientation) ?? defaultGuideSetup)
        hydratedRef.current = true
        setHydrated(true)
      })
    return () => { active = false }
  }, [apply, orientation, saveNow])

  useEffect(() => () => { if (timer.current) saveNow() }, [saveNow])

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

  return { page, hydrated, layoutKey, persist, changePage }
}
