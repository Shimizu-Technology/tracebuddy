import { drawingTitle } from '../../data/practiceSource'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, FlatList, StyleSheet, TextInput, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { continueDrawing } from '../../../finishFindModel'
import { readArtistLevel, writeArtistLevel } from '../../data/artistLevel'
import { catalogPictures } from '../../data/catalog'
import type { ArtLevel, Picture } from '../../data/catalog'
import { useDrawingLibrary } from '../../data/drawingLibrary'
import { pickDrawingPhoto } from '../../data/drawingPhotos'
import { groupsForPictures } from '../../data/pictureGroups'
import { CanvasButton } from '../../ui/CanvasButton'
import { Icon } from '../../ui/Icon'
import {
  ImageIcon, ImagesSquareIcon, MagnifyingGlassIcon, PencilSimpleIcon, PlayIcon, TextAaIcon, UserIcon,
} from '../../ui/icons'
import { PressTarget } from '../../ui/PressTarget'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { DrawingThumbnail } from '../drawings/DrawingThumbnail'
import { LessonShelf } from '../learn/LessonShelf'
import { PictureArt } from '../picture/PictureArt'
import { PictureTile } from '../picture/PictureTile'
import { picturePastel } from '../picture/picturePastel'
import { usePictureGrid } from '../picture/usePictureGrid'
import { ArtistChoice } from './ArtistChoice'
import { useFavorites } from './useFavorites'

type PictureGroup = ReturnType<typeof groupsForPictures>[number]
type GridTile = { kind: 'group'; group: PictureGroup } | { kind: 'picture'; picture: Picture }

const makeYourOwn = [
  { id: 'photo', label: 'My photo', icon: ImageIcon, pastel: theme.pastels.sky },
  { id: 'words', label: 'My words', icon: TextAaIcon, pastel: theme.pastels.butter },
] as const

export default function HomeScreen() {
  const { contentWidth, fontScale, columns, tileWidth } = usePictureGrid()
  const { lessons } = useLocalSearchParams<{ lessons?: string }>()
  const grid = useRef<FlatList<GridTile>>(null)
  const [level, setLevel] = useState<ArtLevel | null>()
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const photoPending = useRef(false)
  const homeFocused = useRef(false)
  const photoLease = useRef<(() => Promise<void>) | null>(null)
  const levelPending = useRef(false)
  const { drawings } = useDrawingLibrary()
  const { favorites, toggle } = useFavorites()
  // A photo of a paper drawing is finished work, not something to keep going on.
  const recent = continueDrawing((drawings ?? []).filter((drawing) => !drawing.paperPhoto))

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

  useFocusEffect(useCallback(() => {
    if (lessons !== '1') return
    setSearching(false)
    setQuery('')
    grid.current?.scrollToOffset({ offset: 0, animated: false })
    router.setParams({ lessons: undefined })
  }, [lessons]))

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
  const favoriteIds = new Set(favorites)
  const favoritePictures = pictures.filter((picture) => favoriteIds.has(picture.id))
  const tiles: GridTile[] = normalizedQuery
    ? pictures.filter((picture) => picture.name.toLocaleLowerCase().includes(normalizedQuery))
      .map((picture) => ({ kind: 'picture', picture }))
    : groupsForPictures(pictures).map((group) => ({ kind: 'group', group }))
  const count = drawings?.length ?? 0

  return (
    <SafeAreaView style={styles.page}>
      <FlatList
        ref={grid}
        key={columns}
        data={tiles}
        keyExtractor={(item) => item.kind === 'group' ? `group-${item.group.id}` : `picture-${item.picture.id}`}
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
            {!normalizedQuery && (
              <>
                <LessonShelf width={Math.min(tileWidth, theme.layout.favoriteTileWidth)} />
                <View style={styles.row}>
                  {makeYourOwn.map(({ id, label, icon, pastel }) => (
                    <PressTarget key={id} style={styles.special} accessibilityLabel={label}
                      onPress={id === 'photo' ? () => void choosePhoto() : () => router.push({ pathname: '/my-name', params: { level: level ?? 'simple' } })}>
                      <View style={[styles.specialBadge, { backgroundColor: pastel }]}><Icon glyph={icon} /></View>
                      <Text style={[styles.bold, styles.center]}>{label}</Text>
                    </PressTarget>
                  ))}
                </View>
                {favoritePictures.length > 0 && (
                  <View style={styles.shelf}>
                    <Text variant="heading" accessibilityRole="header" style={styles.bold}>Favorites</Text>
                    <FlatList
                      horizontal
                      alwaysBounceHorizontal={false}
                      showsHorizontalScrollIndicator={false}
                      data={favoritePictures}
                      keyExtractor={(picture) => picture.id}
                      contentContainerStyle={styles.row}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item }) => (
                        <PictureTile picture={item} width={Math.min(tileWidth, theme.layout.favoriteTileWidth)} favorite toggleFavorite={toggle} />
                      )}
                    />
                  </View>
                )}
              </>
            )}
          </View>
        }
        ListEmptyComponent={normalizedQuery ? <Text tone="muted">No pictures match.</Text> : null}
        renderItem={({ item }) => item.kind === 'picture' ? (
          <PictureTile picture={item.picture} width={tileWidth} favorite={favoriteIds.has(item.picture.id)} toggleFavorite={toggle} />
        ) : (
          <PressTarget
            style={[styles.group, {
              width: tileWidth, minHeight: tileWidth + theme.space.xl,
              backgroundColor: theme.pastels[picturePastel[item.group.id]],
            }]}
            accessibilityLabel={item.group.label}
            onPress={() => router.push({ pathname: '/group/[id]', params: { id: item.group.id } })}
          >
            <PictureArt picture={item.group.cover} />
            <Text variant="heading" style={[styles.bold, styles.center]}>{item.group.label}</Text>
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
  row: { flexDirection: 'row', gap: theme.space.md },
  shelf: { gap: theme.space.sm },
  center: { textAlign: 'center' },
  group: {
    borderRadius: theme.radius.tile, paddingHorizontal: theme.space.sm, paddingTop: theme.space.sm,
    paddingBottom: theme.space.md, gap: theme.space.sm, justifyContent: 'space-between',
  },
  special: {
    flex: 1, minHeight: theme.target.child, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline, borderWidth: theme.border.emphasis,
    borderRadius: theme.radius.tile, padding: theme.space.md, gap: theme.space.sm,
  },
  specialBadge: { width: theme.target.child, height: theme.target.child, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.tile },
})
