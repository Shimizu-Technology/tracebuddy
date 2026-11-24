// Standalone Release entry for the renderer comparison. The app entry does not import it.
import { useMemo, useState } from 'react'
import { registerRootComponent } from 'expo'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useFrameCallback, useSharedValue } from 'react-native-reanimated'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import type { PracticeStroke } from '../practiceStorageModel'
import { PracticeInk } from '../src/features/draw/PracticeInk'
import { SvgPracticeInk } from '../src/features/draw/SvgPracticeInk'

const side = 320
const samples = 180
const reds = ['#BB2244', '#D52043', '#E44367']
function makeFixture(eraseEvery: number): PracticeStroke[] {
  const strokes: PracticeStroke[] = Array.from({ length: 240 }, (_, index) => {
    const mode = index % eraseEvery === eraseEvery - 1 ? 'erase' : 'draw'
    const top = index % 2 === 0 ? 80 : 650
    const y = top + (index * 13) % 230
    const x = 30 + (index * 61) % 540
    return {
      mode, path: `M ${x} ${y} Q ${x + 80} ${y - 48} ${x + 220} ${y + 30} T ${x + 420} ${y}`,
      width: mode === 'erase' ? 24 : 15, color: reds[index % reds.length], opacity: 0.9,
    }
  })
  strokes.push(
    { mode: 'draw', path: 'M 120 500 L 880 500', width: 56, color: '#1155CC', opacity: 1 },
    { mode: 'erase', path: 'M 500 400 L 500 600', width: 95, color: '#000000', opacity: 1 },
    { mode: 'draw', path: 'M 500 515 L 500 552', width: 14, color: '#A020C0', opacity: 1 },
  )
  return strokes
}

function summary(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const nth = (percent: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percent))].toFixed(2)
  return `p50 ${nth(0.5)} ms, p95 ${nth(0.95)} ms, max ${nth(1)} ms, >25 ms ${values.filter((value) => value > 25).length}/${values.length}`
}

function Trial({ renderer, fixture }: { renderer: 'Skia' | 'SVG'; fixture: PracticeStroke[] }) {
  const [report, setReport] = useState('')
  const [running, setRunning] = useState(false)
  const count = useSharedValue(-1)
  const intervals = useSharedValue<number[]>([])
  const delays = useSharedValue<number[]>([])
  const previousSignal = useSharedValue(0)
  const path = useSharedValue('M 0 0')
  const width = useSharedValue(26)
  const live = useMemo(() => ({
    path, width, style: { color: '#000000', opacity: 1, mode: 'erase' as const },
  }), [path, width])

  function complete(frameTimes: number[], signalTimes: number[]) {
    setReport(`${renderer}\nUI frame intervals ${summary(frameTimes)}\nPath signal → next UI frame ${summary(signalTimes)}`)
    setRunning(false)
  }

  useFrameCallback((frame) => {
    const position = count.get()
    if (position < 0) return
    const gap = frame.timeSincePreviousFrame
    if (gap !== null && position > 10) {
      intervals.modify((times) => { times.push(gap); return times })
      delays.modify((times) => { times.push(performance.now() - previousSignal.get()); return times })
    }
    if (position === samples + 10) {
      count.set(-1)
      path.set('M 0 0')
      scheduleOnRN(complete, intervals.get(), delays.get())
      return
    }
    const x = 75 + (position * 11) % 850
    previousSignal.set(performance.now())
    path.set(`M ${x} 240 Q ${x + 60} 350 ${x} 730`)
    count.set(position + 1)
  })

  const Renderer = renderer === 'Skia' ? PracticeInk : SvgPracticeInk
  return <>
    <View style={styles.art}>
      <View style={styles.guide} />
      <Renderer side={side} strokes={fixture} live={live} />
      <View style={styles.outline} pointerEvents="none" />
    </View>
    <Pressable style={styles.button} disabled={running} accessibilityRole="button" onPress={() => {
      setReport('')
      setRunning(true)
      intervals.set([])
      delays.set([])
      count.set(0)
    }}>
      <Text>{running ? 'Measuring…' : `Run ${renderer}`}</Text>
    </Pressable>
    <Text selectable accessibilityLabel={report || undefined}>{report}</Text>
  </>
}

export default function Spike() {
  const [renderer, setRenderer] = useState<'Skia' | 'SVG'>('Skia')
  const [dense, setDense] = useState(false)
  const fixture = useMemo(() => makeFixture(dense ? 5 : 20), [dense])
  return <SafeAreaProvider><SafeAreaView style={styles.page}>
    <Text>243 saved paths, including {dense ? 49 : 13} erasers</Text>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => setRenderer('Skia')}><Text>Skia canvas</Text></Pressable>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => setRenderer('SVG')}><Text>SVG canvas</Text></Pressable>
    </View>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => setDense(!dense)}>
      <Text>{dense ? 'Use 13 erasers' : 'Use 49 erasers'}</Text>
    </Pressable>
    <Trial key={`${renderer}-${dense}`} renderer={renderer} fixture={fixture} />
  </SafeAreaView></SafeAreaProvider>
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: '#FFFDF8' },
  actions: { flexDirection: 'row', gap: 12 },
  button: { padding: 16, borderRadius: 10, backgroundColor: '#DFEAFA' },
  art: { width: side, height: side, backgroundColor: '#FFFFFF' },
  guide: { position: 'absolute', left: 12, right: 12, top: 151, height: 18, backgroundColor: '#B0B0B0' },
  outline: { position: 'absolute', left: 12, right: 12, top: 148, height: 2, backgroundColor: '#606060' },
})

registerRootComponent(Spike)
