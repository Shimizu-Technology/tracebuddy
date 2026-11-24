import { StyleSheet } from 'react-native'

import { Icon } from './Icon'
import type { IconGlyph } from './Icon'
import { PressTarget } from './PressTarget'
import type { PressTargetProps } from './PressTarget'
import { theme } from './theme'

type Props = Omit<PressTargetProps, 'children' | 'accessibilityLabel'> & {
  glyph: IconGlyph
  accessibilityLabel: string
}

export function IconButton({ glyph, style, ...props }: Props) {
  return (
    <PressTarget {...props} style={[styles.button, style, styles.target]}>
      <Icon glyph={glyph} />
    </PressTarget>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
  },
  target: { minHeight: theme.target.adult, minWidth: theme.target.adult },
})
