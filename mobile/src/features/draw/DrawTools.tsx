import { ScrollView, StyleSheet, View } from 'react-native'
import { brushSizes, brushTools } from '../../../practiceStorageModel'
import type { BrushToolId, SavedPracticeSession } from '../../../practiceStorageModel'
import { CanvasButton } from '../../ui/CanvasButton'
import { ArrowUUpLeftIcon, CheckIcon, EraserIcon, HighlighterIcon, PaintBrushIcon, PencilSimpleIcon } from '../../ui/icons'
import { PressTarget } from '../../ui/PressTarget'
import { theme } from '../../ui/theme'

const drawingBrushes = brushTools.filter(({ id }) => id !== 'eraser')
const glyphs = { pencil: PencilSimpleIcon, marker: HighlighterIcon, crayon: PencilSimpleIcon, paint: PaintBrushIcon, eraser: EraserIcon }

export function ColorRail({ selected, vertical, disabled, onPick }: { selected: string; vertical?: boolean; disabled: boolean; onPick: (color: string) => void }) {
  return (
    <ScrollView horizontal={!vertical} showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}
      style={vertical ? styles.railVertical : styles.railHorizontal}
      contentContainerStyle={vertical ? styles.colorsVertical : styles.colorsHorizontal}>
      {theme.crayon.colors.map(({ name, value }) => (
        <PressTarget key={name} accessibilityLabel={name} selected={selected.toUpperCase() === value.toUpperCase()}
          onPress={() => onPick(value)} disabled={disabled} style={styles.crayonHit}>
          <View style={[styles.crayon, selected.toUpperCase() === value.toUpperCase() && styles.raisedCrayon]}>
            <View style={[styles.crayonCap, { backgroundColor: value }]} />
            <View style={[styles.crayonBody, { backgroundColor: value }]} />
          </View>
        </PressTarget>
      ))}
    </ScrollView>
  )
}

type ToolsProps = {
  session: SavedPracticeSession
  lastBrush: BrushToolId
  busy: boolean
  compact: boolean
  vertical?: boolean
  onSize: (size: number) => void
  onTool: (id: BrushToolId) => void
  onUndo: () => void
  onDone: () => void
}

export function DrawTools({ session, lastBrush, busy, compact, vertical, onSize, onTool, onUndo, onDone }: ToolsProps) {
  const brushIndex = Math.max(0, drawingBrushes.findIndex(({ id }) => id === lastBrush))
  const currentBrush = drawingBrushes[brushIndex]
  const nextBrush = drawingBrushes[(brushIndex + 1) % drawingBrushes.length]
  const eraser = session.brushToolId === 'eraser'

  return (
    <View style={[styles.tools, compact && styles.compactTools, vertical && styles.verticalTools]}>
      <View style={styles.group}>
        <View style={styles.sizes}>
          {brushSizes.map(({ label, value }, size) => (
            <PressTarget key={value} disabled={busy} onPress={() => onSize(value)}
              accessibilityLabel={`${label} brush size`}
              selected={session.markerWidth === value}
              style={[styles.size, session.markerWidth === value && styles.sizeSelected]}>
              <View style={[styles.dot, { width: theme.crayon.sizeDots[size], height: theme.crayon.sizeDots[size], backgroundColor: session.markerColor }]} />
            </PressTarget>
          ))}
        </View>
        <CanvasButton glyph={glyphs[currentBrush.id]} label={`Brush: ${currentBrush.label}. Switch to ${nextBrush.label}`}
          onPress={() => onTool(nextBrush.id)} disabled={busy} />
      </View>
      <View style={styles.group}>
        <CanvasButton glyph={EraserIcon} label="Eraser" onPress={() => onTool(eraser ? lastBrush : 'eraser')} selected={eraser} disabled={busy} />
        <CanvasButton glyph={ArrowUUpLeftIcon} label="Undo" showLabel={!compact && !vertical} onPress={onUndo} disabled={busy || session.strokes.length === 0} haptic />
        <CanvasButton glyph={CheckIcon} label="Done" showLabel primary onPress={onDone} disabled={busy} style={styles.done} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  railHorizontal: { flexGrow: 0 },
  railVertical: { flexGrow: 0, height: '100%' },
  colorsHorizontal: { paddingHorizontal: theme.space.lg },
  colorsVertical: { alignItems: 'center' },
  crayonHit: { width: theme.target.child, height: theme.target.child, alignItems: 'center', justifyContent: 'flex-end' },
  crayon: { padding: theme.space.xs, borderWidth: theme.border.emphasis, borderColor: 'transparent', borderRadius: theme.space.md, alignItems: 'center', width: theme.crayon.bodyWidth },
  raisedCrayon: { borderColor: theme.colors.ink, transform: [{ translateY: -theme.space.xs }] },
  crayonCap: { borderTopLeftRadius: theme.space.sm, borderTopRightRadius: theme.space.sm, width: theme.crayon.capWidth, height: theme.space.md, opacity: 0.85 },
  crayonBody: { width: '100%', height: theme.crayon.bodyHeight, borderRadius: theme.space.sm, borderBottomWidth: theme.space.xs, borderBottomColor: theme.crayon.shading },
  tools: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.space.sm, paddingHorizontal: theme.space.md },
  compactTools: { flexDirection: 'column', alignItems: 'stretch' },
  verticalTools: { flexDirection: 'column', alignItems: 'center', paddingHorizontal: 0 },
  group: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: theme.space.xs },
  sizes: { flexDirection: 'row', borderRadius: theme.radius.full, backgroundColor: theme.colors.surface },
  size: { width: theme.target.child, height: theme.target.child, borderRadius: theme.radius.full, alignItems: 'center', justifyContent: 'center' },
  sizeSelected: { backgroundColor: theme.pastels.peach },
  dot: { borderRadius: theme.radius.full },
  done: { flexGrow: 1 },
})
