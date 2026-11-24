import { isLoaded } from 'expo-font'
import { Text as NativeText, useWindowDimensions } from 'react-native'
import type { TextProps } from 'react-native'

import { theme } from './theme'
import type { TextVariant } from './theme'

type Props = TextProps & {
  variant?: TextVariant
  tone?: 'ink' | 'muted'
}

export function Text({ variant = 'body', tone = 'ink', style, dynamicTypeRamp, ...props }: Props) {
  const { fontScale } = useWindowDimensions()
  const { fontSize, fontWeight, ramp } = theme.type[variant]
  const fontFamily = theme.fontFamily[fontWeight]
  const font = isLoaded(fontFamily) ? { fontFamily } : { fontWeight }

  return (
    <NativeText
      // Remeasure the text when the system category changes while a screen is open.
      key={fontScale}
      dynamicTypeRamp={dynamicTypeRamp ?? ramp}
      {...props}
      style={[{ fontSize, ...font, color: theme.colors[tone] }, style]}
    />
  )
}
