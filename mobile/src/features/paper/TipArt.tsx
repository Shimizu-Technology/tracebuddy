import Svg, { Circle, Path, Rect } from 'react-native-svg'

import { theme } from '../../ui/theme'
import { paperTheme } from './paperTheme'

export type TipId = 'stand' | 'page' | 'light'

const line = { stroke: theme.colors.ink, strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const
const width = paperTheme.size.tipArt
const height = (width * 110) / 150

/** One small picture per setup tip, drawn in the app's ink-line style. */
export function TipArt({ tip }: { tip: TipId }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 150 110" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {tip === 'stand' ? (
        <>
          <Path {...line} d="M10 84l56-16 64 14-56 18z" fill={theme.colors.background} />
          <Rect {...line} x={62} y={6} width={38} height={56} rx={7} fill={theme.pastels.sky} />
          <Path {...line} d="M81 62v14M66 92l15-16 15 16" />
        </>
      ) : null}
      {tip === 'page' ? (
        <>
          <Rect {...line} x={20} y={8} width={110} height={94} rx={10} strokeDasharray="7 7" />
          <Path {...line} d="M46 28h58v58H46z" fill={theme.colors.background} />
          <Path {...line} d="M60 64c8-14 14 6 20-6s8 4 12 0" stroke={theme.colors.coral} />
          <Path {...line} d="M30 20l-8-8M120 20l8-8M30 92l-8 8M120 92l8 8" />
        </>
      ) : null}
      {tip === 'light' ? (
        <>
          <Circle {...line} cx={75} cy={34} r={16} fill={theme.pastels.butter} />
          <Path {...line} d="M75 8v-4M75 64v-4M49 34h-4M105 34h-4M57 16l-3-3M93 16l3-3M57 52l-3 3M93 52l3 3" />
          <Path {...line} d="M30 96l40-12 52 10-40 14z" fill={theme.colors.background} />
        </>
      ) : null}
    </Svg>
  )
}
