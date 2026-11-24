import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Switch, useWindowDimensions, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '../../ui/Icon'
import type { IconGlyph } from '../../ui/Icon'
import { CaretDownIcon, CaretLeftIcon, CaretRightIcon, CaretUpIcon, InfoIcon, PushPinIcon } from '../../ui/icons'
import { IconButton } from '../../ui/IconButton'
import { PressTarget } from '../../ui/PressTarget'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { paperStore, usePaperOptions } from './paperStore'
import type { PaperRequest } from './paperStore'
import { paperTheme } from './paperTheme'

function Row({ title, detail, children }: { title: string; detail?: string; children?: ReactNode }) {
  // At the largest text sizes the control moves under its title instead of squeezing it.
  const stacked = useWindowDimensions().fontScale >= theme.layout.stackedHeaderFontScale
  return (
    <View style={[styles.row, stacked && styles.stackedRow]}>
      <View style={[styles.rowText, stacked && styles.stackedText]}>
        <Text variant="body">{title}</Text>
        {detail ? <Text variant="small" tone="muted">{detail}</Text> : null}
      </View>
      {children}
    </View>
  )
}

function LinkRow({ glyph, title, detail, onPress }: { glyph: IconGlyph; title: string; detail?: string; onPress: () => void }) {
  return (
    <PressTarget accessibilityLabel={detail ? `${title}. ${detail}` : title} onPress={onPress} style={styles.row}>
      <View style={styles.rowIcon}><Icon glyph={glyph} /></View>
      <View style={styles.linkText}>
        <Text variant="body">{title}</Text>
        {detail ? <Text variant="small" tone="muted">{detail}</Text> : null}
      </View>
    </PressTarget>
  )
}

const step = paperTheme.nudgeStep

/** The More options themselves. Shown in the native sheet on phones and in a bottom card on iPad. */
export function MoreContent({ onClose }: { onClose: () => void }) {
  const options = usePaperOptions()

  function closeThen(request: PaperRequest) {
    onClose()
    paperStore.request(request)
  }

  return (
    <View>
      <Row title="Fine-tune" detail="Tiny moves">
        <View style={styles.pad} accessibilityLabel="Fine-tune position">
          <IconButton glyph={CaretUpIcon} accessibilityLabel="Move up a little" onPress={() => paperStore.nudge(0, -step)} style={styles.nudge} />
          <View style={styles.padRow}>
            <IconButton glyph={CaretLeftIcon} accessibilityLabel="Move left a little" onPress={() => paperStore.nudge(-step, 0)} style={styles.nudge} />
            <IconButton glyph={CaretDownIcon} accessibilityLabel="Move down a little" onPress={() => paperStore.nudge(0, step)} style={styles.nudge} />
            <IconButton glyph={CaretRightIcon} accessibilityLabel="Move right a little" onPress={() => paperStore.nudge(step, 0)} style={styles.nudge} />
          </View>
        </View>
      </Row>
      <Row title="Light lines" detail={options.canUseLightLines ? 'For dark paper' : 'For line drawings, not photos'}>
        <Switch
          accessibilityLabel="Light lines"
          value={options.lightLines && options.canUseLightLines}
          disabled={!options.canUseLightLines}
          onValueChange={(lightLines) => paperStore.set({ lightLines })}
          trackColor={{ true: theme.colors.coral }}
        />
      </Row>
      <Row title="Mirror" detail="Flip the picture">
        <Switch accessibilityLabel="Mirror" value={options.mirror} onValueChange={(mirror) => paperStore.set({ mirror })} trackColor={{ true: theme.colors.coral }} />
      </Row>
      {options.stickAvailable ? (
        <LinkRow
          glyph={PushPinIcon}
          title="Stick to paper"
          detail="The picture stays on the page if the phone gets bumped."
          onPress={() => closeThen('stick')}
        />
      ) : null}
      <LinkRow glyph={InfoIcon} title="Setup tips" onPress={() => closeThen('tips')} />
    </View>
  )
}

/**
 * On phones: extras in a small undimmed native sheet. The guide moves up to stay in view; swipe down to close.
 * iPad floats form sheets mid-screen where the guide can't be kept clear of them, so it uses MoreContent in a card.
 */
export function MoreSheet() {
  useEffect(() => {
    paperStore.set({ sheetOpen: true })
    return () => paperStore.set({ sheetOpen: false })
  }, [])

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.sheet}>
      <ScrollView contentContainerStyle={styles.content}>
        <MoreContent onClose={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: theme.colors.surface },
  content: { paddingHorizontal: theme.space.xl, paddingTop: theme.space.lg, paddingBottom: theme.space.xl },
  row: {
    minHeight: theme.target.adult + theme.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingVertical: theme.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.hairline,
  },
  rowIcon: {
    width: theme.target.minimum,
    height: theme.target.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background,
  },
  rowText: { flex: 1, gap: theme.space.xs / 2 },
  stackedRow: { flexDirection: 'column', alignItems: 'flex-start' },
  stackedText: { flex: 0, alignSelf: 'stretch' },
  linkText: { flex: 1, gap: theme.space.xs / 2 },
  pad: { alignItems: 'center', gap: theme.space.xs },
  padRow: { flexDirection: 'row', gap: theme.space.xs },
  nudge: { width: paperTheme.size.nudge, height: paperTheme.size.nudge, backgroundColor: theme.colors.hairline },
})
