import { createContext, useContext } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { PictureParams } from '../../data/catalog'

export type DrawMoreActions = {
  guideOpacity: number
  onOpacity: (opacity: number) => void
  onFit: () => void
  onPaper: () => Promise<PictureParams | null>
  onClear: () => Promise<boolean>
}

export const DrawMoreContext = createContext<{
  more: DrawMoreActions | null
  setMore: Dispatch<SetStateAction<DrawMoreActions | null>>
} | null>(null)

export function useDrawMore() {
  const state = useContext(DrawMoreContext)
  if (!state) throw new Error('Drawing tools need the draw controls provider')
  return state
}
