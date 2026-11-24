import { useState } from 'react'
import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SvgXml } from 'react-native-svg'

import { drawingById } from '@tracebuddy/shared'
import { Button } from '../../src/ui/Button'
import { Icon } from '../../src/ui/Icon'
import { PencilSimpleIcon, SparkleIcon, XIcon } from '../../src/ui/icons'
import { IconButton } from '../../src/ui/IconButton'
import { Text } from '../../src/ui/Text'
import { Tile } from '../../src/ui/Tile'
import { theme } from '../../src/ui/theme'
import type { TextVariant } from '../../src/ui/theme'

const exampleArt = drawingById('island-turtle')?.svg
const allColors = { ...theme.colors, ...theme.pastels }
const typeVariants = Object.keys(theme.type) as TextVariant[]

export default function Kit() {
  const [action, setAction] = useState('')
  const { fontScale } = useWindowDimensions()
  const stackHeader = fontScale >= theme.layout.stackedHeaderFontScale
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={[styles.header, stackHeader && styles.stackedHeader]}>
            <Text accessibilityRole="header" variant="display" style={!stackHeader && styles.headerTitle}>TraceBuddy UI kit</Text>
            <IconButton
              glyph={XIcon}
              accessibilityLabel="Close UI kit"
              onPress={() => router.dismissTo('/')}
              style={stackHeader && styles.stackedClose}
            />
          </View>

          <Section title="Components">
            <Button label="Open example sheet" haptic onPress={() => router.navigate('/dev/kit-sheet')} />
            <View style={styles.row}>
              <Button label="Secondary" variant="secondary" target="adult" onPress={() => setAction('Secondary pressed')} />
              <Button label="Quiet" variant="quiet" target="adult" onPress={() => setAction('Quiet pressed')} />
              <IconButton
                glyph={PencilSimpleIcon}
                accessibilityLabel="Test pencil icon button"
                onPress={() => setAction('Icon button pressed')}
              />
            </View>
            <View style={styles.row}>
              <Tile
                pastel="mint"
                label="Sea turtle"
                style={styles.artTile}
                onPress={() => setAction('Sea turtle selected')}
                image={exampleArt
                  ? <SvgXml xml={exampleArt} width={theme.sample.artSize} height={theme.sample.artSize} />
                  : <Icon glyph={SparkleIcon} />}
              />
              <Button label="Disabled" variant="secondary" target="adult" disabled />
            </View>
            {action ? <Text variant="label" tone="muted" accessibilityLiveRegion="polite">{action}</Text> : null}
          </Section>

          <Section title="Color">
            <View style={styles.row}>
              {Object.entries(allColors).map(([name, color]) => (
                <View key={name} style={styles.swatch}>
                  <View style={[styles.swatchColor, { backgroundColor: color }]} />
                  <Text variant="label">{name}</Text>
                  <Text variant="small" tone="muted">{color}</Text>
                </View>
              ))}
            </View>
          </Section>

          <Section title="Nunito">
            {typeVariants.map((variant) => {
              const { fontSize, fontWeight } = theme.type[variant]
              return <Text key={variant} variant={variant}>{variant} · {fontSize} pt · {fontWeight}</Text>
            })}
          </Section>

          <Section title="Spacing and shape">
            {Object.entries(theme.space).map(([name, value]) => (
              <View key={name} style={styles.row}>
                <View style={[styles.spacingBar, { width: value }]} />
                <Text variant="label">{name} · {value} pt</Text>
              </View>
            ))}
            <View style={styles.row}>
              {Object.entries(theme.radius).map(([name, value]) => (
                <View key={name} style={[styles.shape, { borderRadius: value }]}>
                  <Text variant="small">{name}{name === 'full' ? '' : ` · ${value}`}</Text>
                </View>
              ))}
            </View>
            <View style={styles.floating}>
              <Text variant="label">Floating shadow</Text>
              <Text variant="small" tone="muted">
                {theme.floatingShadow.shadowOffset.height} pt offset · {theme.floatingShadow.shadowRadius} pt radius · {theme.floatingShadow.shadowOpacity * 100}% ink
              </Text>
            </View>
          </Section>

          <Section title="Touch and motion">
            {Object.entries(theme.target).map(([name, size]) => (
              <Text key={name} variant="label">{name} · {size} pt</Text>
            ))}
            <View style={styles.row}>
              <Icon glyph={SparkleIcon} />
              <Text variant="label">Phosphor {theme.icon.weight} · {theme.icon.size} pt</Text>
            </View>
            <Text variant="label">Press · {theme.motion.press.scale}× in {theme.motion.press.duration} ms</Text>
            <Text variant="label">Spring · {theme.motion.spring.damping} damping · {theme.motion.spring.stiffness} stiffness</Text>
            <Text variant="label">Small sheet · {theme.sheet.smallDetent * 100}% detent</Text>
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" variant="heading">{title}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.space.xl },
  content: { alignSelf: 'center', width: '100%', maxWidth: theme.sample.maxContentWidth, gap: theme.space.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  stackedHeader: { flexDirection: 'column-reverse', alignItems: 'stretch' },
  stackedClose: { alignSelf: 'flex-end' },
  headerTitle: { flex: 1 },
  section: { gap: theme.space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.space.sm },
  artTile: { width: theme.sample.tileWidth, maxWidth: '100%' },
  swatch: { flexBasis: theme.sample.tileWidth, flexGrow: 1 },
  swatchColor: {
    height: theme.target.minimum,
    borderRadius: theme.radius.tile,
    borderColor: theme.colors.hairline,
    borderWidth: theme.sample.ruleWidth,
  },
  spacingBar: { height: theme.space.sm, borderRadius: theme.radius.full, backgroundColor: theme.colors.ink },
  shape: {
    minHeight: theme.target.child,
    justifyContent: 'center',
    padding: theme.space.lg,
    backgroundColor: theme.pastels.sky,
  },
  floating: {
    ...theme.floatingShadow,
    alignSelf: 'flex-start',
    padding: theme.space.lg,
    borderRadius: theme.radius.tile,
    backgroundColor: theme.colors.surface,
  },
})
