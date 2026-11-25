import assert from 'node:assert/strict'

import { createTextDrawing } from '../shared/drawings'
import {
  artLevels, catalogPictures, lineForSource, paramsForPicture, paramsForSource, pictureLevels, resolvePicture, sourceForPicture,
} from '../mobile/src/data/catalog'
import { createFavoritePreference, isLegacyFavoriteId, parseArtFavorites } from '../mobile/src/data/favoritePreference'
import { guideFonts } from '../mobile/src/data/glyphs.generated'
import { groupsForPictures } from '../mobile/src/data/pictureGroups'
import { sectionsForPictures } from '../mobile/src/data/pictureSections'
import { makePracticeSource } from '../mobile/src/data/practiceSource'
import { layoutTextGuide, textGuideSvg } from '../mobile/src/data/textGuide'
import { pictureRouteParams, resolvePaperPicture } from '../mobile/src/features/paper/paperPicture'
import { normalizePracticeSource } from '../mobile/practiceStorageModel'

const styles = ['bubble', 'practice'] as const
for (const style of styles) {
  const samples = [
    ['Alexandria', ['Alexandria']],
    [' Håfa   Adai ', ['Håfa Adai']],
    ['Happy Birthday', ['Happy', 'Birthday']],
    ['abcdefghijkl', ['abcdef', 'ghijkl']],
    ['0123456789'.repeat(5), ['0123456789012345', '6789012345678901', '2345678901234567']],
  ] as const
  for (const [word, expected] of samples) {
    const layout = layoutTextGuide(word, style)
    assert(layout)
    assert.deepEqual(layout.lines.map(({ text }) => text), expected)
    assert(layout.width <= 840.001 && layout.height <= 840.001)
    for (const { baseline, top, bottom, width } of layout.lines) {
      assert(layout.offsetY + (baseline - top) * layout.scale >= 79.999)
      assert(layout.offsetY + (baseline - bottom) * layout.scale <= 920.001)
      assert(width * layout.scale <= 840.001)
    }
    const svg = textGuideSvg(word, style)
    assert.match(svg, /viewBox="0 0 1000 1000"/)
    assert.match(svg, /stroke="#172033"/)
    assert.doesNotMatch(svg, /<text\b|Infinity|NaN/)
    assert.equal((svg.match(/stroke-dasharray/g) ?? []).length, style === 'practice' ? expected.length : 0)
  }
  const tenLetter = layoutTextGuide('Alexandria', style)!
  assert(tenLetter.scale * guideFonts[style].capHeight * 320 / 1000 > 30, 'a ten-letter name reaches a 30pt capital on a 320pt guide')
  assert.equal(textGuideSvg('Ha\u030afa Adai', style), textGuideSvg('Håfa Adai', style), 'normalize pasted accents')
  const stacked = layoutTextGuide('pppppp ÅÅÅÅÅÅ', style)!
  assert.equal(stacked.lines.length, 2)
  assert(stacked.lines[1].baseline - stacked.lines[1].top >= stacked.lines[0].baseline - stacked.lines[0].bottom,
    'a row of tall accents stays clear of the descenders above it')
  for (const character of "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?'-&åÅñÑáÁéÉíÍóÓúÚüÜʼ’") {
    assert(layoutTextGuide(character, style), `${style} renders ${character} as a path`)
  }
  for (const word of ['Håfa 🐙', 'こんにちは', '<word>']) {
    assert.equal(layoutTextGuide(word, style), null)
    assert.equal(textGuideSvg(word, style), createTextDrawing(word).svg, 'use the entire legacy guide for unsupported text')
  }
}
assert(guideFonts.bubble.kerning.A?.T, 'Fredoka Latin kerning is exported')

for (const level of artLevels) {
  const library = catalogPictures(level)
  assert.equal(groupsForPictures(library).find(({ id }) => id === 'letters')?.cover.id, 'letter-a')
  const sections = sectionsForPictures('letters', library)
  assert.deepEqual(sections.map(({ title, pictures }) => [title, pictures.length]), [['ABC', 26], ['123', 10]])
  assert.equal(sections[0].pictures[0].name, 'A')
  for (const { pictures } of sections) {
    for (const picture of pictures) {
      assert(!library.some((other) => other !== picture && other.id === picture.id), 'favorite IDs are unique')
      assert.equal(picture.level, level)
      assert.equal(resolvePicture(paramsForPicture(picture)), picture)
      assert(picture.line.kind === 'inline')
      assert.match(picture.colorXml?.() ?? '', /fill="#[\dA-F]{6}"/i)
      const source = sourceForPicture(picture, picture.line.xml)
      const reloaded = normalizePracticeSource(JSON.parse(JSON.stringify(source)))
      assert(reloaded)
      assert.equal(resolvePicture(paramsForSource(reloaded)), picture)
      assert.deepEqual(lineForSource(reloaded), picture.line)
      assert.deepEqual(lineForSource({ ...reloaded, drawingSvg: undefined }), picture.line)
    }
  }
  const text = "Håfa Adai, What's your favorite number?"
  const params = { id: 'my-name', text, level }
  const picture = resolvePicture(params)
  assert(picture?.line.kind === 'inline')
  assert.deepEqual(pictureLevels(picture.id), artLevels)
  assert.deepEqual(paramsForPicture(picture), params)
  const saved = sourceForPicture(picture, picture.line.xml)
  assert.equal(saved.kind, 'custom')
  assert.deepEqual(lineForSource(saved), picture.line)
  assert.deepEqual(paramsForSource(saved), params)
  assert.deepEqual(resolvePaperPicture(pictureRouteParams(paramsForSource(saved)))?.picture.line, picture.line)
}
assert.notDeepEqual(resolvePicture({ id: 'letter-a', level: 'simple' })?.line, resolvePicture({ id: 'letter-a', level: 'detailed' })?.line)
assert.notDeepEqual(resolvePicture({ id: 'my-name', level: 'simple', text: 'Ana' })?.line,
  resolvePicture({ id: 'my-name', level: 'detailed', text: 'Ana' })?.line)

let favoriteStorage: string | null = null
const favorites = () => createFavoritePreference(
  async () => favoriteStorage,
  async (value) => { favoriteStorage = value },
  parseArtFavorites,
  (ids, id) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
)
assert(!isLegacyFavoriteId('letter-a'), 'letter favorites use the current catalog storage')
await favorites().toggle('letter-a')
const favoriteIds = (await favorites().read()).value
assert.equal(catalogPictures('detailed').find(({ id }) => favoriteIds.includes(id))?.id, 'letter-a')

const oldDrawing = createTextDrawing('Ana & José')
const oldSource = makePracticeSource(oldDrawing, null)
assert.deepEqual(lineForSource(oldSource), { kind: 'inline', xml: oldDrawing.svg })
assert.deepEqual(resolvePicture(paramsForSource(oldSource))?.line, lineForSource(oldSource))

console.log('Text guide layout, catalog, paper routes, and saved guide checks passed')
