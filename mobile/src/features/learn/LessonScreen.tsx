import { router, useLocalSearchParams, useNavigation } from 'expo-router'
import { usePreventRemove } from 'expo-router/react-navigation'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, AppState, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, { ReduceMotion, ZoomIn, useReducedMotion } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { drawingLessonById } from '../../../../shared/lessons/drawingLessons'
import type { DrawingLesson } from '../../../../shared/lessons/drawingLessons'
import { lessonGeometryLoaders } from '../../../../shared/lessons/lesson-geometry.generated'
import type { PracticeStroke, SavedPracticeSession } from '../../../practiceStorageModel'
import { resolvePicture, sourceForPicture } from '../../data/catalog'
import { newDrawing, readDrawing } from '../../data/drawingLibrary'
import { usePictureLine } from '../../data/usePictureLine'
import { Button } from '../../ui/Button'
import { CanvasButton } from '../../ui/CanvasButton'
import { Icon } from '../../ui/Icon'
import type { IconGlyph } from '../../ui/Icon'
import { ArrowClockwiseIcon, ArrowCounterClockwiseIcon, ArrowUUpLeftIcon, CaretLeftIcon, CaretRightIcon, CheckIcon,
  CopyIcon, CrosshairSimpleIcon, EyeIcon, PencilSimpleIcon, SpeakerHighIcon, SpeakerSlashIcon, SparkleIcon, TrashIcon, XIcon,
} from '../../ui/icons'
import { PageHeader } from '../../ui/PageHeader'
import { PressTarget } from '../../ui/PressTarget'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { useReduceMotion } from '../../ui/useReduceMotion'
import { DrawingCanvas } from '../draw/DrawingCanvas'
import type { CanvasHandle } from '../draw/DrawingCanvas'
import { PracticeInk } from '../draw/PracticeInk'
import { useDrawSession } from '../draw/useDrawSession'
import { LessonArt } from './LessonArt'
import { WatchArt } from './WatchArt'
import { lessonResume, lessonSessionId, undoLessonStroke } from './lessonPractice'
import { readLessonMuted, readLessonProgress, restartSavedLesson, saveLessonMuted, saveLessonProgress } from './lessonStorage'
import { useLessonSpeech } from './useLessonSpeech'

type Resume = ReturnType<typeof lessonResume>
type OpenLesson = { initial: SavedPracticeSession; wasSaved: boolean; progress: Resume; muted: boolean }
type Support = 'trace' | 'copy'
type Phase = 'watch' | 'draw' | 'finish'

const noStrokes: PracticeStroke[] = []
const celebration = ZoomIn.duration(360).reduceMotion(ReduceMotion.System)

export default function LessonScreen() {
  const { id, level } = useLocalSearchParams<{ id: string; level: string }>()
  const lesson = useMemo(() => {
    const metadata = drawingLessonById(`${level}/${id}`)
    const geometry = metadata && lessonGeometryLoaders[metadata.id]?.()
    return metadata && geometry ? { ...metadata, ...geometry } : undefined
  }, [id, level])
  if (lesson) return <LoadLesson key={lesson.id} lesson={lesson} />
  return <LessonLoading status="error" />
}

function LoadLesson({ lesson }: { lesson: DrawingLesson }) {
  const picture = useMemo(() => resolvePicture({ id: lesson.pictureId, level: lesson.level }), [lesson])
  const [attempt, setAttempt] = useState(0)
  const guide = usePictureLine(picture, attempt)
  const guideSvg = guide.status === 'ready' ? guide.xml : undefined
  const [loaded, setLoaded] = useState<{ attempt: number; value: OpenLesson | null }>()

  useEffect(() => {
    if (!picture || guideSvg === undefined) return
    let active = true
    const id = lessonSessionId(lesson)
    void Promise.all([readDrawing(id), readLessonProgress(), readLessonMuted().catch(() => false)])
      .then(([drawing, progress, muted]) => {
        if (!active) return
        const initial = drawing ?? { ...newDrawing(sourceForPicture(picture, guideSvg)), sessionId: id, title: lesson.title }
        setLoaded({ attempt, value: { initial, wasSaved: Boolean(drawing), progress: lessonResume(progress, lesson, drawing), muted } })
      }).catch(() => { if (active) setLoaded({ attempt, value: null }) })
    return () => { active = false }
  }, [attempt, guideSvg, lesson, picture])

  const attemptResult = loaded?.attempt === attempt ? loaded.value : undefined
  if (attemptResult) return <LessonPlayer lesson={lesson} data={attemptResult} />
  const failed = !picture || guide.status === 'error' || attemptResult === null
  return <LessonLoading status={failed ? 'error' : 'loading'} retry={() => setAttempt((value) => value + 1)} />
}

function LessonLoading({ status, retry }: { status: 'loading' | 'error'; retry?: () => void }) {
  return (
    <SafeAreaView style={styles.page}>
      <PageHeader title="Learn to draw" onBack={leaveLesson} />
      <View style={styles.empty}>
        {status === 'loading'
          ? <ActivityIndicator color={theme.colors.ink} accessibilityLabel="Opening lesson" />
          : <>
            <Text variant="heading">This lesson could not open.</Text>
            {retry && <Button label="Try again" onPress={retry} />}
          </>}
      </View>
    </SafeAreaView>
  )
}

function leaveLesson() {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}

function LessonPlayer({ lesson, data }: { lesson: DrawingLesson; data: OpenLesson }) {
  const { session, change, save, clear, saveFailed } = useDrawSession(data.initial, data.wasSaved)
  const [step, setStep] = useState(data.progress.step)
  const [phase, setPhase] = useState<Phase>(data.progress.finished ? 'finish' : 'watch')
  const [support, setSupport] = useState<Support>('trace')
  const [muted, setMuted] = useState(data.muted)
  const [replay, setReplay] = useState(0)
  const [busy, setBusy] = useState(false)
  const [room, setRoom] = useState({ width: 0, height: 0 })
  const canvas = useRef<CanvasHandle>(null)
  const running = useRef(false)
  const navigation = useNavigation()
  const { width, height } = useWindowDimensions()
  const sideBySide = width > height
  const systemReduceMotion = useReducedMotion()
  const reduceMotion = useReduceMotion(systemReduceMotion)
  const { say } = lesson.steps[step]
  const { speak, speakAutomatically, stop } = useLessonSpeech(!muted)
  const cueKey = `${step}-${replay}`
  const spokenCue = useRef<string>(undefined)
  const completedCue = useRef<string>(undefined)
  const interruptedCue = useRef<string>(undefined)
  const playbackKey = `${cueKey}/${reduceMotion ? 'still' : 'animated'}`
  const cueStep = useCallback(() => {
    if (!running.current && spokenCue.current !== cueKey && speakAutomatically(say)) spokenCue.current = cueKey
  }, [cueKey, say, speakAutomatically])
  const completeWatch = useCallback(() => {
    if (AppState.currentState === 'active' || AppState.currentState == null) completedCue.current = playbackKey
  }, [playbackKey])
  const last = step === lesson.steps.length - 1
  const side = Math.floor(Math.min(room.width, room.height))
  const copy = phase === 'draw' && support === 'copy'
  const canEdit = session.strokes.some((stroke) => stroke.lessonStep === step)
  const watch = phase === 'watch'
  const visibleSession = useMemo(() => watch ? { ...session, strokes: noStrokes } : session, [session, watch])

  const flushAndSave = useCallback(async () => {
    await canvas.current?.flush()
    return save()
  }, [save])

  const handleAppActivity = useEffectEvent((active: boolean, wasActive: boolean) => {
    if (active === wasActive) return
    if (!active) {
      interruptedCue.current = watch && completedCue.current !== playbackKey ? cueKey : undefined
      void flushAndSave()
      return
    }

    const restart = watch && interruptedCue.current === cueKey
    interruptedCue.current = undefined
    if (restart) setReplay((value) => value + 1)
    else if (watch && reduceMotion) completedCue.current = playbackKey
  })

  useEffect(() => {
    let active = AppState.currentState === 'active' || AppState.currentState == null
    if (!active) handleAppActivity(false, true)
    const listener = AppState.addEventListener('change', (status) => {
      const wasActive = active
      active = status === 'active'
      handleAppActivity(active, wasActive)
    })
    return () => listener.remove()
  }, [])

  const addStroke = useCallback((stroke: PracticeStroke) => {
    change((value) => ({ ...value, strokes: [...value.strokes, { ...stroke, lessonStep: step }] }))
  }, [change, step])

  const transact = useCallback(async (action: () => Promise<void>) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    try {
      await action()
    } catch {
      Alert.alert('Could not save the lesson', 'Your lesson is still open. Try again.')
    } finally {
      running.current = false
      setBusy(false)
    }
  }, [])

  usePreventRemove(true, ({ data: event }) => {
    void transact(async () => {
      stop()
      if (!await flushAndSave()) throw new Error('Save failed')
      navigation.dispatch(event.action)
    })
  })

  function goTo(next: number) {
    stop()
    void transact(async () => {
      if (!await flushAndSave()) throw new Error('Save failed')
      await saveLessonProgress(lesson, next)
      setStep(next)
      setPhase('watch')
    })
  }

  function finish() {
    stop()
    void transact(async () => {
      if (!await flushAndSave()) throw new Error('Save failed')
      await saveLessonProgress(lesson, step, true)
      change((value) => ({ ...value, lessonFinished: true }))
      if (!await save()) throw new Error('Save failed')
      setPhase('finish')
    })
  }

  function drawAgain() {
    void transact(async () => {
      if (!await clear((drawing, isCurrent) => restartSavedLesson(lesson, drawing, isCurrent))) throw new Error('Save failed')
      setRoom({ width: 0, height: 0 })
      setStep(0)
      setPhase('watch')
    })
  }

  function drawOrWatch(next: Phase) {
    stop()
    if (next === 'draw') setPhase(next)
    else void transact(async () => {
      await canvas.current?.flush()
      setReplay((value) => value + 1)
      setPhase(next)
    })
  }

  function editStroke(clear: boolean) {
    void transact(async () => {
      await canvas.current?.flush()
      change((value) => {
        const strokes = clear ? value.strokes.filter((stroke) => stroke.lessonStep !== step) : undoLessonStroke(value.strokes, step)
        return strokes === value.strokes ? value : { ...value, strokes }
      })
    })
  }

  function toggleMute() {
    if (!muted) stop()
    setMuted(!muted)
    void saveLessonMuted(!muted).catch(() => Alert.alert('Could not save sound setting'))
  }

  const header = (
    <View style={styles.header}>
      <CanvasButton glyph={XIcon} label="Close lesson" onPress={leaveLesson} disabled={busy} />
      <Text accessibilityRole="header" variant="heading" style={styles.title}
        numberOfLines={2} maxFontSizeMultiplier={1.4}>{lesson.title}</Text>
      <CanvasButton glyph={muted ? SpeakerSlashIcon : SpeakerHighIcon}
        label={muted ? 'Turn read-aloud on' : 'Turn read-aloud off'}
        selected={!muted} onPress={toggleMute} />
      {phase !== 'finish' && <CanvasButton glyph={ArrowClockwiseIcon} label="Turn picture" haptic
        onPress={() => canvas.current?.turn()} disabled={busy} />}
    </View>
  )

  if (phase === 'finish') {
    return (
      <SafeAreaView style={styles.page}>
        {header}
        <LessonFinish lesson={lesson} session={session} busy={busy} reduceMotion={reduceMotion}
          color={() => router.replace({ pathname: '/draw/[id]', params: { id: lesson.pictureId, sessionId: session.sessionId } })}
          again={drawAgain} more={() => router.dismissTo({ pathname: '/', params: { lessons: '1' } })} />
      </SafeAreaView>
    )
  }

  const strip = (
    <View style={styles.instructions}>
      <View style={styles.strip}>
        <View style={[styles.stepPicture, copy && styles.copyPicture]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <LessonArt lesson={lesson} step={step} startDots={false} focus={copy} />
        </View>
        <View style={styles.stepText}>
          <Text variant="small" tone="muted" maxFontSizeMultiplier={1.35}>Step {step + 1} of {lesson.steps.length}</Text>
          <Text variant="label" accessibilityLiveRegion="polite" accessibilityLabel={say}
            numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.82} maxFontSizeMultiplier={1.45}>{say}</Text>
        </View>
        <CanvasButton glyph={SpeakerHighIcon} label="Listen" onPress={() => {
          if (watch) spokenCue.current = cueKey
          speak(say)
        }} style={styles.listen} />
      </View>
      {!watch && (
        <View style={styles.support}>
          <LessonControl glyph={CrosshairSimpleIcon} label="Trace" selected={support === 'trace'} onPress={() => setSupport('trace')} disabled={busy} inline />
          <LessonControl glyph={CopyIcon} label="Copy" selected={support === 'copy'} onPress={() => setSupport('copy')} disabled={busy} inline />
        </View>
      )}
    </View>
  )

  return (
    <SafeAreaView style={styles.page}>
      {header}
      {saveFailed && <Text variant="label" style={styles.status} accessibilityLiveRegion="polite">Couldn’t save yet. Try again.</Text>}
      <View style={[styles.workspace, sideBySide && styles.workspaceWide]}>
        {sideBySide ? <ScrollView style={styles.sideStrip} contentContainerStyle={styles.sideContent}>{strip}</ScrollView> : strip}
        <View style={styles.canvas} onLayout={({ nativeEvent: { layout } }) => setRoom(
          (value) => value.width === layout.width && value.height === layout.height ? value : layout,
        )}>
          {side > 0 && (
            <DrawingCanvas ref={canvas} area={room} side={side} session={visibleSession} disabled={busy} readOnly={watch} onStroke={addStroke}
              guideLayer={watch
                ? <WatchArt key={cueKey} lesson={lesson} step={step} side={side} still={reduceMotion} onStart={cueStep} onFinish={completeWatch} />
                : !copy && <LessonArt lesson={lesson} step={step} guide />} />
          )}
        </View>
      </View>
      <View style={styles.controls}>
        {watch ? <>
          <LessonControl glyph={CaretLeftIcon} label="Back" onPress={() => goTo(step - 1)} disabled={busy || step === 0} />
          <LessonControl glyph={ArrowCounterClockwiseIcon} label="Replay" onPress={() => {
            stop()
            setReplay((value) => value + 1)
          }} disabled={busy} />
          <LessonControl glyph={PencilSimpleIcon} label="Your turn" onPress={() => drawOrWatch('draw')} disabled={busy} primary />
          <LessonControl glyph={last ? CheckIcon : CaretRightIcon} label={last ? 'Finish' : 'Next'} onPress={last ? finish : () => goTo(step + 1)} disabled={busy} />
        </> : <>
          <LessonControl glyph={EyeIcon} label="Watch" onPress={() => drawOrWatch('watch')} disabled={busy} />
          <LessonControl glyph={ArrowUUpLeftIcon} label="Undo" onPress={() => editStroke(false)} disabled={busy || !canEdit} />
          <LessonControl glyph={CheckIcon} label="Done" onPress={last ? finish : () => goTo(step + 1)} disabled={busy} primary />
          <LessonControl glyph={TrashIcon} label="Clear" onPress={() => editStroke(true)} disabled={busy || !canEdit} />
        </>}
      </View>
    </SafeAreaView>
  )
}

function LessonControl({ glyph, label, onPress, disabled, primary, selected, inline }: {
  glyph: IconGlyph; label: string; onPress: () => void; disabled?: boolean; primary?: boolean; selected?: boolean; inline?: boolean
}) {
  return (
    <PressTarget accessibilityLabel={label} onPress={onPress} disabled={disabled} selected={selected} haptic
      style={[styles.control, inline && styles.inline, selected && styles.picked, primary && styles.primary]}>
      <Icon glyph={glyph} />
      <Text variant="small" maxFontSizeMultiplier={1.4} numberOfLines={1} adjustsFontSizeToFit
        minimumFontScale={0.82} style={styles.controlLabel}>{label}</Text>
    </PressTarget>
  )
}

function LessonFinish({ lesson, session, busy, reduceMotion, color, again, more }: {
  lesson: DrawingLesson; session: SavedPracticeSession; busy: boolean; reduceMotion: boolean
  color: () => void; again: () => void; more: () => void
}) {
  const { width, height } = useWindowDimensions()
  const side = Math.min(290, width - 2 * theme.space.lg, height * 0.39)
  return (
    <ScrollView contentContainerStyle={styles.finish}>
      <Animated.View entering={reduceMotion ? undefined : celebration} style={styles.reward}>
        <Icon glyph={SparkleIcon} size={32} />
      </Animated.View>
      <Text variant="title" accessibilityRole="header" style={styles.title}>You finished the lesson!</Text>
      <View style={[styles.finishArt, { width: side, height: side }]}>
        {session.strokes.length ? <PracticeInk strokes={session.strokes} side={side} />
          : <LessonArt lesson={lesson} step={lesson.steps.length - 1} startDots={false} allInk />}
      </View>
      <View style={styles.finishActions}>
        <Button label="Color it" onPress={color} disabled={busy} haptic />
        <Button label="Draw it again" variant="secondary" onPress={again} disabled={busy} />
        <Button label="More lessons" variant="quiet" onPress={more} disabled={busy} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.space.xs, paddingHorizontal: theme.space.md, paddingBottom: theme.space.xs },
  title: { flexShrink: 1, flexGrow: 1, textAlign: 'center', fontFamily: theme.fontFamily[800] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space.lg, padding: theme.space.lg },
  workspace: { flex: 1, paddingHorizontal: theme.space.md, gap: theme.space.xs, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  workspaceWide: { flexDirection: 'row', gap: theme.space.md },
  sideStrip: { flex: 0, width: 300 },
  sideContent: { flexGrow: 1, justifyContent: 'center' },
  canvas: { flex: 1, minHeight: 1, justifyContent: 'center', alignItems: 'center' },
  instructions: { gap: theme.space.xs },
  strip: { flexDirection: 'row', gap: theme.space.sm, borderRadius: theme.radius.tile, alignItems: 'center',
    padding: theme.space.xs, backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline, borderWidth: 1 },
  stepPicture: { width: 68, height: 68, borderRadius: theme.space.lg, backgroundColor: theme.colors.background, overflow: 'hidden' },
  copyPicture: { width: 98, height: 98 },
  stepText: { flex: 1, minWidth: 0, gap: 2 },
  listen: { backgroundColor: theme.pastels.sky },
  support: { flexDirection: 'row', gap: theme.space.xs, alignSelf: 'center' },
  controls: { flexDirection: 'row', gap: theme.space.xs, paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md, width: '100%', maxWidth: theme.sample.maxContentWidth, alignSelf: 'center' },
  control: { flex: 1, minWidth: theme.target.child, minHeight: theme.target.child, alignItems: 'center',
    justifyContent: 'center', gap: theme.space.xs, paddingHorizontal: theme.space.xs,
    borderRadius: theme.radius.tile, backgroundColor: theme.colors.surface },
  controlLabel: { textAlign: 'center', fontFamily: theme.fontFamily[800] },
  inline: { flex: 0, flexDirection: 'row', paddingHorizontal: theme.space.lg, gap: theme.space.sm },
  picked: { backgroundColor: theme.pastels.peach, borderColor: theme.colors.ink, borderWidth: theme.border.emphasis },
  primary: { flexGrow: 1.3, backgroundColor: theme.colors.coral },
  status: { textAlign: 'center', paddingHorizontal: theme.space.lg },
  finish: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: theme.space.md, gap: theme.space.sm },
  reward: { backgroundColor: theme.pastels.butter, borderRadius: theme.radius.full, padding: theme.space.sm },
  finishArt: { overflow: 'hidden', borderRadius: theme.radius.tile, backgroundColor: theme.colors.surface },
  finishActions: { width: '100%', maxWidth: 300, gap: theme.space.xs },
})
