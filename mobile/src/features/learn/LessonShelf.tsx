import { router } from 'expo-router'
import { FlatList, StyleSheet, View } from 'react-native'

import { drawingLessonIndex } from '../../../../shared/lessons/drawingLessons'
import { resolvePicture } from '../../data/catalog'
import { Icon } from '../../ui/Icon'
import { PencilSimpleIcon } from '../../ui/icons'
import { PressTarget } from '../../ui/PressTarget'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { PictureArt } from '../picture/PictureArt'
import { picturePastel } from '../picture/picturePastel'
import { lessonDestination } from './lessonPractice'

const featuredIds = ['simple/cat', 'simple/fish', 'simple/rocket', 'simple/t-rex', 'detailed/unicorn']
const shelfLessons = [
  ...featuredIds.flatMap((id) => drawingLessonIndex.filter((lesson) => lesson.id === id)),
  ...drawingLessonIndex.filter((lesson) => !featuredIds.includes(lesson.id)),
]

export function LessonShelf({ width }: { width: number }) {
  return (
    <View style={styles.shelf}>
      <View style={styles.heading}>
        <Icon glyph={PencilSimpleIcon} />
        <Text variant="heading" accessibilityRole="header" style={styles.bold}>Learn to draw</Text>
      </View>
      <FlatList
        horizontal
        alwaysBounceHorizontal={false}
        data={shelfLessons}
        keyExtractor={({ id }) => id}
        contentContainerStyle={styles.cards}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const picture = resolvePicture({ id: item.pictureId, level: item.level })
          if (!picture) return null
          return (
            <PressTarget
              accessibilityLabel={`Learn to draw ${item.title}`}
              onPress={() => router.push(lessonDestination(item))}
              style={[styles.card, { width, backgroundColor: theme.pastels[picturePastel[picture.category]] }]}
            >
              <PictureArt picture={picture} />
              <Text variant="label" style={[styles.bold, styles.label]}>{item.title}</Text>
            </PressTarget>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  shelf: { gap: theme.space.sm },
  heading: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  bold: { fontFamily: theme.fontFamily[800] },
  cards: { gap: theme.space.md, paddingBottom: theme.space.xs },
  card: { minWidth: theme.target.child, minHeight: theme.target.child, borderRadius: theme.radius.tile, padding: theme.space.sm, gap: theme.space.xs },
  label: { textAlign: 'center' },
})
