import { router } from 'expo-router'
import { StackActions } from 'expo-router/build/react-navigation/routers'

import { traceBuddy2Enabled } from '../../devKit'
import { pictureRouteParams } from './paperPicture'
import type { PaperParams } from './paperPicture'
import { photoHandoff } from './usePhotoLease'

type Navigation = { dispatch: (action: ReturnType<typeof StackActions.replace>) => void; getParent: () => Navigation | undefined }

/** "Draw on the screen instead" exists only where the 2.0 Draw route does. */
export const canDrawInstead = traceBuddy2Enabled

/**
 * Both tracing screens send "Draw on the screen instead" to the same Draw route with the same picture. Draw
 * takes On paper's place in the app's stack ([Home, Draw], like On the screen from the Picture sheet), and the
 * photo, if any, is handed over so its file is kept through the switch.
 */
export function drawOnScreenInstead(navigation: Navigation, params: PaperParams, photoUri?: string) {
  photoHandoff.handOff(photoUri)
  // On paper's routes are a nested stack; Draw replaces that whole group in the app's stack.
  const appStack = navigation.getParent() ?? navigation
  appStack.dispatch(StackActions.replace('draw/[id]', pictureRouteParams(params)))
}

/** The Stick to paper (Paper Lock) route for the same picture, over On paper. */
export function openStickToPaper(params: PaperParams, photoUri?: string) {
  photoHandoff.handOff(photoUri)
  router.push({ pathname: '/paper/stick/[id]', params: pictureRouteParams(params) })
}
