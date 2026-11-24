// A photo's file is deleted by the cleanup sweep once nothing holds it and no saved drawing uses it. Moving
// between screens (Picture sheet → On paper → Draw or Stick to paper) briefly leaves no screen holding it, so
// the screen that navigates hands its hold over: it takes a lease before leaving, and the next screen's own
// lease releases it, or it lapses after a while if that screen never opens.

type Keep = (uris: readonly string[]) => () => unknown
type Schedule = (run: () => void, ms: number) => () => void

export function createPhotoHandoff(keep: Keep, schedule: Schedule, lapseMs: number) {
  const pending = new Map<string, { release: () => unknown; cancel: () => void }>()

  function settle(uri: string) {
    const handoff = pending.get(uri)
    if (!handoff) return
    pending.delete(uri)
    handoff.cancel()
    handoff.release()
  }

  return {
    /** Call just before navigating away with this photo. */
    handOff(uri: string | undefined) {
      if (!uri || pending.has(uri)) return
      const release = keep([uri])
      pending.set(uri, { release, cancel: schedule(() => settle(uri), lapseMs) })
    },
    /** A screen showing the photo: holds it while mounted, and takes over any hand-off. Returns its release. */
    hold(uri: string) {
      const release = keep([uri])
      settle(uri)
      return release
    },
    pending: (uri: string) => pending.has(uri),
  }
}
