import { View } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { keepsakeStamps } from '../shared/finishFind'
import type { KeepsakeStamp } from './finishFindModel'

export function KeepsakeStampIcon({ stamp, size = 36 }: { stamp: KeepsakeStamp; size?: number }) {
  const icon = keepsakeStamps.find((candidate) => candidate.id === stamp)!
  return <SvgXml xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="${icon.path}" fill="none" stroke="#A44632" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`} width={size} height={size} />
}
export function KeepsakeStampBadge({ stamp, size = 36 }: { stamp?: KeepsakeStamp; size?: number }) {
  return stamp ? <View pointerEvents="none" style={{ position: 'absolute', right: size * 0.18, bottom: size * 0.18, width: size, height: size, backgroundColor: '#FFF7EA', borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}><KeepsakeStampIcon stamp={stamp} size={size * 0.84} /></View> : null
}
