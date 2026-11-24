import { devKitEnabled } from '../src/devKit'
import { childModeState } from '../src/features/paper/childModeState'

// The app has no public deep-link routes yet. Send every system link to the existing home route
// so links from Safari, Notes or a QR code only bring TraceBuddy forward, as they did before 2.0.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  // A locked tracing screen (child mode) ignores links until a grown-up unlocks.
  if (childModeState.isActive()) return ''
  if (devKitEnabled && /(^|\/)dev\/kit(-sheet)?(\?|$)/.test(path)) return path
  return '/'
}
