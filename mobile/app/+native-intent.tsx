import { devKitEnabled } from '../src/devKit'

// The app has no public deep-link routes yet. Send every system link to the existing home route
// so links from Safari, Notes or a QR code only bring TraceBuddy forward, as they did before 2.0.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  if (devKitEnabled && /(^|\/)dev\/kit(-sheet)?(\?|$)/.test(path)) return path
  return '/'
}
