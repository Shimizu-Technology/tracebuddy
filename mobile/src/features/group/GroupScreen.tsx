import { useCallback, useState } from 'react'
import { SectionList, StyleSheet, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { readArtistLevel } from '../../data/artistLevel'
import { catalogPictures, pictureCategories } from '../../data/catalog'
import type { ArtLevel, Picture } from '../../data/catalog'
import { sectionsForPictures } from '../../data/pictureSections'
import { PageHeader } from '../../ui/PageHeader'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { useFavorites } from '../home/useFavorites'
import { PictureTile } from '../picture/PictureTile'
import { usePictureGrid } from '../picture/usePictureGrid'

function pictureRows(pictures: readonly Picture[], columns: number) {
  const rows: (readonly Picture[])[] = []
  for (let index = 0; index < pictures.length; index += columns) {
    rows.push(pictures.slice(index, index + columns))
  }
  return rows
}

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const group = pictureCategories.find((category) => category.id === id)
  const { columns, tileWidth, fontScale } = usePictureGrid()
  const [level, setLevel] = useState<ArtLevel>()
  const { favorites, toggle } = useFavorites()
  const favoriteIds = new Set(favorites)

  useFocusEffect(useCallback(() => {
    let active = true
    void readArtistLevel().then((value) => { if (active) setLevel(value ?? 'simple') })
      .catch(() => { if (active) setLevel('simple') })
    return () => { active = false }
  }, []))

  const sections = group && level ? sectionsForPictures(group.id, catalogPictures(level)).map(({ title, pictures }) => ({
    key: title ?? group.id,
    title,
    data: pictureRows(pictures, columns),
  })) : []

  return (
    <SafeAreaView style={styles.page}>
      <PageHeader title={group?.label ?? 'Pictures'} stacked={fontScale >= theme.layout.stackedHeaderFontScale}
        onBack={() => router.canGoBack() ? router.back() : router.replace('/')} />
      <SectionList
        key={`${id}-${columns}`}
        sections={sections}
        keyExtractor={(row) => row[0].id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={!group || level ? <Text tone="muted">No pictures in this group.</Text> : null}
        renderSectionHeader={({ section }) => section.title ? (
          <Text variant="heading" accessibilityRole="header" style={styles.heading}>{section.title}</Text>
        ) : null}
        renderItem={({ item: row }) => (
          <View style={styles.row}>
            {row.map((picture) => (
              <PictureTile key={picture.id} picture={picture} width={tileWidth}
                favorite={favoriteIds.has(picture.id)} toggleFavorite={toggle} />
            ))}
          </View>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  list: { paddingHorizontal: theme.space.lg, paddingBottom: theme.space.lg },
  heading: { fontFamily: theme.fontFamily[800], marginTop: theme.space.xs, marginBottom: theme.space.sm },
  row: { flexDirection: 'row', gap: theme.space.md, marginBottom: theme.space.md },
})
