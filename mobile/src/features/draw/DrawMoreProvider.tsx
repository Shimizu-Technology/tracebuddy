import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { DrawMoreContext } from './drawMoreState'
import type { DrawMoreActions } from './drawMoreState'

export function DrawMoreProvider({ children }: { children: ReactNode }) {
  const [more, setMore] = useState<DrawMoreActions | null>(null)
  const state = useMemo(() => ({ more, setMore }), [more])
  return <DrawMoreContext.Provider value={state}>{children}</DrawMoreContext.Provider>
}
