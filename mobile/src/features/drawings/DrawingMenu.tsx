import { drawingTitle } from '../../data/practiceSource'
import { useEffect, useRef, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { usePreventRemove } from 'expo-router/react-navigation'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native'

import type { SavedPracticeSession } from '../../../practiceStorageModel'
import { copyDrawing, deleteDrawing, readDrawing } from '../../data/drawingLibrary'
import { CanvasButton } from '../../ui/CanvasButton'
import { HoldButton } from '../../ui/HoldButton'
import { CopyIcon, DownloadSimpleIcon, PencilSimpleIcon, TrashIcon } from '../../ui/icons'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { usePhotoExport } from '../draw/usePhotoExport'

export default function DrawingMenu() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const [session, setSession] = useState<SavedPracticeSession | null>()
  const [busy, setBusy] = useState(false)
  const [closing, setClosing] = useState(false)
  const working = useRef(false)
  const { saveToPhotos, saving, captureView } = usePhotoExport()

  useEffect(() => {
    let active = true
    void readDrawing(sessionId).then((value) => { if (active) setSession(value) })
      .catch(() => { if (active) setSession(null) })
    return () => { active = false }
  }, [sessionId])

  usePreventRemove(busy, () => undefined)
  useEffect(() => { if (closing && !busy) router.back() }, [busy, closing])

  async function change(action: () => Promise<boolean>) {
    if (working.current) return
    working.current = true
    setBusy(true)
    try {
      if (await action()) setClosing(true)
      else Alert.alert('Could not update drawing', 'Try again in a moment.')
    } catch {
      Alert.alert('Could not update drawing', 'Try again in a moment.')
    } finally {
      working.current = false
      setBusy(false)
    }
  }

  if (!session) return <View style={styles.content}>
    {session === undefined ? <ActivityIndicator color={theme.colors.ink} /> : <Text>This drawing is unavailable.</Text>}
  </View>

  return (
    <View style={styles.page}>
      {captureView}
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="heading" accessibilityRole="header">{drawingTitle(session)}</Text>
        <CanvasButton glyph={CopyIcon} label="Copy" showLabel disabled={busy || saving} style={styles.option}
          onPress={() => void change(() => copyDrawing(session))} />
        <CanvasButton glyph={PencilSimpleIcon} label="Start fresh" showLabel disabled={busy || saving} style={styles.option}
          onPress={() => router.replace({ pathname: '/draw/[id]', params: { id: session.source.drawingId, sessionId, fresh: '1' } })} />
        <CanvasButton glyph={DownloadSimpleIcon} label={saving ? 'Saving…' : 'Save to Photos'} showLabel disabled={busy || saving} style={styles.option}
          onPress={() => void saveToPhotos(session)} />
        <HoldButton glyph={TrashIcon} label="Delete" disabled={busy || saving} onConfirm={() => void change(() => deleteDrawing(sessionId))} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: theme.space.lg, paddingTop: theme.space.xl, gap: theme.space.xs },
  option: { backgroundColor: theme.colors.background, justifyContent: 'flex-start' },
})
