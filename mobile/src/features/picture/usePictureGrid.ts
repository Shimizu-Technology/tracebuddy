import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { theme } from '../../ui/theme'

export function usePictureGrid() {
  const { width, fontScale } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const contentWidth = width - insets.left - insets.right
  const columns = contentWidth >= theme.layout.fourColumns ? 4 : contentWidth >= theme.layout.threeColumns ? 3 : 2
  const tileWidth = Math.floor((contentWidth - theme.space.lg * 2 - theme.space.md * (columns - 1)) / columns)
  return { contentWidth, fontScale, columns, tileWidth }
}
