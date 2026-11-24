import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { View } from 'react-native'

import { theme } from './theme'

export type IconGlyph = PhosphorIcon

export function Icon({ glyph: Glyph, tone = 'ink' }: { glyph: IconGlyph; tone?: 'ink' | 'muted' }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Glyph color={theme.colors[tone]} size={theme.icon.size} weight={theme.icon.weight} />
    </View>
  )
}
