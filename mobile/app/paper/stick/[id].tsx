import { useLocalSearchParams } from 'expo-router'

import { PaperLockScreen } from '../../../src/features/paper/PaperLockScreen'
import type { PaperParams } from '../../../src/features/paper/paperPicture'

export default function StickToPaper() {
  const params = useLocalSearchParams() as PaperParams
  return <PaperLockScreen params={params} />
}
