import LegacyApp from '../App'
import { traceBuddy2Enabled } from '../src/devKit'
import HomeScreen from '../src/features/home/HomeScreen'

export default traceBuddy2Enabled ? HomeScreen : LegacyApp
