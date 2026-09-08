import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as Print from 'expo-print'
import { StatusBar } from 'expo-status-bar'
import { SvgXml } from 'react-native-svg'
import { captureRef, releaseCapture } from 'react-native-view-shot'

import type { Drawing } from '@tracebuddy/shared'
import TraceBuddyARView from '../../../modules/tracebuddy-ar/src/TraceBuddyARView'
import { isTraceBuddyARSupported } from '../../../modules/tracebuddy-ar/src/TraceBuddyARModule'
import {
  arDisplayCopy,
  arPagePresets,
  arTrackingAdvice,
  canEnterARChildMode,
  clampARValue,
  deriveARDisplayState,
  initialARNativeState,
  normalizeARNativeState,
} from './arTraceState'
import type { ARNativeState, ARPagePreset, ARPlacementMode } from './arTraceState'

type UploadedGuide = { uri: string; name: string }

type Props = {
  insetsTop: number
  insetsBottom: number
  pictureName: string
  pictureTheme: string
  selectedDrawing: Drawing
  uploadedImage: UploadedGuide | null
  permissionGranted: boolean
  canAskPermissionAgain: boolean
  requestPermission: () => Promise<unknown>
  onPicker: () => void
  onCameraFallback: () => void
  onScreenPractice: () => void
}

const markerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="50mm" height="50mm" style="display:block"><rect width="800" height="800" fill="#fff"/><rect x="28" y="28" width="744" height="744" rx="42" fill="#18243a"/><rect x="76" y="76" width="648" height="648" rx="22" fill="#fff"/><path d="M76 76h238v76H152v162H76Z" fill="#ff795d"/><path d="M724 76v238h-76V152H486V76Z" fill="#56ccf2"/><path d="M724 724H486v-76h162V486h76Z" fill="#f2c94c"/><path d="M76 724V486h76v162h162v76Z" fill="#62c98c"/><circle cx="250" cy="258" r="86" fill="#18243a"/><circle cx="250" cy="258" r="42" fill="#fff"/><path d="m447 174 116 67-43 74-116-67Z" fill="#18243a"/><path d="m433 369 160 18-9 78-160-18Z" fill="#ff795d"/><path d="M210 430h108v174H210Z" fill="#56ccf2"/><path d="m388 518 86-86 86 86-86 86Z" fill="#18243a"/><circle cx="474" cy="518" r="30" fill="#f2c94c"/><path d="M133 353h70v35h-70ZM598 338h69v34h-69ZM331 123h39v67h-39ZM342 604h43v73h-43Z" fill="#18243a"/></svg>`

function waitForTwoFrames() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

function ARControlButton({ label, onPress, disabled = false, selected = false }: { label: string; onPress: () => void; disabled?: boolean; selected?: boolean }) {
  return (
    <Pressable
      style={[styles.controlButton, selected && styles.controlButtonSelected, disabled && styles.buttonDisabled]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      accessibilityLabel={label}
    >
      <Text style={[styles.controlButtonText, selected && styles.controlButtonTextSelected]}>{label}</Text>
    </Pressable>
  )
}

function GuideTexture({
  captureTarget,
  pagePreset,
  selectedDrawing,
  uploadedImage,
  onReady,
}: {
  captureTarget: RefObject<View | null>
  pagePreset: ARPagePreset
  selectedDrawing: Drawing
  uploadedImage: UploadedGuide | null
  onReady: () => void
}) {
  const page = arPagePresets[pagePreset]
  const width = 720
  const height = Math.round(width * page.heightMeters / page.widthMeters)
  return (
    <View pointerEvents="none" style={styles.captureStage}>
      <View ref={captureTarget} collapsable={false} style={[styles.capturePage, { width, height }]} onLayout={uploadedImage ? undefined : onReady}>
        <View style={styles.captureGuide}>
          {uploadedImage ? (
            <Image
              key={`${uploadedImage.uri}:${pagePreset}`}
              source={{ uri: uploadedImage.uri }}
              resizeMode="contain"
              style={styles.captureImage}
              onLoad={onReady}
            />
          ) : (
            <SvgXml xml={selectedDrawing.svg} width="100%" height="100%" />
          )}
        </View>
      </View>
    </View>
  )
}

export default function ARTraceScreen(props: Props) {
  const {
    insetsTop,
    insetsBottom,
    pictureName,
    pictureTheme,
    selectedDrawing,
    uploadedImage,
    permissionGranted,
    canAskPermissionAgain,
    requestPermission,
    onPicker,
    onCameraFallback,
    onScreenPractice,
  } = props
  const [setupChecks, setSetupChecks] = useState({ stable: false, page: false, light: false })
  const [setupComplete, setSetupComplete] = useState(false)
  const [supported] = useState(() => Platform.OS === 'ios' && isTraceBuddyARSupported())
  const [nativeState, setNativeState] = useState<ARNativeState>(initialARNativeState)
  const [placementMode, setPlacementMode] = useState<ARPlacementMode>('surface')
  const [pagePreset, setPagePreset] = useState<ARPagePreset>('letterPortrait')
  const [guideUri, setGuideUri] = useState<string | null>(null)
  const [captureReady, setCaptureReady] = useState(false)
  const [opacity, setOpacity] = useState(0.72)
  const [scale, setScale] = useState(0.88)
  const [rotation, setRotation] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [placeRevision, setPlaceRevision] = useState(0)
  const [resetRevision, setResetRevision] = useState(0)
  const [controlsOpen, setControlsOpen] = useState(true)
  const [childMode, setChildMode] = useState(false)
  const captureTarget = useRef<View>(null)
  const page = arPagePresets[pagePreset]
  const setupReady = Object.values(setupChecks).every(Boolean)
  const displayState = deriveARDisplayState(nativeState, placementMode)
  const displayCopy = arDisplayCopy[displayState]
  const trackingAdvice = arTrackingAdvice(nativeState)
  const childModeReady = canEnterARChildMode(nativeState)

  const handleCaptureReady = useCallback(() => setCaptureReady(true), [])

  useEffect(() => {
    if (!captureReady || !captureTarget.current) return
    let cancelled = false
    let nextUri: string | null = null
    void waitForTwoFrames().then(async () => {
      if (cancelled || !captureTarget.current) return
      nextUri = await captureRef(captureTarget, { format: 'png', quality: 1, result: 'tmpfile' })
      if (cancelled) {
        releaseCapture(nextUri)
        return
      }
      setGuideUri(nextUri)
    }).catch(() => {
      if (!cancelled) Alert.alert('Guide not ready', 'TraceBuddy could not prepare this picture for Paper Lock. Try regular Camera Trace.')
    })
    return () => { cancelled = true }
  }, [captureReady, pagePreset, selectedDrawing.id, uploadedImage?.uri])

  useEffect(() => () => {
    if (guideUri) releaseCapture(guideUri)
  }, [guideUri])

  const changePlacementMode = useCallback((nextMode: ARPlacementMode) => {
    setPlacementMode(nextMode)
    setOffsetX(nextMode === 'marker' ? page.widthMeters / 2 + 0.04 : 0)
    setOffsetY(nextMode === 'marker' ? page.heightMeters / 2 - 0.025 : 0)
    setNativeState(initialARNativeState)
    setResetRevision((value) => value + 1)
  }, [page.heightMeters, page.widthMeters])

  const printMarker = useCallback(async () => {
    try {
      await Print.printAsync({ html: `<!doctype html><html><body style="font-family:-apple-system;margin:20mm;color:#18243a"><h1>TraceBuddy Paper Lock marker</h1><p>Print at 100% scale. Cut out the 50 mm square and place it flat beside the top-left corner of the paper.</p><div style="width:50mm;height:50mm">${markerSvg}</div><p>Keep the entire marker visible to the camera while tracing. Paper Lock follows the marker if the page moves.</p></body></html>` })
    } catch {
      Alert.alert('Could not print marker', 'Try again, or use Surface Lock without a marker.')
    }
  }, [])

  const requestCamera = useCallback(async () => {
    if (!canAskPermissionAgain) {
      await Linking.openSettings()
      return
    }
    await requestPermission()
  }, [canAskPermissionAgain, requestPermission])

  if (!supported) {
    return (
      <View style={styles.fallback}>
        <StatusBar style="dark" />
        <Text style={styles.fallbackEyebrow}>PAPER LOCK</Text>
        <Text style={styles.fallbackTitle}>Paper Lock is not available on this device.</Text>
        <Text style={styles.fallbackCopy}>You can still trace this picture with the regular camera overlay or practice on the screen.</Text>
        <Pressable style={styles.primaryButton} onPress={onCameraFallback} accessibilityRole="button"><Text style={styles.primaryButtonText}>Use Camera Trace</Text></Pressable>
        <Pressable style={styles.secondaryButton} onPress={onScreenPractice} accessibilityRole="button"><Text style={styles.secondaryButtonText}>Practice on screen</Text></Pressable>
        <Pressable style={styles.textButton} onPress={onPicker} accessibilityRole="button"><Text style={styles.textButtonText}>Back to pictures</Text></Pressable>
      </View>
    )
  }

  if (!setupComplete) {
    return (
      <ScrollView style={styles.setupScreen} contentContainerStyle={[styles.setupContent, { paddingTop: insetsTop + 24, paddingBottom: insetsBottom + 32 }]}>
        <StatusBar style="dark" />
        <Text style={styles.setupEyebrow}>PARENT SETUP · PAPER LOCK</Text>
        <Text style={styles.setupTitle}>Make the tracing space safe and steady.</Text>
        <Text style={styles.setupCopy}>Paper Lock keeps the guide in the same physical spot when the device moves. A stand is still the safest, easiest setup.</Text>
        {([
          ['stable', 'Stand is stable', 'The device cannot tip or fall into the drawing area.'],
          ['page', 'Whole page is visible', 'Leave room around every edge so tracking can recover.'],
          ['light', 'Light is even', 'Avoid dark shadows, glare, and a bright window behind the page.'],
        ] as const).map(([key, title, detail], index) => (
          <Pressable key={key} style={[styles.setupCheck, setupChecks[key] && styles.setupCheckSelected]} onPress={() => setSetupChecks((current) => ({ ...current, [key]: !current[key] }))} accessibilityRole="checkbox" accessibilityState={{ checked: setupChecks[key] }}>
            <View style={[styles.checkNumber, setupChecks[key] && styles.checkNumberSelected]}><Text style={styles.checkNumberText}>{setupChecks[key] ? '✓' : index + 1}</Text></View>
            <View style={styles.checkCopy}><Text style={styles.checkTitle}>{title}</Text><Text style={styles.checkDetail}>{detail}</Text></View>
          </Pressable>
        ))}
        {!permissionGranted ? (
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>Camera permission</Text>
            <Text style={styles.permissionCopy}>The camera finds the table and keeps the guide in place. Frames and tracking data stay on this device.</Text>
            <Pressable style={styles.secondaryButton} onPress={() => { void requestCamera() }} accessibilityRole="button"><Text style={styles.secondaryButtonText}>{canAskPermissionAgain ? 'Allow camera' : 'Open Settings'}</Text></Pressable>
          </View>
        ) : null}
        <Pressable style={[styles.primaryButton, (!setupReady || !permissionGranted) && styles.buttonDisabled]} disabled={!setupReady || !permissionGranted} onPress={() => setSetupComplete(true)} accessibilityRole="button"><Text style={styles.primaryButtonText}>Start Paper Lock</Text></Pressable>
        <Pressable style={styles.textButton} onPress={onCameraFallback} accessibilityRole="button"><Text style={styles.textButtonText}>Use regular Camera Trace instead</Text></Pressable>
        <Pressable style={styles.textButton} onPress={onPicker} accessibilityRole="button"><Text style={styles.textButtonText}>Back to pictures</Text></Pressable>
      </ScrollView>
    )
  }

  return (
    <View style={styles.shell}>
      <StatusBar style="light" hidden={childMode} />
      <GuideTexture captureTarget={captureTarget} pagePreset={pagePreset} selectedDrawing={selectedDrawing} uploadedImage={uploadedImage} onReady={handleCaptureReady} />
      {guideUri ? (
        <TraceBuddyARView
          style={StyleSheet.absoluteFill}
          active
          guideImageUri={guideUri}
          placementMode={placementMode}
          opacity={opacity}
          scale={scale}
          rotationDegrees={rotation}
          offsetXmeters={offsetX}
          offsetYmeters={offsetY}
          paperWidthMeters={page.widthMeters}
          paperHeightMeters={page.heightMeters}
          placeRevision={placeRevision}
          resetRevision={resetRevision}
          onStateChange={(event) => {
            const nextState = normalizeARNativeState(event.nativeEvent)
            setNativeState(nextState)
            if (childMode && !canEnterARChildMode(nextState)) {
              setChildMode(false)
              setControlsOpen(true)
            }
          }}
        />
      ) : <View style={styles.preparing}><Text style={styles.preparingText}>Preparing {pictureName}…</Text></View>}

      {!childMode ? (
        <View style={[styles.header, { paddingTop: insetsTop + 10 }]} pointerEvents="box-none">
          <Pressable style={styles.headerButton} onPress={onPicker} accessibilityRole="button" accessibilityLabel="Back to picture picker"><Text style={styles.headerButtonText}>Pictures</Text></Pressable>
          <View style={styles.titleCard}><Text style={styles.title} numberOfLines={1}>{pictureName}</Text><Text style={styles.subtitle} numberOfLines={1}>{pictureTheme} · Paper Lock</Text></View>
          <Pressable style={styles.headerButton} onPress={onCameraFallback} accessibilityRole="button" accessibilityLabel="Switch to regular Camera Trace"><Text style={styles.headerButtonText}>Camera</Text></Pressable>
        </View>
      ) : (
        <Pressable style={[styles.childExit, { top: insetsTop + 10 }]} onPress={() => setChildMode(false)} accessibilityRole="button"><Text style={styles.childExitText}>Exit child mode</Text></Pressable>
      )}

      <View style={[styles.statusCard, { top: insetsTop + (childMode ? 66 : 76) }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <View style={[styles.statusDot, displayState === 'locked' && styles.statusDotReady]} />
        <View style={styles.statusCopy}><Text style={styles.statusTitle}>{displayCopy.title}</Text><Text style={styles.statusDetail}>{trackingAdvice ?? displayCopy.detail}</Text></View>
      </View>

      {!childMode ? (
        <View style={[styles.controlsDock, { paddingBottom: insetsBottom + 10 }]} pointerEvents="box-none">
          {!controlsOpen ? (
            <Pressable style={styles.openControls} onPress={() => setControlsOpen(true)} accessibilityRole="button"><Text style={styles.openControlsText}>Adjust Paper Lock</Text></Pressable>
          ) : (
            <ScrollView style={styles.controlsSheet} contentContainerStyle={styles.controlsContent} showsVerticalScrollIndicator={false}>
              <View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>Adjust Paper Lock</Text><Text style={styles.sheetCopy}>The center square controls where the page goes.</Text></View><ARControlButton label="Hide" onPress={() => setControlsOpen(false)} /></View>
              <View style={styles.segmentRow}>
                <ARControlButton label="Surface Lock" selected={placementMode === 'surface'} onPress={() => changePlacementMode('surface')} />
                <ARControlButton label="Marker Lock" selected={placementMode === 'marker'} onPress={() => changePlacementMode('marker')} />
              </View>
              {placementMode === 'marker' ? <Pressable style={styles.markerButton} onPress={() => { void printMarker() }} accessibilityRole="button"><Text style={styles.markerButtonText}>Print the 50 mm Paper Lock marker</Text></Pressable> : <Text style={styles.modeNote}>Surface Lock stays on the table. If the paper moves, reset and lock it again.</Text>}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow} accessibilityLabel="Paper size">
                {(Object.keys(arPagePresets) as ARPagePreset[]).map((preset) => <ARControlButton key={preset} label={arPagePresets[preset].label} selected={pagePreset === preset} onPress={() => { const nextPage = arPagePresets[preset]; setPagePreset(preset); setCaptureReady(false); if (placementMode === 'marker') { setOffsetX(nextPage.widthMeters / 2 + 0.04); setOffsetY(nextPage.heightMeters / 2 - 0.025) } setResetRevision((value) => value + 1) }} />)}
              </ScrollView>
              <View style={styles.adjustGrid}>
                <View style={styles.adjustGroup}><Text style={styles.adjustLabel}>Opacity · {Math.round(opacity * 100)}%</Text><View style={styles.segmentRow}><ARControlButton label="Less opacity" onPress={() => setOpacity((value) => clampARValue(value - 0.08, 0.12, 1))} /><ARControlButton label="More opacity" onPress={() => setOpacity((value) => clampARValue(value + 0.08, 0.12, 1))} /></View></View>
                <View style={styles.adjustGroup}><Text style={styles.adjustLabel}>Size · {Math.round(scale * 100)}%</Text><View style={styles.segmentRow}><ARControlButton label="Smaller" onPress={() => setScale((value) => clampARValue(value - 0.05, 0.35, 1.15))} /><ARControlButton label="Larger" onPress={() => setScale((value) => clampARValue(value + 0.05, 0.35, 1.15))} /></View></View>
                <View style={styles.adjustGroup}><Text style={styles.adjustLabel}>Rotation · {Math.round(rotation)}°</Text><View style={styles.segmentRow}><ARControlButton label="Rotate left" onPress={() => setRotation((value) => clampARValue(value - 5, -180, 180))} /><ARControlButton label="Rotate right" onPress={() => setRotation((value) => clampARValue(value + 5, -180, 180))} /></View></View>
              </View>
              <View style={styles.nudgeGroup}><Text style={styles.adjustLabel}>Precise nudge</Text><View style={styles.segmentRow}><ARControlButton label="Nudge left" onPress={() => setOffsetX((value) => clampARValue(value - 0.005, -0.25, 0.25))} /><ARControlButton label="Nudge up" onPress={() => setOffsetY((value) => clampARValue(value - 0.005, -0.25, 0.25))} /><ARControlButton label="Nudge down" onPress={() => setOffsetY((value) => clampARValue(value + 0.005, -0.25, 0.25))} /><ARControlButton label="Nudge right" onPress={() => setOffsetX((value) => clampARValue(value + 0.005, -0.25, 0.25))} /></View></View>
              <View style={styles.actionRow}>
                <Pressable style={[styles.placeButton, displayState !== 'readyToPlace' && styles.buttonDisabled]} disabled={displayState !== 'readyToPlace'} onPress={() => setPlaceRevision((value) => value + 1)} accessibilityRole="button"><Text style={styles.placeButtonText}>Lock to paper</Text></Pressable>
                <Pressable style={styles.resetButton} onPress={() => { setChildMode(false); setResetRevision((value) => value + 1) }} accessibilityRole="button"><Text style={styles.resetButtonText}>Reset</Text></Pressable>
              </View>
              <Pressable style={[styles.childButton, !childModeReady && styles.buttonDisabled]} disabled={!childModeReady} onPress={() => { setControlsOpen(false); setChildMode(true) }} accessibilityRole="button"><Text style={styles.childButtonText}>Start child trace</Text></Pressable>
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  )
}

const colors = { ink: '#18243A', coral: '#FF795D', paper: '#FFF7EA', border: '#D9E1E8', muted: '#5E6878', mint: '#DDF4E7' }

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#101927', overflow: 'hidden' },
  captureStage: { position: 'absolute', left: -2200, top: 0 },
  capturePage: { backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  captureGuide: { width: '88%', height: '88%', alignItems: 'center', justifyContent: 'center' },
  captureImage: { width: '100%', height: '100%' },
  preparing: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101927' },
  preparingText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  header: { position: 'absolute', left: 10, right: 10, flexDirection: 'row', gap: 8, alignItems: 'center' },
  headerButton: { minHeight: 48, minWidth: 70, paddingHorizontal: 12, borderRadius: 18, backgroundColor: 'rgba(16,25,39,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  titleCard: { flex: 1, minHeight: 54, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(16,25,39,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  title: { color: '#fff', fontSize: 15, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 2, fontWeight: '700' },
  statusCard: { position: 'absolute', left: 18, right: 18, minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 20, backgroundColor: 'rgba(16,25,39,0.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  statusDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#F2C94C', borderWidth: 2, borderColor: '#fff' },
  statusDotReady: { backgroundColor: '#62C98C' },
  statusCopy: { flex: 1 },
  statusTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  statusDetail: { color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 17, marginTop: 2, fontWeight: '600' },
  controlsDock: { position: 'absolute', left: 10, right: 10, bottom: 0, alignItems: 'center' },
  controlsSheet: { width: '100%', maxHeight: 500, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.97)' },
  controlsContent: { padding: 14, gap: 10 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  sheetTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  sheetCopy: { color: colors.muted, fontSize: 12, marginTop: 2, fontWeight: '700' },
  segmentRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  controlButton: { minHeight: 46, minWidth: 58, flexGrow: 1, paddingHorizontal: 11, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  controlButtonSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  controlButtonText: { color: colors.ink, fontSize: 12, fontWeight: '900', textAlign: 'center' },
  controlButtonTextSelected: { color: '#fff' },
  markerButton: { minHeight: 46, borderRadius: 16, paddingHorizontal: 14, backgroundColor: '#EAF5FB', alignItems: 'center', justifyContent: 'center' },
  markerButtonText: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  modeNote: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  presetRow: { gap: 8 },
  adjustGrid: { gap: 9 },
  adjustGroup: { padding: 10, gap: 7, borderRadius: 18, backgroundColor: colors.paper },
  adjustLabel: { color: colors.ink, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.3 },
  nudgeGroup: { padding: 10, gap: 7, borderRadius: 18, backgroundColor: '#F1F8F4' },
  actionRow: { flexDirection: 'row', gap: 8 },
  placeButton: { flex: 2, minHeight: 50, borderRadius: 18, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
  placeButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  resetButton: { flex: 1, minHeight: 50, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  resetButtonText: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  childButton: { minHeight: 52, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  childButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  openControls: { minHeight: 54, borderRadius: 999, paddingHorizontal: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  openControlsText: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  childExit: { position: 'absolute', right: 12, minHeight: 48, borderRadius: 999, paddingHorizontal: 16, backgroundColor: 'rgba(16,25,39,0.84)', justifyContent: 'center' },
  childExitText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  setupScreen: { flex: 1, backgroundColor: colors.paper },
  setupContent: { paddingHorizontal: 20, gap: 13 },
  setupEyebrow: { color: colors.coral, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  setupTitle: { color: colors.ink, fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -1.2 },
  setupCopy: { color: colors.muted, fontSize: 16, lineHeight: 23, marginBottom: 6 },
  setupCheck: { minHeight: 88, flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  setupCheckSelected: { backgroundColor: colors.mint, borderColor: '#9BCBAD' },
  checkNumber: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  checkNumberSelected: { backgroundColor: '#267449' },
  checkNumberText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  checkCopy: { flex: 1 },
  checkTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  checkDetail: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  permissionCard: { padding: 15, borderRadius: 22, backgroundColor: '#EAF5FB', gap: 8 },
  permissionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  permissionCopy: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 54, borderRadius: 18, paddingHorizontal: 18, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  secondaryButton: { minHeight: 50, borderRadius: 18, paddingHorizontal: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  textButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  textButtonText: { color: colors.ink, fontSize: 14, fontWeight: '900', textDecorationLine: 'underline' },
  buttonDisabled: { opacity: 0.38 },
  fallback: { flex: 1, padding: 24, justifyContent: 'center', gap: 13, backgroundColor: colors.paper },
  fallbackEyebrow: { color: colors.coral, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  fallbackTitle: { color: colors.ink, fontSize: 32, lineHeight: 37, fontWeight: '900' },
  fallbackCopy: { color: colors.muted, fontSize: 16, lineHeight: 23, marginBottom: 6 },
})
