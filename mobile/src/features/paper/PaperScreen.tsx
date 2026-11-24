import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import { CameraView } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { router, useFocusEffect } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import Animated, { useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { isTraceBuddyARSupported } from '../../../modules/tracebuddy-ar/src/TraceBuddyARModule'
import { devKitEnabled } from '../../devKit'
import { keepDrawingImages } from '../../data/drawingImageFiles'
import { currentDrawingImageUri } from '../../data/drawingPhotos'
import { parentSetupSeenKey } from '../../data/storageKeys'
import { parentSetupSeenValue, parseParentSetupSeen } from '../../data/localSettings'
import { readLocalSetting, writeLocalSetting } from '../../data/nativeStorage'
import { Button } from '../../ui/Button'
import { DotsThreeIcon } from '../../ui/icons'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { useReduceMotion } from '../../ui/useReduceMotion'
import { BottomCard } from './BottomCard'
import { Celebration } from './Celebration'
import { FadeSlider } from './FadeSlider'
import { GuideLayer } from './GuideLayer'
import { LockBadge } from './LockBadge'
import { MoreContent } from './MoreSheet'
import { BottomBar, Pill, TopBar } from './PaperControls'
import { clampCenterOffset, fitArt, fitPage, screenOrientation, sheetCover } from './paperModel'
import { drawOnScreenInstead, openStickToPaper } from './paperNavigation'
import { paperStore, usePaperOptions } from './paperStore'
import type { PaperRequest } from './paperStore'
import { paperTheme } from './paperTheme'
import { PermissionCard } from './PermissionCard'
import { resolvePaperPicture } from './paperPicture'
import type { PaperParams, PaperPicture } from './paperPicture'
import { TableStandIn } from './TableStandIn'
import { TipsCard } from './TipsCard'
import { useCameraAccess } from './useCameraAccess'
import { useChildModeGuard } from './useChildModeGuard'
import { useRememberedSetup } from './useRememberedSetup'
import { useSceneLift } from './useSceneLift'

const keepAwakeTag = 'tracebuddy-paper'
const barHeight = paperTheme.size.lockButton + theme.space.xxl + theme.space.xl

export function PaperScreen({ params }: { params: PaperParams }) {
  const picture = useMemo(() => resolvePaperPicture(params, currentDrawingImageUri), [params])
  if (!picture) return <MissingPicture />
  return <PaperSession key={picture.key} picture={picture} params={params} />
}

function MissingPicture() {
  return (
    <View style={styles.missing}>
      <Text variant="heading" style={styles.centerText}>This picture isn’t here anymore.</Text>
      <Button label="Pick a picture" target="adult" onPress={() => router.dismissTo('/')} />
    </View>
  )
}

function PaperSession({ picture, params }: { picture: PaperPicture; params: PaperParams }) {
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const reduceMotion = useReduceMotion()
  const options = usePaperOptions()
  const cameraRef = useRef<CameraView>(null)
  const camera = useCameraAccess(cameraRef)
  const { restart: restartCamera } = camera
  const [arSupported] = useState(() => Platform.OS === 'ios' && isTraceBuddyARSupported())
  // Stick to paper runs its own AR camera session, so this screen lets go of the camera first.
  const [handedOff, setHandedOff] = useState(false)
  const handoff = useRef<'none' | 'waiting' | 'open'>('none')
  const [locked, setLocked] = useState(false)
  const [tips, setTips] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [moreCard, setMoreCard] = useState(false)

  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const scale = useSharedValue(1)
  const rotation = useSharedValue(0)
  const opacity = useSharedValue<number>(paperTheme.fade.initial)
  const gestureActive = useSharedValue(0)
  const values = useMemo(() => ({ x, y, scale, rotation, opacity }), [opacity, rotation, scale, x, y])

  // Layout: the page sits in the space between the top buttons and the bottom bar.
  const orientation = screenOrientation(window)
  const stage = useMemo(() => ({ width: window.width, height: window.height }), [window.width, window.height])
  const topLimit = insets.top + theme.space.md + paperTheme.size.topButton
  const bottomLimit = window.height - insets.bottom - barHeight
  const center = useMemo(() => ({ x: window.width / 2, y: (topLimit + bottomLimit) / 2 }), [bottomLimit, topLimit, window.width])
  // 1.x setups had no page orientation, so they convert against the tall page.
  const geometry = useMemo(() => ({ stage, rest: center, artWidth: fitArt(fitPage(stage, 'portrait')).width }), [center, stage])
  const setup = useRememberedSetup(orientation, values, geometry, locked)
  const page = useMemo(() => fitPage(stage, setup.page), [setup.page, stage])

  const showGuide = camera.cameraOn && !handedOff && setup.hydrated
  const controls = showGuide && !locked && !done
  // Child mode keeps the locked alignment through a turn of the device, and hides it until the device turns back.
  const turnedAway = locked && !setup.hydrated

  // Keep a photo's file while it is being traced, as the Picture sheet and Draw do.
  const photoUri = picture.kind === 'photo' ? picture.picture.uploadedImage?.uri : undefined
  useEffect(() => {
    if (!photoUri) return undefined
    const release = keepDrawingImages([photoUri])
    return () => { void release() }
  }, [photoUri])

  useEffect(() => paperStore.startPicture({ canUseLightLines: picture.kind === 'drawing', stickAvailable: arSupported }), [arSupported, picture.kind])

  useEffect(() => {
    void activateKeepAwakeAsync(keepAwakeTag).catch(() => undefined)
    return () => { void deactivateKeepAwake(keepAwakeTag).catch(() => undefined) }
  }, [])

  useChildModeGuard(locked, useCallback(() => setToast('Hold the lock to unlock first'), []))

  // Coming back from Stick to paper, this screen owns the camera again. Closing More on the way there doesn't count.
  useFocusEffect(useCallback(() => {
    if (handoff.current === 'waiting') return
    if (handoff.current === 'open') restartCamera()
    handoff.current = 'none'
    setHandedOff(false)
  }, [restartCamera]))

  // First time only, once the camera can show the paper.
  useEffect(() => {
    if (!camera.cameraOn) return undefined
    let active = true
    void readLocalSetting(parentSetupSeenKey).then((raw) => { if (active && !parseParentSetupSeen(raw)) setTips(true) }).catch(() => undefined)
    return () => { active = false }
  }, [camera.cameraOn])

  useEffect(() => {
    if (!hint) return undefined
    const hide = setTimeout(() => setHint(false), paperTheme.timing.hintMs)
    return () => clearTimeout(hide)
  }, [hint])

  useEffect(() => {
    if (!toast) return undefined
    const hide = setTimeout(() => setToast(null), paperTheme.timing.toastMs)
    return () => clearTimeout(hide)
  }, [toast])

  const closeTips = useCallback(() => {
    setTips(false)
    void writeLocalSetting(parentSetupSeenKey, () => parentSetupSeenValue, () => true).catch(() => undefined)
  }, [])

  const { persist, recenter } = setup
  const onRequest = useCallback((request: PaperRequest) => {
    if (request === 'tips') setTips(true)
    if (request === 'center') recenter()
    if (request !== 'stick') return
    // Let go of the camera, wait for the More sheet to close and the camera session to stop, then open AR.
    handoff.current = 'waiting'
    setHandedOff(true)
    const open = () => setTimeout(() => {
      handoff.current = 'open'
      openStickToPaper(params)
    }, paperTheme.timing.cameraHandoffMs)
    if (!paperStore.get().sheetOpen) {
      open()
      return
    }
    const stop = paperStore.subscribe(() => {
      if (paperStore.get().sheetOpen) return
      stop()
      open()
    })
  }, [params, recenter])

  const hideHint = useCallback(() => setHint(false), [])

  // iPad floats native form sheets mid-screen, and a 40% sheet is tiny on a phone held sideways, so those
  // show More as a bottom card instead. Its measured height drives the same lift.
  const cardSheets = Platform.OS === 'ios' && (Platform.isPad || orientation === 'landscape')
  const openMore = useCallback(() => {
    if (!cardSheets) {
      router.push('/paper/more')
      return
    }
    paperStore.set({ sheetOpen: true })
    setMoreCard(true)
  }, [cardSheets])
  const closeMore = useCallback(() => {
    paperStore.set({ sheetOpen: false, sheetTop: null })
    setMoreCard(false)
  }, [])
  const cardBottom = insets.bottom + theme.space.sm
  const onMoreHeight = useCallback((height: number) => paperStore.set({ sheetTop: stage.height - cardBottom - height }), [cardBottom, stage.height])

  useEffect(() => paperStore.connect({
    nudge: (dx, dy) => {
      const next = clampCenterOffset({ x: values.x.get() + dx, y: values.y.get() + dy }, center, stage)
      values.x.set(next.x)
      values.y.set(next.y)
      persist()
    },
    request: onRequest,
  }), [center, onRequest, persist, stage, values])

  const sceneStyle = useSceneLift({
    open: options.sheetOpen,
    cover: sheetCover(stage.height, options.sheetTop),
    values,
    gestureActive,
    rest: center,
    page,
    stage,
    topLimit,
    reduceMotion,
  })

  const lock = useCallback(() => {
    // Child mode starts only over a camera that is showing the paper (or the Simulator's stand-in).
    if (!camera.cameraReady) {
      setToast('Wait for the camera, then lock')
      return
    }
    paperStore.set({ sheetOpen: false, sheetTop: null })
    setMoreCard(false)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    setHint(false)
    setLocked(true)
    setToast('Locked. Time to trace!')
  }, [camera.cameraReady])

  // Dev kit only: shortly after Lock, `fault=camera` makes the camera fail and `fault=leave` tries to navigate
  // back, to check child mode stays sealed.
  const fault = devKitEnabled ? params.fault : undefined
  const { onMountError } = camera
  useEffect(() => {
    if (!fault || !locked) return undefined
    const fail = setTimeout(() => {
      if (fault === 'camera') onMountError()
      if (fault === 'leave') router.back()
    }, paperTheme.timing.toastMs)
    return () => clearTimeout(fail)
  }, [fault, locked, onMountError])

  const unlock = useCallback(() => {
    setLocked(false)
    setToast('Unlocked')
  }, [])

  const sides = { left: insets.left + theme.space.lg, right: insets.right + theme.space.lg }
  const faderHeight = Math.min(paperTheme.size.fader.maxHeight, window.height * paperTheme.size.fader.heightFraction)
  const cameraShown = camera.cameraOn && !handedOff

  return (
    // Full screen over the Picture sheet and Home: VoiceOver stays on this screen too.
    <View style={styles.screen} accessibilityViewIsModal>
      <StatusBar style="light" hidden={locked} animated />
      <Animated.View style={[StyleSheet.absoluteFill, sceneStyle]}>
        {cameraShown && camera.camera === 'none' ? <TableStandIn stage={stage} page={page} center={center} /> : null}
        {cameraShown && camera.camera !== 'none' ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            autofocus="on"
            onCameraReady={camera.onCameraReady}
            onMountError={camera.onMountError}
          />
        ) : null}
        {showGuide && !turnedAway ? (
          <GuideLayer
            picture={picture}
            values={values}
            page={page}
            center={center}
            stage={stage}
            locked={locked}
            lightLines={options.lightLines && picture.kind === 'drawing'}
            mirror={options.mirror}
            reduceMotion={reduceMotion}
            layoutKey={setup.layoutKey}
            gestureActive={gestureActive}
            onGestureStart={hideHint}
            onGestureEnd={persist}
          />
        ) : null}
      </Animated.View>

      {/* Nothing that leads away is on screen in child mode, even if the camera stops. */}
      {!locked && (controls || !camera.cameraOn) ? (
        <TopBar
          top={insets.top + theme.space.sm}
          {...sides}
          onClose={() => router.back()}
          action={controls ? { glyph: DotsThreeIcon, label: 'More options', onPress: openMore } : undefined}
        />
      ) : null}
      {controls && hint ? <Pill text="Pinch to resize · twist to turn" style={[styles.absolute, { top: topLimit + theme.space.sm }]} /> : null}
      {turnedAway ? <Pill text="Turn the device back to keep tracing" style={[styles.absolute, { top: insets.top + theme.space.xl }]} /> : null}
      {locked && !camera.cameraOn ? <Pill text="The camera stopped. Ask a grown-up to unlock." style={[styles.absolute, { top: insets.top + theme.space.xl }]} /> : null}
      {controls ? (
        <FadeSlider
          opacity={opacity}
          syncKey={setup.layoutKey}
          onChangeEnd={persist}
          style={[styles.absolute, { right: insets.right + theme.space.md, top: center.y - faderHeight / 2, height: faderHeight }]}
        />
      ) : null}
      {controls ? (
        <BottomBar
          bottom={insets.bottom + theme.space.md}
          {...sides}
          page={setup.page}
          lockDimmed={!camera.cameraReady}
          onPage={() => {
            setup.changePage(setup.page === 'portrait' ? 'landscape' : 'portrait')
            setToast(setup.page === 'portrait' ? 'Wide page' : 'Tall page')
          }}
          onLock={lock}
          onDone={() => setDone(true)}
        />
      ) : null}

      {toast ? <Pill text={toast} style={[styles.absolute, { bottom: insets.bottom + barHeight }]} /> : null}
      {locked ? <LockBadge onUnlock={unlock} style={[styles.absolute, { right: insets.right + theme.space.lg, bottom: insets.bottom + theme.space.lg }]} /> : null}

      {!locked && camera.access ? (
        <PermissionCard
          access={camera.access}
          reduceMotion={reduceMotion}
          onAllow={camera.retry}
          onOpenSettings={camera.openSettings}
          onDrawOnScreen={() => drawOnScreenInstead(params)}
        />
      ) : null}
      {moreCard && controls ? (
        <BottomCard reduceMotion={reduceMotion} onDismiss={closeMore} onHeight={onMoreHeight} accessibilityLabel="More options">
          <MoreContent onClose={closeMore} />
        </BottomCard>
      ) : null}
      {tips && controls && !moreCard ? <TipsCard reduceMotion={reduceMotion} onClose={closeTips} /> : null}
      {done ? (
        <Celebration
          picture={picture}
          reduceMotion={reduceMotion}
          onKeepTracing={() => setDone(false)}
          onNewPicture={() => router.dismissTo('/')}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: paperTheme.colors.backdrop, overflow: 'hidden' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space.lg, padding: theme.space.xl, backgroundColor: theme.colors.background },
  centerText: { textAlign: 'center' },
  absolute: { position: 'absolute' },
})
