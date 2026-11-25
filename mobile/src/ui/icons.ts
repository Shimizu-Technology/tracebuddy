import type { Icon } from 'phosphor-react-native'

// Load each Phosphor icon from its own module. The package root re-exports every icon (about 6 MB),
// and Metro does not tree-shake. require keeps TypeScript from type-checking the package's .tsx sources,
// which don't pass this project's strict settings. Add new icons here; the lint rule blocks root value imports.
/* eslint-disable @typescript-eslint/no-require-imports */
export const ArrowCounterClockwiseIcon: Icon = require('phosphor-react-native/src/icons/ArrowCounterClockwise').ArrowCounterClockwiseIcon
export const CaretDownIcon: Icon = require('phosphor-react-native/src/icons/CaretDown').CaretDownIcon
export const CaretLeftIcon: Icon = require('phosphor-react-native/src/icons/CaretLeft').CaretLeftIcon
export const CaretRightIcon: Icon = require('phosphor-react-native/src/icons/CaretRight').CaretRightIcon
export const CaretUpIcon: Icon = require('phosphor-react-native/src/icons/CaretUp').CaretUpIcon
export const CheckIcon: Icon = require('phosphor-react-native/src/icons/Check').CheckIcon
export const CrosshairSimpleIcon: Icon = require('phosphor-react-native/src/icons/CrosshairSimple').CrosshairSimpleIcon
export const DotsThreeIcon: Icon = require('phosphor-react-native/src/icons/DotsThree').DotsThreeIcon
export const FileIcon: Icon = require('phosphor-react-native/src/icons/File').FileIcon
export const FlipHorizontalIcon: Icon = require('phosphor-react-native/src/icons/FlipHorizontal').FlipHorizontalIcon
export const InfoIcon: Icon = require('phosphor-react-native/src/icons/Info').InfoIcon
export const LockIcon: Icon = require('phosphor-react-native/src/icons/Lock').LockIcon
export const PushPinIcon: Icon = require('phosphor-react-native/src/icons/PushPin').PushPinIcon
export const SunIcon: Icon = require('phosphor-react-native/src/icons/Sun').SunIcon
export const SunDimIcon: Icon = require('phosphor-react-native/src/icons/SunDim').SunDimIcon
export const PencilSimpleIcon: Icon = require('phosphor-react-native/src/icons/PencilSimple').PencilSimpleIcon
export const SparkleIcon: Icon = require('phosphor-react-native/src/icons/Sparkle').SparkleIcon
export const XIcon: Icon = require('phosphor-react-native/src/icons/X').XIcon
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable @typescript-eslint/no-require-imports */
export const ImagesSquareIcon: Icon = require('phosphor-react-native/src/icons/ImagesSquare').ImagesSquareIcon
export const UserIcon: Icon = require('phosphor-react-native/src/icons/User').UserIcon
export const ImageIcon: Icon = require('phosphor-react-native/src/icons/Image').ImageIcon
export const TextAaIcon: Icon = require('phosphor-react-native/src/icons/TextAa').TextAaIcon
export const SquaresFourIcon: Icon = require('phosphor-react-native/src/icons/SquaresFour').SquaresFourIcon
export const PawPrintIcon: Icon = require('phosphor-react-native/src/icons/PawPrint').PawPrintIcon
export const FishSimpleIcon: Icon = require('phosphor-react-native/src/icons/FishSimple').FishSimpleIcon
export const RocketLaunchIcon: Icon = require('phosphor-react-native/src/icons/RocketLaunch').RocketLaunchIcon
export const IslandIcon: Icon = require('phosphor-react-native/src/icons/Island').IslandIcon
export const ShapesIcon: Icon = require('phosphor-react-native/src/icons/Shapes').ShapesIcon
export const LeafIcon: Icon = require('phosphor-react-native/src/icons/Leaf').LeafIcon
export const SmileyIcon: Icon = require('phosphor-react-native/src/icons/Smiley').SmileyIcon
export const PlayIcon: Icon = require('phosphor-react-native/src/icons/Play').PlayIcon
export const EraserIcon: Icon = require('phosphor-react-native/src/icons/Eraser').EraserIcon
export const ArrowUUpLeftIcon: Icon = require('phosphor-react-native/src/icons/ArrowUUpLeft').ArrowUUpLeftIcon
export const DownloadSimpleIcon: Icon = require('phosphor-react-native/src/icons/DownloadSimple').DownloadSimpleIcon
export const CornersOutIcon: Icon = require('phosphor-react-native/src/icons/CornersOut').CornersOutIcon
export const TrashIcon: Icon = require('phosphor-react-native/src/icons/Trash').TrashIcon
export const CopyIcon: Icon = require('phosphor-react-native/src/icons/Copy').CopyIcon
export const CameraIcon: Icon = require('phosphor-react-native/src/icons/Camera').CameraIcon
export const PaintBrushIcon: Icon = require('phosphor-react-native/src/icons/PaintBrush').PaintBrushIcon
export const HighlighterIcon: Icon = require('phosphor-react-native/src/icons/Highlighter').HighlighterIcon
export const HandPointingIcon: Icon = require('phosphor-react-native/src/icons/HandPointing').HandPointingIcon
export const TipiIcon: Icon = require('phosphor-react-native/src/icons/Tipi').TipiIcon
export const MagnifyingGlassIcon: Icon = require('phosphor-react-native/src/icons/MagnifyingGlass').MagnifyingGlassIcon
export const HeartIcon: Icon = require('phosphor-react-native/src/icons/Heart').HeartIcon
export const ArrowClockwiseIcon: Icon = require('phosphor-react-native/src/icons/ArrowClockwise').ArrowClockwiseIcon
export const MagnifyingGlassMinusIcon: Icon = require('phosphor-react-native/src/icons/MagnifyingGlassMinus').MagnifyingGlassMinusIcon
export const BugIcon: Icon = require('phosphor-react-native/src/icons/Bug').BugIcon
export const PlanetIcon: Icon = require('phosphor-react-native/src/icons/Planet').PlanetIcon
export const IceCreamIcon: Icon = require('phosphor-react-native/src/icons/IceCream').IceCreamIcon
export const GiftIcon: Icon = require('phosphor-react-native/src/icons/Gift').GiftIcon
export const UsersThreeIcon: Icon = require('phosphor-react-native/src/icons/UsersThree').UsersThreeIcon
export const SpiralIcon: Icon = require('phosphor-react-native/src/icons/Spiral').SpiralIcon
export const EyeIcon: Icon = require('phosphor-react-native/src/icons/Eye').EyeIcon
export const SpeakerHighIcon: Icon = require('phosphor-react-native/src/icons/SpeakerHigh').SpeakerHighIcon
export const SpeakerSlashIcon: Icon = require('phosphor-react-native/src/icons/SpeakerSlash').SpeakerSlashIcon
/* eslint-enable @typescript-eslint/no-require-imports */
