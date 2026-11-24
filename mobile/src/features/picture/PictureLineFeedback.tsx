import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'

export function PictureLineFeedback({ status }: { status: 'loading' | 'error' }) {
  return <View style={styles.center}>
    {status === 'loading'
      ? <ActivityIndicator accessibilityLabel="Loading picture" color={theme.colors.ink} />
      : <Text variant="label" tone="muted" style={styles.label}>Picture unavailable</Text>}
  </View>
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.space.sm },
  label: { textAlign: 'center' },
})
