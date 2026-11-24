import { StyleSheet } from 'react-native'

import { PressTarget } from './PressTarget'
import type { PressTargetProps } from './PressTarget'
import { Text } from './Text'
import { theme } from './theme'

const fills = {
  primary: theme.colors.coral,
  secondary: theme.pastels.peach,
  quiet: undefined,
}

type Props = Omit<PressTargetProps, 'children'> & {
  label: string
  variant?: keyof typeof fills
  target?: 'child' | 'adult'
}

export function Button({ label, variant = 'primary', target = 'child', style, ...props }: Props) {
  return (
    <PressTarget
      {...props}
      style={[styles.button, style, {
        backgroundColor: fills[variant],
        minHeight: theme.target[target],
        minWidth: theme.target[target],
      }]}
    >
      <Text variant="body" style={styles.label}>{label}</Text>
    </PressTarget>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    paddingHorizontal: theme.space.xl,
    paddingVertical: theme.space.md,
    borderRadius: theme.radius.full,
  },
  label: { textAlign: 'center' },
})
