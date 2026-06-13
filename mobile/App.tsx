import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native'
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path, Rect, SvgXml } from 'react-native-svg'

import { createTextDrawing, drawingCategories, drawings, sanitizeTraceText } from '@tracebuddy/shared'
import type { Drawing, DrawingFilterId } from '@tracebuddy/shared'

type ScreenMode = 'picker' | 'trace' | 'practice'
type TraceSurface = 'camera' | 'screen'
type PickerCategoryId = DrawingFilterId

type PracticePoint = {
  x: number
  y: number
}

type BrushToolId = 'pencil' | 'marker' | 'crayon' | 'paint'

type BrushTool = {
  id: BrushToolId
  label: string
  widthMultiplier: number
  opacity: number
  dasharray?: number[]
}

type PracticeStroke = {
  path: string
  color: string
  width: number
  opacity: number
  dasharray?: number[]
}

type PracticeViewport = {
  x: number
  y: number
  scale: number
}

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

const markerColors = ['#18243A', '#4A5568', '#FF795D', '#E45336', '#F2994A', '#F2C94C', '#219653', '#27AE60', '#2F80ED', '#56CCF2', '#9B51E0', '#EB5757', '#8B5E3C'] as const

const brushTools: BrushTool[] = [
  { id: 'pencil', label: 'Pencil', widthMultiplier: 0.62, opacity: 0.72 },
  { id: 'marker', label: 'Marker', widthMultiplier: 1, opacity: 0.9 },
  { id: 'crayon', label: 'Crayon', widthMultiplier: 1.35, opacity: 0.62, dasharray: [1, 5] },
  { id: 'paint', label: 'Paint', widthMultiplier: 2.05, opacity: 0.42 },
]

const brushSizes = [
  { label: 'Fine', value: 5 },
  { label: 'Round', value: 9 },
  { label: 'Fill', value: 16 },
] as const

const defaultPracticeViewport: PracticeViewport = { x: 0, y: 0, scale: 1 }

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
  const [traceSurface, setTraceSurface] = useState<TraceSurface>('camera')
  const [customText, setCustomText] = useState('')
  const [transform, setTransform] = useState<OverlayTransform>(defaultTransform)
  const [overlayLocked, setOverlayLocked] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(true)
  const [isPickingImage, setIsPickingImage] = useState(false)
  const cameraPromptedRef = useRef(false)
  const overlayLockedRef = useRef(false)
  const overlayDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: defaultTransform.x, y: defaultTransform.y, pageX: 0, pageY: 0 })
  const transformRef = useRef(defaultTransform)

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<PickerCategoryId, number>> = { all: drawings.length }
    for (const drawing of drawings) {
      counts[drawing.category] = (counts[drawing.category] ?? 0) + 1
      if (drawing.collection) counts[drawing.collection] = (counts[drawing.collection] ?? 0) + 1
    }
    return counts
  }, [])

  const visibleDrawings = useMemo(() => {
    if (activeCategory === 'all') return drawings
    if (activeCategory === 'curated') return drawings.filter((drawing) => drawing.collection === 'curated')
    return drawings.filter((drawing) => drawing.category === activeCategory)
  }, [activeCategory])

  const pictureName = uploadedImage?.name ?? selectedDrawing.name
  const pictureTheme = uploadedImage ? 'Local image' : selectedDrawing.theme
  const overlayBaseSize = Math.min(width * 0.78, height * 0.44, 430)
  const uploadedAspect = uploadedImage?.width && uploadedImage.height ? uploadedImage.width / uploadedImage.height : 1
  const overlayWidth = uploadedImage ? overlayBaseSize * clamp(uploadedAspect, 0.65, 1.35) : overlayBaseSize
  const overlayHeight = uploadedImage ? overlayBaseSize / clamp(uploadedAspect, 0.65, 1.35) : overlayBaseSize

  const setOverlayTransform = useCallback((update: OverlayTransform | ((current: OverlayTransform) => OverlayTransform)) => {
    const next = typeof update === 'function' ? update(transformRef.current) : update
    transformRef.current = next
    setTransform(next)
  }, [])

  useEffect(() => {
    overlayLockedRef.current = overlayLocked
  }, [overlayLocked])

  useEffect(() => {
    if (mode !== 'trace' && mode !== 'practice') return undefined

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
    dragStartRef.current = { x: defaultTransform.x, y: defaultTransform.y, pageX: 0, pageY: 0 }
    transformRef.current = defaultTransform
    setOverlayTransform(defaultTransform)
    setOverlayLocked(false)
  }, [setOverlayTransform])

  const openTraceWithDrawing = useCallback((drawing: Drawing) => {
    setSelectedDrawing(drawing)
    setUploadedImage(null)
    setMode(traceSurface === 'screen' ? 'practice' : 'trace')
    setControlsOpen(true)
    resetOverlay()
  }, [resetOverlay, traceSurface])

  const openTraceWithCustomText = useCallback(() => {
    const safeText = sanitizeTraceText(customText)
    if (!safeText) {
      Alert.alert('Add words to trace', 'Type a name, word, number, or short phrase first.')
      return
    }

    openTraceWithDrawing(createTextDrawing(safeText))
  }, [customText, openTraceWithDrawing])

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
        setMode(traceSurface === 'screen' ? 'practice' : 'trace')
        setControlsOpen(true)
        resetOverlay()
      }
    } catch {
      Alert.alert('Could not open photos', 'Try again or choose a built-in tracing template.')
    } finally {
      setIsPickingImage(false)
    }
  }, [resetOverlay, traceSurface])

  const adjustOpacity = useCallback((delta: number) => {
    setOverlayTransform((current) => ({ ...current, opacity: clamp(current.opacity + delta, 0.18, 1) }))
  }, [setOverlayTransform])

  const adjustScale = useCallback((delta: number) => {
    setOverlayTransform((current) => ({ ...current, scale: clamp(current.scale + delta, 0.42, 2.2) }))
  }, [setOverlayTransform])

  const adjustRotation = useCallback((delta: number) => {
    setOverlayTransform((current) => ({ ...current, rotation: current.rotation + delta }))
  }, [setOverlayTransform])

  const decreaseOpacity = useCallback(() => adjustOpacity(-0.08), [adjustOpacity])
  const increaseOpacity = useCallback(() => adjustOpacity(0.08), [adjustOpacity])
  const decreaseScale = useCallback(() => adjustScale(-0.08), [adjustScale])
  const increaseScale = useCallback(() => adjustScale(0.08), [adjustScale])
  const rotateLeft = useCallback(() => adjustRotation(-5), [adjustRotation])
  const rotateRight = useCallback(() => adjustRotation(5), [adjustRotation])

  const nudgeOverlay = useCallback((x: number, y: number) => {
    setOverlayTransform((current) => ({ ...current, x: current.x + x, y: current.y + y }))
  }, [setOverlayTransform])

  const nudgeUp = useCallback(() => nudgeOverlay(0, -8), [nudgeOverlay])
  const nudgeLeft = useCallback(() => nudgeOverlay(-8, 0), [nudgeOverlay])
  const nudgeDown = useCallback(() => nudgeOverlay(0, 8), [nudgeOverlay])
  const nudgeRight = useCallback(() => nudgeOverlay(8, 0), [nudgeOverlay])

  const openCameraTrace = useCallback(() => {
    setTraceSurface('camera')
    setMode('trace')
    setControlsOpen(true)
    resetOverlay()
  }, [resetOverlay])

  const openScreenPractice = useCallback(() => {
    setTraceSurface('screen')
    setMode('practice')
  }, [])

  const shouldStartOverlayDrag = useCallback(() => !overlayLockedRef.current, [])

  const startOverlayDrag = useCallback((event: GestureResponderEvent) => {
    if (overlayLockedRef.current) return
    overlayDraggingRef.current = true
    dragStartRef.current = {
      x: transformRef.current.x,
      y: transformRef.current.y,
      pageX: event.nativeEvent.pageX,
      pageY: event.nativeEvent.pageY,
    }
  }, [])

  const moveOverlayDrag = useCallback((event: GestureResponderEvent) => {
    if (!overlayDraggingRef.current || overlayLockedRef.current) return
    const nextX = dragStartRef.current.x + event.nativeEvent.pageX - dragStartRef.current.pageX
    const nextY = dragStartRef.current.y + event.nativeEvent.pageY - dragStartRef.current.pageY
    setOverlayTransform((current) => ({ ...current, x: nextX, y: nextY }))
  }, [setOverlayTransform])

  const endOverlayDrag = useCallback(() => {
    overlayDraggingRef.current = false
  }, [])

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
                <Text style={styles.heroTitle}>Pick a picture, then trace your way.</Text>
                <Text style={styles.heroCopy}>Use the camera for paper tracing, or practice directly on the screen with your finger or stylus. Everything stays local on this phone.</Text>
                <View style={styles.traceSurfaceSwitch} accessibilityLabel="Tracing mode">
                  <Pressable
                    style={[styles.traceSurfaceOption, traceSurface === 'camera' && styles.traceSurfaceOptionActive]}
                    onPress={() => setTraceSurface('camera')}
                    accessibilityRole="button"
                    accessibilityState={{ selected: traceSurface === 'camera' }}
                  >
                    <Text style={[styles.traceSurfaceTitle, traceSurface === 'camera' && styles.traceSurfaceTitleActive]}>Camera + paper</Text>
                    <Text style={[styles.traceSurfaceCopy, traceSurface === 'camera' && styles.traceSurfaceCopyActive]}>Overlay above real paper.</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.traceSurfaceOption, traceSurface === 'screen' && styles.traceSurfaceOptionActive]}
                    onPress={() => setTraceSurface('screen')}
                    accessibilityRole="button"
                    accessibilityState={{ selected: traceSurface === 'screen' }}
                  >
                    <Text style={[styles.traceSurfaceTitle, traceSurface === 'screen' && styles.traceSurfaceTitleActive]}>On-screen practice</Text>
                    <Text style={[styles.traceSurfaceCopy, traceSurface === 'screen' && styles.traceSurfaceCopyActive]}>Trace with finger or stylus.</Text>
                  </Pressable>
                </View>
                <View style={styles.customTextCard}>
                  <View style={styles.customTextCopy}>
                    <Text style={styles.customTextTitle}>Write your own words</Text>
                    <Text style={styles.customTextSmall}>Names, ABCs, numbers, or short phrases.</Text>
                  </View>
                  <TextInput
                    value={customText}
                    onChangeText={setCustomText}
                    placeholder="Stassie, ABC, I love Guam"
                    placeholderTextColor="#8A94A6"
                    style={styles.customTextInput}
                    returnKeyType="done"
                    maxLength={48}
                  />
                  <Pressable style={styles.customTextButton} onPress={openTraceWithCustomText} accessibilityRole="button">
                    <Text style={styles.customTextButtonText}>Trace words</Text>
                  </Pressable>
                </View>
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

  if (mode === 'practice') {
    return (
      <PracticeScreen
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        pictureName={pictureName}
        pictureTheme={pictureTheme}
        selectedDrawing={selectedDrawing}
        uploadedImage={uploadedImage}
        onPicker={() => setMode('picker')}
        onCameraTrace={openCameraTrace}
      />
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

      <View
        style={[
          styles.overlayWrap,
          {
            left: (width - overlayWidth) / 2,
            top: (height - overlayHeight) / 2 - 24,
            width: overlayWidth,
            height: overlayHeight,
            opacity: transform.opacity,
            transform: [
              { translateX: transform.x },
              { translateY: transform.y },
              { scale: transform.scale },
              { rotate: `${transform.rotation}deg` },
            ],
          },
          overlayLocked && styles.overlayWrapLocked,
          styles.pointerBoxOnly,
        ]}
        onStartShouldSetResponder={shouldStartOverlayDrag}
        onMoveShouldSetResponder={shouldStartOverlayDrag}
        onResponderGrant={startOverlayDrag}
        onResponderMove={moveOverlayDrag}
        onResponderRelease={endOverlayDrag}
        onResponderTerminate={endOverlayDrag}
      >
        {uploadedImage ? (
          <Image source={{ uri: uploadedImage.uri }} style={styles.uploadedOverlayImage} resizeMode="contain" />
        ) : (
          <SvgXml xml={selectedDrawing.svg} width="100%" height="100%" />
        )}
      </View>

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
              <Pressable style={styles.actionButton} onPress={openScreenPractice} accessibilityRole="button">
                <Text style={styles.actionButtonText}>Screen</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}

function PracticeScreen({
  insetsTop,
  insetsBottom,
  pictureName,
  pictureTheme,
  selectedDrawing,
  uploadedImage,
  onPicker,
  onCameraTrace,
}: {
  insetsTop: number
  insetsBottom: number
  pictureName: string
  pictureTheme: string
  selectedDrawing: Drawing
  uploadedImage: UploadedImage | null
  onPicker: () => void
  onCameraTrace: () => void
}) {
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 })
  const [practiceStrokes, setPracticeStrokes] = useState<PracticeStroke[]>([])
  const [activePath, setActivePath] = useState('')
  const [markerColor, setMarkerColor] = useState<string>(markerColors[0])
  const [markerWidth, setMarkerWidth] = useState(9)
  const [brushToolId, setBrushToolId] = useState<BrushToolId>('marker')
  const [guideOpacity, setGuideOpacity] = useState(0.24)
  const [viewportLocked, setViewportLocked] = useState(true)
  const [viewport, setViewport] = useState<PracticeViewport>(defaultPracticeViewport)
  const canvasSizeRef = useRef(canvasSize)
  const viewportRef = useRef<PracticeViewport>(defaultPracticeViewport)
  const activePathRef = useRef('')
  const activePointCountRef = useRef(0)
  const activeStrokeStyleRef = useRef<PracticeStroke>({ path: '', color: markerColor, width: markerWidth, opacity: 0.9 })
  const lastPointRef = useRef<PracticePoint | null>(null)
  const drawingActiveRef = useRef(false)
  const viewportGestureRef = useRef<
    | { mode: 'pan'; startPoint: PracticePoint; startViewport: PracticeViewport }
    | { mode: 'pinch'; startDistance: number; startCenter: PracticePoint; startViewport: PracticeViewport }
    | null
  >(null)

  const brushTool = useMemo(() => brushTools.find((tool) => tool.id === brushToolId) ?? brushTools[1], [brushToolId])
  const activeStrokeWidth = markerWidth * brushTool.widthMultiplier

  useEffect(() => {
    canvasSizeRef.current = canvasSize
  }, [canvasSize])

  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  const clampPracticeViewport = useCallback((next: PracticeViewport) => {
    const { width, height } = canvasSizeRef.current
    const scale = clamp(next.scale, 1, 5)
    const extraX = Math.max(0, (scale - 1) * width)
    const extraY = Math.max(0, (scale - 1) * height)
    const overscroll = 90

    return {
      x: clamp(next.x, -extraX - overscroll, overscroll),
      y: clamp(next.y, -extraY - overscroll, overscroll),
      scale,
    }
  }, [])

  const setPracticeViewport = useCallback((update: PracticeViewport | ((current: PracticeViewport) => PracticeViewport)) => {
    const next = typeof update === 'function' ? update(viewportRef.current) : update
    const clamped = clampPracticeViewport(next)
    viewportRef.current = clamped
    setViewport(clamped)
  }, [clampPracticeViewport])

  const handleCanvasLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    const nextSize = { width: Math.max(1, width), height: Math.max(1, height) }
    canvasSizeRef.current = nextSize
    setCanvasSize(nextSize)
    setPracticeViewport((current) => clampPracticeViewport(current))
  }, [clampPracticeViewport, setPracticeViewport])

  const pointFromLocation = useCallback((point: PracticePoint): PracticePoint => {
    const currentViewport = viewportRef.current
    const { width, height } = canvasSizeRef.current
    return {
      x: clamp((point.x - currentViewport.x) / currentViewport.scale, 0, width),
      y: clamp((point.y - currentViewport.y) / currentViewport.scale, 0, height),
    }
  }, [])

  const touchPointsFromEvent = useCallback((event: GestureResponderEvent): PracticePoint[] => {
    const nativeEvent = event.nativeEvent as typeof event.nativeEvent & { touches?: Array<{ locationX: number; locationY: number }> }
    const touches = nativeEvent.touches ?? []
    if (touches.length > 0) return touches.map((touch) => ({ x: touch.locationX, y: touch.locationY }))
    return [{ x: nativeEvent.locationX, y: nativeEvent.locationY }]
  }, [])

  const statsFromPoints = useCallback((points: PracticePoint[]) => {
    if (points.length < 2) return null
    const [first, second] = points
    return {
      distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
      center: {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
      },
    }
  }, [])

  const startViewportGesture = useCallback((points: PracticePoint[]) => {
    const stats = statsFromPoints(points)
    if (stats) {
      viewportGestureRef.current = {
        mode: 'pinch',
        startDistance: stats.distance,
        startCenter: stats.center,
        startViewport: viewportRef.current,
      }
      return
    }

    viewportGestureRef.current = {
      mode: 'pan',
      startPoint: points[0] ?? { x: 0, y: 0 },
      startViewport: viewportRef.current,
    }
  }, [statsFromPoints])

  const finishPracticeStroke = useCallback(() => {
    if (!drawingActiveRef.current) return

    let path = activePathRef.current
    if (path && activePointCountRef.current === 1) path = `${path} l 0.1 0`

    if (path) {
      const { color, width, opacity, dasharray } = activeStrokeStyleRef.current
      setPracticeStrokes((current) => [...current, { path, color, width, opacity, dasharray }])
    }

    activePathRef.current = ''
    activePointCountRef.current = 0
    lastPointRef.current = null
    drawingActiveRef.current = false
    setActivePath('')
  }, [])

  const resetViewportGestureState = useCallback(() => {
    viewportGestureRef.current = null
  }, [])

  const toggleViewportMode = useCallback(() => {
    finishPracticeStroke()
    resetViewportGestureState()
    setViewportLocked((locked) => !locked)
  }, [finishPracticeStroke, resetViewportGestureState])

  const startPracticeStroke = useCallback((event: GestureResponderEvent) => {
    const touches = touchPointsFromEvent(event)
    if (!viewportLocked) {
      startViewportGesture(touches)
      return
    }

    const point = pointFromLocation(touches[0] ?? { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY })
    const path = `M ${point.x} ${point.y}`
    activePathRef.current = path
    activePointCountRef.current = 1
    lastPointRef.current = point
    drawingActiveRef.current = true
    activeStrokeStyleRef.current = {
      path,
      color: markerColor,
      width: activeStrokeWidth,
      opacity: brushTool.opacity,
      dasharray: brushTool.dasharray,
    }
    setActivePath(path)
  }, [activeStrokeWidth, brushTool.dasharray, brushTool.opacity, markerColor, pointFromLocation, startViewportGesture, touchPointsFromEvent, viewportLocked])

  const movePracticeStroke = useCallback((event: GestureResponderEvent) => {
    const touches = touchPointsFromEvent(event)

    if (!viewportLocked) {
      const gesture = viewportGestureRef.current
      if (!gesture) {
        startViewportGesture(touches)
        return
      }

      const stats = statsFromPoints(touches)
      if (stats) {
        const pinchGesture = gesture.mode === 'pinch'
          ? gesture
          : {
              mode: 'pinch' as const,
              startDistance: stats.distance,
              startCenter: stats.center,
              startViewport: viewportRef.current,
            }
        if (gesture.mode !== 'pinch') viewportGestureRef.current = pinchGesture

        const nextScale = clamp(pinchGesture.startViewport.scale * (stats.distance / pinchGesture.startDistance), 1, 5)
        const contentAtStartCenterX = (pinchGesture.startCenter.x - pinchGesture.startViewport.x) / pinchGesture.startViewport.scale
        const contentAtStartCenterY = (pinchGesture.startCenter.y - pinchGesture.startViewport.y) / pinchGesture.startViewport.scale
        setPracticeViewport({
          x: stats.center.x - contentAtStartCenterX * nextScale,
          y: stats.center.y - contentAtStartCenterY * nextScale,
          scale: nextScale,
        })
        return
      }

      if (gesture.mode !== 'pan') {
        startViewportGesture(touches)
        return
      }

      const currentPoint = touches[0]
      if (!currentPoint) return
      setPracticeViewport({
        x: gesture.startViewport.x + currentPoint.x - gesture.startPoint.x,
        y: gesture.startViewport.y + currentPoint.y - gesture.startPoint.y,
        scale: gesture.startViewport.scale,
      })
      return
    }

    if (!drawingActiveRef.current) return

    const point = pointFromLocation(touches[0] ?? { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY })
    const lastPoint = lastPointRef.current
    if (lastPoint && Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < 2.5) return

    activePathRef.current = `${activePathRef.current} L ${point.x} ${point.y}`
    activePointCountRef.current += 1
    lastPointRef.current = point
    setActivePath(activePathRef.current)
  }, [pointFromLocation, setPracticeViewport, startViewportGesture, statsFromPoints, touchPointsFromEvent, viewportLocked])

  const finishPracticeGesture = useCallback(() => {
    if (viewportLocked) {
      finishPracticeStroke()
      return
    }

    resetViewportGestureState()
  }, [finishPracticeStroke, resetViewportGestureState, viewportLocked])

  const undoPracticeStroke = useCallback(() => {
    setPracticeStrokes((current) => current.slice(0, -1))
  }, [])

  const clearPracticeStrokes = useCallback(() => {
    activePathRef.current = ''
    activePointCountRef.current = 0
    lastPointRef.current = null
    drawingActiveRef.current = false
    setActivePath('')
    setPracticeStrokes([])
  }, [])

  const lightenGuide = useCallback(() => {
    setGuideOpacity((current) => clamp(current - 0.06, 0.08, 0.66))
  }, [])

  const darkenGuide = useCallback(() => {
    setGuideOpacity((current) => clamp(current + 0.06, 0.08, 0.66))
  }, [])

  const zoomPractice = useCallback((amount: number) => {
    const { width, height } = canvasSizeRef.current
    const center = { x: width / 2, y: height / 2 }
    const startViewport = viewportRef.current
    const nextScale = clamp(startViewport.scale + amount, 1, 5)
    const contentX = (center.x - startViewport.x) / startViewport.scale
    const contentY = (center.y - startViewport.y) / startViewport.scale
    setPracticeViewport({
      x: center.x - contentX * nextScale,
      y: center.y - contentY * nextScale,
      scale: nextScale,
    })
  }, [setPracticeViewport])

  const resetPracticeViewport = useCallback(() => {
    resetViewportGestureState()
    setPracticeViewport(defaultPracticeViewport)
  }, [resetViewportGestureState, setPracticeViewport])

  return (
    <View style={styles.practiceShell}>
      <StatusBar style="dark" />
      <View style={[styles.practiceHeader, { paddingTop: insetsTop + 12 }]}>
        <Pressable style={styles.practiceHeaderButton} onPress={onPicker} accessibilityRole="button" accessibilityLabel="Back to picture picker">
          <Text style={styles.practiceHeaderButtonText}>Picker</Text>
        </Pressable>
        <View style={styles.practiceTitleCard}>
          <Text style={styles.practiceTitle} numberOfLines={1}>{pictureName}</Text>
          <Text style={styles.practiceSubtitle} numberOfLines={1}>{pictureTheme} · {viewportLocked ? 'Draw locked' : 'Move and zoom'}</Text>
        </View>
        <Pressable style={styles.practiceHeaderButton} onPress={onCameraTrace} accessibilityRole="button" accessibilityLabel="Switch to camera tracing">
          <Text style={styles.practiceHeaderButtonText}>Camera</Text>
        </Pressable>
      </View>

      <View style={styles.practiceStageCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.practiceToolScroller} contentContainerStyle={styles.practiceToolRail}>
          <Pressable
            style={[styles.practiceModeButton, viewportLocked && styles.practiceModeButtonActive]}
            onPress={toggleViewportMode}
            accessibilityRole="button"
            accessibilityState={{ selected: viewportLocked }}
            accessibilityLabel={viewportLocked ? 'Canvas locked for drawing' : 'Canvas unlocked for moving and zooming'}
          >
            <Text style={[styles.practiceModeButtonText, viewportLocked && styles.practiceModeButtonTextActive]}>{viewportLocked ? 'Locked' : 'Move'}</Text>
            <Text style={styles.practiceModeButtonSubtext}>{viewportLocked ? 'Draw mode' : 'Pan + zoom'}</Text>
          </Pressable>

          <View style={styles.practiceToolGroupCompact}>
            <Text style={styles.practiceOptionLabel}>Color</Text>
            <View style={styles.colorSwatchesCompact}>
              {markerColors.map((color) => (
                <Pressable
                  key={color}
                  style={[styles.colorSwatchCompact, { backgroundColor: color }, markerColor === color && styles.colorSwatchActive]}
                  onPress={() => setMarkerColor(color)}
                  accessibilityRole="button"
                  accessibilityLabel={`Use marker color ${color}`}
                />
              ))}
            </View>
          </View>

          <View style={styles.practiceToolGroupCompact}>
            <Text style={styles.practiceOptionLabel}>Brush</Text>
            <View style={styles.practiceSegmentedRowCompact}>
              {brushTools.map((tool) => (
                <Pressable key={tool.id} style={[styles.practiceMiniButtonCompact, brushToolId === tool.id && styles.practiceMiniButtonActive]} onPress={() => setBrushToolId(tool.id)} accessibilityRole="button">
                  <Text style={[styles.practiceMiniButtonText, brushToolId === tool.id && styles.practiceMiniButtonTextActive]}>{tool.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.practiceToolGroupCompact}>
            <Text style={styles.practiceOptionLabel}>Size</Text>
            <View style={styles.practiceSegmentedRowCompact}>
              {brushSizes.map((size) => (
                <Pressable key={size.value} style={[styles.practiceMiniButtonCompact, markerWidth === size.value && styles.practiceMiniButtonActive]} onPress={() => setMarkerWidth(size.value)} accessibilityRole="button">
                  <Text style={[styles.practiceMiniButtonText, markerWidth === size.value && styles.practiceMiniButtonTextActive]}>{size.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.practiceToolGroupCompact}>
            <Text style={styles.practiceOptionLabel}>Guide {Math.round(guideOpacity * 100)}%</Text>
            <View style={styles.practiceSegmentedRowCompact}>
              <Pressable style={styles.practiceMiniButtonCompact} onPress={lightenGuide} accessibilityRole="button">
                <Text style={styles.practiceMiniButtonText}>Less</Text>
              </Pressable>
              <Pressable style={styles.practiceMiniButtonCompact} onPress={darkenGuide} accessibilityRole="button">
                <Text style={styles.practiceMiniButtonText}>More</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.practiceToolGroupCompact}>
            <Text style={styles.practiceOptionLabel}>Zoom {Math.round(viewport.scale * 100)}%</Text>
            <View style={styles.practiceSegmentedRowCompact}>
              <Pressable style={[styles.practiceMiniButtonCompact, viewportLocked && styles.practiceMiniButtonDisabled]} disabled={viewportLocked} onPress={() => zoomPractice(-0.35)} accessibilityRole="button">
                <Text style={styles.practiceMiniButtonText}>−</Text>
              </Pressable>
              <Pressable style={[styles.practiceMiniButtonCompact, viewportLocked && styles.practiceMiniButtonDisabled]} disabled={viewportLocked} onPress={() => zoomPractice(0.35)} accessibilityRole="button">
                <Text style={styles.practiceMiniButtonText}>+</Text>
              </Pressable>
              <Pressable style={[styles.practiceMiniButtonCompact, viewport.scale === 1 && viewport.x === 0 && viewport.y === 0 && styles.practiceMiniButtonDisabled]} disabled={viewport.scale === 1 && viewport.x === 0 && viewport.y === 0} onPress={resetPracticeViewport} accessibilityRole="button">
                <Text style={styles.practiceMiniButtonText}>Reset</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <Text style={styles.practiceCanvasHint} numberOfLines={1}>{viewportLocked ? 'Locked: draw and color without moving the page.' : 'Move: drag or pinch, then lock to draw.'}</Text>

        <View
          style={styles.practiceCanvas}
          onLayout={handleCanvasLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={startPracticeStroke}
          onResponderMove={movePracticeStroke}
          onResponderRelease={finishPracticeGesture}
          onResponderTerminate={finishPracticeGesture}
        >
          <View
            style={[
              styles.practiceTransformLayer,
              {
                width: canvasSize.width,
                height: canvasSize.height,
                transform: [
                  { translateX: viewport.x },
                  { translateY: viewport.y },
                  { scale: viewport.scale },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <View style={[styles.practiceGuide, { opacity: guideOpacity }]} pointerEvents="none">
              {uploadedImage ? (
                <Image source={{ uri: uploadedImage.uri }} style={styles.practiceGuideImage} resizeMode="contain" />
              ) : (
                <SvgXml xml={selectedDrawing.svg} width="100%" height="100%" />
              )}
            </View>
            <Svg
              pointerEvents="none"
              width={canvasSize.width}
              height={canvasSize.height}
              viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
              style={styles.practiceInkLayer}
            >
              {practiceStrokes.map((stroke, index) => (
                <Path key={`stroke-${index}`} d={stroke.path} stroke={stroke.color} strokeWidth={stroke.width} strokeOpacity={stroke.opacity} strokeDasharray={stroke.dasharray} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              ))}
              {activePath && (
                <Path d={activePath} stroke={markerColor} strokeWidth={activeStrokeWidth} strokeOpacity={brushTool.opacity} strokeDasharray={brushTool.dasharray} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              )}
            </Svg>
          </View>
        </View>
      </View>

      <View style={[styles.practiceToolbar, { paddingBottom: insetsBottom + 12 }]}>
        <Pressable style={[styles.practiceToolButton, practiceStrokes.length === 0 && styles.practiceToolButtonDisabled]} onPress={undoPracticeStroke} disabled={practiceStrokes.length === 0} accessibilityRole="button">
          <Text style={styles.practiceToolButtonText}>Undo</Text>
        </Pressable>
        <Pressable style={[styles.practiceToolButton, practiceStrokes.length === 0 && !activePath && styles.practiceToolButtonDisabled]} onPress={clearPracticeStrokes} disabled={practiceStrokes.length === 0 && !activePath} accessibilityRole="button">
          <Text style={styles.practiceToolButtonText}>Clear</Text>
        </Pressable>
        <Pressable style={[styles.practiceToolButton, styles.practiceToolButtonPrimary]} onPress={onCameraTrace} accessibilityRole="button">
          <Text style={[styles.practiceToolButtonText, styles.practiceToolButtonPrimaryText]}>Use camera</Text>
        </Pressable>
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
  customTextCard: {
    marginTop: 14,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#FFFDF8',
    padding: 12,
    gap: 10,
  },
  customTextCopy: {
    gap: 3,
  },
  customTextTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  customTextSmall: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  customTextInput: {
    minHeight: 48,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 12,
  },
  customTextButton: {
    minHeight: 46,
    borderRadius: 17,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customTextButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  traceSurfaceSwitch: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  traceSurfaceOption: {
    flex: 1,
    minHeight: 78,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#FFFDF8',
    padding: 12,
    justifyContent: 'center',
  },
  traceSurfaceOptionActive: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  traceSurfaceTitle: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  traceSurfaceTitleActive: {
    color: '#FFFFFF',
  },
  traceSurfaceCopy: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
    fontWeight: '700',
  },
  traceSurfaceCopyActive: {
    color: 'rgba(255,255,255,0.72)',
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
  practiceShell: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  practiceHeader: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    zIndex: 5,
  },
  practiceHeaderButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  practiceHeaderButtonText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  practiceTitleCard: {
    flex: 1,
    minHeight: 52,
    borderRadius: 22,
    backgroundColor: palette.ink,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  practiceTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  practiceSubtitle: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  practiceStageCard: {
    flex: 1,
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 8,
    shadowColor: palette.ink,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  practiceStageIntro: {
    marginBottom: 12,
  },
  practiceStageEyebrow: {
    color: palette.coralDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  practiceStageTitle: {
    color: palette.ink,
    fontSize: 24,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 4,
  },
  practiceStageCopy: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  practiceOptionsPanel: {
    borderRadius: 24,
    backgroundColor: palette.paper,
    padding: 10,
    gap: 10,
    marginBottom: 12,
  },
  practiceToolScroller: {
    flexGrow: 0,
    flexShrink: 0,
    height: 66,
    maxHeight: 66,
  },
  practiceToolRail: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  practiceModeButton: {
    minWidth: 92,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  practiceModeButtonActive: {
    borderColor: 'rgba(107,215,183,0.55)',
    backgroundColor: '#E9FFF7',
  },
  practiceModeButtonText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  practiceModeButtonTextActive: {
    color: '#17634F',
  },
  practiceModeButtonSubtext: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  practiceToolGroupCompact: {
    height: 58,
    borderRadius: 18,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: 'rgba(24,36,58,0.08)',
    padding: 8,
    gap: 6,
    justifyContent: 'center',
  },
  practiceOptionGroup: {
    gap: 8,
  },
  practiceOptionLabel: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  colorSwatches: {
    flexDirection: 'row',
    gap: 8,
  },
  colorSwatchesCompact: {
    flexDirection: 'row',
    gap: 6,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  colorSwatchCompact: {
    width: 25,
    height: 25,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  colorSwatchActive: {
    borderColor: palette.ink,
    transform: [{ scale: 1.08 }],
  },
  practiceSegmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  practiceSegmentedRowCompact: {
    flexDirection: 'row',
    gap: 6,
  },
  practiceMiniButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceMiniButtonCompact: {
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  practiceMiniButtonDisabled: {
    opacity: 0.42,
  },
  practiceMiniButtonActive: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  practiceMiniButtonText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  practiceMiniButtonTextActive: {
    color: '#FFFFFF',
  },
  practiceCanvas: {
    flex: 1,
    minHeight: 430,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#FFFDF7',
    borderWidth: 1,
    borderColor: 'rgba(24,36,58,0.1)',
  },
  practiceCanvasHint: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    height: 18,
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  practiceTransformLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: [0, 0, 0],
  },
  practiceGuide: {
    position: 'absolute',
    top: 18,
    right: 18,
    bottom: 18,
    left: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceGuideImage: {
    width: '100%',
    height: '100%',
  },
  practiceInkLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  practiceToolbar: {
    paddingHorizontal: 12,
    paddingTop: 2,
    flexDirection: 'row',
    gap: 8,
  },
  practiceToolButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceToolButtonPrimary: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  practiceToolButtonDisabled: {
    opacity: 0.42,
  },
  practiceToolButtonText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  practiceToolButtonPrimaryText: {
    color: '#FFFFFF',
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
