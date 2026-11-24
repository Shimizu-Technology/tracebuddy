import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { View } from 'react-native'

import { theme } from './theme'

export type IconGlyph = PhosphorIcon

export function Icon({ glyph: Glyph, tone = 'ink', size = theme.icon.size }: { glyph: IconGlyph; tone?: 'ink' | 'muted' | 'surface'; size?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Glyph color={theme.colors[tone]} size={size} weight={theme.icon.weight} />
    </View>
  )
}
