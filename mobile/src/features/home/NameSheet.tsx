import { useState } from 'react'
import { Keyboard, Platform, ScrollView, StyleSheet, TextInput } from 'react-native'
import { router } from 'expo-router'

import { sanitizeTraceText } from '../../../../shared'
import { Button } from '../../ui/Button'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'

export default function NameSheet() {
  const [word, setWord] = useState('')
  const text = sanitizeTraceText(word)

  function openPicture() {
    if (!text) return
    Keyboard.dismiss()
    router.replace({ pathname: '/picture/[id]', params: { id: 'my-name', text } })
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text variant="title" accessibilityRole="header">My name</Text>
      <Text variant="body" tone="muted">Type a name or a word to draw.</Text>
      <TextInput
        accessibilityLabel="Name or word"
        autoFocus
        autoCapitalize="words"
        autoCorrect={false}
        style={styles.input}
        placeholder="Name or word"
        placeholderTextColor={theme.colors.muted}
        value={word}
        onChangeText={setWord}
        maxLength={48}
        returnKeyType="go"
        onSubmitEditing={openPicture}
      />
      <Button label="See my picture" disabled={!text} onPress={openPicture} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: theme.space.xl, gap: theme.space.md, paddingTop: theme.space.xxl },
  input: {
    minHeight: theme.target.child, paddingHorizontal: theme.space.lg, paddingVertical: theme.space.md,
    borderRadius: theme.radius.tile, backgroundColor: theme.colors.background,
    borderColor: theme.colors.hairline, borderWidth: StyleSheet.hairlineWidth,
    color: theme.colors.ink, fontSize: theme.type.heading.fontSize,
    fontFamily: Platform.select({ ios: theme.fontFamily[700], default: undefined }),
  },
})
