import type { ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'

import { Icon } from './Icon'
import type { IconGlyph } from './Icon'
import { PressTarget } from './PressTarget'
import { Text } from './Text'
import { theme } from './theme'

type Props = {
  glyph: IconGlyph
  label: string
  onPress: () => void
  selected?: boolean
  disabled?: boolean
  primary?: boolean
  showLabel?: boolean
  haptic?: boolean
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

export function CanvasButton({ glyph, label, onPress, selected, disabled, primary, showLabel, haptic, children, style }: Props) {
  return (
    <PressTarget
      onPress={onPress}
      accessibilityLabel={label}
      selected={selected}
      disabled={disabled}
      haptic={haptic}
      style={[styles.button, primary && styles.primary, selected && styles.selected, showLabel && styles.label, style]}
    >
      <Icon glyph={glyph} />
      {showLabel && <Text variant="body" style={styles.text}>{label}</Text>}
      {children}
    </PressTarget>
  )
}

const styles = StyleSheet.create({
  button: {
    minWidth: theme.target.child, minHeight: theme.target.child,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: theme.space.sm,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.full,
  },
  label: { paddingVertical: theme.space.sm, paddingHorizontal: theme.space.lg, flexShrink: 1 },
  primary: { backgroundColor: theme.colors.coral },
  selected: { backgroundColor: theme.pastels.peach },
  text: { fontFamily: theme.fontFamily[800], flexShrink: 1, textAlign: 'center' },
})
