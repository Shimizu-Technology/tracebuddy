import assert from 'node:assert/strict'

import { generatedArt } from '../mobile/src/data/art.generated.ts'
import { artLevels, catalogPictures } from '../mobile/src/data/catalog.ts'
import { groupsForPictures } from '../mobile/src/data/pictureGroups.ts'
import { pictureSections, sectionsForPictures } from '../mobile/src/data/pictureSections.ts'

const listed = new Set<string>()
for (const [category, sections] of Object.entries(pictureSections)) {
  for (const { title, ids } of sections) {
    for (const id of ids) {
      assert(!listed.has(id), `Picture "${id}" is listed more than once (in ${category}: ${title}).`)
      listed.add(id)
      for (const level of artLevels) {
        const picture = generatedArt[level].find((item) => item.id === id)
        if (picture) {
          assert.equal(picture.category, category, `Picture "${id}" in ${level} belongs to ${picture.category}, not ${category}.`)
        }
      }
    }
  }
}

const simple = catalogPictures('simple')
const puppy = simple.find((picture) => picture.id === 'puppy')
const cat = simple.find((picture) => picture.id === 'cat')
assert(puppy && cat)

assert.equal(groupsForPictures([cat, puppy])[0].cover.id, 'puppy')
assert.equal(groupsForPictures([cat])[0].cover.id, 'cat')
assert(!groupsForPictures(simple).some((group) => group.id === 'patterns'))
assert(groupsForPictures(catalogPictures('detailed')).some((group) => group.cover.id === 'flower-mandala'))
assert.deepEqual(sectionsForPictures('patterns', simple), [])

const animals = sectionsForPictures('animals', [cat, { ...cat, id: 'unassigned' }, puppy])
assert.deepEqual(animals.map(({ title, pictures }) => [title, pictures.map((picture) => picture.id)]), [
  ['Pets and farm', ['puppy', 'cat']],
  ['More', ['unassigned']],
])

console.log('Picture section checks passed')
