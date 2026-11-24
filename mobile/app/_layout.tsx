import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold'
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold'
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold'
import { useFonts } from 'expo-font'
import { SplashScreen, Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { devKitEnabled } from '../src/devKit'
import { smallSheetOptions } from '../src/ui/Sheet'
import { theme } from '../src/ui/theme'
import { useReduceMotion } from '../src/ui/useReduceMotion'

void SplashScreen.preventAutoHideAsync().catch(() => undefined)

const fontTimeoutMs = 2500
const fonts = {
  [theme.fontFamily[600]]: Nunito_600SemiBold,
  [theme.fontFamily[700]]: Nunito_700Bold,
  [theme.fontFamily[800]]: Nunito_800ExtraBold,
}

// Give direct links a back destination without putting kit links on the home screen.
// eslint-disable-next-line react-refresh/only-export-components -- Expo Router reads this route export.
export const unstable_settings = { initialRouteName: 'index' }

export default function RootLayout() {
  const [loaded, error] = useFonts(fonts)
  const [timedOut, setTimedOut] = useState(false)
  const reduceMotion = useReduceMotion()
  const ready = loaded || Boolean(error) || timedOut

  useEffect(() => {
    if (ready) return
    const timer = setTimeout(() => setTimedOut(true), fontTimeoutMs)
    return () => clearTimeout(timer)
  }, [ready])

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined)
  }, [ready])

  if (!ready) return null

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'default' }}>
          <Stack.Screen name="index" />
          <Stack.Protected guard={devKitEnabled}>
            <Stack.Screen name="dev/kit" />
            <Stack.Screen
              name="dev/kit-sheet"
              options={{ ...smallSheetOptions, sheetResizeAnimationEnabled: !reduceMotion }}
            />
          </Stack.Protected>
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({ root: { flex: 1 } })
