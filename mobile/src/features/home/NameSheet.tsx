import { useEffect, useMemo, useState } from 'react'
import { Keyboard, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SvgXml } from 'react-native-svg'

import { sanitizeTraceText } from '../../../../shared'
import { readArtistLevel } from '../../data/artistLevel'
import { artLevels } from '../../data/catalog'
import type { ArtLevel } from '../../data/catalog'
import { textStyleForLevel } from '../../data/letterPictures'
import { textGuideSvg } from '../../data/textGuide'
import { Button } from '../../ui/Button'
import { PressTarget } from '../../ui/PressTarget'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'

const choices = {
  simple: { label: 'Bubble', pastel: theme.pastels.butter },
  detailed: { label: 'Practice', pastel: theme.pastels.sky },
}
const examples = {
  simple: textGuideSvg('Aa', 'bubble', { preview: true }),
  detailed: textGuideSvg('Aa', 'practice', { preview: true }),
}

export default function NameSheet() {
  const { level } = useLocalSearchParams<{ level?: ArtLevel }>()
  const [word, setWord] = useState('')
  const [artistLevel, setArtistLevel] = useState<ArtLevel>(level === 'detailed' ? 'detailed' : 'simple')
  const [chosenLevel, setChosenLevel] = useState<ArtLevel>()
  const { fontScale } = useWindowDimensions()
  const stacked = fontScale >= theme.layout.stackedHeaderFontScale
  const text = sanitizeTraceText(word)
  const selected = chosenLevel ?? artistLevel
  const preview = useMemo(() => text ? textGuideSvg(text, textStyleForLevel[selected], { preview: true }) : null, [text, selected])

  useEffect(() => {
    if (level === 'simple' || level === 'detailed') return
    let active = true
    void readArtistLevel().then((value) => { if (active && value) setArtistLevel(value) }).catch(() => undefined)
    return () => { active = false }
  }, [level])

  function openPicture() {
    if (!text) return
    Keyboard.dismiss()
    router.replace({ pathname: '/picture/[id]', params: { id: 'my-name', text, level: selected } })
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
      <Text variant="title" accessibilityRole="header">My words</Text>
      <TextInput
        accessibilityLabel="Name or words"
        autoCapitalize="words"
        autoCorrect={false}
        style={styles.input}
        placeholder="Name or words"
        placeholderTextColor={theme.colors.muted}
        value={word}
        onChangeText={setWord}
        maxLength={48}
        returnKeyType="go"
        onSubmitEditing={openPicture}
      />
      <View style={[styles.choices, stacked && styles.stacked]}>
        {artLevels.map((option) => (
          <PressTarget key={option} accessibilityLabel={choices[option].label} selected={selected === option}
            style={[styles.choice, stacked && styles.stackedChoice, { backgroundColor: choices[option].pastel },
              selected === option && styles.selected]}
            onPress={() => { setChosenLevel(option); Keyboard.dismiss() }}>
            <View style={styles.example} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <SvgXml xml={examples[option]} width="100%" height="100%" />
            </View>
            <Text style={styles.label}>{choices[option].label}</Text>
          </PressTarget>
        ))}
      </View>
      {preview && (
        <View style={styles.preview} accessible accessibilityLabel={`Preview: ${text}, ${choices[selected].label}`}>
          <SvgXml xml={preview} width="100%" height="100%" />
        </View>
      )}
      <Button label="See my picture" disabled={!text} onPress={openPicture} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: theme.sample.maxContentWidth, alignSelf: 'center',
    padding: theme.space.lg, paddingTop: theme.space.xxl, gap: theme.space.md },
  input: {
    minHeight: theme.target.child, paddingHorizontal: theme.space.lg, paddingVertical: theme.space.md,
    borderRadius: theme.radius.tile, backgroundColor: theme.colors.background,
    borderColor: theme.colors.hairline, borderWidth: StyleSheet.hairlineWidth,
    color: theme.colors.ink, fontSize: theme.type.heading.fontSize,
    fontFamily: Platform.select({ ios: theme.fontFamily[700], default: undefined }),
  },
  choices: { flexDirection: 'row', gap: theme.space.md },
  stacked: { flexDirection: 'column' },
  choice: { flexGrow: 1, flexBasis: 0, minHeight: theme.target.child, alignItems: 'center',
    padding: theme.space.sm, borderRadius: theme.radius.tile, borderWidth: theme.border.emphasis, borderColor: 'transparent' },
  stackedChoice: { flexBasis: 'auto' },
  selected: { borderColor: theme.colors.ink },
  example: { height: theme.target.child, width: '100%' },
  label: { fontFamily: theme.fontFamily[800], textAlign: 'center' },
  preview: { height: theme.target.adult * 2, backgroundColor: theme.colors.background, borderRadius: theme.radius.tile },
})
