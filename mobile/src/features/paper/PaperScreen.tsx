import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, BackHandler, Image, Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import { CameraView } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { router, useNavigation } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import Animated, { useSharedValue } from 'react-native-reanimated'
import { captureRef } from 'react-native-view-shot'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { isTraceBuddyARSupported } from '../../../modules/tracebuddy-ar/src/TraceBuddyARModule'
import { devKitEnabled } from '../../devKit'
import { currentDrawingImageUri } from '../../data/drawingPhotos'
import { discardPaperShot, savePaperKeepsake } from '../../data/paperKeepsake'
import type { PaperShot } from '../../data/paperKeepsake'
import { parentSetupSeenKey } from '../../data/storageKeys'
import { parentSetupSeenValue, parseParentSetupSeen } from '../../data/localSettings'
import { readLocalSetting, writeLocalSetting } from '../../data/nativeStorage'
import { usePictureLine } from '../../data/usePictureLine'
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
import type { ScreenOrientation } from './paperModel'
import { canDrawInstead, canStickToPaper, drawOnScreenInstead } from './paperNavigation'
import { paperStore, usePaperOptions } from './paperStore'
import type { PaperRequest } from './paperStore'
import { paperTheme } from './paperTheme'
import { PermissionCard } from './PermissionCard'
import { resolvePaperPicture } from './paperPicture'
import type { PaperParams, PaperPicture } from './paperPicture'
import { SnapAim, SnapReview } from './SnapPhoto'
import { TableStandIn } from './TableStandIn'
import { TipsCard } from './TipsCard'
import { useCameraAccess } from './useCameraAccess'
import { useChildModeGuard } from './useChildModeGuard'
import { usePhotoLease } from './usePhotoLease'
import { useRememberedSetup } from './useRememberedSetup'
import { useSceneLift } from './useSceneLift'
import { useStickHandoff } from './useStickHandoff'

const keepAwakeTag = 'tracebuddy-paper'
const barHeight = paperTheme.size.lockButton + theme.space.xxl + theme.space.xl

/** Snap your drawing: aiming with the live camera, then the photo just taken. */
type Snap = { step: 'aim' } | { step: 'review'; shot: PaperShot }

function imageSize(uri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => Image.getSize(uri, (width, height) => resolve({ width, height }), reject))
}

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
  const line = usePictureLine(picture.picture)
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const reduceMotion = useReduceMotion()
  const options = usePaperOptions()
  const cameraRef = useRef<CameraView>(null)
  const camera = useCameraAccess(cameraRef)
  const { restart: restartCamera } = camera
  const navigation = useNavigation()
  const [arSupported] = useState(() => Platform.OS === 'ios' && isTraceBuddyARSupported())
  // This screen's identity for the app-wide child-mode flag.
  const [owner] = useState(() => ({}))
  const [locked, setLocked] = useState(false)
  const [tips, setTips] = useState(false)
  const [done, setDone] = useState(false)
  const [snap, setSnap] = useState<Snap | null>(null)
  const [snapBusy, setSnapBusy] = useState(false)
  // A photo was kept this visit, and the well-done card has been shown once already.
  const [kept, setKept] = useState(false)
  const [celebrated, setCelebrated] = useState(false)
  const standInRef = useRef<View>(null)
  const pendingShot = useRef<PaperShot | null>(null)
  // A capture or save is running (set synchronously, so a second tap can't start another), and the current
  // capture attempt. Back, losing the camera and closing the screen start a new attempt number, so a photo
  // that arrives late for an older attempt is deleted instead of opening review.
  const snapWorking = useRef(false)
  const captureAttempt = useRef(0)
  const [hint, setHint] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  // More as a bottom card. Any turn of the device closes it for good (it doesn't come back on turning back).
  const [moreCard, setMoreCard] = useState(false)
  const [moreTurn, setMoreTurn] = useState<ScreenOrientation | null>(null)

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
  const pageRoom = bottomLimit - topLimit
  const geometry = useMemo(() => ({ stage, rest: center, artWidth: fitArt(fitPage(stage, 'portrait', pageRoom)).width }), [center, pageRoom, stage])
  const setup = useRememberedSetup(orientation, values, geometry, locked)
  const page = useMemo(() => fitPage(stage, setup.page, pageRoom), [pageRoom, setup.page, stage])

  // Keep a photo's file while it is being traced, taking over the Picture sheet's hand-off.
  const photoUri = picture.kind === 'photo' ? picture.picture.uploadedImage?.uri : undefined
  usePhotoLease(photoUri)
  const stick = useStickHandoff(params, photoUri, restartCamera)
  const { handedOff } = stick

  // The guide is hidden while snapping, so the photo is just the child's drawing.
  const showGuide = camera.cameraOn && !handedOff && setup.hydrated && !snap
  const controls = showGuide && line.status === 'ready' && !locked && !done
  // Child mode keeps the locked alignment through a turn of the device, and hides it until the device turns back.
  const turnedAway = locked && !setup.hydrated

  useEffect(() => paperStore.startPicture({ canUseLightLines: picture.kind === 'drawing', stickAvailable: canStickToPaper && arSupported }), [arSupported, picture.kind])

  useEffect(() => {
    void activateKeepAwakeAsync(keepAwakeTag).catch(() => undefined)
    return () => { void deactivateKeepAwake(keepAwakeTag).catch(() => undefined) }
  }, [])

  const setChildMode = useChildModeGuard(owner, locked, useCallback(() => setToast('Hold the lock to unlock first'), []))

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

  const { persist, recenter, markDirty } = setup
  const { start: startStick } = stick
  const onRequest = useCallback((request: PaperRequest) => {
    if (request === 'tips') setTips(true)
    if (request === 'center') recenter()
    if (request === 'stick') startStick()
  }, [recenter, startStick])

  // A gesture in progress is an unsaved edit: a flush now (background, exit, turn) must save it.
  const onGestureStart = useCallback(() => {
    setHint(false)
    markDirty()
  }, [markDirty])

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
  if (moreTurn !== orientation) {
    setMoreTurn(orientation)
    if (moreCard) setMoreCard(false)
  }
  const moreCardOpen = moreCard

  // Turning the device with More open closes it: the sheet or card that fit the old orientation doesn't fit
  // the new one, and the guide must not end up under it. More opens again in the right form.
  const moreOrientation = useRef(orientation)
  useEffect(() => {
    if (moreOrientation.current === orientation) return
    moreOrientation.current = orientation
    if (!paperStore.get().sheetOpen) return
    paperStore.set({ sheetOpen: false, sheetTop: null })
    if (navigation.isFocused()) return
    // The native sheet is the focused route over this screen: dismiss it.
    if (router.canGoBack()) router.back()
  }, [navigation, orientation])
  const cardBottom = insets.bottom + theme.space.sm
  const onMoreHeight = useCallback((height: number) => paperStore.set({ sheetTop: stage.height - cardBottom - height }), [cardBottom, stage.height])

  useEffect(() => paperStore.connect({
    nudge: (dx, dy) => {
      if (locked) return
      const next = clampCenterOffset({ x: values.x.get() + dx, y: values.y.get() + dy }, center, stage)
      values.x.set(next.x)
      values.y.set(next.y)
      persist()
    },
    request: onRequest,
  }), [center, locked, onRequest, persist, stage, values])

  const { style: sceneStyle, band } = useSceneLift({
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
    // Arm child mode here, in the same handler, before the locked UI renders: the flag (navigation is refused
    // from now on) and the swipe-back settings go in the same commit as the lock.
    setChildMode(true)
    paperStore.set({ sheetOpen: false, sheetTop: null })
    setMoreCard(false)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    setHint(false)
    setLocked(true)
    setToast('Locked. Time to trace!')
  }, [camera.cameraReady, setChildMode])

  // Dev kit only: shortly after Lock, `fault=camera` makes the camera fail, `fault=leave` tries to navigate back
  // and `fault=push` pushes another screen over it, to check child mode stays sealed.
  const fault = devKitEnabled ? params.fault : undefined
  const { onMountError } = camera
  useEffect(() => {
    if (!fault || !locked) return undefined
    const fail = setTimeout(() => {
      if (fault === 'camera') onMountError()
      if (fault === 'leave') router.back()
      if (fault === 'push') router.push('/dev/kit')
    }, paperTheme.timing.toastMs)
    return () => clearTimeout(fail)
  }, [fault, locked, onMountError])

  const unlock = useCallback(() => {
    setChildMode(false)
    setLocked(false)
    setToast('Unlocked')
  }, [setChildMode])

  const finishCelebration = useCallback((next: () => void) => {
    setDone(false)
    setCelebrated(false)
    setKept(false)
    next()
  }, [])

  // A photo that wasn't kept is deleted from the cache when it's retaken or the screen closes.
  const dropShot = useCallback(() => {
    if (pendingShot.current) void discardPaperShot(pendingShot.current)
    pendingShot.current = null
  }, [])
  useEffect(() => () => {
    captureAttempt.current += 1
    dropShot()
  }, [dropShot])

  const cameraLost = !camera.cameraOn || Boolean(camera.access)
  useEffect(() => {
    if (cameraLost) captureAttempt.current += 1
  }, [cameraLost])

  const leaveSnap = useCallback(() => {
    captureAttempt.current += 1
    dropShot()
    setCelebrated(true)
    setSnap(null)
  }, [dropShot])

  // Android Back steps out of snapping instead of leaving On paper, like a picker in Draw.
  useEffect(() => {
    if (!snap) return undefined
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (snap.step === 'review' && !snapBusy) {
        dropShot()
        setSnap({ step: 'aim' })
      } else if (snap.step === 'aim') leaveSnap()
      return true
    })
    return () => subscription.remove()
  }, [dropShot, leaveSnap, snap, snapBusy])

  const shoot = useCallback(async () => {
    if (snapWorking.current || !camera.cameraReady) return
    snapWorking.current = true
    captureAttempt.current += 1
    const attempt = captureAttempt.current
    setSnapBusy(true)
    try {
      let shot: PaperShot
      if (camera.camera === 'none') {
        // The Simulator has no camera: the photo is of the table stand-in, so the whole flow can be tried.
        const uri = await captureRef(standInRef, { format: 'jpg', quality: 0.9, result: 'tmpfile' })
        shot = { uri, ...await imageSize(uri) }
      } else {
        const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85, exif: false })
        if (!photo) throw new Error('The camera is not ready')
        shot = { uri: photo.uri, width: photo.width, height: photo.height }
      }
      if (attempt !== captureAttempt.current) {
        void discardPaperShot(shot)
        return
      }
      pendingShot.current = shot
      setSnap({ step: 'review', shot })
    } catch {
      if (attempt === captureAttempt.current) setToast('That photo didn’t work. Try again.')
    } finally {
      snapWorking.current = false
      setSnapBusy(false)
    }
  }, [camera.camera, camera.cameraReady])

  const keepShot = useCallback(async (shot: PaperShot) => {
    if (snapWorking.current || line.status !== 'ready') return
    snapWorking.current = true
    setSnapBusy(true)
    try {
      await savePaperKeepsake(picture.picture, line.xml, shot)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      setKept(true)
      leaveSnap()
    } catch {
      Alert.alert('Couldn’t keep the photo', 'Try again in a moment.')
    } finally {
      snapWorking.current = false
      setSnapBusy(false)
    }
  }, [leaveSnap, line, picture.picture])

  const sides = { left: insets.left + theme.space.lg, right: insets.right + theme.space.lg }
  const faderHeight = Math.min(paperTheme.size.fader.maxHeight, window.height * paperTheme.size.fader.heightFraction)
  const cameraShown = camera.cameraOn && !handedOff
  const drawInstead = canDrawInstead ? () => drawOnScreenInstead(navigation, params, photoUri) : undefined

  return (
    <View style={styles.screen} accessibilityViewIsModal>
      <StatusBar style="light" hidden={locked} animated />
      <Animated.View style={[StyleSheet.absoluteFill, sceneStyle]}>
        {cameraShown && camera.camera === 'none' ? (
          <View ref={standInRef} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill}>
            <TableStandIn stage={stage} page={page} center={center} />
          </View>
        ) : null}
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
        {showGuide && !turnedAway && line.status === 'ready' ? (
          <GuideLayer
            picture={picture}
            guideSvg={line.xml}
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
            band={band}
            onGestureStart={onGestureStart}
            onGestureEnd={persist}
          />
        ) : null}
      </Animated.View>

      {/* Nothing that leads away is on screen in child mode, even if the camera stops. */}
      {!locked && (controls || !camera.cameraOn || line.status !== 'ready') ? (
        <TopBar
          top={insets.top + theme.space.sm}
          {...sides}
          onClose={() => router.back()}
          action={controls ? { glyph: DotsThreeIcon, label: 'More options', onPress: openMore } : undefined}
        />
      ) : null}
      {showGuide && line.status !== 'ready' ? <Pill text={line.status === 'loading' ? 'Getting your picture ready…' : 'This picture couldn’t open.'}
        announce style={[styles.absolute, { top: topLimit + theme.space.sm }]} /> : null}
      {controls && hint ? <Pill text="Pinch to resize · twist to turn" style={[styles.absolute, { top: topLimit + theme.space.sm }]} /> : null}
      {turnedAway ? <Pill text="Turn the device back to keep tracing" announce style={[styles.absolute, { top: insets.top + theme.space.xl }]} /> : null}
      {setup.loadFailed && !locked ? <Pill text="Couldn’t open your saved setup. Trying again…" announce style={[styles.absolute, { top: topLimit + theme.space.sm }]} /> : null}
      {locked && !camera.cameraOn ? <Pill text="The camera stopped. Ask a grown-up to unlock." announce style={[styles.absolute, { top: insets.top + theme.space.xl }]} /> : null}
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

      {toast ? <Pill text={toast} announce style={[styles.absolute, { bottom: insets.bottom + barHeight }]} /> : null}
      {locked ? <LockBadge onUnlock={unlock} style={[styles.absolute, { right: insets.right + theme.space.lg, bottom: insets.bottom + theme.space.lg }]} /> : null}

      {!locked && camera.access ? (
        <PermissionCard
          access={camera.access}
          reduceMotion={reduceMotion}
          onAllow={camera.retry}
          onOpenSettings={camera.openSettings}
          onDrawOnScreen={drawInstead}
        />
      ) : null}
      {moreCardOpen && controls ? (
        <BottomCard reduceMotion={reduceMotion} onDismiss={closeMore} onHeight={onMoreHeight} accessibilityLabel="More options">
          <MoreContent onClose={closeMore} />
        </BottomCard>
      ) : null}
      {tips && controls && !moreCardOpen ? <TipsCard reduceMotion={reduceMotion} onClose={closeTips} /> : null}
      {done && !snap ? (
        <Celebration
          picture={picture}
          reduceMotion={reduceMotion}
          kept={kept}
          returning={celebrated}
          onSnap={() => setSnap({ step: 'aim' })}
          onKeepTracing={() => finishCelebration(() => undefined)}
          onNewPicture={() => finishCelebration(() => router.dismissTo('/'))}
        />
      ) : null}
      {snap?.step === 'aim' && camera.cameraOn && !camera.access ? (
        <SnapAim page={page} center={center} ready={camera.cameraReady} busy={snapBusy}
          onShoot={() => void shoot()} onBack={leaveSnap} />
      ) : null}
      {snap?.step === 'review' ? (
        <SnapReview shot={snap.shot} saving={snapBusy}
          onRetake={() => { dropShot(); setSnap({ step: 'aim' }) }}
          onKeep={() => void keepShot(snap.shot)} />
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
