import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { PressTarget } from './PressTarget'
import type { PressTargetProps } from './PressTarget'
import { Text } from './Text'
import { theme } from './theme'
import type { Pastel } from './theme'

type Props = Omit<PressTargetProps, 'children'> & {
  label: string
  image: ReactNode
  pastel: Pastel
}

export function Tile({ label, image, pastel, style, ...props }: Props) {
  return (
    <PressTarget {...props} accessibilityLabel={props.accessibilityLabel ?? label} style={[
      styles.tile, style, styles.target, { backgroundColor: theme.pastels[pastel] },
    ]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.image}>{image}</View>
      <Text variant="label" style={styles.label}>{label}</Text>
    </PressTarget>
  )
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    gap: theme.space.sm,
    padding: theme.space.lg,
    borderRadius: theme.radius.tile,
  },
  target: { minHeight: theme.target.child, minWidth: theme.target.child },
  image: { alignSelf: 'stretch', alignItems: 'center' },
  label: { textAlign: 'center' },
})
