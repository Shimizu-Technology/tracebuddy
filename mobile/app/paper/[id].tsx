import { useLocalSearchParams } from 'expo-router'

import { PaperScreen } from '../../src/features/paper/PaperScreen'
import type { PaperParams } from '../../src/features/paper/paperPicture'

export default function OnPaper() {
  const params = useLocalSearchParams() as PaperParams
  return <PaperScreen params={params} />
}
