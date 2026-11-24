/* eslint-disable @typescript-eslint/no-require-imports -- Metro evaluates only the selected route's feature module. */
import { traceBuddy2Enabled } from '../src/devKit'

export default traceBuddy2Enabled
  ? (require('../src/features/drawings/DrawingMenu') as typeof import('../src/features/drawings/DrawingMenu')).default
  : () => null
