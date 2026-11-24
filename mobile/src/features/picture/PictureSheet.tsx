import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'

import { pictureLevels, resolvePicture } from '../../data/catalog'
import type { ArtLevel, PictureParams } from '../../data/catalog'
import { parseModePreference, serializeModePreference } from '../../data/localSettings'
import { readLocalSetting, writeLocalSetting } from '../../data/nativeStorage'
import { modePreferenceKey } from '../../data/storageKeys'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { CameraIcon, HandPointingIcon } from '../../ui/icons'
import { PressTarget } from '../../ui/PressTarget'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { PictureArt } from './PictureArt'
import { picturePastel } from './picturePastel'

const modes = [
  { id: 'camera', label: 'On paper', glyph: CameraIcon, pastel: theme.pastels.sky },
  { id: 'screen', label: 'On the screen', glyph: HandPointingIcon, pastel: theme.pastels.peach },
] as const

export default function PictureSheet() {
  const params = useLocalSearchParams<PictureParams>()
  const [level, setLevel] = useState<ArtLevel | undefined>(params.level)
  const [lastMode, setLastMode] = useState<'camera' | 'screen'>()
  const navigating = useRef(false)
  const focused = useRef(false)
  const { height, fontScale } = useWindowDimensions()
  const picture = resolvePicture({ ...params, level })
  const levels = picture?.level ? pictureLevels(picture.id) : []

  useFocusEffect(useCallback(() => {
    focused.current = true
    navigating.current = false
    return () => { focused.current = false }
  }, []))

  useEffect(() => {
    let active = true
    void readLocalSetting(modePreferenceKey).then((raw) => {
      if (raw && active) setLastMode(parseModePreference(raw, false) === 'screen' ? 'screen' : 'camera')
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  async function openMode(mode: typeof modes[number]['id']) {
    if (!picture || navigating.current) return
    navigating.current = true
    const next = { ...params, level: picture.level }
    try {
      await writeLocalSetting(modePreferenceKey, () => serializeModePreference(mode), () => true)
      setLastMode(mode)
    } catch {
      Alert.alert('Could not remember this choice', 'You can still open the picture.')
    }
    if (!focused.current) return
    if (mode === 'camera') router.push({ pathname: '/paper/[id]', params: next })
    else router.replace({ pathname: '/draw/[id]', params: next })
  }

  if (!picture) return (
    <View style={styles.content}>
      <Text variant="heading">This picture could not open.</Text>
      <Button label="Back" onPress={() => router.back()} />
    </View>
  )

  const stacked = fontScale >= theme.layout.stackedHeaderFontScale
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.preview, { width: Math.min(theme.layout.picturePreviewMax, height * 0.285), backgroundColor: theme.pastels[picturePastel[picture.category]] }]}>
        <PictureArt picture={picture} />
      </View>
      <Text accessibilityRole="header" variant="title" style={styles.title}>{picture.name}</Text>
      {levels.length === 2 && (
        <View style={[styles.levels, stacked && styles.stacked]}>
          {levels.map((option) => (
            <PressTarget key={option} accessibilityLabel={option === 'simple' ? 'Simple' : 'Detailed'}
              selected={picture.level === option} style={[styles.level, picture.level === option && styles.selectedLevel]}
              onPress={() => setLevel(option)}>
              <Text style={[styles.bold, picture.level === option && styles.selectedText]}>
                {option === 'simple' ? 'Simple' : 'Detailed'}
              </Text>
            </PressTarget>
          ))}
        </View>
      )}
      <Text tone="muted" style={styles.title}>How do you want to draw?</Text>
      <View style={[styles.choices, stacked && styles.stacked]}>
        {modes.map(({ id, label, glyph, pastel }) => (
          <PressTarget key={id} onPress={() => void openMode(id)}
            accessibilityLabel={label} accessibilityHint={lastMode === id ? 'Last used' : undefined}
            style={[styles.choice, lastMode === id && styles.lastMode]}>
            <View style={[styles.modeIcon, { backgroundColor: pastel }]}><Icon glyph={glyph} size={theme.icon.size + theme.space.lg} /></View>
            <Text variant="heading" style={styles.title}>{label}</Text>
          </PressTarget>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { gap: theme.space.md, padding: theme.space.lg, paddingTop: theme.space.xl,
    width: '100%', maxWidth: theme.sample.maxContentWidth, alignSelf: 'center' },
  preview: { alignSelf: 'center', borderRadius: theme.radius.sheet },
  title: { textAlign: 'center', fontFamily: theme.fontFamily[800] },
  bold: { fontFamily: theme.fontFamily[800], textAlign: 'center' },
  levels: { flexDirection: 'row', padding: theme.space.xs, gap: theme.space.xs, borderRadius: theme.radius.tile, backgroundColor: theme.colors.background },
  level: {
    minHeight: theme.target.child, minWidth: theme.target.child, padding: theme.space.sm,
    flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: theme.space.lg,
  },
  selectedLevel: { backgroundColor: theme.colors.ink },
  selectedText: { color: theme.colors.surface },
  choices: { flexDirection: 'row', gap: theme.space.md },
  stacked: { flexDirection: 'column' },
  choice: {
    flex: 1, gap: theme.space.md, padding: theme.space.md, minHeight: theme.target.child,
    alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.tile,
    borderColor: theme.colors.hairline, borderWidth: theme.border.emphasis, backgroundColor: theme.colors.background,
  },
  lastMode: { borderColor: theme.colors.ink, backgroundColor: theme.pastels.peach },
  modeIcon: { borderRadius: theme.space.lg, padding: theme.space.md },
})
