// Whether a tracing screen is in child mode right now. The app-wide link handler reads it, because an
// incoming link can reset navigation without asking the screen first.
let active = 0

export const childModeState = {
  enter() { active += 1 },
  exit() { active = Math.max(0, active - 1) },
  isActive: () => active > 0,
}
