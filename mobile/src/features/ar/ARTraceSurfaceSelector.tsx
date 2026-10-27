import { useState } from 'react'
import { SvgXml } from 'react-native-svg'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { isTraceBuddyARSupported } from '../../../modules/tracebuddy-ar/src/TraceBuddyARModule'
import { availableARTraceSurfaces } from './arTraceState'
import type { ARTraceSurface } from './arTraceState'

const labels = { camera: 'Trace on paper', screen: 'Draw on screen', ar: 'Paper Lock (Beta)' }
const illustrations = {
  camera: '<rect x="22" y="59" width="100" height="30" rx="3" fill="#FFFFFF"/><path d="M78 57V24h41M104 24v36M94 60h20"/><rect x="12" y="10" width="74" height="37" rx="7" fill="#CFE8F7"/><path d="M46 59c-16 5-12 20 0 21 15-1 18-15 0-21Z"/>',
  screen: '<rect x="16" y="9" width="105" height="79" rx="10" fill="#FFFFFF"/><path d="M27 24h72M27 72h30M39 55c0-25 36-25 36 0 0 14-20 15-20 0"/><path d="m89 90-10-23c-3-8 8-12 12-4l5 10V43c0-9 12-9 12 0v17c12-3 17 4 17 12v18" fill="#FFF1DC"/>',
}
const descriptions = {
  camera: 'A guide above your paper.',
  screen: 'Use a finger or stylus.',
  ar: 'Try table or marker tracking. Check alignment; the guide can drift.',
}

export default function ARTraceSurfaceSelector({ value, onChange }: {
  value: ARTraceSurface
  onChange: (surface: ARTraceSurface) => void
}) {
  const [supported] = useState(() => Platform.OS === 'ios' && isTraceBuddyARSupported())
  return (
    <View style={styles.selector} accessibilityLabel="Tracing mode">
      <View style={styles.options}>
        {availableARTraceSurfaces(supported).map((surface) => (
          <Pressable
            key={surface}
            style={({ pressed }) => [styles.option, surface === 'ar' && styles.betaOption, value === surface && styles.selected, pressed && styles.pressed]}
            onPress={() => onChange(surface)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === surface }}
          >
            {surface !== 'ar' && <SvgXml xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 100"><g stroke="#18243A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">${illustrations[surface]}</g></svg>`} width="100%" height={64} />}
            <Text style={[styles.label, value === surface && styles.selectedLabel]}>{value === surface ? '✓ ' : ''}{labels[surface]}</Text>
            <Text style={styles.detail}>{descriptions[surface]}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.detail}>Paper needs a stand. Screen works anywhere.</Text>
      {Platform.OS === 'ios' && !supported ? <Text style={styles.detail}>Paper Lock (Beta) needs a device with AR world tracking.</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  selector: { gap: 6, marginTop: 8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { flexGrow: 1, flexBasis: 130, minHeight: 140, borderRadius: 18, borderWidth: 1, borderColor: '#D9E1E8', backgroundColor: '#FFFDF8', padding: 8, gap: 4, alignItems: 'center', justifyContent: 'center' },
  betaOption: { flexBasis: '100%', minHeight: 48 },
  selected: { backgroundColor: '#FFF1DC', borderColor: '#A44632', borderWidth: 2 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  label: { color: '#18243A', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  selectedLabel: { color: '#18243A' },
  detail: { color: '#5E6878', fontSize: 13, lineHeight: 18, fontWeight: '600' },
})
