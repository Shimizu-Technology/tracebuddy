import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Linking, Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { Redirect, router, useNavigation } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SvgXml } from 'react-native-svg'
import { captureRef, releaseCapture } from 'react-native-view-shot'
import { scheduleOnRN } from 'react-native-worklets'

import TraceBuddyARView from '../../../modules/tracebuddy-ar/src/TraceBuddyARView'
import { isTraceBuddyARSupported } from '../../../modules/tracebuddy-ar/src/TraceBuddyARModule'
import { prepareARGuide } from '../ar/arGuideCapture'
import {
  arDisplayCopy, arGuideGenerationKey, arPagePresets, arTrackingAdvice, canEnterARChildMode, canLockARPlacement,
  clampARValue, currentARGuide, deriveARDisplayState, initialARNativeState, isCurrentAREvent, normalizeARNativeState,
} from '../ar/arTraceState'
import type { ARGuideCapture, ARNativeState, ARPagePreset } from '../ar/arTraceState'
import { ArrowCounterClockwiseIcon } from '../../ui/icons'
import { theme } from '../../ui/theme'
import { useReduceMotion } from '../../ui/useReduceMotion'
import { Celebration } from './Celebration'
import { FadeSlider } from './FadeSlider'
import { LockBadge } from './LockBadge'
import { BottomBar, Pill, TopBar } from './PaperControls'
import { fitPage, isSnapped, normalizeDegrees, snapRotation, stickLockAction } from './paperModel'
import { paperTheme } from './paperTheme'
import { PermissionCard } from './PermissionCard'
import { paperRouteParams, resolvePaperPicture } from './pictureSource'
import type { PaperParams, PaperPicture } from './pictureSource'

const captureWidth = 720
// The texture page is laid out off screen, out of sight, before capture.
const offscreenLeft = -2200
const arScale = { min: 0.35, max: 1.15 }
const arOffsetLimit = 0.25
const keepAwakeTag = 'tracebuddy-paper-lock'
const barHeight = paperTheme.size.lockButton + theme.space.xxl + theme.space.xl

function waitForTwoFrames() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

/** Draws the guide off screen so it can be captured as the texture ARKit places on the paper. */
function GuideTexture({ target, picture, preset, onReady, onError }: {
  target: RefObject<View | null>
  picture: PaperPicture
  preset: ARPagePreset
  onReady: () => void
  onError: () => void
}) {
  const page = arPagePresets[preset]
  const height = Math.round((captureWidth * page.heightMeters) / page.widthMeters)
  return (
    <View pointerEvents="none" style={styles.captureStage}>
      <View ref={target} collapsable={false} style={[styles.capturePage, { width: captureWidth, height }]} onLayout={picture.kind === 'drawing' ? onReady : undefined}>
        <View style={styles.captureGuide}>
          {picture.kind === 'drawing'
            ? <SvgXml xml={picture.svg} width="100%" height="100%" />
            : <Image source={{ uri: picture.uri }} contentFit="contain" style={styles.fill} onLoad={onReady} onError={onError} />}
        </View>
      </View>
    </View>
  )
}

export function PaperLockScreen({ params }: { params: PaperParams }) {
  const picture = useMemo(() => resolvePaperPicture(params), [params])
  const [supported] = useState(() => Platform.OS === 'ios' && isTraceBuddyARSupported())
  if (!picture || !supported) return <Redirect href={{ pathname: '/paper/[id]', params: paperRouteParams(params) }} />
  return <PaperLockSession key={picture.key} picture={picture} />
}

/**
 * On paper with "Stick to paper" on: ARKit keeps the guide on the table even if the phone moves.
 * The same gestures, fade slider and bar as On paper, plus a tracking status that is always honest.
 */
function PaperLockSession({ picture }: { picture: PaperPicture }) {
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const navigation = useNavigation()
  const reduceMotion = useReduceMotion()
  const [permission, requestPermission] = useCameraPermissions()
  const [nativeState, setNativeState] = useState<ARNativeState>(initialARNativeState)
  const [preset, setPreset] = useState<ARPagePreset>('letterPortrait')
  const [capture, setCapture] = useState<ARGuideCapture | null>(null)
  const [readyKey, setReadyKey] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [scale, setScale] = useState(0.88)
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [placeRevision, setPlaceRevision] = useState(0)
  const [resetRevision, setResetRevision] = useState(0)
  const [childMode, setChildMode] = useState(false)
  const wantsLock = useRef(false)
  const [done, setDone] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [opacity, setOpacity] = useState<number>(paperTheme.fade.initial)
  const fade = useSharedValue<number>(paperTheme.fade.initial)
  const expectedReset = useRef(0)
  const target = useRef<View>(null)
  const page = arPagePresets[preset]
  const guideKey = arGuideGenerationKey({ id: picture.key, svg: picture.kind === 'drawing' ? picture.svg : '' }, picture.kind === 'photo' ? picture.uri : undefined, preset, attempt)
  const guideUri = currentARGuide(capture, guideKey)
  const expectedGuide = useRef({ key: guideKey, uri: guideUri })
  useLayoutEffect(() => { expectedGuide.current = { key: guideKey, uri: guideUri } }, [guideKey, guideUri])

  const current = isCurrentAREvent(nativeState, resetRevision, guideUri) ? nativeState : initialARNativeState
  const display = deriveARDisplayState(current, 'surface')
  const status = arDisplayCopy[display]
  const advice = arTrackingAdvice(current)
  const placementReady = canLockARPlacement(current, 'surface')
  const childModeReady = canEnterARChildMode(current)
  const childModeActive = childMode && childModeReady
  // Screen points to meters on the paper, roughly, from how big a page looks on this screen.
  const metersPerPoint = page.widthMeters / fitPage(window, preset === 'letterPortrait' ? 'portrait' : 'landscape').width

  useAnimatedReaction(() => fade.get(), (value, previous) => { if (value !== previous) scheduleOnRN(setOpacity, value) })

  useEffect(() => {
    void activateKeepAwakeAsync(keepAwakeTag).catch(() => undefined)
    return () => { void deactivateKeepAwake(keepAwakeTag).catch(() => undefined) }
  }, [])

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !childModeActive })
    navigation.getParent()?.setOptions({ gestureEnabled: !childModeActive })
  }, [childModeActive, navigation])

  useEffect(() => {
    if (!toast) return undefined
    const hide = setTimeout(() => setToast(null), paperTheme.timing.toastMs)
    return () => clearTimeout(hide)
  }, [toast])

  const reset = useCallback(() => {
    expectedReset.current += 1
    setResetRevision(expectedReset.current)
    setNativeState(initialARNativeState)
    setChildMode(false)
    wantsLock.current = false
  }, [])

  useEffect(() => {
    if (readyKey !== guideKey || !target.current) return undefined
    let cancelled = false
    void waitForTwoFrames().then(async () => {
      if (cancelled || !target.current) return
      const uri = await prepareARGuide({
        capture: () => captureRef(target, { format: 'png', quality: 1, result: 'tmpfile' }),
        isCurrent: () => !cancelled && expectedGuide.current.key === guideKey,
        release: releaseCapture,
      })
      if (!uri) return
      setNativeState(initialARNativeState)
      setChildMode(false)
      setCapture({ key: guideKey, uri })
      setErrorKey(null)
    }).catch(() => {
      if (!cancelled && expectedGuide.current.key === guideKey) {
        setCapture(null)
        setErrorKey(guideKey)
      }
    })
    return () => { cancelled = true }
  }, [readyKey, guideKey])

  useEffect(() => () => { if (capture) releaseCapture(capture.uri) }, [capture])

  const enterChildMode = useCallback(() => {
    wantsLock.current = false
    setChildMode(true)
    setToast('Locked. Time to trace!')
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
  }, [])

  // The Lock button places the guide first; child mode starts when tracking says the guide is held on the paper.
  const lock = useCallback(() => {
    const action = stickLockAction(placementReady, childModeReady)
    if (action === 'childMode') enterChildMode()
    else if (action === 'place') {
      wantsLock.current = true
      setPlaceRevision((value) => value + 1)
    } else setToast(status.title)
  }, [childModeReady, enterChildMode, placementReady, status.title])

  const changePage = useCallback(() => {
    reset()
    setCapture(null)
    setReadyKey(null)
    setErrorKey(null)
    setAttempt((value) => value + 1)
    expectedGuide.current.uri = null
    setPreset((value) => (value === 'letterPortrait' ? 'letterLandscape' : 'letterPortrait'))
  }, [reset])

  const rotationValue = useSharedValue(0)
  const rawRotation = useSharedValue(0)
  const wasSnapped = useSharedValue(true)
  const gesture = useMemo(() => {
    const enabled = !childModeActive && !done
    const moveBy = (dx: number, dy: number) => setOffset((value) => ({
      x: clampARValue(value.x + dx * metersPerPoint, -arOffsetLimit, arOffsetLimit),
      y: clampARValue(value.y + dy * metersPerPoint, -arOffsetLimit, arOffsetLimit),
    }))
    const scaleBy = (factor: number) => setScale((value) => clampARValue(value * factor, arScale.min, arScale.max))
    const snapHaptic = () => { void Haptics.selectionAsync().catch(() => undefined) }
    return Gesture.Simultaneous(
      Gesture.Pan().enabled(enabled).maxPointers(2).onChange((event) => { scheduleOnRN(moveBy, event.changeX, event.changeY) }),
      Gesture.Pinch().enabled(enabled).onChange((event) => { scheduleOnRN(scaleBy, event.scaleChange) }),
      Gesture.Rotation().enabled(enabled)
        .onBegin(() => {
          rawRotation.set(rotationValue.get())
          wasSnapped.set(isSnapped(rotationValue.get()))
        })
        .onChange((event) => {
          rawRotation.set(rawRotation.get() + (event.rotationChange * 180) / Math.PI)
          const snapped = isSnapped(rawRotation.get())
          if (snapped && !wasSnapped.get()) scheduleOnRN(snapHaptic)
          wasSnapped.set(snapped)
          rotationValue.set(normalizeDegrees(snapRotation(rawRotation.get())))
          scheduleOnRN(setRotation, rotationValue.get())
        }),
    )
  }, [childModeActive, done, metersPerPoint, rawRotation, rotationValue, wasSnapped])

  if (permission && !permission.granted) {
    return (
      <View style={styles.screen}>
        <PermissionCard
          access={permission.canAskAgain ? 'ask' : 'denied'}
          reduceMotion={reduceMotion}
          onAllow={() => { void requestPermission().catch(() => undefined) }}
          onOpenSettings={() => { void Linking.openSettings().catch(() => undefined) }}
          onDrawOnScreen={() => router.back()}
        />
      </View>
    )
  }

  const faderHeight = Math.min(paperTheme.size.fader.maxHeight, window.height * paperTheme.size.fader.heightFraction)
  const sides = { left: insets.left + theme.space.lg, right: insets.right + theme.space.lg }
  const controls = !childModeActive && !done

  return (
    <View style={styles.screen}>
      <StatusBar style="light" hidden={childModeActive} animated />
      <GuideTexture key={guideKey} target={target} picture={picture} preset={preset} onReady={() => { if (expectedGuide.current.key === guideKey) setReadyKey(guideKey) }} onError={() => setErrorKey(guideKey)} />
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          {guideUri ? (
            <TraceBuddyARView
              key={guideUri}
              style={StyleSheet.absoluteFill}
              active
              guideImageUri={guideUri}
              placementMode="surface"
              opacity={opacity}
              scale={scale}
              rotationDegrees={rotation}
              offsetXmeters={offset.x}
              offsetYmeters={offset.y}
              paperWidthMeters={page.widthMeters}
              paperHeightMeters={page.heightMeters}
              placeRevision={placeRevision}
              resetRevision={resetRevision}
              onStateChange={(event) => {
                const next = normalizeARNativeState(event.nativeEvent)
                if (!isCurrentAREvent(next, expectedReset.current, expectedGuide.current.uri)) return
                setNativeState(next)
                if (wantsLock.current && canEnterARChildMode(next)) enterChildMode()
                // Never leave a child tracing over a guide that may have slipped.
                if (childMode && !canEnterARChildMode(next)) {
                  setChildMode(false)
                  setToast('The picture may have moved. Check it, then lock again.')
                }
              }}
            />
          ) : null}
        </View>
      </GestureDetector>

      {controls ? <TopBar top={insets.top + theme.space.sm} {...sides} onClose={() => router.back()} action={{ glyph: ArrowCounterClockwiseIcon, label: 'Start over', onPress: reset }} /> : null}
      <Pill
        text={errorKey === guideKey ? 'The picture couldn’t be prepared. Tap Page to try again.' : `${status.title}. ${advice ?? status.detail}`}
        style={[styles.status, { top: insets.top + theme.space.sm + (controls ? paperTheme.size.topButton + theme.space.sm : 0) }]}
      />
      {controls ? (
        <FadeSlider
          opacity={fade}
          syncKey={0}
          onChangeEnd={() => undefined}
          style={[styles.absolute, { right: insets.right + theme.space.md, top: (window.height - faderHeight) / 2, height: faderHeight }]}
        />
      ) : null}
      {controls ? (
        <BottomBar
          bottom={insets.bottom + theme.space.md}
          {...sides}
          page={preset === 'letterPortrait' ? 'portrait' : 'landscape'}
          lockDimmed={!placementReady && !childModeReady}
          onPage={changePage}
          onLock={lock}
          onDone={() => setDone(true)}
        />
      ) : null}
      {toast ? <Pill text={toast} style={[styles.absolute, { bottom: insets.bottom + barHeight }]} /> : null}
      {childModeActive ? (
        <LockBadge
          onUnlock={() => { setChildMode(false); setToast('Unlocked') }}
          style={[styles.absolute, { right: insets.right + theme.space.lg, bottom: insets.bottom + theme.space.lg }]}
        />
      ) : null}
      {done ? <Celebration picture={picture} reduceMotion={reduceMotion} onKeepTracing={() => setDone(false)} onNewPicture={() => router.dismissTo('/')} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: paperTheme.colors.backdrop, overflow: 'hidden' },
  captureStage: { position: 'absolute', left: offscreenLeft, top: 0 },
  capturePage: { backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  captureGuide: { width: `${paperTheme.page.artInset * 100}%`, height: `${paperTheme.page.artInset * 100}%`, alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  status: { position: 'absolute', marginHorizontal: theme.space.lg },
  absolute: { position: 'absolute' },
})
