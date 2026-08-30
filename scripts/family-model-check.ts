import assert from 'node:assert/strict'

import { buildWorksheetHtml, buildWorksheetSvg, drawingForFamilyActivity, familyActivities, worksheetFileName } from '../shared/index.ts'

assert.equal(familyActivities.length, 12)
assert.equal(new Set(familyActivities.map((activity) => activity.id)).size, familyActivities.length)

for (const activity of familyActivities) {
  const drawing = drawingForFamilyActivity(activity)
  assert.equal(drawing.id, activity.starterDrawingId)
  assert.equal(activity.steps.length, 3)
  assert.ok(activity.minutes > 0)
  const svg = buildWorksheetSvg(drawing, { title: activity.title, subtitle: activity.description, steps: activity.steps })
  assert.match(svg, /width="816" height="1056"/)
  assert.match(svg, /data:image\/svg\+xml/)
  assert.ok(activity.steps.every((step) => step.split(/\s+/).every((word) => svg.includes(word.replace(/&/g, '&amp;')))))
  assert.ok(!svg.includes('undefined'))
  assert.match(buildWorksheetHtml(drawing, { title: activity.title }), /Print worksheet/)
}

const drawing = drawingForFamilyActivity(familyActivities[0])
const escaped = buildWorksheetSvg(drawing, { title: '<script>alert("no")</script>', subtitle: 'A & B' })
assert.ok(!escaped.includes('<script>'))
assert.match(escaped, /&lt;script&gt;alert\(&quot;no&quot;\)&lt;\/script&gt;/)
assert.match(escaped, /A &amp; B/)
assert.equal(worksheetFileName('Guam Memory Map!'), 'guam-memory-map-tracebuddy.svg')
assert.equal(worksheetFileName('***'), 'tracebuddy-worksheet-tracebuddy.svg')

console.log('Family activities and printable worksheet model checks passed')
