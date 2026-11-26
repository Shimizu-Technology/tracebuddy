import { useCallback, useRef, useState } from 'react'
import { Alert, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { usePreventRemove } from 'expo-router/react-navigation'
import { SafeAreaView } from 'react-native-safe-area-context'

import { readArtistLevel, writeArtistLevel } from '../../data/artistLevel'
import type { ArtLevel } from '../../data/catalog'
import { pickAndRestoreDrawingBackup, shareDrawingBackup } from '../../data/drawingBackup'
import { DrawingBackupError, DrawingRestoreWriteError, maxDrawingBackupMiB } from '../../data/drawingBackupModel'
import type { DrawingRestoreResult } from '../../data/drawingBackupModel'
import { Button } from '../../ui/Button'
import { HoldButton } from '../../ui/HoldButton'
import { LockIcon } from '../../ui/icons'
import { PageHeader } from '../../ui/PageHeader'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { ArtistChoice } from './ArtistChoice'

const backupErrorMessages = {
  backup: {
    invalid: 'A saved drawing could not be read. Open My drawings and try again.',
    'too-large': `Your library is larger than TraceBuddy’s ${maxDrawingBackupMiB} MB backup limit. You can save individual drawings to Photos from My drawings.`,
  },
  restore: {
    invalid: 'Choose a drawings backup made by TraceBuddy.',
    'too-large': `This file is larger than TraceBuddy’s ${maxDrawingBackupMiB} MB restore limit.`,
  },
}

function photoNote(count: number) {
  return count === 1 ? 'One photo was missing.' : `${count} photos were missing.`
}

function restoreSummary({ added, updated, kept, missingPhotos }: DrawingRestoreResult) {
  const details = []
  if (added) details.push(`Added ${added} ${added === 1 ? 'drawing' : 'drawings'}.`)
  if (updated) details.push(`Updated ${updated} ${updated === 1 ? 'drawing' : 'drawings'}.`)
  if (kept) details.push(`Kept ${kept} ${kept === 1 ? 'drawing already on this device' : 'drawings already on this device'}.`)
  if (missingPhotos) details.push(photoNote(missingPhotos))
  return details.join(' ')
}

export default function GrownUpsScreen() {
  const [level, setLevel] = useState<ArtLevel | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [working, setWorking] = useState<'backup' | 'restore' | null>(null)
  const busy = useRef(false)
  const { width, height } = useWindowDimensions()
  usePreventRemove(working !== null, () => undefined)

  useFocusEffect(useCallback(() => {
    let active = true
    void readArtistLevel().then((value) => { if (active) setLevel(value) }).catch(() => undefined)
    return () => {
      active = false
      setUnlocked(false)
    }
  }, []))

  async function pick(value: ArtLevel) {
    try {
      await writeArtistLevel(value)
      setLevel(value)
    } catch {
      Alert.alert('Could not save your choice', 'Try choosing an artist again.')
    }
  }

  async function run(operation: 'backup' | 'restore') {
    if (!unlocked || busy.current) return
    busy.current = true
    setWorking(operation)
    try {
      if (operation === 'backup') {
        const { missingPhotos } = await shareDrawingBackup({ width: Math.max(1, width - 20), height: Math.max(430, height - 280) })
        if (missingPhotos) Alert.alert('Some photos were missing', `${photoNote(missingPhotos)} The backup still includes the saved drawings.`)
      } else {
        const result = await pickAndRestoreDrawingBackup()
        if (result) Alert.alert('Restore complete', restoreSummary(result) || 'There were no drawings to add.')
      }
    } catch (error) {
      const title = operation === 'backup' ? 'Could not back up drawings' : 'Could not restore drawings'
      if (error instanceof DrawingBackupError) {
        Alert.alert(title, backupErrorMessages[operation][error.reason])
      } else if (error instanceof DrawingRestoreWriteError) {
        Alert.alert('Restore stopped', [restoreSummary(error.result), 'Try the same file again when there’s space on this device.'].filter(Boolean).join(' '))
      } else {
        Alert.alert(title, 'Check that there’s space on this device and try again.')
      }
    } finally {
      busy.current = false
      setWorking(null)
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <PageHeader title="Grown-ups" />
      <ScrollView contentContainerStyle={styles.content}>
        {unlocked ? <>
          <ArtistChoice level={level} onPick={(value) => void pick(value)} />
          {Platform.OS !== 'web' && (
            <View style={styles.backup}>
              <Text variant="heading" accessibilityRole="header">Drawing backups</Text>
              <Text tone="muted">Save a copy of your drawings, lesson progress, and favorites to Files, or bring them back from a backup.</Text>
              <Button label={working === 'backup' ? 'Getting your backup ready…' : 'Back up drawings'} target="adult"
                onPress={() => void run('backup')} disabled={working !== null} />
              <Button label={working === 'restore' ? 'Restoring drawings…' : 'Restore drawings'} target="adult"
                variant="secondary" onPress={() => void run('restore')} disabled={working !== null} />
            </View>
          )}
        </> : <HoldButton label="Open grown-up settings" glyph={LockIcon} parentGate onConfirm={() => setUnlocked(true)} />}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.space.lg, width: '100%', maxWidth: theme.sample.maxContentWidth, alignSelf: 'center', gap: theme.space.xl },
  backup: { gap: theme.space.md, paddingBottom: theme.space.xl },
})
