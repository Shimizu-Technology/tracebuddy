import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { defaultDocument, guideBounds, inkGroups, normalizeDocument, recoverLegacyDocument } from '../src/practice/document.ts'
import type { InkStroke } from '../src/practice/document.ts'
import { createTextDrawing, sanitizeTraceText, splitTraceText } from '../shared/drawings.ts'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/practice-legacy.json', import.meta.url), 'utf8'))
const recovered = recoverLegacyDocument(fixture.strokes, 348.96, 624.56)
assert.equal(recovered.document.width, 1000)
assert(recovered.document.legacyViewport)
assert.equal(recovered.strokes[0].path, fixture.strokes[0].path, 'Preserve legacy path bytes')
assert.equal(recovered.strokes[0].transform, `scale(1 ${624.56 / 348.96})`)
const oldY = 348.6551675746166 * recovered.document.height / 1000
const featureY = recovered.document.height / 2 + (80 / 420 - 0.5) * 880
assert(Math.abs(oldY - featureY) * 348.96 / 1000 < 1, 'Legacy ink stays on the audited guide feature')
assert.deepEqual(normalizeDocument(JSON.parse(JSON.stringify(recovered.document))), recovered.document)
assert.equal(normalizeDocument({ width: Infinity, height: 1000 }), undefined)
assert.deepEqual(guideBounds(defaultDocument), { x: 60, y: 60, width: 880, height: 880 })

const draw: InkStroke = { path: 'M 1 1 L 2 2', color: '#000', width: 12, opacity: 0.9, mode: 'draw' }
const erase: InkStroke = { ...draw, mode: 'erase', opacity: 0.5, dasharray: '2 3' }
const groups = inkGroups([draw, erase, draw, erase, draw])
assert.deepEqual(groups.map((group) => group.erasers.length), [2, 1, 0], 'Erasers affect only earlier ink')
assert.deepEqual(groups[0].erasers[0], erase, 'Preserve eraser opacity, dash and transform')
assert.equal(inkGroups(Array.from({ length: 50 }, () => draw))[0].draws.length, 50, 'Never truncate thumbnail ink')

for (const value of ['Aleksandra Wiśniewska-Kowalczyk', 'Wiśniewska', 'å ñ ʼ', 'åñʼ'.repeat(16), '名字をなぞって練習しましょう'.repeat(4), 'W'.repeat(48), 'a '.repeat(24)]) {
  const lines = splitTraceText(value)
  assert(lines.every((line) => Array.from(line).length <= 12))
  assert.equal(lines.join('').replaceAll(' ', ''), sanitizeTraceText(value).replaceAll(' ', ''), 'No accepted character is discarded')
  const drawing = createTextDrawing(value)
  assert(drawing.svg.startsWith('<svg') && drawing.svg.endsWith('</svg>'))
  assert(!drawing.svg.includes('textLength='), 'Keep text sizing compatible with native SVG')
}
console.log('Practice document, legacy recovery, compositing and shared text model checks passed')
