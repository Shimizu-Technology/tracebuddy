import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { XIcon } from 'phosphor-react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { IconButton } from '../../src/ui/IconButton'
import { Text } from '../../src/ui/Text'
import { theme } from '../../src/ui/theme'

export default function KitSheet() {
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.sheet}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text accessibilityRole="header" variant="heading" style={styles.title}>Example sheet</Text>
          <IconButton glyph={XIcon} accessibilityLabel="Close example sheet" onPress={() => router.back()} />
        </View>
        <Text>Swipe down to close.</Text>
        <Text tone="muted">The kit stays visible behind this sheet.</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.space.xl, gap: theme.space.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  title: { flex: 1 },
})
