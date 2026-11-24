import { StyleSheet, View } from 'react-native'
import Svg, { Defs, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg'

import { theme } from '../../ui/theme'
import type { Point, Size } from './paperModel'
import { paperTheme } from './paperTheme'

const grainSpacing = 22
const grainWidth = 3

/**
 * A wooden table with a sheet of paper, shown where there is no camera (the iOS Simulator), so the
 * screen, its gestures and its layout can be tried without a phone over real paper.
 */
export function TableStandIn({ stage, page, center }: { stage: Size; page: Size; center: Point }) {
  const { table } = paperTheme.colors
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={stage.width} height={stage.height}>
        <Defs>
          <RadialGradient id="table" cx="50%" cy="40%" rx="70%" ry="60%">
            <Stop offset="0" stopColor={table.center} />
            <Stop offset="0.55" stopColor={table.middle} />
            <Stop offset="1" stopColor={table.edge} />
          </RadialGradient>
          <Pattern id="grain" width={grainSpacing} height={stage.height} patternUnits="userSpaceOnUse" patternTransform="rotate(2)">
            <Rect width={grainWidth} height={stage.height} fill={table.grain} fillOpacity={paperTheme.opacity.grain} />
          </Pattern>
        </Defs>
        <Rect width={stage.width} height={stage.height} fill="url(#table)" />
        <Rect width={stage.width} height={stage.height} fill="url(#grain)" />
      </Svg>
      <View
        style={[styles.paper, {
          left: center.x - page.width / 2,
          top: center.y - page.height / 2,
          width: page.width,
          height: page.height,
          transform: [{ rotate: `${paperTheme.page.tableTilt}deg` }],
        }]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  paper: {
    position: 'absolute',
    borderRadius: theme.space.xs - 1,
    backgroundColor: paperTheme.colors.paper,
    shadowColor: paperTheme.colors.paperShadow,
    shadowOffset: { width: 0, height: theme.space.md + 2 },
    shadowRadius: theme.space.xl + 6,
    shadowOpacity: paperTheme.opacity.shadow,
  },
})
