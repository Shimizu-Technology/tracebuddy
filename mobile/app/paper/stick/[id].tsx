import { useLocalSearchParams } from 'expo-router'

import { PaperLockScreen } from '../../../src/features/paper/PaperLockScreen'
import type { PaperParams } from '../../../src/features/paper/pictureSource'

export default function StickToPaper() {
  const params = useLocalSearchParams<{ id: string; level?: string; photo?: string; text?: string }>()
  return <PaperLockScreen params={params as PaperParams} />
}
