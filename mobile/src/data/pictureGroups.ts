import type { Picture, PictureCategory } from './catalog'
import { pictureCategories } from './catalog'

const groupOrder: readonly { id: PictureCategory; coverId?: string }[] = [
  { id: 'animals', coverId: 'puppy' },
  { id: 'dinosaurs', coverId: 't-rex' },
  { id: 'ocean', coverId: 'sea-turtle' },
  { id: 'magic', coverId: 'unicorn' },
  { id: 'go', coverId: 'fire-truck' },
  { id: 'space', coverId: 'rocket' },
  { id: 'holidays', coverId: 'christmas-tree' },
  { id: 'food', coverId: 'ice-cream' },
  { id: 'bugs', coverId: 'ladybug' },
  { id: 'nature', coverId: 'sunflower' },
  { id: 'guam', coverId: 'latte-stone' },
  { id: 'people', coverId: 'superhero' },
  { id: 'fun', coverId: 'teddy-bear' },
  { id: 'patterns', coverId: 'flower-mandala' },
  { id: 'letters' },
  { id: 'shapes' },
]

export function groupsForPictures(pictures: readonly Picture[]) {
  return groupOrder.flatMap(({ id, coverId }) => {
    const category = pictureCategories.find((item) => item.id === id)
    const groupPictures = pictures.filter((picture) => picture.category === id)
    const cover = groupPictures.find((picture) => picture.id === coverId) ?? groupPictures[0]
    return category && cover ? [{ ...category, cover }] : []
  })
}
