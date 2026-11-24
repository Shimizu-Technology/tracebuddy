import { StackActions } from 'expo-router/build/react-navigation/routers'

import { pictureRouteParams } from './paperPicture'
import type { PaperParams } from './paperPicture'

/** The app's stack, as far as this decision needs it. */
export type AppStack = { index: number; routes: readonly { name: string }[] }

/**
 * Where "Draw on the screen instead" goes, as an action for the app's stack (On paper's routes are one group
 * in it, on top). Opened from Draw's More ([Home, Draw, On paper]), it goes back to that same Draw, strokes and
 * all. Opened from the Picture sheet ([Home, On paper]), Draw takes On paper's place: [Home, Draw].
 */
export function drawInsteadAction(appStack: AppStack | undefined, params: PaperParams) {
  const below = appStack?.routes[appStack.index - 1]
  if (below?.name === 'draw/[id]') return { kind: 'back' as const, action: StackActions.pop() }
  return { kind: 'replace' as const, action: StackActions.replace('draw/[id]', pictureRouteParams(params)) }
}
