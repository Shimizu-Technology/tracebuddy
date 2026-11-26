import assert from 'node:assert/strict'

import { brushTools, coloringBrushTools, normalizeSavedPracticeSession, normalizeSavedPracticeStroke } from '../mobile/practiceStorageModel.ts'
import { crayons, selectedCrayon } from '../mobile/src/features/draw/crayonShades.ts'
import { supportsFill } from '../mobile/src/features/draw/fillGuide.ts'
import { fillResolution, floodFill, guideBarriers } from '../mobile/src/features/draw/floodFill.ts'

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
  let winding = 0
  for (const match of path.matchAll(/M (\d+) (\d+)|H(\d+)|V(\d+)/g)) {
    const [, moveX, moveY, horizontal, vertical] = match
    if (moveX) {
      previousX = Number(moveX)
      previousY = Number(moveY)
    } else if (horizontal) {
      previousX = Number(horizontal)
    } else {
      const nextY = Number(vertical)
      if (x < previousX && previousY <= y && y < nextY) winding++
      if (x < previousX && nextY <= y && y < previousY) winding--
      previousY = nextY
    }
  }
  return winding !== 0
}

const inner = floodFill(mask, size, size, 5, 5)
assert.equal(inner.status, 'filled')
if (inner.status === 'filled') {
  assert.ok(includes(inner.path, 5.5, 5.5))
  assert.ok(includes(inner.path, 3.5, 6.5), 'covers the edge under the line')
  assert.ok(!includes(inner.path, 2.5, 6.5), 'stays inside the outer guide')
  assert.ok(!includes(inner.path, 8.5, 8.5), 'keeps the central island')
}
const outer = floodFill(mask, size, size, 0, 0)
assert.equal(outer.status, 'filled')
if (outer.status === 'filled') {
  assert.ok(includes(outer.path, 0.5, 0.5))
  assert.ok(!includes(outer.path, 5.5, 5.5), 'leaves the enclosed region alone')
}
assert.deepEqual(floodFill(mask, size, size, 3, 3), { status: 'miss' })
assert.deepEqual(floodFill(mask, size, size, size, -1), { status: 'miss' })
assert.deepEqual(floodFill(mask, size, size, 5, 5, 0), { status: 'limit' })
assert.deepEqual(floodFill(new Uint8Array(fillResolution ** 2), fillResolution, fillResolution, 0, 0, 1000), {
  status: 'filled', path: 'M 0 0 H1000 V1000 H0 V0 Z',
})

console.log('Coloring tools checks passed: legacy paint and new stroke round trips, 75 shades, guide barriers and region fill')
