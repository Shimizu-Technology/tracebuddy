import { router } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { paramsForPicture } from '../../data/catalog'
import type { Picture } from '../../data/catalog'
import { Icon } from '../../ui/Icon'
import { HeartIcon } from '../../ui/icons'
import { PressTarget } from '../../ui/PressTarget'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { PictureArt } from './PictureArt'
import { picturePastel } from './picturePastel'

type Props = {
  picture: Picture
  width: number
  favorite: boolean
  toggleFavorite: (id: string) => void
}

export function PictureTile({ picture, width, favorite, toggleFavorite }: Props) {
  return (
    <PressTarget
      style={[styles.tile, { width, backgroundColor: theme.pastels[picturePastel[picture.category]] }]}
      accessibilityLabel={picture.name}
      accessibilityHint="Long-press to change favorite"
      accessibilityActions={[{ name: 'favorite', label: favorite ? 'Remove favorite' : 'Add favorite' }]}
      onAccessibilityAction={({ nativeEvent }) => { if (nativeEvent.actionName === 'favorite') toggleFavorite(picture.id) }}
      onLongPress={() => toggleFavorite(picture.id)}
      onPress={() => router.push({ pathname: '/picture/[id]', params: paramsForPicture(picture) })}
    >
      <PictureArt picture={picture} />
      {favorite && <View style={styles.favoriteMark}><Icon glyph={HeartIcon} /></View>}
      <Text variant="body" style={styles.bold}>{picture.name}</Text>
    </PressTarget>
  )
}

const styles = StyleSheet.create({
  tile: { position: 'relative', borderRadius: theme.radius.tile, padding: theme.space.md, gap: theme.space.sm, minHeight: theme.target.child },
  favoriteMark: { position: 'absolute', top: theme.space.md, right: theme.space.md, backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.full, padding: theme.space.xs },
  bold: { fontFamily: theme.fontFamily[800] },
})
