import { photoDrawingName } from '../../data/practiceSource'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Redirect, router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router'
import { usePreventRemove } from 'expo-router/react-navigation'
import { Alert, AppState, BackHandler, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import { finishAfterSave } from '../../../finishFindModel'
import type { BrushToolId, PracticeStroke, SavedPracticeSession } from '../../../practiceStorageModel'
import { lineForSource, paramsForSource, resolvePicture, sourceForPicture } from '../../data/catalog'
import type { Picture, PictureParams } from '../../data/catalog'
import { keepDrawingImages } from '../../data/drawingImageFiles'
import { drawingImageUris } from '../../data/practiceImageCleanup'
import { currentDrawingImageUri } from '../../data/drawingPhotos'
import { newDrawing, readDrawing } from '../../data/drawingLibrary'
import { serializeModePreference } from '../../data/localSettings'
import { writeLocalSetting } from '../../data/nativeStorage'
import { modePreferenceKey } from '../../data/storageKeys'
import { usePictureLine } from '../../data/usePictureLine'
import { Button } from '../../ui/Button'
import { CanvasButton } from '../../ui/CanvasButton'
import { ArrowClockwiseIcon, DotsThreeIcon } from '../../ui/icons'
import { PageHeader } from '../../ui/PageHeader'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { lessonDestination, lessonForSession } from '../learn/lessonPractice'
import { PictureLineFeedback } from '../picture/PictureLineFeedback'
import { selectedCrayon } from './crayonShades'
import { DrawingCanvas } from './DrawingCanvas'
import type { CanvasHandle } from './DrawingCanvas'
import { BrushTray, ShadeFan } from './DrawingPickers'
import { ColorRail, DrawTools } from './DrawTools'
import { useDrawMore } from './drawMoreState'
import { supportsFill } from './fillGuide'
import { useDrawSession } from './useDrawSession'

type Params = PictureParams & { fresh?: '1' }
type Picker = { kind: 'brushes' } | { kind: 'shades'; index: number; x: number }
const sideToolsWidth = theme.target.child * 4 + theme.space.lg

export default function DrawScreen() {
  const params = useLocalSearchParams<Params>()
  const { sessionId, fresh } = params
  const [loaded, setLoaded] = useState<SavedPracticeSession | null>()
  const [picture] = useState(() => sessionId ? null : resolvePicture(params))
  const line = usePictureLine(sessionId && loaded ? { line: lineForSource(loaded.source) } : picture)

  useEffect(() => {
    if (!sessionId) return
    let active = true
    void readDrawing(sessionId).then((saved) => {
      if (active) setLoaded(saved && fresh === '1' ? newDrawing(saved.source) : saved)
    }).catch(() => { if (active) setLoaded(null) })
    return () => { active = false }
  }, [fresh, sessionId])

  const lesson = sessionId && lessonForSession(sessionId)
  if (lesson && loaded && fresh !== '1' && !loaded.lessonFinished) {
    return <Redirect href={lessonDestination(lesson)} />
  }

  if (line.status === 'ready') {
    if (sessionId && loaded) return <ActiveDrawing key={loaded.sessionId} initial={loaded} guideSvg={line.xml} wasSaved={fresh !== '1'} params={params} />
    if (picture) return <NewDrawing picture={picture} guideSvg={line.xml} params={params} />
  }

  const loading = line.status === 'loading' || Boolean(sessionId && loaded === undefined)
  return <SafeAreaView style={styles.page}>
    <PageHeader title="On the screen" />
    <View style={styles.empty}>
      {loading ? <PictureLineFeedback status="loading" /> : <>
        <Text variant="heading">This drawing could not open.</Text>
        <Button label="Go back" onPress={() => router.back()} />
      </>}
    </View>
  </SafeAreaView>
}

function NewDrawing({ picture, guideSvg, params }: { picture: Picture; guideSvg: string; params: Params }) {
  const [initial] = useState(() => newDrawing(sourceForPicture(picture, guideSvg)))
  return <ActiveDrawing initial={initial} guideSvg={guideSvg} wasSaved={false} params={params} />
}

function ActiveDrawing({ initial, guideSvg, wasSaved, params }: { initial: SavedPracticeSession; guideSvg: string; wasSaved: boolean; params: Params }) {
  const { session, change, save, clear, refreshStamp, saveFailed } = useDrawSession(initial, wasSaved)
  const { setMore } = useDrawMore()
  const [busy, setBusy] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [picker, setPicker] = useState<Picker | null>(null)
  const [toolbarHeight, setToolbarHeight] = useState(0)
  const [fillHint, setFillHint] = useState<string | null>(null)
  const [missingPhoto, setMissingPhoto] = useState(false)
  const [colorChoices, setColorChoices] = useState<Record<number, string>>(() => ({
    [selectedCrayon(initial.markerColor)]: initial.markerColor,
  }))
  const [room, setRoom] = useState({ width: 0, height: 0 })
  const running = useRef(false)
  const canvas = useRef<CanvasHandle>(null)
  const [lastBrush, setLastBrush] = useState<BrushToolId>(session.brushToolId === 'eraser' ? 'marker' : session.brushToolId)
  const navigation = useNavigation()
  const returningFromDone = useRef<string | null>(null)
  const { width, height, fontScale } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const tablet = Math.min(width, height) >= theme.layout.threeColumns
  const landscape = width > height
  const floatingSheet = Platform.OS === 'ios' && Platform.isPad
  const sideTools = landscape && !moreOpen
  const portraitRail = tablet && !landscape && !moreOpen
  const side = Math.floor(Math.min(room.width, room.height))

  const { source, stickers } = session
  const showMissingPhoto = useCallback(() => setMissingPhoto(true), [])
  const fillAvailable = supportsFill(guideSvg, source.kind === 'upload')
  const dismissPicker = useCallback(() => setPicker(null), [])
  const swipePicker = Gesture.Pan().activeOffsetY(theme.space.lg).failOffsetX([-theme.space.xl, theme.space.xl])
    .onEnd(({ translationY }) => {
      if (translationY >= theme.space.xl) scheduleOnRN(dismissPicker)
    })
  // Android Back closes an open tray or shade fan before it can leave the drawing.
  useEffect(() => {
    if (!picker) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissPicker()
      return true
    })
    return () => subscription.remove()
  }, [dismissPicker, picker])
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
        setFillHint(null)
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

  function pickTool(brushToolId: BrushToolId) {
    setPicker(null)
    setFillHint(null)
    if (brushToolId !== 'eraser') setLastBrush(brushToolId)
    change((value) => ({ ...value, brushToolId }))
  }

  function pickColor(markerColor: string) {
    setPicker(null)
    change((value) => ({ ...value, markerColor, brushToolId: lastBrush }))
  }

  const tools = (
    <DrawTools session={session} lastBrush={lastBrush} busy={busy}
      compact={!tablet || fontScale >= theme.layout.stackedHeaderFontScale} vertical={sideTools}
      onBrushTray={() => setPicker({ kind: 'brushes' })}
      onSize={(markerWidth) => change((value) => ({ ...value, markerWidth }))}
      onTool={pickTool}
      onUndo={() => change((value) => value.strokes.length ? { ...value, strokes: value.strokes.slice(0, -1) } : value)}
      onDone={finish}
    />
  )
  const rail = (vertical = false) => <ColorRail selected={session.markerColor} choices={colorChoices} vertical={vertical} disabled={busy}
    erasing={session.brushToolId === 'eraser'} onPick={pickColor} onShades={(index, x) => setPicker({ kind: 'shades', index, x })} />
  const pickerWidth = width - insets.left - insets.right - (sideTools ? sideToolsWidth + theme.space.xs : 0)

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content} accessibilityElementsHidden={Boolean(picker)}
        importantForAccessibility={picker ? 'no-hide-descendants' : 'auto'}>
        <PageHeader title={session.source.kind === 'upload' ? photoDrawingName : session.source.drawingName} centered
          trailing={<View style={styles.headerActions}>
            <CanvasButton glyph={ArrowClockwiseIcon} label="Turn picture" haptic onPress={() => canvas.current?.turn()} disabled={busy || moreOpen} />
            <CanvasButton glyph={DotsThreeIcon} label="More" onPress={openMore} disabled={busy || moreOpen} />
          </View>} />
        {saveFailed && <Text variant="label" tone="muted" accessibilityLiveRegion="polite" style={styles.status}>Couldn’t save yet. Try Done again.</Text>}
        {missingPhoto && <Text variant="label" tone="muted" accessibilityLiveRegion="polite" style={styles.status}>A photo could not open. You can still keep drawing.</Text>}
        {fillHint && <Text variant="label" tone="muted" accessibilityLiveRegion="polite" style={styles.status}>{fillHint}</Text>}
        <View style={styles.workspace}>
          <View style={styles.canvasArea} onLayout={({ nativeEvent: { layout } }) => setRoom((current) => (current.width === layout.width && current.height === layout.height) ? current : layout)}>
            {side > 0 && <DrawingCanvas ref={canvas} area={room} side={side} session={session} guideSvg={guideSvg}
              disabled={busy || moreOpen || Boolean(picker)} onStroke={addStroke} onFillHint={setFillHint} onImageError={showMissingPhoto} />}
          </View>
          {(sideTools || portraitRail) && <View style={styles.sideRail}>{rail(true)}</View>}
          {sideTools && <ScrollView style={styles.sideTools} contentContainerStyle={styles.sideToolsContent}>{tools}</ScrollView>}
        </View>
        {moreOpen ? <View style={{ height: height * (theme.sheet.drawDetent + (floatingSheet ? theme.sheet.tabletClearance : 0)) }} />
          : !sideTools && <View style={styles.bottomTools} onLayout={({ nativeEvent }) => setToolbarHeight(nativeEvent.layout.height)}>
              {!portraitRail && rail()}{tools}
            </View>}
      </View>
      {picker && (
        <View style={[styles.overlay, { top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right }]}
          accessibilityViewIsModal onAccessibilityEscape={dismissPicker}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close picker" onPress={dismissPicker} />
          <View pointerEvents="box-none" style={[styles.picker, sideTools ? styles.pickerBesideTools : { bottom: toolbarHeight + theme.space.xs }]}>
            <GestureDetector gesture={swipePicker}>
              <View pointerEvents="box-none">
                {picker.kind === 'brushes'
                  ? <BrushTray selected={session.brushToolId} fillAvailable={fillAvailable} alignRight={sideTools} onPick={pickTool} />
                  : <ShadeFan selected={session.markerColor} index={picker.index} anchorX={picker.x - insets.left}
                      width={pickerWidth} onPick={(color) => {
                        setColorChoices((choices) => ({ ...choices, [picker.index]: color }))
                        pickColor(color)
                      }} />}
              </View>
            </GestureDetector>
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { flex: 1 },
  workspace: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  canvasArea: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 1 },
  headerActions: { flexDirection: 'row', gap: theme.space.sm },
  status: { textAlign: 'center', paddingHorizontal: theme.space.lg },
  sideRail: { width: theme.target.child + theme.space.sm, marginRight: theme.space.sm },
  sideTools: { width: sideToolsWidth, flexGrow: 0 },
  sideToolsContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: theme.space.sm },
  bottomTools: { gap: theme.space.xs, paddingVertical: theme.space.xs },
  overlay: { ...StyleSheet.absoluteFill, zIndex: 1 },
  picker: { position: 'absolute', left: 0, right: 0 },
  pickerBesideTools: { top: 0, bottom: 0, right: sideToolsWidth + theme.space.xs, justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space.lg, padding: theme.space.lg },
})
