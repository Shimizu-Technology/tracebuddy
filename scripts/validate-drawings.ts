import { drawingCategories, drawings, type DrawingCategoryId } from '../shared/drawings'
import { revisedTemplateSvgs } from '../shared/revisedTemplates'

const legacyIds = [
  'curated-flower-head-008', 'curated-cute-crab-056', 'curated-shell-057', 'curated-car-062',
  'curated-rocket-064', 'curated-kite-070', 'curated-snowflake-080', 'curated-palm-tree-081',
  'curated-pine-tree-088', 'curated-pumpkin-097', 'curated-airplane-110', 'curated-rose-117',
  'curated-fish-118', 'curated-flower-120', 'curated-long-stem-flower-257', 'flower',
  'smiling-star', 'cozy-house', 'friendly-sun', 'butterfly', 'puppy', 'sleepy-cat', 'bunny',
  'gentle-elephant', 'panda', 'little-duck', 'curly-snail', 'island-turtle', 'friendly-fish',
  'seahorse', 'starfish', 'happy-crab', 'tiny-whale', 'octopus', 'shell', 'dream-unicorn',
  'fairy-wand', 'storybook-castle', 'tiny-dragon', 'royal-crown', 'rainbow-cloud', 'rocket-ship',
  'race-car', 'airplane', 'delivery-truck', 'sailboat', 'scooter', 'abc-practice', 'numbers-123',
  'big-heart-word', 'name-banner', 'latte-stone', 'palm-island', 'hibiscus', 'proa-canoe',
  'beach-hut', 'pumpkin', 'snowflake', 'heart-balloons', 'flying-kite', 'birthday-cake',
] as const

const addedIds = [
  'line-paths', 'waves-zigzags', 'loops-spirals', 'easy-tree', 'big-leaf', 'rain-cloud',
  'baby-dinosaur', 'ladybug', 'jellyfish', 'happy-train', 'guam-outline', 'coconut-crab',
] as const

const replacementIds = [
  'curated-flower-120', 'curated-long-stem-flower-257', 'seahorse', 'shell',
  'curated-car-062', 'curated-airplane-110', 'curated-kite-070', 'curated-pumpkin-097',
  'proa-canoe', 'dream-unicorn', 'tiny-dragon', 'abc-practice', 'numbers-123', 'name-banner',
] as const

const repairIds = [
  'curated-flower-head-008', 'curated-shell-057', 'island-turtle', 'starfish', 'octopus',
  'delivery-truck', 'scooter', 'snowflake', 'palm-island', 'beach-hut', 'flower', 'butterfly',
  'gentle-elephant', 'panda', 'curly-snail', 'big-heart-word', 'curated-palm-tree-081',
  'curated-rose-117', 'curated-fish-118',
] as const

const revisedLegacyIds = [...replacementIds, ...repairIds]

const expectedCategoryCounts: Record<DrawingCategoryId, number> = {
  starters: 7,
  nature: 8,
  animals: 10,
  ocean: 12,
  magic: 6,
  vehicles: 10,
  letters: 3,
  island: 8,
  seasonal: 9,
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function sorted(values: readonly string[]) {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function assertExactSet(actual: readonly string[], expected: readonly string[], label: string) {
  assert(JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expected)), `${label} do not match the ledger`)
}

assert(drawings.length === 73, `Expected 73 drawings, received ${drawings.length}`)
assertExactSet(drawings.map(({ id }) => id), [...legacyIds, ...addedIds], 'Catalog IDs')
assert(new Set(drawings.map(({ id }) => id)).size === drawings.length, 'Drawing IDs must be unique')
assert(new Set(drawings.map(({ name }) => name)).size === drawings.length, 'Drawing names must be unique')
assertExactSet(Object.keys(revisedTemplateSvgs), [...revisedLegacyIds, ...addedIds], 'Revised SVG IDs')
assert(legacyIds.filter((id) => !revisedLegacyIds.includes(id as typeof revisedLegacyIds[number])).length === 28, 'Expected 28 unchanged legacy drawings')

const featuredFilter = drawingCategories.find(({ id }) => id === 'curated')
assert(featuredFilter?.label === 'Featured', 'The curated filter must be displayed as Featured')
assert(drawings.filter(({ collection }) => collection === 'curated').length === 15, 'Expected 15 Featured drawings')

for (const [category, expectedCount] of Object.entries(expectedCategoryCounts)) {
  const actualCount = drawings.filter((drawing) => drawing.category === category).length
  assert(actualCount === expectedCount, `${category} should contain ${expectedCount} drawings, received ${actualCount}`)
}

const revisedIds = new Set<string>([...revisedLegacyIds, ...addedIds])

for (const drawing of drawings) {
  assert(drawing.name.trim().length > 0, `${drawing.id} is missing a name`)
  assert(drawing.theme.trim().length > 0, `${drawing.id} is missing a theme`)
  assert(drawing.svg.startsWith('<svg '), `${drawing.id} must begin with an SVG root`)
  assert(drawing.svg.includes('viewBox="0 0 420 420"'), `${drawing.id} must use the 420x420 viewBox`)
  assert(!/<(?:text|image|foreignObject)\b/i.test(drawing.svg), `${drawing.id} contains a disallowed SVG element`)
  assert(!/(?:href|src)=["'](?:https?:|data:|javascript:)/i.test(drawing.svg), `${drawing.id} contains an external or executable reference`)

  if (!revisedIds.has(drawing.id)) continue

  assert(drawing.svg === revisedTemplateSvgs[drawing.id as keyof typeof revisedTemplateSvgs], `${drawing.id} is not using its revised SVG`)
  assert(drawing.svg.includes('stroke="#18243a"'), `${drawing.id} must use TraceBuddy navy`)
  assert(drawing.svg.includes('stroke-linecap="round"'), `${drawing.id} must use rounded line caps`)
  assert(drawing.svg.includes('stroke-linejoin="round"'), `${drawing.id} must use rounded line joins`)

  const strokeWidths = [...drawing.svg.matchAll(/(?:^|[\s<])stroke-width\s*=\s*(["'])([\d.]+)\1/g)]
  assert(strokeWidths.length > 0, `${drawing.id} is missing a stroke width`)
  for (const [, , width] of strokeWidths) {
    assert(Number(width) >= 7, `${drawing.id} contains a stroke thinner than 7px`)
  }
}

console.log('Drawing catalog valid: 73 drawings, 61 preserved IDs, 14 replacements, 19 repairs, 28 unchanged drawings, and 12 additions.')
