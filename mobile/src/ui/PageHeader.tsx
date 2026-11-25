import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'

import { CanvasButton } from './CanvasButton'
import { CaretLeftIcon } from './icons'
import { Text } from './Text'
import { theme } from './theme'

export function PageHeader({ title, centered, stacked, trailing, onBack }: {
  title: string
  centered?: boolean
  stacked?: boolean
  trailing?: ReactNode
  onBack?: () => void
}) {
  return (
    <View style={[styles.row, stacked && styles.stacked]}>
      <CanvasButton glyph={CaretLeftIcon} label="Back" onPress={onBack ?? (() => router.back())} />
      <Text accessibilityRole="header" variant={centered ? 'heading' : 'title'}
        style={[styles.title, centered && styles.centered, stacked && styles.stackedTitle]}>{title}</Text>
      {trailing}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, paddingHorizontal: theme.space.lg, paddingBottom: theme.space.sm },
  title: { flex: 1, fontFamily: theme.fontFamily[800] },
  stacked: { flexDirection: 'column', alignItems: 'flex-start' },
  stackedTitle: { flex: 0 },
  centered: { textAlign: 'center' },
})
