export type NativeScreen = 'picker' | 'gallery' | 'together' | 'learn' | 'trace' | 'ar' | 'practice'
export type Point = { x: number; y: number }
export type Viewport = Point & { scale: number }
export function strokePointAction(active: boolean, point: Point | null) {
  if (!point) return active ? 'finish' : 'ignore'
  return active ? 'append' : 'start'
}
export type NavigationState = { current: NativeScreen; history: NativeScreen[] }

/** Returning to an existing screen unwinds it rather than creating a back loop. */
export function navigate(state: NavigationState, screen: NativeScreen): NavigationState {
  if (screen === state.current) return state
  const existing = state.history.lastIndexOf(screen)
  return { current: screen, history: existing >= 0 ? state.history.slice(0, existing) : [...state.history, state.current] }
}

export function goBack(state: NavigationState): NavigationState {
  return { current: state.history.at(-1) ?? 'picker', history: state.history.slice(0, -1) }
}

export function documentFrame(size: { width: number; height: number }) {
  const side = Math.max(1, Math.min(size.width, size.height))
  return { side, x: (size.width - side) / 2, y: (size.height - side) / 2 }
}

/** Invert the exact origin-zero transform used by the native document layer. */
export function documentPoint(point: Point, size: { width: number; height: number }, viewport: Viewport): Point | null {
  const frame = documentFrame(size)
  const x = ((point.x - viewport.x) / viewport.scale - frame.x) / frame.side * 1000
  const y = ((point.y - viewport.y) / viewport.scale - frame.y) / frame.side * 1000
  return x >= 0 && x <= 1000 && y >= 0 && y <= 1000 ? { x, y } : null
}

export type DrawingTouch = { identifier: string | number; locationX: number; locationY: number }
export function ownedTouch(touches: ArrayLike<DrawingTouch>, owner: string | number | null) {
  return owner === null ? null : Array.from(touches).find((touch) => touch.identifier === owner) ?? null
}

export function photoAccessAllowed(permission: { granted?: boolean; status?: string; accessPrivileges?: string }) {
  return permission.granted === true || permission.status === 'granted' || permission.accessPrivileges === 'limited'
}

export type ResumeContext = { mode: NativeScreen; sessionId: string | null; lessonId: string; source?: unknown; history?: NativeScreen[] }
export function normalizeResumeContext(value: unknown, lessonIds: readonly string[]): ResumeContext | null {
  if (!value || typeof value !== 'object') return null
  const context = value as Partial<ResumeContext>
  if (!['picker', 'gallery', 'together', 'learn', 'trace', 'ar', 'practice'].includes(context.mode ?? '')) return null
  return {
    mode: context.mode as NativeScreen,
    sessionId: typeof context.sessionId === 'string' ? context.sessionId : null,
    lessonId: lessonIds.includes(context.lessonId ?? '') ? context.lessonId! : lessonIds[0],
    source: context.mode === 'practice' ? context.source : undefined,
    history: Array.isArray(context.history) ? context.history.filter((screen) => ['picker', 'gallery', 'together', 'learn', 'trace', 'ar', 'practice'].includes(screen)) : [],
  }
}
