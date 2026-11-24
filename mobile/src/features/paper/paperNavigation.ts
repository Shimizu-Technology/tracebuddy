import { router } from 'expo-router'

import { paperLockEnabled, traceBuddy2Enabled } from '../../devKit'
import { drawInsteadAction } from './drawInstead'
import type { AppStack } from './drawInstead'
import { pictureRouteParams } from './paperPicture'
import type { PaperParams } from './paperPicture'
import { photoHandoff } from './usePhotoLease'

type Navigation = {
  dispatch: (action: ReturnType<typeof drawInsteadAction>['action']) => void
  getParent: () => Navigation | undefined
  getState: () => AppStack | undefined
}

/** "Draw on the screen instead" exists only where the 2.0 Draw route does. */
export const canDrawInstead = traceBuddy2Enabled

/** Stick to paper (Paper Lock) stays off in 2.0 until it passes the physical accuracy test. */
export const canStickToPaper = paperLockEnabled

/**
 * Both tracing screens send "Draw on the screen instead" to Draw with the same picture, without stacking a
 * second Draw (see drawInsteadAction). A new Draw gets the photo, if any, handed over so its file is kept
 * through the switch.
 */
export function drawOnScreenInstead(navigation: Navigation, params: PaperParams, photoUri?: string) {
  // On paper's routes are a nested stack, one group in the app's stack.
  const appStack = navigation.getParent() ?? navigation
  const next = drawInsteadAction(appStack.getState(), params)
  if (next.kind === 'replace') photoHandoff.handOff(photoUri)
  appStack.dispatch(next.action)
}

/** The Stick to paper (Paper Lock) route for the same picture, over On paper. */
export function openStickToPaper(params: PaperParams, photoUri?: string) {
  if (!canStickToPaper) return
  photoHandoff.handOff(photoUri)
  router.push({ pathname: '/paper/stick/[id]', params: pictureRouteParams(params) })
}
