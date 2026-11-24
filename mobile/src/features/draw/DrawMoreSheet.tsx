import { useEffect, useRef, useState } from 'react'
import Slider from '@react-native-community/slider'
import { router } from 'expo-router'
import { usePreventRemove } from 'expo-router/react-navigation'
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'

import type { PictureParams } from '../../data/catalog'
import { CanvasButton } from '../../ui/CanvasButton'
import { HoldButton } from '../../ui/HoldButton'
import { CameraIcon, CornersOutIcon, TrashIcon } from '../../ui/icons'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { useDrawMore } from './drawMoreState'

type Destination = 'back' | PictureParams

export default function DrawMoreSheet() {
  const { more } = useDrawMore()
  const { fontScale } = useWindowDimensions()
  const wide = Platform.OS === 'ios' && Platform.isPad && fontScale < theme.layout.stackedHeaderFontScale
  const [opacity, setOpacity] = useState(() => more?.guideOpacity ?? 0.24)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [destination, setDestination] = useState<Destination | null>(null)

  // Keep the sheet in place until a save or clear has settled. Navigate
  // after releasing the guard so a dismissal cannot accidentally pop Draw.
  usePreventRemove(busy, () => undefined)
  useEffect(() => {
    if (busy || !destination) return
    if (destination === 'back') router.back()
    else router.replace({ pathname: '/paper/[id]', params: destination })
  }, [busy, destination])

  async function act(action: () => Promise<Destination | null>) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    try {
      setDestination(await action())
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  if (!more) return null

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.guide}>
        <Text variant="body" style={styles.label}>Guide strength</Text>
        <Slider
          accessibilityLabel="Guide strength"
          accessibilityValue={{ min: 8, max: 66, now: Math.round(opacity * 100) }}
          minimumValue={8} maximumValue={66} step={1} value={opacity * 100}
          disabled={busy} onValueChange={(value) => { setOpacity(value / 100); more.onOpacity(value / 100) }}
          minimumTrackTintColor={theme.colors.coral} maximumTrackTintColor={theme.colors.hairline}
          style={styles.slider}
        />
      </View>
      <View style={[styles.actions, wide && styles.wideActions]}>
        <CanvasButton glyph={CornersOutIcon} label="Fit to screen" showLabel disabled={busy}
          onPress={() => { more.onFit(); router.back() }} style={[styles.option, wide && styles.wideOption]} />
        <CanvasButton glyph={CameraIcon} label="Trace on paper instead" showLabel disabled={busy}
          onPress={() => void act(more.onPaper)} style={[styles.option, wide && styles.wideOption]} />
      </View>
      <HoldButton label="Start over" glyph={TrashIcon} disabled={busy} onConfirm={() => void act(async () => await more.onClear() ? 'back' : null)} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { gap: theme.space.xs, padding: theme.space.lg, paddingTop: theme.space.xl },
  guide: { gap: theme.space.xs },
  label: { fontFamily: theme.fontFamily[800] },
  slider: { minHeight: theme.target.child },
  actions: { gap: theme.space.xs },
  wideActions: { flexDirection: 'row' },
  wideOption: { flex: 1 },
  option: { backgroundColor: theme.colors.background, justifyContent: 'flex-start' },
})
