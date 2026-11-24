import { Redirect, useLocalSearchParams } from 'expo-router'

import { paperLockEnabled } from '../../../src/devKit'
import { PaperLockScreen } from '../../../src/features/paper/PaperLockScreen'
import { pictureRouteParams } from '../../../src/features/paper/paperPicture'
import type { PaperParams } from '../../../src/features/paper/paperPicture'

// Stick to paper is off in 2.0 (EXPO_PUBLIC_PAPER_LOCK): its address leads to On paper for the same picture.
export default function StickToPaper() {
  const params = useLocalSearchParams() as PaperParams
  if (!paperLockEnabled) return <Redirect href={{ pathname: '/paper/[id]', params: pictureRouteParams(params) }} />
  return <PaperLockScreen params={params} />
}
