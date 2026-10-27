import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { isTraceBuddyARSupported } from '../../../modules/tracebuddy-ar/src/TraceBuddyARModule'
import { availableARTraceSurfaces } from './arTraceState'
import type { ARTraceSurface } from './arTraceState'

const labels = { camera: 'Camera + paper', screen: 'On-screen practice', ar: 'Paper Lock (Beta)' }
const descriptions = {
  camera: 'Overlay a guide above real paper. Keep the device on a stand.',
  screen: 'Trace with a finger or stylus on this screen.',
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
            style={({ pressed }) => [styles.option, value === surface && styles.selected, pressed && styles.pressed]}
            onPress={() => onChange(surface)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === surface }}
          >
            <Text style={[styles.label, value === surface && styles.selectedLabel]}>{labels[surface]}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.detail}>{descriptions[value]}</Text>
      {Platform.OS === 'ios' && !supported ? <Text style={styles.detail}>Paper Lock (Beta) needs a device with AR world tracking.</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  selector: { gap: 8, marginTop: 12 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { flexGrow: 1, flexBasis: 130, minHeight: 48, borderRadius: 18, borderWidth: 1, borderColor: '#D9E1E8', backgroundColor: '#FFFDF8', padding: 12, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: '#18243A', borderColor: '#18243A' },
  pressed: { opacity: 0.8 },
  label: { color: '#18243A', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  selectedLabel: { color: '#FFFFFF' },
  detail: { color: '#5E6878', fontSize: 13, lineHeight: 18, fontWeight: '600' },
})
