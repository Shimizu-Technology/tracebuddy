import { photoDrawingName } from '../../data/practiceSource'
import { useCallback, useEffect, useRef, useState } from 'react'
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router'
import { usePreventRemove } from 'expo-router/react-navigation'
import { ActivityIndicator, Alert, AppState, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { finishAfterSave } from '../../../finishFindModel'
import type { BrushToolId, PracticeStroke, SavedPracticeSession } from '../../../practiceStorageModel'
import { paramsForSource, resolvePicture, sourceForPicture } from '../../data/catalog'
import type { PictureParams } from '../../data/catalog'
import { keepDrawingImages } from '../../data/drawingImageFiles'
import { drawingImageUris } from '../../data/practiceImageCleanup'
import { currentDrawingImageUri } from '../../data/drawingPhotos'
import { newDrawing, readDrawing } from '../../data/drawingLibrary'
import { serializeModePreference } from '../../data/localSettings'
import { writeLocalSetting } from '../../data/nativeStorage'
import { modePreferenceKey } from '../../data/storageKeys'
import { Button } from '../../ui/Button'
import { CanvasButton } from '../../ui/CanvasButton'
import { DotsThreeIcon } from '../../ui/icons'
import { PageHeader } from '../../ui/PageHeader'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { DrawingCanvas } from './DrawingCanvas'
import type { CanvasHandle } from './DrawingCanvas'
import { ColorRail, DrawTools } from './DrawTools'
import { useDrawMore } from './drawMoreState'
import { useDrawSession } from './useDrawSession'

type Params = PictureParams & { fresh?: '1' }

export default function DrawScreen() {
  const params = useLocalSearchParams<Params>()
  const { sessionId, fresh } = params
  const [loaded, setLoaded] = useState<SavedPracticeSession | null>()
  const [newSession] = useState(() => {
    const picture = resolvePicture(params)
    return picture ? newDrawing(sourceForPicture(picture)) : null
  })

  useEffect(() => {
    if (!sessionId) return
    let active = true
    void readDrawing(sessionId).then((saved) => {
      if (active) setLoaded(saved && fresh === '1' ? newDrawing(saved.source) : saved)
    }).catch(() => { if (active) setLoaded(null) })
    return () => { active = false }
  }, [fresh, sessionId])

  const initial = sessionId ? loaded : newSession
  if (initial) return <ActiveDrawing initial={initial} wasSaved={Boolean(sessionId && fresh !== '1')} params={params} />

  return <SafeAreaView style={styles.page}>
    <PageHeader title="On the screen" />
    <View style={styles.empty}>
      {initial === undefined ? <ActivityIndicator color={theme.colors.ink} /> : <>
        <Text variant="heading">This drawing could not open.</Text>
        <Button label="Go back" onPress={() => router.back()} />
      </>}
    </View>
  </SafeAreaView>
}

function ActiveDrawing({ initial, wasSaved, params }: { initial: SavedPracticeSession; wasSaved: boolean; params: Params }) {
  const { session, change, save, clear, refreshStamp, saveFailed } = useDrawSession(initial, wasSaved)
  const { setMore } = useDrawMore()
  const [busy, setBusy] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [room, setRoom] = useState({ width: 0, height: 0 })
  const running = useRef(false)
  const canvas = useRef<CanvasHandle>(null)
  const [lastBrush, setLastBrush] = useState<BrushToolId>(session.brushToolId === 'eraser' ? 'marker' : session.brushToolId)
  const navigation = useNavigation()
  const returningFromDone = useRef<string | null>(null)
  const { width, height, fontScale } = useWindowDimensions()
  const tablet = Math.min(width, height) >= theme.layout.threeColumns
  const landscape = width > height
  const floatingSheet = Platform.OS === 'ios' && Platform.isPad
  const sideTools = landscape && !moreOpen
  const portraitRail = tablet && !landscape && !moreOpen
  const side = Math.floor(Math.min(room.width, room.height))

  const { source, stickers } = session
  useEffect(() => {
    const release = keepDrawingImages(drawingImageUris({ source, stickers }))
    return () => { void release() }
  }, [source, stickers])

  useFocusEffect(useCallback(() => {
    setMoreOpen(false)
    if (returningFromDone.current) {
      void refreshStamp(returningFromDone.current)
      returningFromDone.current = null
    }
  }, [refreshStamp]))

  const flushAndSave = useCallback(async () => {
    await canvas.current?.flush()
    return save()
  }, [save])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flushAndSave()
    })
    return () => subscription.remove()
  }, [flushAndSave])

  async function transact<Result>(action: () => Promise<Result>): Promise<Result | false> {
    if (running.current) return false
    running.current = true
    setBusy(true)
    try {
      return await action()
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  function showSaveFailure() {
    Alert.alert('Could not save drawing', 'Your drawing is still open. Try saving again.')
  }

  // The canvas can hold ink that has not reached the session yet.
  usePreventRemove(true, ({ data }) => {
    if (running.current) return
    void transact(async () => {
      if (!await flushAndSave()) { showSaveFailure(); return false }
      navigation.dispatch(data.action)
      return true
    })
  })

  function openMore() {
    if (running.current || moreOpen) return
    setMore({
      guideOpacity: session.guideOpacity,
      onOpacity: (guideOpacity) => change((value) => ({ ...value, guideOpacity })),
      onFit: () => canvas.current?.fit(),
      onPaper: async () => {
        const destination = await transact(async () => {
          if (!await flushAndSave()) { showSaveFailure(); return null }
          await writeLocalSetting(modePreferenceKey, () => serializeModePreference('camera'), () => true).catch(() => undefined)
          const picture = params.sessionId ? paramsForSource(session.source) : params
          return picture.photo ? { ...picture, photo: currentDrawingImageUri(picture.photo) } : picture
        })
        return destination || null
      },
      onClear: () => transact(async () => {
        await canvas.current?.flush()
        if (!await clear()) { showSaveFailure(); return false }
        setLastBrush('marker')
        canvas.current?.fit()
        return true
      }),
    })
    setMoreOpen(true)
    router.push('/draw-more')
  }

  const addStroke = useCallback((stroke: PracticeStroke) => {
    change((value) => ({ ...value, strokes: [...value.strokes, stroke] }))
  }, [change])

  function finish() {
    void transact(async () => {
      await canvas.current?.flush()
      change((value) => ({ ...value, finishedAt: new Date().toISOString() }))
      const saved = await finishAfterSave(save, () => {
        returningFromDone.current = session.sessionId
        router.push({ pathname: '/done', params: { sessionId: session.sessionId } })
      })
      if (!saved) showSaveFailure()
      return saved
    })
  }

  const tools = (
    <DrawTools session={session} lastBrush={lastBrush} busy={busy}
      compact={!tablet || fontScale >= theme.layout.stackedHeaderFontScale} vertical={sideTools}
      onSize={(markerWidth) => change((value) => ({ ...value, markerWidth }))}
      onTool={(brushToolId) => {
        if (brushToolId !== 'eraser') setLastBrush(brushToolId)
        change((value) => ({ ...value, brushToolId }))
      }}
      onUndo={() => change((value) => value.strokes.length ? { ...value, strokes: value.strokes.slice(0, -1) } : value)}
      onDone={finish}
    />
  )
  const rail = (vertical = false) => <ColorRail selected={session.markerColor} vertical={vertical} disabled={busy} onPick={(markerColor) => {
    change((value) => ({ ...value, markerColor, brushToolId: lastBrush }))
  }} />

  return (
    <SafeAreaView style={styles.page}>
      <PageHeader title={session.source.kind === 'upload' ? photoDrawingName : session.source.drawingName} centered
        trailing={<CanvasButton glyph={DotsThreeIcon} label="More" onPress={openMore} disabled={busy || moreOpen} />} />
      {saveFailed && <Text variant="label" tone="muted" accessibilityLiveRegion="polite" style={styles.status}>Couldn’t save yet. Try Done again.</Text>}
      <View style={styles.workspace}>
        <View style={styles.canvasArea} onLayout={({ nativeEvent: { layout } }) => setRoom((current) => (current.width === layout.width && current.height === layout.height) ? current : layout)}>
          {side > 0 && <DrawingCanvas ref={canvas} side={side} session={session} disabled={busy || moreOpen} onStroke={addStroke} />}
        </View>
        {(sideTools || portraitRail) && <View style={styles.sideRail}>{rail(true)}</View>}
        {sideTools && <ScrollView style={styles.sideTools} contentContainerStyle={styles.sideToolsContent}>{tools}</ScrollView>}
      </View>
      {moreOpen ? <View style={{ height: height * (theme.sheet.drawDetent + (floatingSheet ? theme.sheet.tabletClearance : 0)) }} />
        : !sideTools && <View style={styles.bottomTools}>{!portraitRail && rail()}{tools}</View>}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  workspace: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  canvasArea: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 1 },
  status: { textAlign: 'center', paddingHorizontal: theme.space.lg },
  sideRail: { width: theme.target.child + theme.space.sm, marginRight: theme.space.sm },
  sideTools: { width: theme.target.child * 4 + theme.space.lg, flexGrow: 0 },
  sideToolsContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: theme.space.sm },
  bottomTools: { gap: theme.space.xs, paddingVertical: theme.space.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space.lg, padding: theme.space.lg },
})
