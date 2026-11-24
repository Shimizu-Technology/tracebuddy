import assert from 'node:assert/strict'

import { lineForSource, resolvePicture, sourceForPicture } from '../mobile/src/data/catalog'
import { createPictureLineCache } from '../mobile/src/data/pictureLineModel'
import type { PictureLine } from '../mobile/src/data/pictureLineModel'

const svg = (id: number) => `<svg id="${id}"/>`
const asset = (id: number): PictureLine => ({ kind: 'asset', moduleId: () => id })
const reads: number[] = []
const missing = new Error('Missing asset')
const cache = createPictureLineCache(async (id) => {
  reads.push(id)
  if (id === 0 && reads.filter((read) => read === id).length === 1) throw missing
  return id === -1 ? 'not an SVG' : svg(id)
}, 2)

const a = asset(1)
const b = asset(2)
const c = asset(3)
assert.equal(cache.peek(a), undefined, 'an unread asset starts in the loading state')
assert.deepEqual(reads, [], 'peeking does not resolve or read assets')
assert.deepEqual(await Promise.all([cache.read(a), cache.read(a)]), [
  { status: 'ready', xml: svg(1) }, { status: 'ready', xml: svg(1) },
])
assert.deepEqual(reads, [1], 'concurrent readers share the same asset read')
await cache.read(b)
await cache.read(a)
await cache.read(c)
assert.equal(cache.peek(a), svg(1), 'the accessed item remains cached')
assert.equal(cache.peek(b), undefined, 'the least recently used item is evicted')
await cache.read(b)
assert.deepEqual(reads, [1, 2, 3, 2], 'reading an evicted item reloads it')

const missingAsset = asset(0)
assert.deepEqual(await cache.read(missingAsset), { status: 'error', error: missing })
assert.equal(cache.peek(missingAsset), undefined, 'a failure leaves room to retry')
assert.deepEqual(await cache.read(missingAsset), { status: 'ready', xml: svg(0) })
assert.equal((await cache.read(asset(-1))).status, 'error', 'invalid asset content surfaces as an error')

const brokenRequire: PictureLine = { kind: 'asset', moduleId: () => { throw missing } }
assert.deepEqual(await cache.read(brokenRequire), { status: 'error', error: missing })

for (const params of [{ id: 'happy-crab', legacy: '1' }, { id: 'my-name', text: 'Ana' }]) {
  const picture = resolvePicture(params)
  assert.ok(picture)
  const xml = cache.peek(picture.line)
  assert.ok(xml?.includes('<svg'), 'legacy and text guides are ready synchronously')
  assert.equal(cache.peek(lineForSource(sourceForPicture(picture, xml))), xml)
}

const curated = resolvePicture({ id: 'crab', level: 'detailed' })
assert.ok(curated)
const saved = sourceForPicture(curated, svg(10))
assert.equal(saved.drawingId, 'tb2-detailed-crab')
assert.equal(cache.peek(lineForSource(saved)), svg(10), 'saved drawings keep their original guide')
assert.equal(lineForSource({ ...saved, drawingSvg: undefined }), curated.line, 'curated IDs can resolve the exact asset')

console.log('Picture line loading, errors, retry, LRU eviction and saved guides passed.')
