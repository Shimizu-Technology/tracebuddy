import { StyleSheet, View } from 'react-native'

import { watercolorOpacity } from '../../../practiceStorageModel'
import type { BrushToolId, PracticeStroke } from '../../../practiceStorageModel'
import { Icon } from '../../ui/Icon'
import { PressTarget } from '../../ui/PressTarget'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { brushGlyphs, drawingBrushes } from './brushPresentation'
import { crayons } from './crayonShades'
import { PracticeInk } from './PracticeInk'
import { watercolorPigment } from './watercolor'

const sampleBlue = crayons[8].value
const sampleYellow = crayons[4].value
const sampleNormal = 'M 200 660 Q 500 240 800 530'
const swatchSide = theme.target.child / 2

function swatchStroke(path: string, width: number, color: string = sampleBlue, opacity = 1): PracticeStroke {
  return { path, width, color, opacity, mode: 'draw' }
}

const swatches: Partial<Record<BrushToolId, PracticeStroke[]>> = {
  marker: [swatchStroke(sampleNormal, 220)],
  crayon: [{ ...swatchStroke(sampleNormal, 220, sampleBlue, 0.62), dasharray: [44, 95] }],
  paint: [
    { ...swatchStroke('M 180 310 Q 430 790 810 650', 275, watercolorPigment(sampleBlue), watercolorOpacity), blend: 'multiply' },
    { ...swatchStroke('M 180 690 Q 530 600 790 265', 275, watercolorPigment(sampleYellow), watercolorOpacity), blend: 'multiply' },
  ],
  pencil: [swatchStroke(sampleNormal, 75, sampleBlue, 0.72)],
  fill: [
    { ...swatchStroke('M 200 500 a 300 300 0 1 0 600 0 a 300 300 0 1 0 -600 0 Z', 1), kind: 'fill' },
    swatchStroke('M 200 500 a 300 300 0 1 0 600 0 a 300 300 0 1 0 -600 0 Z', 45, theme.colors.ink),
  ],
}

export function BrushTray({ selected, fillAvailable, alignRight, onPick }: {
  selected: BrushToolId
  fillAvailable: boolean
  alignRight: boolean
  onPick: (tool: BrushToolId) => void
}) {
  return (
    <View style={[styles.brushTray, alignRight && styles.trayBesideTools]}>
      <View style={styles.brushRow}>
        {drawingBrushes.map(({ id, label }) => (
          <PressTarget key={id} accessibilityLabel={label}
            accessibilityHint={id === 'fill' && !fillAvailable ? 'Fill works on pictures with outlines.' : undefined}
            disabled={id === 'fill' && !fillAvailable} selected={selected === id}
            style={[styles.brush, selected === id && styles.selected]} onPress={() => onPick(id)}>
            <Icon glyph={brushGlyphs[id]} />
            <PracticeInk side={swatchSide} strokes={swatches[id] ?? []} />
            <Text variant="small" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}
              maxFontSizeMultiplier={1.25} style={styles.brushLabel}>{label}</Text>
          </PressTarget>
        ))}
      </View>
      {!fillAvailable && <Text variant="small" tone="muted" style={styles.unavailable}>Fill works on pictures with outlines.</Text>}
    </View>
  )
}

const buttonWidth = theme.target.child
const fanWidth = buttonWidth * 5

export function ShadeFan({ index, selected, anchorX, width, onPick }: {
  index: number
  selected: string
  anchorX: number
  width: number
  onPick: (color: string) => void
}) {
  const left = Math.max(0, Math.min(width - fanWidth, anchorX - fanWidth / 2))
  return (
    <View style={[styles.shadeFan, { marginLeft: left }]}>
      {crayons[index].shades.map(({ name, value }, i) => {
        const active = selected.toUpperCase() === value.toUpperCase()
        return (
          <PressTarget key={value} accessibilityLabel={name} selected={active} onPress={() => onPick(value)}
            style={[styles.shadeButton, { marginTop: Math.abs(i - 2) * theme.space.xs }]}>
            <View style={[styles.shade, { backgroundColor: value }, active && styles.activeShade]} />
          </PressTarget>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  brushTray: { alignSelf: 'center', maxWidth: '100%', backgroundColor: theme.colors.surface, borderRadius: theme.radius.tile, ...theme.floatingShadow },
  trayBesideTools: { alignSelf: 'flex-end' },
  brushRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  brush: { width: buttonWidth + theme.space.sm, minHeight: buttonWidth, justifyContent: 'center', alignItems: 'center', paddingVertical: theme.space.xs, borderRadius: theme.space.lg },
  selected: { backgroundColor: theme.pastels.peach },
  brushLabel: { textAlign: 'center', alignSelf: 'stretch' },
  unavailable: { textAlign: 'center', marginBottom: theme.space.xs },
  shadeFan: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: theme.colors.surface, borderRadius: theme.radius.tile, ...theme.floatingShadow },
  shadeButton: { width: buttonWidth, height: buttonWidth, alignItems: 'center', justifyContent: 'center' },
  shade: { width: theme.target.minimum, height: theme.target.minimum, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.crayon.shading },
  activeShade: { borderWidth: theme.border.emphasis, borderColor: theme.colors.ink },
})
