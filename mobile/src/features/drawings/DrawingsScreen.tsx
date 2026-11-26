import { drawingTitle } from '../../data/practiceSource'
import { router } from 'expo-router'
import { ActivityIndicator, FlatList, StyleSheet, View, useWindowDimensions } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import type { SavedPracticeSession } from '../../../practiceStorageModel'
import { useDrawingLibrary } from '../../data/drawingLibrary'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { ImagesSquareIcon } from '../../ui/icons'
import { PageHeader } from '../../ui/PageHeader'
import { PressTarget } from '../../ui/PressTarget'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { DrawingThumbnail } from './DrawingThumbnail'

function dateLabel(updatedAt: string) {
  const date = new Date(updatedAt)
  if (!Number.isFinite(date.getTime())) return 'Saved drawing'
  if (Date.now() - date.getTime() < 60_000) return 'Just now'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DrawingsScreen() {
  const { drawings, failed, reload } = useDrawingLibrary()
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const contentWidth = width - insets.left - insets.right
  const columns = contentWidth >= theme.layout.fourColumns ? 4 : contentWidth >= theme.layout.threeColumns ? 3 : 2
  const tileWidth = Math.floor((contentWidth - theme.space.lg * 2 - theme.space.md * (columns - 1)) / columns)

  function openMenu(session: SavedPracticeSession) {
    router.push({ pathname: '/drawing-menu', params: { sessionId: session.sessionId } })
  }

  // A photo of a paper drawing opens as a photo; everything else opens in Draw.
  function open(session: SavedPracticeSession) {
    if (session.paperPhoto) router.push({ pathname: '/keepsake/[sessionId]', params: { sessionId: session.sessionId } })
    else router.push({ pathname: '/draw/[id]', params: { id: session.source.drawingId, sessionId: session.sessionId } })
  }

  return (
    <SafeAreaView style={styles.page}>
      <PageHeader title="My drawings" />
      <FlatList
        key={columns}
        data={drawings ?? []}
        keyExtractor={(session) => session.sessionId}
        numColumns={columns}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        ListHeaderComponent={failed && Boolean(drawings?.length) ? (
          <View style={styles.notice}>
            <Text tone="muted" accessibilityLiveRegion="polite">Some drawings could not open.</Text>
            <Button label="Try again" target="adult" variant="secondary" onPress={reload} />
          </View>
        ) : null}
        ListEmptyComponent={failed ? (
          <View style={styles.empty}>
            <Text variant="heading">My drawings could not load.</Text>
            <Button label="Try again" onPress={reload} />
          </View>
        ) : drawings ? (
          <View style={styles.empty}>
            <View style={styles.illustration}><Icon glyph={ImagesSquareIcon} size={theme.target.adult} /></View>
            <Text variant="heading" style={styles.title}>Your drawings will go here</Text>
            <Button label="Pick a picture" onPress={() => router.dismissTo('/')} />
          </View>
        ) : <ActivityIndicator color={theme.colors.ink} />}
        renderItem={({ item }) => (
          <PressTarget style={[styles.tile, { width: tileWidth }]} accessibilityLabel={drawingTitle(item)}
            accessibilityHint={item.paperPhoto ? 'Open photo. Long-press for drawing options.' : 'Open drawing. Long-press for drawing options.'}
            accessibilityActions={[{ name: 'options', label: 'Drawing options' }]}
            onAccessibilityAction={({ nativeEvent }) => { if (nativeEvent.actionName === 'options') openMenu(item) }}
            onLongPress={() => openMenu(item)}
            onPress={() => open(item)}>
            <DrawingThumbnail side={tileWidth - theme.space.sm * 2} session={item} />
            <View style={styles.caption}>
              <Text variant="body" style={styles.label}>{drawingTitle(item)}</Text>
              <Text variant="label" tone="muted">{dateLabel(item.updatedAt)}</Text>
            </View>
          </PressTarget>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  grid: { padding: theme.space.lg, gap: theme.space.md, flexGrow: 1 },
  row: { gap: theme.space.md },
  tile: { borderRadius: theme.radius.tile, backgroundColor: theme.colors.surface, padding: theme.space.sm, ...theme.floatingShadow },
  caption: { padding: theme.space.sm, gap: theme.space.xs },
  label: { fontFamily: theme.fontFamily[800] },
  empty: { minHeight: theme.layout.emptyGalleryMinHeight, alignItems: 'center', justifyContent: 'center', gap: theme.space.lg },
  illustration: { backgroundColor: theme.pastels.peach, borderRadius: theme.radius.tile, padding: theme.space.lg },
  title: { textAlign: 'center' },
  notice: { gap: theme.space.sm },
})
