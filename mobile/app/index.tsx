/* eslint-disable @typescript-eslint/no-require-imports -- Metro evaluates only the selected route's feature module. */
import { traceBuddy2Enabled } from '../src/devKit'

export default traceBuddy2Enabled
  ? (require('../src/features/home/HomeScreen') as typeof import('../src/features/home/HomeScreen')).default
  : (require('../App') as typeof import('../App')).default
