import { useRef } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { brushSizes } from '../../../practiceStorageModel'
import type { BrushToolId, SavedPracticeSession } from '../../../practiceStorageModel'
import { CanvasButton } from '../../ui/CanvasButton'
import { Icon } from '../../ui/Icon'
import { ArrowUUpLeftIcon, CheckIcon, DotsThreeIcon, EraserIcon } from '../../ui/icons'
import { PressTarget } from '../../ui/PressTarget'
import { theme } from '../../ui/theme'

import { brushGlyphs, drawingBrushes } from './brushPresentation'
import { crayons, selectedCrayon } from './crayonShades'

export function ColorRail({ selected, choices, vertical, disabled, onPick, onShades }: {
  selected: string
  choices: Record<number, string>
  vertical?: boolean
  disabled: boolean
  onPick: (color: string) => void
  onShades: (index: number, x: number) => void
}) {
  const active = selectedCrayon(selected)
  return (
    <ScrollView horizontal={!vertical} showsHorizontalScrollIndicator={!vertical} showsVerticalScrollIndicator={false}
      style={vertical ? styles.railVertical : styles.railHorizontal}
      contentContainerStyle={vertical ? styles.colorsVertical : styles.colorsHorizontal}>
      {crayons.map((crayon, index) => (
        <Crayon key={crayon.name} crayon={crayon} disabled={disabled} active={active === index}
          value={active === index ? selected : choices[index] ?? crayon.value}
          onPick={onPick} onShades={(x) => onShades(index, x)} />
      ))}
    </ScrollView>
  )
}

function Crayon({ crayon, value, active, disabled, onPick, onShades }: {
  crayon: (typeof crayons)[number]
  value: string
  active: boolean
  disabled: boolean
  onPick: (color: string) => void
  onShades: (x: number) => void
}) {
  const anchor = useRef<View>(null)
  const shade = crayon.shades.find((candidate) => candidate.value.toUpperCase() === value.toUpperCase())
  const showShades = () => anchor.current?.measureInWindow((x, _y, width) => onShades(x + width / 2))
  return (
    <View ref={anchor} collapsable={false}>
      <PressTarget accessibilityLabel={shade?.name ?? crayon.name} selected={active}
        accessibilityHint={active ? 'Opens more shades.' : undefined}
        onPress={() => active ? showShades() : onPick(value)} onLongPress={showShades} disabled={disabled} style={styles.crayonHit}>
        <View style={[styles.crayon, active && styles.raisedCrayon]}>
          <View style={[styles.crayonCap, { backgroundColor: value }]} />
          <View style={[styles.crayonBody, { backgroundColor: value }]} />
          {active && <View style={styles.shadesHint}><Icon glyph={DotsThreeIcon} size={theme.space.lg} /></View>}
        </View>
      </PressTarget>
    </View>
  )
}

type ToolsProps = {
  session: SavedPracticeSession
  lastBrush: BrushToolId
  busy: boolean
  compact: boolean
  vertical?: boolean
  onBrushTray: () => void
  onSize: (size: number) => void
  onTool: (id: BrushToolId) => void
  onUndo: () => void
  onDone: () => void
}

export function DrawTools({ session, lastBrush, busy, compact, vertical, onBrushTray, onSize, onTool, onUndo, onDone }: ToolsProps) {
  const currentBrush = drawingBrushes.find(({ id }) => id === lastBrush) ?? drawingBrushes[0]
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
        <CanvasButton glyph={brushGlyphs[currentBrush.id]} label={`Brush tools, ${currentBrush.label}`}
          onPress={onBrushTray} disabled={busy} />
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
  colorsHorizontal: { paddingRight: theme.space.lg },
  colorsVertical: { alignItems: 'center' },
  crayonHit: { width: theme.target.child, height: theme.target.child, alignItems: 'center', justifyContent: 'flex-end' },
  crayon: { paddingVertical: theme.space.xs, borderWidth: theme.border.emphasis, borderColor: 'transparent', borderRadius: theme.space.md, alignItems: 'center', width: theme.crayon.bodyWidth },
  raisedCrayon: { borderColor: theme.colors.ink, transform: [{ translateY: -theme.space.xs }] },
  shadesHint: { position: 'absolute', top: -theme.space.xs, right: 0, borderRadius: theme.radius.full, backgroundColor: theme.colors.surface },
  crayonCap: { borderTopLeftRadius: theme.space.sm, borderTopRightRadius: theme.space.sm, width: theme.crayon.capWidth, height: theme.space.md, opacity: 0.85, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.crayon.shading },
  crayonBody: { width: '100%', height: theme.crayon.bodyHeight, borderRadius: theme.space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.crayon.shading, borderBottomWidth: theme.space.xs, borderBottomColor: theme.crayon.shading },
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
