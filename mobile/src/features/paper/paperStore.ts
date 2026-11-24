import { useSyncExternalStore } from 'react'

// Shared between the On paper screen and its More sheet, which is a separate native sheet route.
// The screen owns the guide; the sheet only flips options and sends requests.

export type PaperOptions = {
  sheetOpen: boolean
  /** Where the More sheet's top edge landed, in window points. iPad floats form sheets mid-screen. */
  sheetTop: number | null
  lightLines: boolean
  mirror: boolean
  /** Light lines only change line drawings, not photos. */
  canUseLightLines: boolean
  /** Paper Lock (ARKit world tracking) works on this device. */
  stickAvailable: boolean
}

export type PaperRequest = 'tips' | 'stick'

const initialOptions: PaperOptions = { sheetOpen: false, sheetTop: null, lightLines: false, mirror: false, canUseLightLines: true, stickAvailable: false }

let options = initialOptions
const listeners = new Set<() => void>()
let nudgeHandler: ((dx: number, dy: number) => void) | null = null
let requestHandler: ((request: PaperRequest) => void) | null = null

function emit() {
  listeners.forEach((listener) => listener())
}

export const paperStore = {
  get: () => options,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  set(update: Partial<PaperOptions>) {
    const next = { ...options, ...update }
    if ((Object.keys(next) as (keyof PaperOptions)[]).every((key) => next[key] === options[key])) return
    options = next
    emit()
  },
  /** A new picture starts unmirrored; light lines stay on for the same dark paper. */
  startPicture(update: Pick<PaperOptions, 'canUseLightLines' | 'stickAvailable'>) {
    paperStore.set({ ...update, mirror: false, sheetOpen: false, sheetTop: null })
  },
  nudge(dx: number, dy: number) {
    nudgeHandler?.(dx, dy)
  },
  request(request: PaperRequest) {
    requestHandler?.(request)
  },
  /** The screen registers its handlers; the returned function removes them. */
  connect(handlers: { nudge: (dx: number, dy: number) => void; request: (request: PaperRequest) => void }) {
    nudgeHandler = handlers.nudge
    requestHandler = handlers.request
    return () => {
      if (nudgeHandler === handlers.nudge) nudgeHandler = null
      if (requestHandler === handlers.request) requestHandler = null
    }
  },
}

export function usePaperOptions() {
  return useSyncExternalStore(paperStore.subscribe, paperStore.get, paperStore.get)
}
