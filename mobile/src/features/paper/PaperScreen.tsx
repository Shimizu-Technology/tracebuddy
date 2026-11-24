import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Linking, Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { router, useNavigation } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { isTraceBuddyARSupported } from '../../../modules/tracebuddy-ar/src/TraceBuddyARModule'
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
import { boundingSize, clampOffset, fitPage, screenOrientation, sheetCover, sheetLift } from './paperModel'
import { paperStore, usePaperOptions } from './paperStore'
import type { PaperRequest } from './paperStore'
import { paperTheme } from './paperTheme'
import { PermissionCard } from './PermissionCard'
import type { CameraAccess } from './PermissionCard'
import { paperRouteParams, resolvePaperPicture } from './pictureSource'
import type { PaperParams, PaperPicture } from './pictureSource'
import { TableStandIn } from './TableStandIn'
import { TipsCard } from './TipsCard'
import { useRememberedSetup } from './useRememberedSetup'

type CameraState = 'starting' | 'live' | 'none' | 'error'

const keepAwakeTag = 'tracebuddy-paper'
const barHeight = paperTheme.size.lockButton + theme.space.xxl + theme.space.xl

export function PaperScreen({ params }: { params: PaperParams }) {
  const picture = useMemo(() => resolvePaperPicture(params), [params])
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
  const navigation = useNavigation()
  const reduceMotion = useReduceMotion()
  const options = usePaperOptions()
  const [permission, requestPermission] = useCameraPermissions()
  const [arSupported] = useState(() => Platform.OS === 'ios' && isTraceBuddyARSupported())
  const [camera, setCamera] = useState<CameraState>('starting')
  const cameraRef = useRef<CameraView>(null)
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
  const stableValues = useMemo(() => ({ x, y, scale, rotation, opacity }), [opacity, rotation, scale, x, y])
  const orientation = screenOrientation(window)
  const setup = useRememberedSetup(orientation, stableValues)

  // Layout: the page sits in the space between the top buttons and the bottom bar.
  const stage = useMemo(() => ({ width: window.width, height: window.height }), [window.width, window.height])
  const topLimit = insets.top + theme.space.md + paperTheme.size.topButton
  const bottomLimit = window.height - insets.bottom - barHeight
  const center = useMemo(() => ({ x: window.width / 2, y: (topLimit + bottomLimit) / 2 }), [bottomLimit, topLimit, window.width])
  const page = useMemo(() => fitPage(stage, setup.page), [setup.page, stage])

  const access: CameraAccess | null = !permission ? null
    : permission.granted ? (camera === 'error' ? 'unavailable' : null)
      : permission.canAskAgain ? 'ask' : 'denied'
  const cameraOn = Boolean(permission?.granted) && camera !== 'error'

  useEffect(() => paperStore.startPicture({ canUseLightLines: picture.kind === 'drawing', stickAvailable: arSupported }), [arSupported, picture.kind])

  useEffect(() => {
    void activateKeepAwakeAsync(keepAwakeTag).catch(() => undefined)
    return () => { void deactivateKeepAwake(keepAwakeTag).catch(() => undefined) }
  }, [])

  // Child mode: no swipe back to the picture list until a grown-up unlocks.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !locked })
    navigation.getParent()?.setOptions({ gestureEnabled: !locked })
  }, [locked, navigation])

  // First time only, once the camera can show the paper.
  useEffect(() => {
    if (!cameraOn) return undefined
    let active = true
    void readLocalSetting(parentSetupSeenKey).then((raw) => { if (active && !parseParentSetupSeen(raw)) setTips(true) }).catch(() => undefined)
    return () => { active = false }
  }, [cameraOn])

  // In the Simulator there is no camera. Show the table stand-in instead of a black screen.
  useEffect(() => {
    if (!permission?.granted || camera !== 'starting') return undefined
    const check = setTimeout(() => {
      void cameraRef.current?.getAvailableLensesAsync()
        .then((lenses) => setCamera((current) => (current === 'starting' && lenses.length === 0 ? 'none' : current)))
        .catch(() => undefined)
    }, paperTheme.timing.saveDelayMs)
    return () => clearTimeout(check)
  }, [camera, permission?.granted])

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

  const { persist } = setup
  const onRequest = useCallback((request: PaperRequest) => {
    if (request === 'tips') setTips(true)
    if (request !== 'stick') return
    // Open Paper Lock only after the More sheet has finished closing, so two transitions never overlap.
    const open = () => router.push({ pathname: '/paper/stick/[id]', params: paperRouteParams(params) })
    if (!paperStore.get().sheetOpen) {
      open()
      return
    }
    const stop = paperStore.subscribe(() => {
      if (paperStore.get().sheetOpen) return
      stop()
      open()
    })
  }, [params])

  const hideHint = useCallback(() => setHint(false), [])

  // iPad floats native form sheets mid-screen, where the guide can't be kept clear of them, so wide
  // screens show More as a bottom card instead. Its measured height drives the same lift.
  const cardSheets = window.width >= paperTheme.size.cardSheetMinWidth
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
      const next = clampOffset({ x: stableValues.x.get() + dx, y: stableValues.y.get() + dy }, stage)
      stableValues.x.set(next.x)
      stableValues.y.set(next.y)
      persist()
    },
    request: onRequest,
  }), [onRequest, persist, stableValues, stage])

  // While More is open, lift the whole scene so the guide stays in view above the sheet.
  const sceneDy = useSharedValue(0)
  const sceneScale = useSharedValue(1)
  useEffect(() => {
    const lift = options.sheetOpen ? sheetLift({
      screen: stage,
      sheetHeight: sheetCover(stage.height, options.sheetTop),
      topLimit,
      center: { x: center.x + stableValues.x.get(), y: center.y + stableValues.y.get() },
      bounds: boundingSize(page, stableValues.scale.get(), stableValues.rotation.get()),
      margin: theme.space.md,
    }) : { dy: 0, scale: 1 }
    sceneDy.set(reduceMotion ? lift.dy : withSpring(lift.dy, theme.motion.spring))
    sceneScale.set(reduceMotion ? lift.scale : withSpring(lift.scale, theme.motion.spring))
  }, [center, options.sheetOpen, options.sheetTop, page, reduceMotion, sceneDy, sceneScale, stableValues, stage, topLimit])
  const sceneStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sceneDy.get() }, { scale: sceneScale.get() }] }))

  const lock = useCallback(() => {
    // Child mode never keeps the scene lifted for a More card.
    paperStore.set({ sheetOpen: false, sheetTop: null })
    setMoreCard(false)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    setHint(false)
    setLocked(true)
    setToast('Locked. Time to trace!')
  }, [])

  const unlock = useCallback(() => {
    setLocked(false)
    setToast('Unlocked')
  }, [])

  const drawOnScreen = useCallback(() => {
    router.replace({ pathname: '/draw/[id]', params: paperRouteParams(params) } as never)
  }, [params])

  const showGuide = cameraOn && setup.hydrated
  const controls = showGuide && !locked && !done
  const sides = { left: insets.left + theme.space.lg, right: insets.right + theme.space.lg }
  const faderHeight = Math.min(paperTheme.size.fader.maxHeight, window.height * paperTheme.size.fader.heightFraction)

  return (
    <View style={styles.screen}>
      <StatusBar style="light" hidden={locked} animated />
      <Animated.View style={[StyleSheet.absoluteFill, sceneStyle]}>
        {cameraOn && camera === 'none' ? <TableStandIn stage={stage} page={page} center={center} /> : null}
        {cameraOn && camera !== 'none' ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            autofocus="on"
            onCameraReady={() => setCamera('live')}
            onMountError={() => setCamera('error')}
          />
        ) : null}
        {showGuide ? (
          <GuideLayer
            picture={picture}
            values={stableValues}
            page={page}
            center={center}
            stage={stage}
            locked={locked}
            lightLines={options.lightLines && picture.kind === 'drawing'}
            mirror={options.mirror}
            reduceMotion={reduceMotion}
            layoutKey={setup.layoutKey}
            onGestureStart={hideHint}
            onGestureEnd={persist}
          />
        ) : null}
      </Animated.View>

      {controls || !cameraOn ? (
        <TopBar top={insets.top + theme.space.sm} {...sides} onClose={() => router.back()} action={controls ? { glyph: DotsThreeIcon, label: 'More options', onPress: openMore } : undefined} />
      ) : null}
      {controls && hint ? <Pill text="Pinch to resize · twist to turn" style={[styles.hint, { top: topLimit + theme.space.sm }]} /> : null}
      {controls ? (
        <FadeSlider
          opacity={stableValues.opacity}
          syncKey={setup.layoutKey}
          onChangeEnd={persist}
          style={[styles.fader, { right: insets.right + theme.space.md, top: center.y - faderHeight / 2, height: faderHeight }]}
        />
      ) : null}
      {controls ? (
        <BottomBar
          bottom={insets.bottom + theme.space.md}
          {...sides}
          page={setup.page}
          onPage={() => {
            setup.changePage(setup.page === 'portrait' ? 'landscape' : 'portrait')
            setToast(setup.page === 'portrait' ? 'Wide page' : 'Tall page')
          }}
          onLock={lock}
          onDone={() => setDone(true)}
        />
      ) : null}

      {toast ? <Pill text={toast} style={[styles.toast, { bottom: insets.bottom + barHeight }]} /> : null}
      {locked ? <LockBadge onUnlock={unlock} style={[styles.badge, { right: insets.right + theme.space.lg, bottom: insets.bottom + theme.space.lg }]} /> : null}

      {access ? (
        <PermissionCard
          access={access}
          reduceMotion={reduceMotion}
          onAllow={() => { setCamera('starting'); void requestPermission().catch(() => undefined) }}
          onOpenSettings={() => { void Linking.openSettings().catch(() => undefined) }}
          onDrawOnScreen={drawOnScreen}
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
  hint: { position: 'absolute' },
  toast: { position: 'absolute' },
  fader: { position: 'absolute' },
  badge: { position: 'absolute' },
})
