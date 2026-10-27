import assert from 'node:assert/strict'
import { adjustUnlocked, childExitHoldMs, documentCapture, holdProgress, parentModeHelp, placeholderColor, selectedFamilyActivity } from '../mobile/nativeSafetyModel.ts'
const original = { x: 12, y: 5, scale: 1, rotation: 10, opacity: 0.7 }
for (const key of ['x', 'y', 'scale', 'rotation', 'opacity'] as const) {
  assert.equal(adjustUnlocked(true, original, (value) => ({ ...value, [key]: 99 })), original)
  assert.equal(adjustUnlocked(false, original, (value) => ({ ...value, [key]: 99 }))[key], 99)
}
assert.equal(holdProgress(-1), 0)
assert.ok(holdProgress(1499) < 1)
assert.equal(holdProgress(childExitHoldMs), 1)
assert.equal(holdProgress(2000), 1)
assert.match(parentModeHelp(true), /Paper Lock \(Beta\).*device/)
assert.match(parentModeHelp(false), /needs a device/)
assert.equal(selectedFamilyActivity('mirror', ['pass', 'mirror']), 'mirror')
assert.equal(selectedFamilyActivity('gone', ['pass', 'mirror']), 'pass')
assert.deepEqual(documentCapture, { side: 1000, width: 1000, height: 1000 })
console.log('Native round 2 safety: locked geometry/opacity, deliberate hold, support copy, activity validation, document capture contract passed')

const channels = placeholderColor.slice(1).match(/../g)!.map((hex) => parseInt(hex, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
const contrast = 1.05 / (channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 + 0.05)
assert.ok(contrast >= 4.5, `Placeholder on white: ${contrast}`)
console.log(`Placeholder on white: ${contrast.toFixed(2)}:1`)
