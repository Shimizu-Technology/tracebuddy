import { router } from 'expo-router'

import { paperRouteParams } from './pictureSource'
import type { PaperParams } from './pictureSource'

/** Both tracing screens send "Draw on the screen instead" to the same Draw route, with the same picture. */
export function drawOnScreenInstead(params: PaperParams) {
  router.replace({ pathname: '/draw/[id]', params: paperRouteParams(params) } as never)
}

/** The Stick to paper (Paper Lock) route for the same picture. */
export function openStickToPaper(params: PaperParams) {
  router.push({ pathname: '/paper/stick/[id]', params: paperRouteParams(params) })
}
