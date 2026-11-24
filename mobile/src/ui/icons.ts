import type { Icon } from 'phosphor-react-native'

// Load each Phosphor icon from its own module. The package root re-exports every icon (about 6 MB),
// and Metro does not tree-shake. require keeps TypeScript from type-checking the package's .tsx sources,
// which don't pass this project's strict settings. Add new icons here; the lint rule blocks root value imports.
/* eslint-disable @typescript-eslint/no-require-imports */
export const PencilSimpleIcon: Icon = require('phosphor-react-native/src/icons/PencilSimple').PencilSimpleIcon
export const SparkleIcon: Icon = require('phosphor-react-native/src/icons/Sparkle').SparkleIcon
export const XIcon: Icon = require('phosphor-react-native/src/icons/X').XIcon
/* eslint-enable @typescript-eslint/no-require-imports */
