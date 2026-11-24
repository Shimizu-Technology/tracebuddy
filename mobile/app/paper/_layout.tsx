import { Stack } from 'expo-router'

import { smallSheetOptions } from '../../src/ui/Sheet'
import { useReduceMotion } from '../../src/ui/useReduceMotion'
import { paperTheme } from '../../src/features/paper/paperTheme'

// On paper keeps its own stack so its More sheet and Paper Lock screen don't need entries in the root layout.
export default function PaperLayout() {
  const reduceMotion = useReduceMotion()
  return (
    <Stack screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'default', contentStyle: { backgroundColor: paperTheme.colors.backdrop } }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen
        name="more"
        options={{
          ...smallSheetOptions,
          sheetAllowedDetents: [paperTheme.moreSheetDetent],
          sheetResizeAnimationEnabled: !reduceMotion,
        }}
      />
      <Stack.Screen name="stick/[id]" options={{ animation: reduceMotion ? 'none' : 'fade' }} />
    </Stack>
  )
}
