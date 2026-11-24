import { drawingTitle } from '../../data/practiceSource'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, FlatList, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { continueDrawing } from '../../../finishFindModel'
import { readArtistLevel, writeArtistLevel } from '../../data/artistLevel'
import { catalogPictures, paramsForPicture, pictureCategories } from '../../data/catalog'
import type { ArtLevel, Picture, PictureCategory } from '../../data/catalog'
import { useDrawingLibrary } from '../../data/drawingLibrary'
import { pickDrawingPhoto } from '../../data/drawingPhotos'
import { CanvasButton } from '../../ui/CanvasButton'
import { Icon } from '../../ui/Icon'
import type { IconGlyph } from '../../ui/Icon'
import {
  BugIcon, FishSimpleIcon, GiftIcon, HeartIcon, IceCreamIcon, ImageIcon, ImagesSquareIcon, IslandIcon, LeafIcon,
  MagnifyingGlassIcon, PawPrintIcon, PencilSimpleIcon, PlanetIcon, PlayIcon, RocketLaunchIcon, ShapesIcon, SmileyIcon,
  SparkleIcon, SpiralIcon, SquaresFourIcon, TextAaIcon, TipiIcon, UserIcon, UsersThreeIcon,
} from '../../ui/icons'
import { PressTarget } from '../../ui/PressTarget'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { DrawingThumbnail } from '../drawings/DrawingThumbnail'
import { PictureArt } from '../picture/PictureArt'
import { picturePastel } from '../picture/picturePastel'
import { ArtistChoice } from './ArtistChoice'
import { useFavorites } from './useFavorites'

const categoryIcons: Record<PictureCategory, IconGlyph> = {
  animals: PawPrintIcon, ocean: FishSimpleIcon, magic: SparkleIcon, go: RocketLaunchIcon, guam: IslandIcon,
  letters: TextAaIcon, shapes: ShapesIcon, dinosaurs: TipiIcon, nature: LeafIcon, fun: SmileyIcon, bugs: BugIcon,
  space: PlanetIcon, food: IceCreamIcon, holidays: GiftIcon, people: UsersThreeIcon, patterns: SpiralIcon,
}

type Category = PictureCategory | 'all' | 'favorites'
type GridTile = { kind: 'photo' | 'name'; id: string } | { kind: 'picture'; id: string; picture: Picture }

export default function HomeScreen() {
  const { width, fontScale } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const contentWidth = width - insets.left - insets.right
  const columns = contentWidth >= theme.layout.fourColumns ? 4 : contentWidth >= theme.layout.threeColumns ? 3 : 2
  const [level, setLevel] = useState<ArtLevel | null>()
  const [category, setCategory] = useState<Category>('all')
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const photoPending = useRef(false)
  const homeFocused = useRef(false)
  const photoLease = useRef<(() => Promise<void>) | null>(null)
  const levelPending = useRef(false)
  const { drawings } = useDrawingLibrary()
  const { favorites, toggle } = useFavorites()
  const recent = continueDrawing(drawings ?? [])

  useEffect(() => () => { void photoLease.current?.() }, [photoLease])

  useFocusEffect(useCallback(() => {
    homeFocused.current = true
    void photoLease.current?.()
    photoLease.current = null
    let active = true
    void readArtistLevel().then((value) => { if (active) setLevel(value) })
      .catch(() => { if (active) setLevel(null) })
    return () => { active = false; homeFocused.current = false }
  }, []))

  async function chooseArtist(value: ArtLevel) {
    if (levelPending.current) return
    levelPending.current = true
    try {
      await writeArtistLevel(value)
      setLevel(value)
    } catch {
      Alert.alert('Could not save your choice', 'Try choosing an artist again.')
    } finally {
      levelPending.current = false
    }
  }

  async function choosePhoto() {
    if (photoPending.current) return
    photoPending.current = true
    try {
      const selection = await pickDrawingPhoto()
      if (!selection) return
      const { photo, release } = selection
      if (!homeFocused.current) {
        await release()
        return
      }
      photoLease.current = release
      router.push({ pathname: '/picture/[id]', params: {
        id: 'my-photo', photo: photo.uri,
        ...(photo.width ? { photoWidth: String(photo.width) } : {}),
        ...(photo.height ? { photoHeight: String(photo.height) } : {}),
      } })
    } catch {
      void photoLease.current?.()
      photoLease.current = null
      Alert.alert('Could not open photo', 'Try choosing your photo again.')
    } finally {
      photoPending.current = false
    }
  }

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const pictures = catalogPictures(level ?? 'simple')
  const chips = [
    { id: 'all' as const, label: 'All', icon: SquaresFourIcon },
    ...(favorites.length ? [{ id: 'favorites' as const, label: 'Favorites', icon: HeartIcon }] : []),
    ...pictureCategories.filter(({ id }) => pictures.some((picture) => picture.category === id))
      .map((item) => ({ ...item, icon: categoryIcons[item.id] })),
  ]
  const activeCategory = chips.some(({ id }) => id === category) ? category : 'all'
  const tiles: GridTile[] = [
    ...(activeCategory === 'all' && !normalizedQuery ? [
      { kind: 'photo' as const, id: 'my-photo' }, { kind: 'name' as const, id: 'my-name' },
    ] : []),
    ...pictures.filter((picture) => {
      const matchesCategory = activeCategory === 'all' || picture.category === activeCategory
        || (activeCategory === 'favorites' && favorites.includes(picture.id))
      return matchesCategory && picture.name.toLocaleLowerCase().includes(normalizedQuery)
    }).map((picture) => ({ kind: 'picture' as const, id: picture.id, picture })),
  ]
  const tileWidth = Math.floor((contentWidth - theme.space.lg * 2 - theme.space.md * (columns - 1)) / columns)
  const count = drawings?.length ?? 0

  return (
    <SafeAreaView style={styles.page}>
      <FlatList
        key={columns}
        data={tiles}
        numColumns={columns}
        keyboardShouldPersistTaps="handled"
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.top, fontScale >= theme.layout.stackedHeaderFontScale && styles.wrap]}>
              <View style={styles.wordmark}>
                <View style={styles.logo}><Icon glyph={PencilSimpleIcon} /></View>
                <Text variant="heading" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.bold, styles.wordmarkText]}>TraceBuddy</Text>
              </View>
              <View style={styles.actions}>
                <CanvasButton glyph={MagnifyingGlassIcon} label="Search pictures" selected={searching} style={styles.adultButton} onPress={() => {
                  setSearching(!searching)
                  if (searching) setQuery('')
                }} />
                <CanvasButton glyph={ImagesSquareIcon} label={`My drawings, ${count} saved`} onPress={() => router.push('/drawings')}>
                  {!!count && <View style={styles.count}><Text variant="label" maxFontSizeMultiplier={1.3} style={styles.bold}>{count}</Text></View>}
                </CanvasButton>
                <CanvasButton glyph={UserIcon} label="Grown-ups" style={styles.adultButton} onPress={() => router.push('/grown-ups')} />
              </View>
            </View>
            {searching && (
              <TextInput
                accessibilityLabel="Search pictures" placeholder="Search pictures" placeholderTextColor={theme.colors.muted}
                value={query} onChangeText={setQuery} autoFocus style={styles.search} returnKeyType="search"
              />
            )}
            <Text variant="display" accessibilityRole="header" style={contentWidth < theme.layout.threeColumns && styles.phoneTitle}>What do you want to draw?</Text>
            {level === null && <ArtistChoice level={level} onPick={(value) => void chooseArtist(value)} />}
            {recent && (
              <PressTarget
                accessibilityLabel={`Keep going, ${drawingTitle(recent)}`}
                onPress={() => router.push({ pathname: '/draw/[id]', params: { id: recent.source.drawingId, sessionId: recent.sessionId } })}
                style={styles.keepGoing}
              >
                <View style={styles.thumbnail}><DrawingThumbnail session={recent} side={theme.layout.recentThumbnail} /></View>
                <View style={styles.keepText}>
                  <Text variant="heading" style={styles.bold}>Keep going</Text>
                  <Text tone="muted">{drawingTitle(recent)}</Text>
                </View>
                <View style={styles.play}><Icon glyph={PlayIcon} /></View>
              </PressTarget>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {chips.map(({ id, icon, label }) => (
                <PressTarget key={id} accessibilityLabel={label} selected={activeCategory === id}
                  onPress={() => setCategory(id)} style={[styles.chip, activeCategory === id && styles.activeChip]}>
                  <Icon glyph={icon} tone={activeCategory === id ? 'surface' : 'ink'} />
                  <Text variant="label" style={[styles.bold, activeCategory === id && styles.activeText]}>{label}</Text>
                </PressTarget>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={<Text tone="muted">No pictures match.</Text>}
        renderItem={({ item }) => item.kind !== 'picture' ? (
          <PressTarget style={[styles.tile, styles.special, { width: tileWidth }]}
            accessibilityLabel={item.kind === 'photo' ? 'My photo' : 'My name'}
            onPress={item.kind === 'photo' ? () => void choosePhoto() : () => router.push('/my-name')}>
            <View style={styles.specialArt}>
              <View style={[styles.specialBadge, item.kind === 'photo' ? styles.photoBadge : styles.nameBadge]}>
                <Icon glyph={item.kind === 'photo' ? ImageIcon : TextAaIcon} />
              </View>
            </View>
            <Text variant="body" style={styles.bold}>{item.kind === 'photo' ? 'My photo' : 'My name'}</Text>
          </PressTarget>
        ) : (
          <PressTarget
            style={[styles.tile, { width: tileWidth, backgroundColor: theme.pastels[picturePastel[item.picture.category]] }]}
            accessibilityLabel={item.picture.name}
            accessibilityHint="Long-press to change favorite"
            accessibilityActions={[{ name: 'favorite', label: favorites.includes(item.id) ? 'Remove favorite' : 'Add favorite' }]}
            onAccessibilityAction={({ nativeEvent }) => { if (nativeEvent.actionName === 'favorite') toggle(item.id) }}
            onLongPress={() => toggle(item.id)}
            onPress={() => router.push({ pathname: '/picture/[id]', params: paramsForPicture(item.picture) })}
          >
            <PictureArt picture={item.picture} />
            {favorites.includes(item.id) && <View style={styles.favoriteMark}><Icon glyph={HeartIcon} /></View>}
            <Text variant="body" style={styles.bold}>{item.picture.name}</Text>
          </PressTarget>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  list: { paddingHorizontal: theme.space.lg, paddingBottom: theme.space.xl, gap: theme.space.md },
  header: { gap: theme.space.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.sm },
  wrap: { flexDirection: 'column', alignItems: 'flex-start' },
  wordmark: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: theme.layout.wordmarkMinWidth, gap: theme.space.sm },
  wordmarkText: { flexShrink: 1 },
  logo: { padding: theme.space.xs, backgroundColor: theme.pastels.peach, borderRadius: theme.space.md },
  bold: { fontFamily: theme.fontFamily[800] },
  actions: { flexDirection: 'row', gap: theme.space.xs, alignItems: 'center' },
  adultButton: { minWidth: theme.target.adult, minHeight: theme.target.adult },
  phoneTitle: { maxWidth: theme.layout.homeTitleWidth },
  count: {
    position: 'absolute', top: 0, right: 0, borderRadius: theme.radius.full, minWidth: theme.space.xl,
    alignItems: 'center', paddingHorizontal: theme.space.xs, backgroundColor: theme.colors.coral,
  },
  search: {
    minHeight: theme.target.child, borderRadius: theme.radius.tile, paddingHorizontal: theme.space.lg,
    backgroundColor: theme.colors.surface, color: theme.colors.ink, fontSize: theme.type.body.fontSize,
  },
  keepGoing: {
    minHeight: theme.target.child, flexDirection: 'row', alignItems: 'center', padding: theme.space.md,
    gap: theme.space.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.tile, ...theme.floatingShadow,
  },
  thumbnail: { borderRadius: theme.space.lg, overflow: 'hidden' },
  keepText: { flex: 1, gap: theme.space.xs },
  play: { minHeight: theme.target.child, minWidth: theme.target.child, borderRadius: theme.radius.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.coral },
  chips: { gap: theme.space.sm },
  chip: {
    minHeight: theme.target.child, minWidth: theme.target.child, paddingHorizontal: theme.space.lg, paddingVertical: theme.space.sm,
    borderRadius: theme.radius.full, backgroundColor: theme.colors.surface,
    flexDirection: 'row', alignItems: 'center', gap: theme.space.sm,
  },
  activeChip: { backgroundColor: theme.colors.ink },
  activeText: { color: theme.colors.surface },
  row: { gap: theme.space.md },
  tile: { position: 'relative', borderRadius: theme.radius.tile, padding: theme.space.md, gap: theme.space.sm, minHeight: theme.target.child },
  favoriteMark: { position: 'absolute', top: theme.space.md, right: theme.space.md, backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.full, padding: theme.space.xs },
  special: { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline, borderWidth: theme.border.emphasis },
  specialArt: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  specialBadge: { width: theme.target.child, height: theme.target.child, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.tile },
  photoBadge: { backgroundColor: theme.pastels.sky },
  nameBadge: { backgroundColor: theme.pastels.butter },
})
