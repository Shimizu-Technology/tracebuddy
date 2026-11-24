import type { GuideSetup, ScreenOrientation } from './paperModel'
import type { SetupSnapshot } from './setupPersistence'

type Persistence = {
  save: (snapshot: SetupSnapshot) => Promise<void>
  load: () => Promise<string | null>
}

type Deps = {
  persistence: Persistence
  /** The guide as it is on screen right now. */
  read: () => GuideSetup
  apply: (setup: GuideSetup) => void
  restore: (raw: string | null, orientation: ScreenOrientation) => GuideSetup
}

/**
 * The remembered setup's rules, without React:
 * - The values on screen belong to the orientation that was loaded (the owner) until another one loads.
 * - A gesture marks the setup dirty when it starts, so a flush in the middle of it (background, exit, turn)
 *   saves the transform as it is right then, for its owner.
 * - A save that fails stays pending for its orientation and is retried on the next flush, unless a newer save
 *   for that orientation has been made since; an older snapshot never overwrites a newer one.
 * - A load that fails leaves nothing loaded (controls stay gated) and applies nothing, so an edit can't
 *   overwrite the real saved setup with defaults. Load again to retry.
 */
export function createSetupTracker({ persistence, read, apply, restore }: Deps) {
  let owner: ScreenOrientation | null = null
  let dirty = false
  let generation = 0
  let sequence = 0
  const latest = new Map<ScreenOrientation, number>()
  const failed = new Map<ScreenOrientation, GuideSetup>()

  function save(orientation: ScreenOrientation, setup: GuideSetup) {
    const mine = ++sequence
    latest.set(orientation, mine)
    failed.delete(orientation)
    return persistence.save({ orientation, setup }).then(() => true, () => {
      if (latest.get(orientation) === mine) failed.set(orientation, setup)
      return false
    })
  }

  function flush() {
    const saves: Promise<boolean>[] = []
    if (dirty && owner) {
      dirty = false
      saves.push(save(owner, read()))
    }
    for (const [orientation, setup] of [...failed]) saves.push(save(orientation, setup))
    return Promise.all(saves)
  }

  return {
    owner: () => owner,
    isDirty: () => dirty,
    /** A gesture started or a value changed: the on-screen setup needs saving. */
    markDirty() {
      if (owner) dirty = true
    },
    flush,
    /** Loads after flushing the current owner's edits. Resolves true once applied, false if stale or failed. */
    load(orientation: ScreenOrientation) {
      void flush()
      owner = null
      dirty = false
      const current = ++generation
      return persistence.load().then((raw) => {
        if (current !== generation) return false
        apply(restore(raw, orientation))
        owner = orientation
        return true
      }, () => false)
    },
  }
}
