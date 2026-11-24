// Which tracing screens are in child mode right now. Screens set it in the same handler that locks or unlocks,
// so it is never behind the UI. The app-wide link handler reads it, because an incoming link can reset
// navigation without asking the screen first.
const owners = new Set<object>()

export const childModeState = {
  set(owner: object, active: boolean) {
    if (active) owners.add(owner)
    else owners.delete(owner)
  },
  isActive: () => owners.size > 0,
  has: (owner: object) => owners.has(owner),
}
