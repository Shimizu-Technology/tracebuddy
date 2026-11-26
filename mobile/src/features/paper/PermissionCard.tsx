import { StyleSheet, View } from 'react-native'

import { Button } from '../../ui/Button'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { BottomCard } from './BottomCard'

export type CameraAccess = 'ask' | 'denied' | 'unavailable'

type Props = {
  access: CameraAccess
  reduceMotion: boolean
  onAllow: () => void
  onOpenSettings: () => void
  /** Left out where there is no Draw route (the 2.0 flag is off): the option is hidden. */
  onDrawOnScreen?: () => void
}

const copy: Record<CameraAccess, { title: string; line: string }> = {
  ask: {
    title: 'Use the camera',
    line: 'TraceBuddy uses the camera to show your paper for tracing and to take a photo when you tap the shutter.',
  },
  denied: {
    title: 'The camera is off',
    line: 'Turn on Camera for TraceBuddy in Settings to trace on paper.',
  },
  unavailable: {
    title: 'The camera didn’t start',
    line: 'Close other camera apps and try again, or draw on the screen.',
  },
}

/** Explains the camera in one sentence before the system asks, and offers a way forward if it stays off. */
export function PermissionCard({ access, reduceMotion, onAllow, onOpenSettings, onDrawOnScreen }: Props) {
  const { title, line } = copy[access]
  return (
    <BottomCard
      reduceMotion={reduceMotion}
      accessibilityLabel={title}
      footer={(
        <View style={styles.actions}>
          {access === 'ask' ? <Button label="Turn on camera" target="adult" onPress={onAllow} /> : null}
          {access === 'denied' ? <Button label="Open Settings" target="adult" onPress={onOpenSettings} /> : null}
          {access === 'unavailable' ? <Button label="Try again" target="adult" onPress={onAllow} /> : null}
          {onDrawOnScreen ? <Button label="Draw on the screen instead" variant="quiet" target="adult" onPress={onDrawOnScreen} /> : null}
        </View>
      )}
    >
      <Text variant="heading" accessibilityRole="header">{title}</Text>
      <Text tone="muted">{line}</Text>
    </BottomCard>
  )
}

const styles = StyleSheet.create({
  actions: { gap: theme.space.sm },
})
