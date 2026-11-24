import Svg, { Path, Rect } from 'react-native-svg'

import { theme } from '../../ui/theme'

export function PictureModeIllustration({ mode }: { mode: 'camera' | 'screen' }) {
  const { ink, coral, surface } = theme.colors
  return (
    <Svg accessible={false} width="100%" height={76} viewBox="0 0 120 88">
      {mode === 'camera' ? (
        <>
          <Path d="M45 67 81 61 105 75 68 84Z" fill={surface} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
          <Path d="m66 72 7-3 5 2 7-2m-12 7 14-4" fill="none" stroke={coral} strokeWidth={2.5} strokeLinecap="round" />
          <Path d="M22 77h27M35 76V27l19-10m-2 8h22" fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <Rect x={53} y={5} width={37} height={52} rx={7} fill={ink} />
          <Rect x={57} y={11} width={29} height={38} rx={3} fill={surface} />
          <Path d="m65 29 5 5 8-10" stroke={coral} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M69 53h5" stroke={surface} strokeWidth={1.5} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Rect x={10} y={10} width={92} height={61} rx={9} fill={ink} />
          <Rect x={15} y={15} width={82} height={51} rx={4} fill={surface} />
          <Path d="M29 49c6-14 14-18 19-13 4 5-3 16 5 16 5 0 8-13 19-12" stroke={coral} strokeWidth={3.5} fill="none" strokeLinecap="round" />
          <Path d="M96 83 81 72l-5-9-5-14c-1-4 4-6 6-2l5 9c2-3 6-3 8 1 3-2 7 0 8 4 4-1 7 2 8 5l4 9-7 8Z"
            fill={theme.pastels.rose} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
        </>
      )}
    </Svg>
  )
}
