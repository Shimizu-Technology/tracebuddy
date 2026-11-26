// Who owns each temporary photo file while snapping a paper drawing, so every file is deleted exactly once and
// never while something still reads it:
// - a capture owns its file from the moment the camera (or the Simulator stand-in) returns it;
// - review owns the one photo on screen;
// - Keep it owns the photo until the copy into My drawings has settled.
// Back, losing the camera and closing the screen start a new capture attempt, so a photo that arrives late
// for an older attempt is deleted instead of opening review.

export function createSnapShots(discard: (uri: string) => void) {
  let attempt = 0
  let open = true
  let pending: string | null = null
  const held = new Set<string>()

  /** The photo in review isn't wanted any more. A save holding it deletes it when its copy settles. */
  function drop() {
    if (pending && !held.has(pending)) discard(pending)
    pending = null
  }

  return {
    isOpen: () => open,
    pending: () => pending,
    drop,
    /** Back or camera loss: a capture in flight no longer opens review. */
    invalidate() {
      attempt += 1
    },
    /** A new capture. Call `own` as soon as its file exists, then `settle` once. */
    begin() {
      attempt += 1
      const mine = attempt
      let file: string | null = null
      return {
        own(uri: string) {
          file = uri
        },
        /** Still the current attempt on an open screen. */
        current: () => open && mine === attempt,
        /** True when the photo should be reviewed (it becomes the pending photo); otherwise its file is deleted. */
        settle(ok: boolean) {
          const accepted = ok && file !== null && open && mine === attempt
          if (accepted) {
            drop()
            pending = file
          } else if (file) discard(file)
          file = null
          return accepted
        },
      }
    },
    /** Keep it holds the photo until its copy settles. The returned release deletes it unless review still shows it. */
    hold(uri: string) {
      held.add(uri)
      return () => {
        held.delete(uri)
        if (pending !== uri) discard(uri)
      }
    },
    /** The screen closed: nothing reopens review, and the photo in review goes (once any save of it settles). */
    close() {
      open = false
      attempt += 1
      drop()
    },
  }
}
