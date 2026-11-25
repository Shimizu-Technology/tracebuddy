import type { Picture, PictureCategory } from './catalog'
import { letterPictureSections } from './letterPictures'

type PictureSection = { title: string; ids: readonly string[] }

export const pictureSections: Partial<Record<PictureCategory, readonly PictureSection[]>> = {
  letters: letterPictureSections,
  animals: [
    { title: 'Pets and farm', ids: ['puppy', 'cat', 'kitten', 'bunny', 'hamster', 'horse', 'pig', 'sheep', 'cow', 'chicken', 'duck', 'kitty-bow', 'pony'] },
    { title: 'Wild animals', ids: ['lion', 'tiger', 'elephant', 'giraffe', 'monkey', 'panda', 'koala', 'sloth', 'fox', 'frog', 'penguin', 'polar-bear', 'hedgehog', 'zebra', 'bear', 'deer', 'raccoon', 'squirrel', 'hippo'] },
    { title: 'Birds', ids: ['owl', 'flamingo', 'toucan', 'peacock'] },
  ],
  holidays: [
    { title: 'Christmas', ids: ['christmas-tree', 'snowman', 'present', 'gingerbread', 'santa', 'wreath', 'reindeer', 'candy-cane', 'stocking'] },
    { title: 'Halloween', ids: ['jack-o-lantern'] },
    { title: 'Thanksgiving', ids: ['turkey'] },
  ],
}

export function sectionsForPictures(category: PictureCategory, pictures: readonly Picture[]): {
  title?: string
  pictures: readonly Picture[]
}[] {
  const group = pictures.filter((picture) => picture.category === category)
  if (!group.length) return []
  const definitions = pictureSections[category]
  if (!definitions) return [{ pictures: group }]

  const remaining = new Map(group.map((picture) => [picture.id, picture]))
  const sections = definitions.flatMap(({ title, ids }) => {
    const pictures = ids.flatMap((id) => {
      const picture = remaining.get(id)
      remaining.delete(id)
      return picture ? [picture] : []
    })
    return pictures.length ? [{ title, pictures }] : []
  })
  if (remaining.size) sections.push({ title: 'More', pictures: [...remaining.values()] })
  return sections
}
