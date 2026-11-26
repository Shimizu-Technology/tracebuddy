import { useEffect } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { Icon } from '../../ui/Icon'
import type { IconGlyph } from '../../ui/Icon'
import { CheckIcon, FileIcon, LockIcon, XIcon } from '../../ui/icons'
import { PressTarget } from '../../ui/PressTarget'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import type { PageOrientation } from './paperModel'
import { paperTheme } from './paperTheme'

const { size, colors } = paperTheme

export function GlassButton({ glyph, label, onPress, style }: { glyph: IconGlyph; label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <PressTarget accessibilityLabel={label} onPress={onPress} style={[styles.glassButton, style]}>
      <Icon glyph={glyph} />
    </PressTarget>
  )
}

type TopAction = { glyph: IconGlyph; label: string; onPress: () => void }

/** Close at left; More (or another single action) at right. */
export function TopBar({ top, left, right, onClose, action }: { top: number; left: number; right: number; onClose: () => void; action?: TopAction }) {
  return (
    <View pointerEvents="box-none" style={[styles.topBar, { top, left, right }]}>
      <GlassButton glyph={XIcon} label="Close" onPress={onClose} />
      {action ? <GlassButton glyph={action.glyph} label={action.label} onPress={action.onPress} /> : null}
    </View>
  )
}


function BarAction({ glyph, label, accessibilityLabel = label, main, dimmed, iconStyle, onPress }: {
  glyph: IconGlyph
  dimmed?: boolean
  label: string
  accessibilityLabel?: string
  main?: boolean
  iconStyle?: StyleProp<ViewStyle>
  onPress: () => void
}) {
  return (
    <View style={styles.action}>
      <PressTarget accessibilityLabel={accessibilityLabel} haptic={main} onPress={onPress} style={[main ? styles.mainCircle : styles.circle, dimmed && styles.dimmed]}>
        <View style={iconStyle}><Icon glyph={glyph} size={main ? size.lockIcon : theme.icon.size} /></View>
      </PressTarget>
      <Text variant="label" style={styles.actionLabel} importantForAccessibility="no" accessibilityElementsHidden>{label}</Text>
    </View>
  )
}

/** Page, Lock and Done. Lock is the main action, so it is bigger and coral. */
export function BottomBar({ bottom, left, right, page, lockDimmed, onPage, onLock, onDone }: {
  bottom: number
  left: number
  right: number
  page: PageOrientation
  /** Paper Lock: tracking isn't ready yet. Lock still answers a tap by saying what it is waiting for. */
  lockDimmed?: boolean
  onPage: () => void
  onLock: () => void
  onDone: () => void
}) {
  return (
    <View pointerEvents="box-none" style={styles.barDock}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
        <Defs>
          <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.scrim} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.scrim} />
          </LinearGradient>
        </Defs>
        <Rect width={1} height={1} fill="url(#scrim)" />
      </Svg>
      <View pointerEvents="box-none" style={[styles.bar, { paddingBottom: bottom, paddingLeft: left, paddingRight: right }]}>
        <BarAction
          glyph={FileIcon}
          label="Page"
          accessibilityLabel={page === 'portrait' ? 'Page, tall. Switch to wide' : 'Page, wide. Switch to tall'}
          iconStyle={page === 'landscape' && styles.wide}
          onPress={onPage}
        />
        <BarAction glyph={LockIcon} label="Lock" main dimmed={lockDimmed} onPress={onLock} />
        <BarAction glyph={CheckIcon} label="Done" onPress={onDone} />
      </View>
    </View>
  )
}

/**
 * A short dark pill for hints, confirmations and status. `announce` also speaks it with VoiceOver: on iOS a
 * live region does nothing, so the text is announced when it appears or changes.
 */
export function Pill({ text, announce = false, style }: { text: string; announce?: boolean; style?: StyleProp<ViewStyle> }) {
  useEffect(() => {
    if (announce) AccessibilityInfo.announceForAccessibility(text)
  }, [announce, text])
  return (
    <View pointerEvents="none" style={[styles.pill, style]} accessibilityLiveRegion={announce ? 'polite' : 'none'}>
      <Text variant="label" style={styles.pillText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  topBar: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  glassButton: {
    width: size.topButton,
    height: size.topButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    backgroundColor: colors.glass,
    ...theme.floatingShadow,
  },
  barDock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: size.barMaxWidth,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: theme.space.xxl,
  },
  action: { flex: 1, alignItems: 'center', gap: theme.space.xs },
  circle: {
    width: size.barButton,
    height: size.barButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    backgroundColor: colors.glass,
    ...theme.floatingShadow,
  },
  mainCircle: {
    width: size.lockButton,
    height: size.lockButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.coral,
    ...theme.floatingShadow,
  },
  actionLabel: { color: colors.onCamera, textAlign: 'center', textShadowColor: colors.scrim, textShadowRadius: theme.space.xs },
  wide: { transform: [{ rotate: '90deg' }] },
  dimmed: { opacity: theme.opacity.disabled },
  pill: {
    alignSelf: 'center',
    maxWidth: '90%',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.full,
    backgroundColor: colors.toast,
  },
  pillText: { color: colors.onCamera, textAlign: 'center' },
})
