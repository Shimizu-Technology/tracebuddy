import { useLocalSearchParams } from 'expo-router'

import { PaperScreen } from '../../src/features/paper/PaperScreen'
import type { PaperParams } from '../../src/features/paper/pictureSource'

export default function OnPaper() {
  const params = useLocalSearchParams<{ id: string; level?: string; photo?: string; text?: string; fault?: string }>()
  return <PaperScreen params={params as PaperParams} />
}
