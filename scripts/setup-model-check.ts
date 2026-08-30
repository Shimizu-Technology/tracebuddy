import assert from 'node:assert/strict'

import { normalizeTraceAlignment } from '../shared/index.ts'

assert.equal(normalizeTraceAlignment(null), null)
assert.equal(normalizeTraceAlignment({ x: 0, y: 0, scale: Number.NaN, rotation: 0, opacity: 0.5 }), null)
assert.deepEqual(normalizeTraceAlignment({ version: 99, x: 5000, y: -5000, scale: 8, rotation: 999, opacity: -1 }), {
  version: 1,
  x: 2000,
  y: -2000,
  scale: 2.2,
  rotation: 180,
  opacity: 0.15,
})
assert.deepEqual(normalizeTraceAlignment({ x: 12, y: -8, scale: 0.82, rotation: 5, opacity: 0.62 }), {
  version: 1,
  x: 12,
  y: -8,
  scale: 0.82,
  rotation: 5,
  opacity: 0.62,
})

console.log('Parent setup and saved-alignment model checks passed')
