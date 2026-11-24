import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import type { AccessibilityActionEvent } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { Redirect, router, useFocusEffect } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureDetector } from 'react-native-gesture-handler'
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
import { accessibilityPose, guideAccessibilityActions } from './guideMotion'
import { LockBadge } from './LockBadge'
import { BottomBar, Pill, TopBar } from './PaperControls'
import { canAdjust, showsControls, stickTransition } from './paperLockModel'
import type { StickEvent, StickPhase } from './paperLockModel'
import { fitPage } from './paperModel'
import { drawOnScreenInstead } from './paperNavigation'
import { paperTheme } from './paperTheme'
import { PermissionCard } from './PermissionCard'
import { paperRouteParams, resolvePaperPicture } from './pictureSource'
import type { PaperParams, PaperPicture } from './pictureSource'
import { useCameraAccess } from './useCameraAccess'
import { useChildModeGuard } from './useChildModeGuard'
import { useGuideGesture } from './useGuideGesture'

const captureWidth = 720
// The texture page is laid out off screen, out of sight, before capture.
const offscreenLeft = -2200
// ARKit draws the page at real size, so the guide's own size range is narrower than on the camera screen.
const arScaleLimits = { min: 0.35, max: 1.15 }
const arStartScale = 0.88
const arOffsetLimit = 0.25
const keepAwakeTag = 'tracebuddy-paper-lock'
const barHeight = paperTheme.size.lockButton + theme.space.xxl + theme.space.xl
const noop = () => undefined

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
  return <PaperLockSession key={picture.key} picture={picture} params={params} />
}

type ARPose = { x: number; y: number; scale: number; rotation: number }

/**
 * On paper with "Stick to paper" on: ARKit keeps the guide on the table even if the phone moves.
 * The same gestures, fade slider and bar as On paper, plus a tracking status that is always honest.
 * Placing, child mode and the celebration are separate states (paperLockModel), so nothing can start
 * child mode behind Done or after a reset.
 */
function PaperLockSession({ picture, params }: { picture: PaperPicture; params: PaperParams }) {
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const reduceMotion = useReduceMotion()
  const camera = useCameraAccess()
  const [nativeState, setNativeState] = useState<ARNativeState>(initialARNativeState)
  const [preset, setPreset] = useState<ARPagePreset>('letterPortrait')
  const [capture, setCapture] = useState<ARGuideCapture | null>(null)
  const [readyKey, setReadyKey] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [pose, setPose] = useState<ARPose>({ x: 0, y: 0, scale: arStartScale, rotation: 0 })
  const [placeRevision, setPlaceRevision] = useState(0)
  const [resetRevision, setResetRevision] = useState(0)
  const [phase, setPhase] = useState<StickPhase>('adjusting')
  const phaseRef = useRef<StickPhase>('adjusting')
  const [toast, setToast] = useState<string | null>(null)
  const [opacity, setOpacity] = useState<number>(paperTheme.fade.initial)
  const fade = useSharedValue<number>(paperTheme.fade.initial)
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const scale = useSharedValue(arStartScale)
  const rotation = useSharedValue(0)
  const values = useMemo(() => ({ x, y, scale, rotation }), [rotation, scale, x, y])
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
  const childMode = phase === 'child'
  const stage = useMemo(() => ({ width: window.width, height: window.height }), [window.height, window.width])
  const rest = useMemo(() => ({ x: window.width / 2, y: window.height / 2 }), [window.height, window.width])
  // Screen points to meters on the paper, roughly, from how big a page looks on this screen.
  const metersPerPoint = page.widthMeters / fitPage(window, preset === 'letterPortrait' ? 'portrait' : 'landscape').width

  const dispatch = useCallback((event: StickEvent) => {
    const next = stickTransition(phaseRef.current, event)
    phaseRef.current = next.phase
    setPhase(next.phase)
    if (next.effect === 'place') setPlaceRevision((value) => value + 1)
    if (next.effect === 'enterChild') {
      setToast('Locked. Time to trace!')
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    }
    if (next.effect === 'trackingLost') setToast('The picture may have moved. Check it, then lock again.')
    return next
  }, [])

  useAnimatedReaction(() => fade.get(), (value, previous) => { if (value !== previous) scheduleOnRN(setOpacity, value) })

  // Gestures write shared values; only changes made while adjusting reach ARKit, so a late frame can't move a placed guide.
  const applyPose = useCallback((next: ARPose) => { if (canAdjust(phaseRef.current)) setPose(next) }, [])
  useAnimatedReaction(
    () => ({ x: x.get(), y: y.get(), scale: scale.get(), rotation: rotation.get() }),
    (next, previous) => { if (previous && (next.x !== previous.x || next.y !== previous.y || next.scale !== previous.scale || next.rotation !== previous.rotation)) scheduleOnRN(applyPose, next) },
  )

  useEffect(() => {
    void activateKeepAwakeAsync(keepAwakeTag).catch(() => undefined)
    return () => { void deactivateKeepAwake(keepAwakeTag).catch(() => undefined) }
  }, [])

  useChildModeGuard(childMode, useCallback(() => setToast('Hold the lock to unlock first'), []))
  // Leaving the screen cancels a placement that hasn't finished.
  useFocusEffect(useCallback(() => () => { dispatch({ type: 'blur' }) }, [dispatch]))

  useEffect(() => {
    if (!toast) return undefined
    const hide = setTimeout(() => setToast(null), paperTheme.timing.toastMs)
    return () => clearTimeout(hide)
  }, [toast])

  const reset = useCallback(() => {
    dispatch({ type: 'reset' })
    expectedReset.current += 1
    setResetRevision(expectedReset.current)
    setNativeState(initialARNativeState)
  }, [dispatch])

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
      dispatch({ type: 'reset' })
      setCapture({ key: guideKey, uri })
      setErrorKey(null)
    }).catch(() => {
      if (!cancelled && expectedGuide.current.key === guideKey) {
        setCapture(null)
        setErrorKey(guideKey)
      }
    })
    return () => { cancelled = true }
  }, [dispatch, readyKey, guideKey])

  useEffect(() => () => { if (capture) releaseCapture(capture.uri) }, [capture])

  const lock = useCallback(() => {
    const next = dispatch({ type: 'lock', placementReady, childModeReady })
    if (next.effect === 'waiting') setToast(status.title)
  }, [childModeReady, dispatch, placementReady, status.title])

  const changePage = useCallback(() => {
    reset()
    setCapture(null)
    setReadyKey(null)
    setErrorKey(null)
    setAttempt((value) => value + 1)
    expectedGuide.current.uri = null
    setPreset((value) => (value === 'letterPortrait' ? 'letterLandscape' : 'letterPortrait'))
  }, [reset])

  const gesture = useGuideGesture({
    values,
    rest,
    stage,
    limits: arScaleLimits,
    enabled: canAdjust(phase),
    onStart: noop,
    onEnd: noop,
  })

  function onAccessibilityAction(event: AccessibilityActionEvent) {
    if (!canAdjust(phaseRef.current)) return
    const next = accessibilityPose({ x: x.get(), y: y.get(), scale: scale.get(), rotation: rotation.get() }, event.nativeEvent.actionName, arScaleLimits)
    scale.set(next.scale)
    rotation.set(next.rotation)
  }

  if (!camera.granted && camera.access) {
    return (
      <View style={styles.screen}>
        <PermissionCard
          access={camera.access}
          reduceMotion={reduceMotion}
          onAllow={camera.retry}
          onOpenSettings={camera.openSettings}
          onDrawOnScreen={() => drawOnScreenInstead(params)}
        />
      </View>
    )
  }

  const faderHeight = Math.min(paperTheme.size.fader.maxHeight, window.height * paperTheme.size.fader.heightFraction)
  const sides = { left: insets.left + theme.space.lg, right: insets.right + theme.space.lg }
  const controls = showsControls(phase)

  return (
    <View style={styles.screen}>
      <StatusBar style="light" hidden={childMode} animated />
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
              scale={pose.scale}
              rotationDegrees={pose.rotation}
              offsetXmeters={clampARValue(pose.x * metersPerPoint, -arOffsetLimit, arOffsetLimit)}
              offsetYmeters={clampARValue(pose.y * metersPerPoint, -arOffsetLimit, arOffsetLimit)}
              paperWidthMeters={page.widthMeters}
              paperHeightMeters={page.heightMeters}
              placeRevision={placeRevision}
              resetRevision={resetRevision}
              onStateChange={(event) => {
                const next = normalizeARNativeState(event.nativeEvent)
                // Events from an earlier reset or guide belong to another session; ignore them.
                if (!isCurrentAREvent(next, expectedReset.current, expectedGuide.current.uri)) return
                setNativeState(next)
                dispatch({ type: 'tracking', childModeReady: canEnterARChildMode(next), trackingOk: next.session === 'running' && next.tracking === 'normal' })
              }}
            />
          ) : null}
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`${picture.name} picture`}
            accessibilityHint={canAdjust(phase) ? 'Drag to move, pinch to resize, twist to turn. Swipe up or down for more actions.' : 'Locked.'}
            accessibilityActions={canAdjust(phase) ? guideAccessibilityActions : []}
            onAccessibilityAction={onAccessibilityAction}
            pointerEvents="none"
            style={[styles.accessibilityBox, { top: window.height / 4, height: window.height / 2 }]}
          />
        </View>
      </GestureDetector>

      {controls ? <TopBar top={insets.top + theme.space.sm} {...sides} onClose={() => router.back()} action={{ glyph: ArrowCounterClockwiseIcon, label: 'Start over', onPress: reset }} /> : null}
      <Pill
        text={errorKey === guideKey ? 'The picture couldn’t be prepared. Tap Page to try again.' : phase === 'placing' ? 'Placing the picture on the paper…' : `${status.title}. ${advice ?? status.detail}`}
        style={[styles.status, { top: insets.top + theme.space.sm + (controls ? paperTheme.size.topButton + theme.space.sm : 0) }]}
      />
      {controls ? (
        <FadeSlider
          opacity={fade}
          syncKey={0}
          onChangeEnd={noop}
          style={[styles.absolute, { right: insets.right + theme.space.md, top: (window.height - faderHeight) / 2, height: faderHeight }]}
        />
      ) : null}
      {controls ? (
        <BottomBar
          bottom={insets.bottom + theme.space.md}
          {...sides}
          page={preset === 'letterPortrait' ? 'portrait' : 'landscape'}
          lockDimmed={phase === 'placing' || (!placementReady && !childModeReady)}
          onPage={changePage}
          onLock={lock}
          onDone={() => dispatch({ type: 'done' })}
        />
      ) : null}
      {toast ? <Pill text={toast} style={[styles.absolute, { bottom: insets.bottom + barHeight }]} /> : null}
      {childMode ? (
        <LockBadge
          onUnlock={() => { dispatch({ type: 'unlock' }); setToast('Unlocked') }}
          style={[styles.absolute, { right: insets.right + theme.space.lg, bottom: insets.bottom + theme.space.lg }]}
        />
      ) : null}
      {phase === 'celebrating' ? (
        <Celebration picture={picture} reduceMotion={reduceMotion} onKeepTracing={() => dispatch({ type: 'keepTracing' })} onNewPicture={() => router.dismissTo('/')} />
      ) : null}
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
  accessibilityBox: { position: 'absolute', left: 0, right: 0 },
})
