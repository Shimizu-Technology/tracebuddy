import { requireNativeView, requireOptionalNativeModule } from 'expo'
import { Platform } from 'react-native'
import type { ViewProps } from 'react-native'

type EscapeProps = ViewProps & { onEscape: () => void }
const NativeEscapeView = Platform.OS === 'ios' && requireOptionalNativeModule('TraceBuddyKeyboard')
  ? requireNativeView<EscapeProps>('TraceBuddyKeyboard')
  : null

export default function KeepsakeEscape({ onEscape }: { onEscape: () => void }) {
  return NativeEscapeView ? <NativeEscapeView onEscape={onEscape} pointerEvents="none" accessible={false} accessibilityElementsHidden style={{ position: 'absolute', width: 1, height: 1 }} /> : null
}
