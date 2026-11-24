import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'
import { SvgXml } from 'react-native-svg'

import type { Picture } from '../../data/catalog'
import { currentDrawingImageUri } from '../../data/drawingPhotos'
import { theme } from '../../ui/theme'

export function PictureArt({ picture }: { picture: Picture }) {
  const image = picture.uploadedImage ? { uri: currentDrawingImageUri(picture.uploadedImage.uri) } : picture.color?.()
  return (
    <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {image ? <Image source={image} style={StyleSheet.absoluteFill} contentFit="contain" />
        : <SvgXml xml={picture.line()} width="100%" height="100%" />}
    </View>
  )
}

const styles = StyleSheet.create({
  art: { width: '100%', aspectRatio: 1, borderRadius: theme.radius.tile, overflow: 'hidden' },
})
