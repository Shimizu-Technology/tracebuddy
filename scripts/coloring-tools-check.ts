import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import { brushTools, coloringBrushTools, normalizeSavedPracticeSession, normalizeSavedPracticeStroke } from '../mobile/practiceStorageModel.ts'
import { crayons, selectedCrayon } from '../mobile/src/features/draw/crayonShades.ts'
import { prepareFillGuide, supportsFill } from '../mobile/src/features/draw/fillGuide.ts'
import { fillBudgetMs, fillDocumentScale, fillResolution, floodFill, guideBarriers, indexFillGuide } from '../mobile/src/features/draw/floodFill.ts'

const oldPaint = { path: 'M 100 200 L 800 400', mode: 'draw', color: '#B99488', width: 78, opacity: 0.42 }
const wash = { ...oldPaint, blend: 'multiply', opacity: 0.72 }
const shape = { kind: 'fill', path: 'M 0 0 H1000 V1000 H0 Z', mode: 'draw', color: '#2959C4', width: 1, opacity: 1, lessonStep: 3 }

const oldDrawing = {
  version: 2, sessionId: 'legacy-coloring',
  source: { kind: 'drawing', drawingId: 'puppy', drawingName: 'Puppy', drawingTheme: 'Animals' },
  brushToolId: 'paint', strokes: [oldPaint, wash, shape],
}
const reopened = normalizeSavedPracticeSession(JSON.parse(JSON.stringify(oldDrawing)))!
assert.equal(reopened.brushToolId, 'paint')
assert.equal(brushTools.find(({ id }) => id === 'paint')?.label, 'Paint')
assert.equal(coloringBrushTools.find(({ id }) => id === reopened.brushToolId)?.label, 'Watercolor')
assert.deepEqual(reopened.strokes[0], { ...oldPaint, dasharray: undefined })
assert.deepEqual(reopened.strokes[1], { ...wash, dasharray: undefined })
assert.deepEqual(reopened.strokes[2], { ...shape, dasharray: undefined })
assert.equal(normalizeSavedPracticeSession({ ...oldDrawing, brushToolId: 'fill' })?.brushToolId, 'fill')
assert.equal(normalizeSavedPracticeStroke({ ...shape, mode: 'erase', blend: 'multiply' })?.kind, undefined)
assert.equal(normalizeSavedPracticeStroke({ ...shape, mode: 'erase', blend: 'multiply' })?.blend, undefined)

assert.equal(crayons.length, 15)
for (const [index, crayon] of crayons.entries()) {
  assert.equal(crayon.shades.length, 5)
  assert.equal(crayon.shades[2].value, crayon.value)
  for (const shade of crayon.shades) assert.equal(selectedCrayon(shade.value.toLowerCase()), index, shade.name)
}
assert.equal(crayons[selectedCrayon('#285AC3')].name, 'Blue')
assert.equal(crayons[selectedCrayon('#fff')].name, 'White')
assert.equal(crayons[selectedCrayon('#80808090')].name, 'Gray')
assert.equal(crayons[14].shades[4].name, 'Deep skin')

const outline = '<svg viewBox="0 0 1000 1000"><path d="M0 0h10v10Z"/></svg>'
assert.equal(supportsFill(outline, false), true)
assert.equal(supportsFill(outline, true), false)
assert.equal(supportsFill('<svg><text>x</text></svg>', false), false)
assert.equal(supportsFill(outline.padEnd(500_001), false), false)
const failedMask = prepareFillGuide(outline)
assert.equal(prepareFillGuide(outline), failedMask, 'shares an in-flight rasterization')
assert.equal(await failedMask, null)
const retryMask = prepareFillGuide(outline)
assert.notEqual(retryMask, failedMask, 'allows a failed rasterization to be retried')
assert.equal(await retryMask, null)
assert.deepEqual(guideBarriers(new Uint8Array([
  23, 32, 51, 255, // line
  23, 32, 51, 76,  // faint handwriting rule
  255, 255, 255, 255, // white background
  0, 0, 0, 0, // transparent background
])), new Uint8Array([1, 0, 0, 0]))

const size = 16
const mask = new Uint8Array(size * size)
for (let y = 3; y <= 12; y++) {
  for (let x = 3; x <= 12; x++) {
    if (x === 3 || x === 12 || y === 3 || y === 12 || (x >= 7 && x <= 9 && y >= 7 && y <= 9)) {
      mask[y * size + x] = 1
    }
  }
}

function includes(path: string, x: number, y: number) {
  let previousX = 0, previousY = 0
  let startX = 0, startY = 0
  let winding = 0
  function lineTo(nextX: number, nextY: number) {
    if ((previousY <= y && y < nextY) || (nextY <= y && y < previousY)) {
      const intersection = previousX + (nextX - previousX) * (y - previousY) / (nextY - previousY)
      if (x < intersection) winding += nextY > previousY ? 1 : -1
    }
    previousX = nextX
    previousY = nextY
  }

  for (const [, command, coordinates] of path.matchAll(/([MLQZ])([^MLQZ]*)/g)) {
    const [a, b, c, d] = coordinates.trim().split(/\s+/).map(Number)
    if (command === 'M') {
      startX = previousX = a
      startY = previousY = b
    } else if (command === 'L') {
      lineTo(a, b)
    } else if (command === 'Q') {
      const fromX = previousX, fromY = previousY
      for (let i = 1; i <= 8; i++) {
        const t = i / 8
        lineTo((1 - t) ** 2 * fromX + 2 * t * (1 - t) * a + t * t * c,
          (1 - t) ** 2 * fromY + 2 * t * (1 - t) * b + t * t * d)
      }
    } else {
      lineTo(startX, startY)
    }
  }
  return winding !== 0
}

const smallGuide = indexFillGuide(mask, size, size)
const inner = floodFill(smallGuide, 5, 5)
assert.equal(inner.status, 'filled')
if (inner.status === 'filled') {
  assert.ok(includes(inner.path, 5.5, 5.5))
  assert.ok(includes(inner.path, 3.5, 6.5), 'covers the edge under the line')
  assert.ok(!includes(inner.path, 2.5, 6.5), 'stays inside the outer guide')
  assert.ok(!includes(inner.path, 8.5, 8.5), 'keeps the central island')
}
const outer = floodFill(smallGuide, 0, 0)
assert.equal(outer.status, 'filled')
if (outer.status === 'filled') {
  assert.ok(includes(outer.path, 0.5, 0.5))
  assert.ok(!includes(outer.path, 5.5, 5.5), 'leaves the enclosed region alone')
}
assert.deepEqual(floodFill(smallGuide, 3, 3), { status: 'miss' })
assert.deepEqual(floodFill(smallGuide, size, -1), { status: 'miss' })
assert.deepEqual(floodFill(smallGuide, 5, 5, { budgetMs: 0 }), { status: 'limit', reason: 'time' })

// This file runs under --jitless. Allow extra wall-clock time for loaded CI
// runners. Independently bound path size, which does not depend on scheduling.
const testBudgetMs = fillBudgetMs * 2
const testOptions = { scale: fillDocumentScale, budgetMs: testBudgetMs }
const paper = new Uint8Array(fillResolution ** 2)
const center = fillResolution / 2
const circle = Uint8Array.from(paper, (_, index) => {
  const dx = index % fillResolution - center
  const dy = Math.floor(index / fillResolution) - center
  return Number(Math.abs(Math.hypot(dx, dy) - fillResolution * 0.35) < 1.6)
})
const largeCases = [
  { name: 'blank page', mask: paper, x: 0, y: 0, inside: [[0.5, 0.5], [999.5, 999.5]], outside: [], maxLength: 100 },
  { name: 'circle interior', mask: circle, x: center, y: center, inside: [[500, 500], [500, 153]], outside: [[500, 140]], maxLength: 6_000 },
  { name: 'circle background', mask: circle, x: 0, y: 0, inside: [[0.5, 0.5], [999.5, 999.5]], outside: [[500, 500]], maxLength: 6_000 },
]
for (const fixture of largeCases) {
  const guide = indexFillGuide(fixture.mask, fillResolution, fillResolution)
  const start = performance.now()
  const result = floodFill(guide, fixture.x, fixture.y, testOptions)
  const elapsed = performance.now() - start
  assert.equal(result.status, 'filled', `${fixture.name} exceeded the ${testBudgetMs} ms test budget`)
  if (result.status !== 'filled') continue
  assert.ok(result.path.length <= fixture.maxLength, `${fixture.name} path has ${result.path.length} characters`)
  if (fixture.mask === circle) assert.match(result.path, /Q/, 'curved outlines are smoothed')
  for (const [x, y] of fixture.inside) assert.ok(includes(result.path, x, y), `${fixture.name} includes ${x}, ${y}`)
  for (const [x, y] of fixture.outside) assert.ok(!includes(result.path, x, y), `${fixture.name} excludes ${x}, ${y}`)
  console.log(`Fill ${fixture.name}: ${elapsed.toFixed(1)} ms, ${result.path.length} path characters`)
}

// Browser-rasterized at the app's resolution by fill-guide-benchmark.ts --fixtures.
const realMasks: { picture: string; svgHash: string; mask: string }[] = JSON.parse(gunzipSync(
  readFileSync(new URL('./fixtures/coloring-guides.json.gz', import.meta.url)),
).toString('utf8'))
const realCases = [
  { picture: 'simple/t-rex', region: 'body', seed: [264, 236], ink: [355, 236], untouched: [[315, 329], [0, 0]], maxLength: 14_000 },
  { picture: 'detailed/t-rex', region: 'body', seed: [265, 223], ink: [195, 223], untouched: [[301, 357], [0, 0]], maxLength: 16_000 },
  { picture: 'detailed/t-rex', region: 'background', seed: [205, 203], ink: [62, 203], untouched: [[265, 223]], maxLength: 11_000 },
  { picture: 'detailed/whale', region: 'body', seed: [247, 254], ink: [199, 254], untouched: [[357, 298], [0, 0]], maxLength: 11_000 },
  { picture: 'detailed/heart-pattern', region: 'large region', seed: [243, 204], ink: [225, 204], untouched: [[130, 133], [0, 0]], maxLength: 28_000 },
] as const
for (const { picture, region, seed, ink, untouched, maxLength } of realCases) {
  const name = `${picture} ${region}`
  const fixture = realMasks.find((mask) => mask.picture === picture)
  assert.ok(fixture, `Missing ${picture} mask`)
  const svg = readFileSync(new URL(`../shared/art/${picture}/line.svg`, import.meta.url))
  assert.equal(fixture.svgHash, createHash('sha256').update(svg).digest('hex'), `Regenerate the updated ${picture} mask`)
  const barriers = Buffer.from(fixture.mask, 'base64')
  assert.equal(barriers.length, fillResolution ** 2, picture)
  assert.equal(barriers[ink[1] * fillResolution + ink[0]], 1, `${name} edge sample is on the ink`)
  const guide = indexFillGuide(barriers, fillResolution, fillResolution)
  const start = performance.now()
  const result = floodFill(guide, ...seed, testOptions)
  const elapsed = performance.now() - start
  assert.equal(result.status, 'filled', `${name} must fill within ${testBudgetMs} ms`)
  assert.ok(result.path.length <= maxLength, `${name} path has ${result.path.length} characters`)
  const coversPixel = ([x, y]: readonly [number, number]) =>
    includes(result.path, (x + 0.5) * fillDocumentScale, (y + 0.5) * fillDocumentScale)
  assert.ok(coversPixel(seed), `${name} colors the tapped region`)
  assert.ok(coversPixel(ink), `${name} reaches under the ink`)
  for (const pixel of untouched) assert.ok(!coversPixel(pixel), `${name} leaves ${pixel} clear`)
  console.log(`Fill ${name}: ${elapsed.toFixed(1)} ms, ${result.corners} raw corners, ${result.path.length} path characters`)
}

console.log('Coloring tools checks passed: stroke round trips, 75 shades, mask retry, guide barriers and region fill')
