import { readFileSync } from 'node:fs'

import { drawingById, drawingByNameAndTheme, drawingCategories, drawings, type DrawingCategoryId } from '../shared/drawings'
import { revisedTemplateSvgs } from '../shared/revisedTemplates'

const retiredIds = [
  'curated-cute-crab-056',
  'curated-rocket-064',
  'curated-kite-070',
  'curated-snowflake-080',
  'curated-palm-tree-081',
  'curated-airplane-110',
  'curated-fish-118',
  'curated-flower-120',
  'curated-long-stem-flower-257',
] as const

const approvedUnchangedIds = [
  'smiling-star',
  'friendly-sun',
  'royal-crown',
  'birthday-cake',
] as const

const inlineApprovedUnchangedIds = [
  'smiling-star',
  'friendly-sun',
  'royal-crown',
  'birthday-cake',
] as const

const expectedCategoryCounts: Record<DrawingCategoryId, number> = {
  starters: 7,
  nature: 6,
  animals: 10,
  ocean: 10,
  magic: 6,
  vehicles: 8,
  letters: 3,
  island: 7,
  seasonal: 7,
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function sorted(values: readonly string[]) {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function assertExactSet(actual: readonly string[], expected: readonly string[], label: string) {
  assert(JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expected)), `${label} do not match the review ledger`)
}

assert(drawings.length === 64, `Expected 64 drawings, received ${drawings.length}`)
assert(new Set(drawings.map(({ id }) => id)).size === drawings.length, 'Drawing IDs must be unique')
assert(new Set(drawings.map(({ name }) => name)).size === drawings.length, 'Drawing names must be unique')
assert(retiredIds.every((id) => !drawings.some((drawing) => drawing.id === id)), 'Retired drawings must not remain discoverable')
assert(retiredIds.every((id) => drawingById(id)?.id === id), 'Retired drawings must remain available for saved-session compatibility')
assert(retiredIds.every((id) => {
  const drawing = drawingById(id)
  return drawing && drawingByNameAndTheme(drawing.name, drawing.theme)?.id === id
}), 'Retired drawings must remain available to name-and-theme legacy migrations')

const reviewLedger = readFileSync(new URL('../artifacts/drawings/catalog-review.md', import.meta.url), 'utf8')
for (const { id } of drawings) {
  const token = `| \`${id}\` |`
  const matchingRows = reviewLedger.split('\n').filter((line) => line.includes(token))
  assert(matchingRows.length === 1, `${id} must have exactly one row in the drawing review ledger`)
  assert(matchingRows[0].includes('pass'), `${id} must have a passing drawing review decision`)
}
for (const id of retiredIds) {
  const token = `| \`${id}\` |`
  assert(reviewLedger.split(token).length === 2, `${id} must have exactly one retirement row in the drawing review ledger`)
}

const revisedDrawingIds = drawings
  .map(({ id }) => id)
  .filter((id) => !(inlineApprovedUnchangedIds as readonly string[]).includes(id))

assertExactSet(Object.keys(revisedTemplateSvgs), revisedDrawingIds, 'Revised SVG IDs')

const featuredFilter = drawingCategories.find(({ id }) => id === 'curated')
assert(featuredFilter?.label === 'Featured', 'The curated filter must be displayed as Featured')
assert(drawings.filter(({ collection }) => collection === 'curated').length === 6, 'Expected 6 Featured drawings after consolidation')

for (const [category, expectedCount] of Object.entries(expectedCategoryCounts)) {
  const actualCount = drawings.filter((drawing) => drawing.category === category).length
  assert(actualCount === expectedCount, `${category} should contain ${expectedCount} drawings, received ${actualCount}`)
}

for (const drawing of drawings) {
  assert(drawing.name.trim().length > 0, `${drawing.id} is missing a name`)
  assert(drawing.theme.trim().length > 0, `${drawing.id} is missing a theme`)
  assert(drawing.svg.startsWith('<svg '), `${drawing.id} must begin with an SVG root`)
  assert(drawing.svg.includes('viewBox="0 0 420 420"'), `${drawing.id} must use the 420x420 viewBox`)
  assert(!/<(?:text|image|foreignObject)\b/i.test(drawing.svg), `${drawing.id} contains a disallowed SVG element`)
  assert(!/(?:href|src)=["'](?:https?:|data:|javascript:)/i.test(drawing.svg), `${drawing.id} contains an external or executable reference`)

  const revisedSvg = revisedTemplateSvgs[drawing.id as keyof typeof revisedTemplateSvgs]
  if (revisedSvg) assert(drawing.svg === revisedSvg, `${drawing.id} is not using its reviewed SVG`)
  if ((approvedUnchangedIds as readonly string[]).includes(drawing.id)) continue

  assert(drawing.svg.includes('stroke="#18243a"'), `${drawing.id} must use TraceBuddy navy`)
  assert(drawing.svg.includes('stroke-linecap="round"'), `${drawing.id} must use rounded line caps`)
  assert(drawing.svg.includes('stroke-linejoin="round"'), `${drawing.id} must use rounded line joins`)
  assert(!/fill=["'](?:white|#fff|#ffffff)["']/i.test(drawing.svg), `${drawing.id} must not obscure the camera or paper with a white fill`)

  const strokeWidths = [...drawing.svg.matchAll(/(?:^|[\s<])stroke-width\s*=\s*(["'])([\d.]+)\1/g)]
  assert(strokeWidths.length > 0, `${drawing.id} is missing a stroke width`)
  for (const [, , width] of strokeWidths) {
    assert(Number(width) >= 7, `${drawing.id} contains a stroke thinner than 7px`)
    assert(Number(width) <= 13, `${drawing.id} contains a stroke thicker than 13px`)
  }
}

console.log('Drawing catalog valid: 64 drawings, 60 revised templates, 4 approved unchanged templates, and 9 retired duplicates.')
