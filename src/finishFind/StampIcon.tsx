import { keepsakeStamps } from '../../shared/finishFind'
import type { KeepsakeStamp } from '../../shared/finishFind'
export function StampIcon({ stamp }: { stamp: KeepsakeStamp }) {
  return <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><path d={keepsakeStamps.find((item) => item.id === stamp)?.path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
