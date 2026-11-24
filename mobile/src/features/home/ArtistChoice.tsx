import { StyleSheet, View, useWindowDimensions } from 'react-native'
import type { ArtLevel } from '../../data/catalog'
import { Icon } from '../../ui/Icon'
import { PencilSimpleIcon, SparkleIcon } from '../../ui/icons'
import { PressTarget } from '../../ui/PressTarget'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'

const choices = [
  { level: 'simple', label: 'Little artist', description: 'Simple pictures', icon: SparkleIcon },
  { level: 'detailed', label: 'Big artist', description: 'Detailed pictures', icon: PencilSimpleIcon },
] as const

export function ArtistChoice({ level, onPick }: { level: ArtLevel | null; onPick: (level: ArtLevel) => void }) {
  const { fontScale } = useWindowDimensions()
  return (
    <View style={styles.card}>
      <Text variant="label" tone="muted" accessibilityRole="header" style={styles.title}>Who’s drawing?</Text>
      <View style={[styles.choices, fontScale >= theme.layout.stackedHeaderFontScale && styles.stacked]}>
        {choices.map((choice) => (
          <PressTarget
            key={choice.level}
            onPress={() => onPick(choice.level)}
            selected={level === choice.level}
            accessibilityLabel={`${choice.label}, ${choice.description}`}
            style={[styles.choice, level === choice.level && styles.selected]}
          >
            <View style={[styles.badge, choice.level === 'simple' ? styles.simple : styles.detailed]}><Icon glyph={choice.icon} /></View>
            <View style={styles.choiceText}>
              <Text variant="body" style={[styles.label, level === choice.level && styles.selectedText]}>{choice.label}</Text>
              <Text variant="label" tone="muted" style={level === choice.level && styles.selectedText}>{choice.description}</Text>
            </View>
          </PressTarget>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { padding: theme.space.md, gap: theme.space.sm, borderRadius: theme.radius.tile, backgroundColor: theme.colors.surface, ...theme.floatingShadow },
  title: { textTransform: 'uppercase', fontFamily: theme.fontFamily[800], paddingHorizontal: theme.space.xs },
  choices: { flexDirection: 'row', gap: theme.space.xs, padding: theme.space.xs, borderRadius: theme.radius.tile, backgroundColor: theme.colors.background },
  stacked: { flexDirection: 'column' },
  choice: {
    flex: 1, minHeight: theme.target.child, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: theme.space.sm, padding: theme.space.sm, borderRadius: theme.space.lg,
  },
  selected: { backgroundColor: theme.colors.ink },
  selectedText: { color: theme.colors.surface },
  badge: { padding: theme.space.xs, borderRadius: theme.space.sm },
  simple: { backgroundColor: theme.pastels.butter },
  detailed: { backgroundColor: theme.pastels.lilac },
  choiceText: { flexShrink: 1 },
  label: { fontFamily: theme.fontFamily[800] },
})
