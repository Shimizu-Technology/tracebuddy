import { useCallback, useState } from 'react'
import { Alert, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { readArtistLevel, writeArtistLevel } from '../../data/artistLevel'
import type { ArtLevel } from '../../data/catalog'
import { PageHeader } from '../../ui/PageHeader'
import { theme } from '../../ui/theme'
import { ArtistChoice } from './ArtistChoice'

export default function GrownUpsScreen() {
  const [level, setLevel] = useState<ArtLevel | null>(null)
  useFocusEffect(useCallback(() => {
    let active = true
    void readArtistLevel().then((value) => { if (active) setLevel(value) }).catch(() => undefined)
    return () => { active = false }
  }, []))

  async function pick(value: ArtLevel) {
    try {
      await writeArtistLevel(value)
      setLevel(value)
    } catch {
      Alert.alert('Could not save your choice', 'Try choosing an artist again.')
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <PageHeader title="Grown-ups" />
      <ScrollView contentContainerStyle={styles.content}>
        <ArtistChoice level={level} onPick={(value) => void pick(value)} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.space.lg, width: '100%', maxWidth: theme.sample.maxContentWidth, alignSelf: 'center' },
})
