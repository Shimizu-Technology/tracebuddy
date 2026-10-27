import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AccessibilityInfo, Animated, Easing, findNodeHandle, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { keepsakeStamps } from './finishFindModel'
import type { KeepsakeStamp } from './finishFindModel'
import KeepsakeEscape from './KeepsakeEscape'
import { KeepsakeStampIcon } from './KeepsakeStamp'

export default function KeepsakeView({ title, date, stamp, reduceMotion, saving, saveFailed, renderDocument, onClose, onSave, onGallery, onStamp, onRetry }: {
  title: string; date: string; stamp?: KeepsakeStamp; reduceMotion: boolean; saving: boolean; saveFailed: boolean
  renderDocument: (side: number) => ReactNode
  onClose: () => void; onSave: () => void; onGallery: () => void; onStamp: (stamp: KeepsakeStamp) => void; onRetry: () => void
}) {
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const landscape = width > height
  const side = Math.max(120, Math.min(480, landscape ? height - insets.top - insets.bottom - 64 : width - insets.left - insets.right - 48, landscape ? width * 0.42 : height * 0.40))
  const [enter] = useState(() => new Animated.Value(0))
  const closing = useRef(false)
  const keepRef = useRef<View | null>(null)
  useEffect(() => {
    const motion = Animated.timing(enter, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true })
    motion.start()
    return () => motion.stop()
  }, [enter])
  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    Animated.timing(enter, { toValue: 0, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => { if (finished) onClose() })
  }, [enter, onClose])
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [close])
  return <Modal visible transparent animationType="none" onRequestClose={close} onShow={() => {
    const node = findNodeHandle(keepRef.current)
    if (node) AccessibilityInfo.setAccessibilityFocus(node)
    AccessibilityInfo.announceForAccessibility('Your drawing. Save a picture, keep drawing, or open My drawings.')
  }}>
    <View style={[styles.backdrop, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]} accessibilityViewIsModal onAccessibilityEscape={close}>
      <KeepsakeEscape onEscape={close} />
      <Animated.View style={[styles.sheet, { opacity: enter, transform: reduceMotion ? [] : [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
        <ScrollView contentContainerStyle={[styles.content, landscape && styles.landscape]} keyboardShouldPersistTaps="handled">
          <View style={{ width: side, alignItems: 'center', gap: 8 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.date}>{date}</Text>
            {renderDocument(side)}
          </View>
          <View style={[styles.actions, landscape && { flex: 1 }]}>
            <Text style={styles.label}>Add a stamp, if you like</Text>
            <View style={styles.stamps} accessibilityLabel="Optional keepsake stamp">
              {keepsakeStamps.map((candidate) => <Pressable key={candidate} style={({ pressed }) => [styles.stamp, stamp === candidate && styles.selected, pressed && (reduceMotion ? styles.reducedPressed : styles.pressed)]} onPress={() => onStamp(candidate)} accessibilityRole="button" accessibilityLabel={`${candidate === 'smiley' ? 'Smiley' : candidate[0].toUpperCase() + candidate.slice(1)} stamp`} accessibilityHint="Tap again to remove" accessibilityState={{ selected: stamp === candidate }}><KeepsakeStampIcon stamp={candidate} size={42} /></Pressable>)}
            </View>
            {saveFailed && <Pressable style={styles.button} onPress={onRetry} accessibilityRole="button"><Text style={styles.buttonText}>Not saved · Retry</Text></Pressable>}
            <Pressable style={({ pressed }) => [styles.button, styles.primary, saving && styles.disabled, pressed && (reduceMotion ? styles.reducedPressed : styles.pressed)]} onPress={onSave} disabled={saving} accessibilityRole="button" accessibilityLabel="Save picture to Photos"><Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save picture'}</Text></Pressable>
            <Pressable ref={keepRef} style={({ pressed }) => [styles.button, pressed && (reduceMotion ? styles.reducedPressed : styles.pressed)]} onPress={close} accessibilityRole="button"><Text style={styles.buttonText}>Keep drawing</Text></Pressable>
            <Pressable style={({ pressed }) => [styles.button, saving && styles.disabled, pressed && (reduceMotion ? styles.reducedPressed : styles.pressed)]} onPress={onGallery} disabled={saving} accessibilityState={{ disabled: saving, busy: saving }} accessibilityRole="button"><Text style={styles.buttonText}>My drawings</Text></Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  </Modal>
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(24,36,58,0.42)', justifyContent: 'center' },
  sheet: { maxHeight: '100%', backgroundColor: '#FFF7EA', borderRadius: 28 },
  content: { padding: 16, gap: 16, alignItems: 'center' },
  landscape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, color: '#18243A', fontWeight: '900', textAlign: 'center' },
  date: { fontSize: 13, color: '#667085', fontWeight: '600' },
  label: { color: '#18243A', fontSize: 14, fontWeight: '700' },
  actions: { width: '100%', maxWidth: 500, gap: 8 },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stamp: { minWidth: 56, minHeight: 56, padding: 5, borderWidth: 2, borderColor: '#D9E1E8', backgroundColor: '#FFFFFF', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  selected: { borderColor: '#A44632', backgroundColor: '#FFF1DC' },
  button: { minHeight: 48, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: '#D9E1E8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  primary: { minHeight: 56, backgroundColor: '#FF795D', borderColor: '#FF795D' },
  buttonText: { color: '#18243A', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  reducedPressed: { opacity: 0.72 },
  disabled: { opacity: 0.6 },
})
