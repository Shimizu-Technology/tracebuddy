import { useEffect, useRef, useState } from 'react'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams, useNavigation } from 'expo-router'
import { usePreventRemove } from 'expo-router/react-navigation'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated'

import { keepsakeStamps, toggleStamp } from '../../../../shared/finishFind'
import { KeepsakeStampIcon } from '../../../KeepsakeStamp'
import type { KeepsakeStamp } from '../../../finishFindModel'
import type { SavedPracticeSession } from '../../../practiceStorageModel'
import { readDrawing, saveDrawing } from '../../data/drawingLibrary'
import { Button } from '../../ui/Button'
import { CanvasButton } from '../../ui/CanvasButton'
import { Icon } from '../../ui/Icon'
import { DownloadSimpleIcon, SparkleIcon } from '../../ui/icons'
import { PressTarget } from '../../ui/PressTarget'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { useReduceMotion } from '../../ui/useReduceMotion'
import { usePhotoExport } from '../draw/usePhotoExport'
import { DrawingThumbnail } from '../drawings/DrawingThumbnail'

const celebration = FadeInDown.duration(260).reduceMotion(ReduceMotion.System)

export default function DoneSheet() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const [session, setSession] = useState<SavedPracticeSession | null>()
  const hapticPlayed = useRef(false)

  useEffect(() => {
    let active = true
    void readDrawing(sessionId).then((saved) => {
      if (!active) return
      setSession(saved)
      if (saved && !hapticPlayed.current) {
        hapticPlayed.current = true
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      }
    }).catch(() => { if (active) setSession(null) })
    return () => { active = false }
  }, [sessionId])

  if (session) return <Keepsake initial={session} />
  return <View style={styles.content}>
    {session === undefined ? <ActivityIndicator color={theme.colors.ink} /> : <>
      <Text variant="heading">This drawing could not open.</Text>
      <Button label="Keep drawing" onPress={() => router.back()} />
    </>}
  </View>
}

function Keepsake({ initial }: { initial: SavedPracticeSession }) {
  const [session, setSession] = useState(initial)
  const [stamping, setStamping] = useState(false)
  const stampWrite = useRef<Promise<boolean> | null>(null)
  const navigation = useNavigation()
  const { saveToPhotos, saving, captureView } = usePhotoExport()
  const reduceMotion = useReduceMotion()
  const { width, height, fontScale } = useWindowDimensions()
  const stacked = fontScale >= theme.layout.stackedHeaderFontScale
  const preview = Math.min(theme.layout.keepsakePreviewMax, width - theme.space.xxl * 2, height * 0.29)

  usePreventRemove(stamping, ({ data }) => {
    void stampWrite.current?.then((saved) => { if (saved) navigation.dispatch(data.action) })
  })

  async function pickStamp(stamp: KeepsakeStamp) {
    if (stampWrite.current || saving) return
    const next = { ...session, stamp: toggleStamp(session.stamp, stamp), updatedAt: new Date().toISOString() }
    setStamping(true)
    const write = saveDrawing(next).catch(() => false)
    stampWrite.current = write
    try {
      if (await write) setSession(next)
      else Alert.alert('Could not save stamp', 'Your drawing is still saved. Try adding the stamp again.')
    } finally {
      stampWrite.current = null
      setStamping(false)
    }
  }

  return (
    <View style={styles.page}>
      {captureView}
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={reduceMotion ? undefined : celebration} style={styles.celebration}>
          <Icon glyph={SparkleIcon} />
          <Text accessibilityRole="header" variant="title" style={styles.heading}>You did it!</Text>
          <Icon glyph={SparkleIcon} />
        </Animated.View>
        <View style={styles.preview}><DrawingThumbnail side={Math.max(1, preview)} session={session} /></View>
        <View style={styles.stamps}>
          {keepsakeStamps.map(({ id, label }) => (
            <PressTarget key={id} accessibilityLabel={`${label} stamp`} selected={session.stamp === id} disabled={stamping || saving}
              onPress={() => void pickStamp(id)} style={[styles.stamp, session.stamp === id && styles.selected]}>
              <KeepsakeStampIcon stamp={id} size={theme.icon.size + theme.space.xs} />
            </PressTarget>
          ))}
        </View>
        <CanvasButton glyph={DownloadSimpleIcon} label={saving ? 'Saving…' : 'Save to Photos'} onPress={() => void saveToPhotos(session)}
          primary showLabel disabled={saving || stamping} />
        <View style={[styles.next, stacked && styles.stacked]}>
          <Button label="Keep drawing" variant="quiet" onPress={() => router.back()} style={styles.secondary} disabled={stamping} />
          <Button label="New picture" variant="quiet" onPress={() => router.dismissTo('/')} style={styles.secondary} disabled={stamping} />
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { width: '100%', maxWidth: theme.sample.maxContentWidth, alignSelf: 'center', padding: theme.space.lg, paddingTop: theme.space.xl, gap: theme.space.md },
  celebration: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space.md },
  heading: { fontFamily: theme.fontFamily[800], textAlign: 'center', flexShrink: 1 },
  preview: { alignSelf: 'center', overflow: 'hidden', borderRadius: theme.radius.tile, backgroundColor: theme.colors.surface },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.space.xs },
  stamp: { width: theme.target.child, height: theme.target.child, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.background, borderColor: theme.colors.hairline, borderWidth: theme.border.emphasis, borderRadius: theme.space.lg },
  selected: { backgroundColor: theme.pastels.peach, borderColor: theme.colors.ink },
  next: { flexDirection: 'row', gap: theme.space.sm },
  stacked: { flexDirection: 'column' },
  secondary: { flexGrow: 1, borderColor: theme.colors.hairline, borderWidth: theme.border.emphasis },
})
