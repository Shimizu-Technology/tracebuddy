import { useEffect, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, Image, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { SavedPracticeSession } from '../../../practiceStorageModel'
import { paramsForSource } from '../../data/catalog'
import { keepDrawingImages } from '../../data/drawingImageFiles'
import { readDrawing } from '../../data/drawingLibrary'
import { currentDrawingImageUri } from '../../data/drawingPhotos'
import { isPaperKeepsake } from '../../data/paperKeepsakeModel'
import type { PaperKeepsake } from '../../data/paperKeepsakeModel'
import { drawingImageUris } from '../../data/practiceImageCleanup'
import { drawingTitle } from '../../data/practiceSource'
import { Button } from '../../ui/Button'
import { CanvasButton } from '../../ui/CanvasButton'
import { DownloadSimpleIcon, XIcon } from '../../ui/icons'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { usePhotoExport } from '../draw/usePhotoExport'
import { paperTheme } from '../paper/paperTheme'

/** A photo of a drawing made On paper, shown whole, with Trace again and Save to Photos. */
export default function PaperKeepsakeScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const [session, setSession] = useState<SavedPracticeSession | null>()

  useEffect(() => {
    let active = true
    void readDrawing(sessionId).then((saved) => { if (active) setSession(saved) })
      .catch(() => { if (active) setSession(null) })
    return () => { active = false }
  }, [sessionId])

  if (session && isPaperKeepsake(session)) return <Keepsake session={session} />
  return (
    <View style={[styles.page, styles.centered]}>
      {session === undefined ? <ActivityIndicator color={paperTheme.colors.onCamera} /> : <>
        <Text variant="heading" style={styles.onDark}>This photo isn’t here anymore.</Text>
        <Button label="Go back" target="adult" onPress={() => router.back()} />
      </>}
    </View>
  )
}

function Keepsake({ session }: { session: PaperKeepsake }) {
  const insets = useSafeAreaInsets()
  const { saveToPhotos, saving, captureView } = usePhotoExport()
  const [failed, setFailed] = useState(false)
  const { width, height } = useWindowDimensions()
  // Held sideways, the buttons move beside the photo so it keeps the full height.
  const wide = width > height
  const title = drawingTitle(session)

  // Hold the photo and its picture's files while they're on screen.
  useEffect(() => {
    const release = keepDrawingImages(drawingImageUris(session))
    return () => { void release() }
  }, [session])

  return (
    <View style={[styles.page, wide && styles.wide, {
      paddingTop: insets.top + theme.space.sm,
      paddingBottom: insets.bottom + theme.space.md,
      paddingLeft: insets.left + theme.space.lg,
      paddingRight: insets.right + theme.space.lg,
    }]}>
      {captureView}
      {wide ? null : (
        <View style={styles.header}>
          <CanvasButton glyph={XIcon} label="Close" onPress={() => router.back()} style={styles.close} />
          <Text variant="heading" accessibilityRole="header" numberOfLines={2} style={[styles.onDark, styles.title]}>{title}</Text>
          <View style={styles.close} />
        </View>
      )}
      <View style={styles.photo}>
        {failed ? <Text style={[styles.onDark, styles.center]}>This photo couldn’t open.</Text> : (
          <Image source={{ uri: currentDrawingImageUri(session.paperPhoto.uri) }} resizeMode="contain" style={StyleSheet.absoluteFill}
            accessible accessibilityRole="image" accessibilityLabel={`Photo of your drawing: ${title}`} onError={() => setFailed(true)} />
        )}
      </View>
      <View style={wide ? styles.side : styles.actions}>
        {wide ? <>
          <CanvasButton glyph={XIcon} label="Close" onPress={() => router.back()} style={styles.close} />
          <Text variant="heading" accessibilityRole="header" numberOfLines={3} style={[styles.onDark, styles.sideTitle]}>{title}</Text>
        </> : null}
        <CanvasButton glyph={DownloadSimpleIcon} label={saving ? 'Saving…' : 'Save to Photos'} showLabel disabled={saving || failed}
          onPress={() => void saveToPhotos(session)} style={!wide && styles.action} />
        <Button label="Trace again" haptic accessibilityHint="Opens this picture on paper"
          onPress={() => router.push({ pathname: '/paper/[id]', params: paramsForSource(session.source) })} style={!wide && styles.action} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: paperTheme.colors.backdrop, gap: theme.space.md },
  wide: { flexDirection: 'row' },
  side: { width: paperTheme.size.sideColumn, justifyContent: 'center', gap: theme.space.md },
  sideTitle: { flex: 1, textAlignVertical: 'center' },
  centered: { alignItems: 'center', justifyContent: 'center', padding: theme.space.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.space.md },
  close: { width: theme.target.child },
  title: { flex: 1, textAlign: 'center' },
  onDark: { color: paperTheme.colors.onCamera },
  center: { textAlign: 'center' },
  photo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.md, alignSelf: 'center', width: '100%', maxWidth: paperTheme.size.cardMaxWidth },
  action: { flexGrow: 1 },
})
