import { Canvas, DashPathEffect, Group, Path, Picture } from '@shopify/react-native-skia'
import { memo, useMemo } from 'react'

import type { InkProps } from './inkTypes'
import { recordInk } from './recordInk'

export const PracticeInk = memo(function PracticeInk({ side, strokes, live }: InkProps) {
  const picture = useMemo(() => recordInk(strokes), [strokes])
  const transform = useMemo(() => [{ scale: side / 1000 }], [side])
  const usesEraser = Boolean(live) || strokes.some((stroke) => stroke.mode === 'erase')
  return (
    <Canvas pointerEvents="none" style={{ width: side, height: side }}>
      <Group layer={usesEraser}>
        <Group transform={transform}>
          <Picture picture={picture} />
          {live && (
            <Path
              path={live.path}
              color={live.style.color}
              strokeWidth={live.width}
              strokeCap="round"
              strokeJoin="round"
              style="stroke"
              opacity={live.style.opacity}
              blendMode={live.style.mode === 'erase' ? 'dstOut' : 'srcOver'}
            >
              {live.style.dasharray && <DashPathEffect intervals={live.style.dasharray} />}
            </Path>
          )}
        </Group>
      </Group>
    </Canvas>
  )
})
