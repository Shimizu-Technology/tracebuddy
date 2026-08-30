import assert from 'node:assert/strict'

import {
  addRecentDrawing,
  drawings,
  emptyDrawingPreferences,
  filterDrawings,
  normalizeDrawingPreferences,
  toggleFavoriteDrawing,
} from '../shared/index.ts'

assert.deepEqual(normalizeDrawingPreferences(null), emptyDrawingPreferences)
assert.deepEqual(normalizeDrawingPreferences({
  favoriteIds: ['guam-outline', 'missing-template', 'guam-outline'],
  recentIds: ['guam-outline', 'happy-train', 'missing-template', 'guam-outline'],
}), {
  version: 1,
  favoriteIds: ['guam-outline'],
  recentIds: ['guam-outline', 'happy-train'],
})

const favorite = toggleFavoriteDrawing(emptyDrawingPreferences, 'guam-outline')
assert.deepEqual(favorite.favoriteIds, ['guam-outline'])
assert.deepEqual(toggleFavoriteDrawing(favorite, 'guam-outline').favoriteIds, [])
assert.equal(toggleFavoriteDrawing(favorite, 'missing-template'), favorite)

const nineIds = drawings.slice(0, 9).map((drawing) => drawing.id)
const recents = nineIds.reduce(addRecentDrawing, emptyDrawingPreferences)
assert.deepEqual(recents.recentIds, nineIds.slice(1).reverse())
assert.deepEqual(addRecentDrawing(recents, nineIds[4]).recentIds, [nineIds[4], ...recents.recentIds.filter((id) => id !== nineIds[4])])

const islandStarters = filterDrawings({ category: 'island', difficulty: 'Starter', query: '', favoriteIds: [] })
assert(islandStarters.length > 0)
assert(islandStarters.every((drawing) => drawing.category === 'island' && drawing.difficulty === 'Starter'))
assert(filterDrawings({ category: 'all', difficulty: 'all', query: 'Guam', favoriteIds: [] }).some((drawing) => drawing.id === 'guam-outline'))
assert.deepEqual(filterDrawings({ category: 'all', difficulty: 'all', query: '', favoriteIds: ['guam-outline'], favoritesOnly: true }).map((drawing) => drawing.id), ['guam-outline'])

console.log('Discovery model checks passed')
