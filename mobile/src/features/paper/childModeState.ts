// Which tracing screens are in child mode right now. Screens set it in the same handler that locks or unlocks,
// so it is never behind the UI. The app-wide navigation guards read it (childModeNavigation.ts and
// app/+native-intent.tsx), because navigation can be asked for without going through the locked screen.
const owners = new Set<object>()
const blockedListeners = new Set<() => void>()

export const childModeState = {
  set(owner: object, active: boolean) {
    if (active) owners.add(owner)
    else owners.delete(owner)
  },
  isActive: () => owners.size > 0,
  has: (owner: object) => owners.has(owner),
  /** Navigation was refused because of child mode; the locked screen tells the grown-up how to unlock. */
  reportBlocked() {
    for (const listener of blockedListeners) listener()
  },
  onBlocked(listener: () => void) {
    blockedListeners.add(listener)
    return () => { blockedListeners.delete(listener) }
  },
}
