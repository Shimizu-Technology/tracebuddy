import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Alert,
  Animated,
  FlatList,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path, Rect, SvgXml } from 'react-native-svg'

import { drawingCategories, drawings } from '@tracebuddy/shared'
import type { Drawing, DrawingCategoryId } from '@tracebuddy/shared'

type ScreenMode = 'picker' | 'trace'
type PickerCategoryId = 'all' | DrawingCategoryId

type OverlayTransform = {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
}

type UploadedImage = {
  uri: string
  name: string
  width?: number
  height?: number
}

const defaultTransform: OverlayTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 0.72,
}

const palette = {
  ink: '#18243A',
  muted: '#667085',
  paper: '#FFF7EA',
  paperStrong: '#FFF1DC',
  surface: '#FFFFFF',
  coral: '#FF795D',
  coralDark: '#A44632',
  sky: '#CFE8F7',
  mint: '#DDF4E7',
  border: 'rgba(24, 36, 58, 0.12)',
  camera: '#101927',
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function TraceBuddyMobile() {
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [permission, requestPermission] = useCameraPermissions()
  const [mode, setMode] = useState<ScreenMode>('picker')
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing>(drawings[0])
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null)
  const [activeCategory, setActiveCategory] = useState<PickerCategoryId>('all')
  const [transform, setTransform] = useState<OverlayTransform>(defaultTransform)
  const [overlayLocked, setOverlayLocked] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(true)
  const [isPickingImage, setIsPickingImage] = useState(false)
  const cameraPromptedRef = useRef(false)

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<PickerCategoryId, number>> = { all: drawings.length }
    for (const drawing of drawings) {
      counts[drawing.category] = (counts[drawing.category] ?? 0) + 1
    }
    return counts
  }, [])

  const visibleDrawings = useMemo(() => (
    activeCategory === 'all' ? drawings : drawings.filter((drawing) => drawing.category === activeCategory)
  ), [activeCategory])

  const pictureName = uploadedImage?.name ?? selectedDrawing.name
  const pictureTheme = uploadedImage ? 'Local image' : selectedDrawing.theme
  const overlayBaseSize = Math.min(width * 0.78, height * 0.44, 430)
  const uploadedAspect = uploadedImage?.width && uploadedImage.height ? uploadedImage.width / uploadedImage.height : 1
  const overlayWidth = uploadedImage ? overlayBaseSize * clamp(uploadedAspect, 0.65, 1.35) : overlayBaseSize
  const overlayHeight = uploadedImage ? overlayBaseSize / clamp(uploadedAspect, 0.65, 1.35) : overlayBaseSize

  const pan = useMemo(() => new Animated.ValueXY({ x: defaultTransform.x, y: defaultTransform.y }), [])

  useEffect(() => {
    if (mode !== 'trace') return undefined

    activateKeepAwakeAsync('tracebuddy-trace').catch(() => {
      // Keep awake is a convenience, not a blocker for tracing.
    })

    return () => {
      deactivateKeepAwake('tracebuddy-trace')
    }
  }, [mode])

  useEffect(() => {
    if (mode !== 'trace' || permission?.granted || cameraPromptedRef.current) return
    cameraPromptedRef.current = true
    requestPermission().catch(() => {
      // The trace screen renders a retry action if permission fails.
    })
  }, [mode, permission?.granted, requestPermission])

  const resetOverlay = useCallback(() => {
    pan.setOffset({ x: 0, y: 0 })
    pan.setValue({ x: defaultTransform.x, y: defaultTransform.y })
    setTransform(defaultTransform)
    setOverlayLocked(false)
  }, [pan])

  const openTraceWithDrawing = useCallback((drawing: Drawing) => {
    setSelectedDrawing(drawing)
    setUploadedImage(null)
    setMode('trace')
    setControlsOpen(true)
    resetOverlay()
  }, [resetOverlay])

  const pickLocalImage = useCallback(async () => {
    try {
      setIsPickingImage(true)
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Photo permission needed', 'Allow photo access to choose a local image for tracing.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsMultipleSelection: false,
      })

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0]
        setUploadedImage({
          uri: asset.uri,
          name: asset.fileName ?? 'Local image',
          width: asset.width,
          height: asset.height,
        })
        setMode('trace')
        setControlsOpen(true)
        resetOverlay()
      }
    } catch {
      Alert.alert('Could not open photos', 'Try again or choose a built-in tracing template.')
    } finally {
      setIsPickingImage(false)
    }
  }, [resetOverlay])

  const adjustOpacity = useCallback((delta: number) => {
    setTransform((current) => ({ ...current, opacity: clamp(current.opacity + delta, 0.18, 1) }))
  }, [])

  const adjustScale = useCallback((delta: number) => {
    setTransform((current) => ({ ...current, scale: clamp(current.scale + delta, 0.42, 2.2) }))
  }, [])

  const adjustRotation = useCallback((delta: number) => {
    setTransform((current) => ({ ...current, rotation: current.rotation + delta }))
  }, [])

  const decreaseOpacity = useCallback(() => adjustOpacity(-0.08), [adjustOpacity])
  const increaseOpacity = useCallback(() => adjustOpacity(0.08), [adjustOpacity])
  const decreaseScale = useCallback(() => adjustScale(-0.08), [adjustScale])
  const increaseScale = useCallback(() => adjustScale(0.08), [adjustScale])
  const rotateLeft = useCallback(() => adjustRotation(-5), [adjustRotation])
  const rotateRight = useCallback(() => adjustRotation(5), [adjustRotation])

  const nudgeOverlay = useCallback((x: number, y: number) => {
    pan.stopAnimation((value) => {
      const nextX = value.x + x
      const nextY = value.y + y
      pan.setOffset({ x: 0, y: 0 })
      pan.setValue({ x: nextX, y: nextY })
      setTransform((current) => ({ ...current, x: nextX, y: nextY }))
    })
  }, [pan])

  const nudgeUp = useCallback(() => nudgeOverlay(0, -8), [nudgeOverlay])
  const nudgeLeft = useCallback(() => nudgeOverlay(-8, 0), [nudgeOverlay])
  const nudgeDown = useCallback(() => nudgeOverlay(0, 8), [nudgeOverlay])
  const nudgeRight = useCallback(() => nudgeOverlay(8, 0), [nudgeOverlay])

  const settleDraggedOverlay = useCallback(() => {
    pan.flattenOffset()
    pan.stopAnimation((value) => {
      setTransform((current) => ({ ...current, x: value.x, y: value.y }))
    })
  }, [pan])

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !overlayLocked,
    onMoveShouldSetPanResponder: (_event, gesture) => !overlayLocked && (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),
    onPanResponderGrant: () => {
      pan.extractOffset()
    },
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: settleDraggedOverlay,
    onPanResponderTerminate: settleDraggedOverlay,
  }), [overlayLocked, pan, settleDraggedOverlay])

  if (mode === 'picker') {
    return (
      <View style={styles.appShell}>
        <StatusBar style="dark" />
        <FlatList
          data={visibleDrawings}
          numColumns={2}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.cardRow}
          contentContainerStyle={[styles.pickerContent, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 32 }]}
          ListHeaderComponent={(
            <View>
              <View style={styles.heroCard}>
                <View style={styles.heroBadgeRow}>
                  <View style={styles.brandMark}>
                    <TraceIcon />
                  </View>
                  <Text style={styles.eyebrow}>TraceBuddy mobile</Text>
                </View>
                <Text style={styles.heroTitle}>Pick a picture, then trace over live camera.</Text>
                <Text style={styles.heroCopy}>This Expo Go MVP keeps everything local on your phone while we test whether native camera tracing feels better than the browser.</Text>
                <Pressable style={styles.uploadPill} onPress={pickLocalImage} disabled={isPickingImage} accessibilityRole="button" accessibilityLabel="Upload a local photo or drawing">
                  <ImageIcon />
                  <View style={styles.uploadCopy}>
                    <Text style={styles.uploadTitle}>{isPickingImage ? 'Opening photos' : 'Upload your own'}</Text>
                    <Text style={styles.uploadSmall}>Local photo or drawing</Text>
                  </View>
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryStrip}>
                {drawingCategories.map((category) => {
                  const active = activeCategory === category.id
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => setActiveCategory(category.id)}
                      style={[styles.categoryChip, active && styles.categoryChipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${category.label}, ${categoryCounts[category.id] ?? 0} templates`}
                    >
                      <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{category.label}</Text>
                      <View style={[styles.categoryCount, active && styles.categoryCountActive]}>
                        <Text style={styles.categoryCountText}>{categoryCounts[category.id] ?? 0}</Text>
                      </View>
                    </Pressable>
                  )
                })}
              </ScrollView>

              <Text style={styles.templateCount}>Showing {visibleDrawings.length} {visibleDrawings.length === 1 ? 'template' : 'templates'}.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.drawingCard, selectedDrawing.id === item.id && !uploadedImage && styles.drawingCardSelected]}
              onPress={() => openTraceWithDrawing(item)}
              accessibilityRole="button"
              accessibilityLabel={`Trace ${item.name}. ${item.difficulty} difficulty. ${item.theme}.`}
            >
              <View style={styles.drawingPreview}>
                <SvgXml xml={item.svg} width="100%" height="100%" />
              </View>
              <View style={styles.drawingMeta}>
                <Text style={styles.drawingName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.drawingTheme} numberOfLines={1}>{item.theme}</Text>
              </View>
              <Text style={styles.difficultyBadge}>{item.difficulty}</Text>
            </Pressable>
          )}
        />
      </View>
    )
  }

  const cameraReady = Boolean(permission?.granted)

  return (
    <View style={styles.traceShell}>
      <StatusBar style="light" />
      {cameraReady ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" autofocus="on" />
      ) : (
        <View style={styles.cameraFallback}>
          <View style={styles.fakePaper} />
          <Text style={styles.cameraFallbackTitle}>Camera permission needed</Text>
          <Text style={styles.cameraFallbackCopy}>TraceBuddy uses the camera only to show your paper under the overlay.</Text>
          <Pressable style={styles.cameraRetryButton} onPress={() => requestPermission()} accessibilityRole="button">
            <Text style={styles.cameraRetryText}>Start camera</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.traceHeader, styles.pointerBoxNone, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.headerButton} onPress={() => setMode('picker')} accessibilityRole="button" accessibilityLabel="Back to picture picker">
          <BackIcon />
          <Text style={styles.headerButtonText}>Picker</Text>
        </Pressable>
        <View style={styles.traceTitleCard}>
          <Text style={styles.traceTitle} numberOfLines={1}>{pictureName}</Text>
          <Text style={styles.traceSubtitle} numberOfLines={1}>{pictureTheme} · {overlayLocked ? 'Locked' : 'Drag to move'}</Text>
        </View>
        <Pressable style={styles.iconButton} onPress={() => setOverlayLocked((locked) => !locked)} accessibilityRole="button" accessibilityLabel={overlayLocked ? 'Unlock overlay' : 'Lock overlay'}>
          {overlayLocked ? <LockIcon /> : <UnlockIcon />}
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.overlayWrap,
          {
            left: (width - overlayWidth) / 2,
            top: (height - overlayHeight) / 2 - 24,
            width: overlayWidth,
            height: overlayHeight,
            opacity: transform.opacity,
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: transform.scale },
              { rotate: `${transform.rotation}deg` },
            ],
          },
          overlayLocked && styles.overlayWrapLocked,
          styles.pointerBoxOnly,
        ]}
        {...panResponder.panHandlers}
      >
        {uploadedImage ? (
          <Image source={{ uri: uploadedImage.uri }} style={styles.uploadedOverlayImage} resizeMode="contain" />
        ) : (
          <SvgXml xml={selectedDrawing.svg} width="100%" height="100%" />
        )}
      </Animated.View>

      <View style={[styles.traceControls, styles.pointerBoxNone, { paddingBottom: insets.bottom + 12 }]}>
        {!controlsOpen ? (
          <Pressable style={styles.openControlsButton} onPress={() => setControlsOpen(true)} accessibilityRole="button">
            <Text style={styles.openControlsText}>Adjust drawing</Text>
          </Pressable>
        ) : (
          <View style={styles.controlsSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.controlsHeader}>
              <View>
                <Text style={styles.controlsTitle}>Adjust drawing</Text>
                <Text style={styles.controlsStatus}>{overlayLocked ? 'Locked to avoid accidental dragging.' : 'Drag the overlay or use precise nudges.'}</Text>
              </View>
              <Pressable style={styles.hideButton} onPress={() => setControlsOpen(false)} accessibilityRole="button">
                <Text style={styles.hideButtonText}>Hide</Text>
              </Pressable>
            </View>

            <View style={styles.controlGrid}>
              <ControlGroup label="Opacity">
                <ControlButton label="Less" onPress={decreaseOpacity} />
                <ControlValue value={`${Math.round(transform.opacity * 100)}%`} />
                <ControlButton label="More" onPress={increaseOpacity} />
              </ControlGroup>

              <ControlGroup label="Size">
                <ControlButton label="Smaller" onPress={decreaseScale} />
                <ControlValue value={`${Math.round(transform.scale * 100)}%`} />
                <ControlButton label="Larger" onPress={increaseScale} />
              </ControlGroup>

              <ControlGroup label="Rotate">
                <ControlButton label="Left" onPress={rotateLeft} />
                <ControlValue value={`${Math.round(transform.rotation)}°`} />
                <ControlButton label="Right" onPress={rotateRight} />
              </ControlGroup>
            </View>

            <View style={styles.nudgePanel}>
              <Text style={styles.nudgeTitle}>Nudge</Text>
              <View style={styles.nudgeRowCenter}>
                <ControlButton label="Up" onPress={nudgeUp} />
              </View>
              <View style={styles.nudgeRow}>
                <ControlButton label="Left" onPress={nudgeLeft} />
                <ControlButton label="Down" onPress={nudgeDown} />
                <ControlButton label="Right" onPress={nudgeRight} />
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable style={[styles.actionButton, overlayLocked && styles.actionButtonActive]} onPress={() => setOverlayLocked((locked) => !locked)} accessibilityRole="button">
                <Text style={[styles.actionButtonText, overlayLocked && styles.actionButtonTextActive]}>{overlayLocked ? 'Unlock overlay' : 'Lock overlay'}</Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={resetOverlay} accessibilityRole="button">
                <Text style={styles.actionButtonText}>Reset</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.controlGroup}>
      <Text style={styles.controlLabel}>{label}</Text>
      <View style={styles.controlRow}>{children}</View>
    </View>
  )
}

function ControlButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.controlButton} onPress={onPress} accessibilityRole="button">
      <Text style={styles.controlButtonText}>{label}</Text>
    </Pressable>
  )
}

function ControlValue({ value }: { value: string }) {
  return (
    <View style={styles.controlValue}>
      <Text style={styles.controlValueText}>{value}</Text>
    </View>
  )
}

function TraceIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Rect x={5} y={3} width={18} height={22} rx={4} stroke={palette.ink} strokeWidth={2.2} />
      <Path d="M9 17c0-4 2.8-7 6.4-7 3.3 0 5.7 2.6 5.7 6 0 3.7-2.7 6.4-6 6.4-3.6 0-6.1-2.3-6.1-5.4Z" stroke={palette.ink} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 17c-2.3-1.9-4-2.2-5.1-.6-.9 1.3-.6 2.8.7 3.5 1.7.9 3.1 0 4.4-2.9Z" stroke={palette.coral} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function ImageIcon() {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30" fill="none">
      <Rect x={4} y={5} width={22} height={20} rx={5} stroke={palette.ink} strokeWidth={2.2} />
      <Circle cx={11} cy={12} r={2.3} fill={palette.coral} />
      <Path d="m7 22 6-6 4 4 3-3 4 5" stroke={palette.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function BackIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M11.5 3.5 6 9l5.5 5.5" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function LockIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Rect x={4} y={9} width={14} height={10} rx={3} stroke="#FFFFFF" strokeWidth={2.1} />
      <Path d="M7 9V7a4 4 0 0 1 8 0v2" stroke="#FFFFFF" strokeWidth={2.1} strokeLinecap="round" />
    </Svg>
  )
}

function UnlockIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Rect x={4} y={9} width={14} height={10} rx={3} stroke="#FFFFFF" strokeWidth={2.1} />
      <Path d="M8 9V7a4 4 0 0 1 7.4-2.1" stroke="#FFFFFF" strokeWidth={2.1} strokeLinecap="round" />
    </Svg>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <TraceBuddyMobile />
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  pickerContent: {
    paddingHorizontal: 14,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 34,
    padding: 18,
    marginBottom: 16,
    backgroundColor: palette.surface,
    shadowColor: palette.ink,
    shadowOpacity: 0.09,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.paperStrong,
  },
  eyebrow: {
    color: palette.coralDark,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 35,
    lineHeight: 36,
    letterSpacing: -1.6,
    fontWeight: '900',
  },
  heroCopy: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  uploadPill: {
    minHeight: 78,
    marginTop: 18,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 121, 93, 0.28)',
    backgroundColor: palette.paperStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uploadCopy: {
    flex: 1,
  },
  uploadTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  uploadSmall: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 3,
  },
  categoryStrip: {
    gap: 8,
    paddingHorizontal: 2,
    paddingBottom: 10,
  },
  categoryChip: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: 'rgba(255,255,255,0.82)',
    paddingLeft: 14,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryChipActive: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  categoryText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  categoryCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.paperStrong,
  },
  categoryCountActive: {
    backgroundColor: palette.coral,
  },
  categoryCountText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  templateCount: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
    paddingLeft: 2,
  },
  cardRow: {
    gap: 10,
  },
  drawingCard: {
    flex: 1,
    minHeight: 220,
    marginBottom: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 9,
    shadowColor: palette.ink,
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  drawingCardSelected: {
    borderColor: 'rgba(255, 121, 93, 0.55)',
    backgroundColor: '#FFFDF8',
  },
  drawingPreview: {
    aspectRatio: 1,
    borderRadius: 19,
    backgroundColor: palette.paper,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawingMeta: {
    marginTop: 8,
    gap: 2,
  },
  drawingName: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  drawingTheme: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  difficultyBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: palette.paperStrong,
    color: palette.coralDark,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  traceShell: {
    flex: 1,
    backgroundColor: palette.camera,
    overflow: 'hidden',
  },
  pointerBoxNone: {
    pointerEvents: 'box-none',
  },
  pointerBoxOnly: {
    pointerEvents: 'box-only',
  },
  cameraFallback: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: palette.camera,
  },
  fakePaper: {
    position: 'absolute',
    width: '68%',
    height: '46%',
    borderRadius: 28,
    backgroundColor: 'rgba(255,247,234,0.14)',
    transform: [{ rotate: '-4deg' }],
  },
  cameraFallbackTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  cameraFallbackCopy: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  cameraRetryButton: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  cameraRetryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  traceHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    zIndex: 5,
  },
  headerButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: 'rgba(16,25,39,0.68)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  headerButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  traceTitleCard: {
    flex: 1,
    minHeight: 52,
    borderRadius: 22,
    backgroundColor: 'rgba(16,25,39,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  traceTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  traceSubtitle: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: 'rgba(16,25,39,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  overlayWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  overlayWrapLocked: {
    borderColor: 'rgba(255,121,93,0.72)',
  },
  uploadedOverlayImage: {
    width: '100%',
    height: '100%',
  },
  traceControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    zIndex: 6,
    alignItems: 'center',
  },
  openControlsButton: {
    minHeight: 54,
    borderRadius: 999,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  openControlsText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  controlsSheet: {
    width: '100%',
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.96)',
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(24,36,58,0.18)',
    marginBottom: 10,
  },
  controlsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  controlsTitle: {
    color: palette.ink,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  controlsStatus: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 3,
    fontWeight: '700',
  },
  hideButton: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: palette.paperStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  hideButtonText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  controlGrid: {
    gap: 9,
  },
  controlGroup: {
    borderRadius: 22,
    backgroundColor: palette.paper,
    padding: 10,
  },
  controlLabel: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  controlRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  controlButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 8,
  },
  controlButtonText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  controlValue: {
    minWidth: 62,
    minHeight: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.ink,
  },
  controlValueText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  nudgePanel: {
    marginTop: 10,
    borderRadius: 22,
    backgroundColor: '#F4FAF6',
    padding: 10,
    gap: 8,
  },
  nudgeTitle: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  nudgeRowCenter: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  nudgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonActive: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  actionButtonText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  actionButtonTextActive: {
    color: '#FFFFFF',
  },
})
