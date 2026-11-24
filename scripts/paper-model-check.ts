import assert from 'node:assert/strict'

import { normalizeTraceAlignment } from '../shared/setup'
import { childExitHoldMs } from '../mobile/nativeSafetyModel'
import {
  clampCenterOffset, clampScale, defaultGuideSetup, fadeFromTrack, fadePercent, fitArt, fitPage, handleTransform, hitHandle,
  lightLinesSvg, normalizeDegrees, pageCorner, parseRememberedSetup, rotatePoint, screenOrientation, serializeRememberedSetup,
  sheetCover, snapRotation, stepFade, trackFraction,
} from '../mobile/src/features/paper/paperModel'
import type { GuideSetup } from '../mobile/src/features/paper/paperModel'
import { paperTheme } from '../mobile/src/features/paper/paperTheme'
import { paramsForPicture, resolvePicture } from '../mobile/src/data/catalog'
import { pictureRouteParams, resolvePaperPicture } from '../mobile/src/features/paper/paperPicture'

const close = (actual: number, expected: number, message?: string) => assert.ok(Math.abs(actual - expected) < 1e-6, message ?? `${actual} ≈ ${expected}`)
const phone = { width: 390, height: 844 }
const phoneLandscape = { width: 844, height: 390 }
const iPad = { width: 1024, height: 1366 }
const iPadLandscape = { width: 1366, height: 1024 }

// Page fit: a Letter-shaped frame that fits the screen in both device orientations.
for (const screen of [phone, phoneLandscape, iPad, iPadLandscape]) {
  for (const page of ['portrait', 'landscape'] as const) {
    const frame = fitPage(screen, page)
    close(frame.width / frame.height, page === 'portrait' ? 8.5 / 11 : 11 / 8.5, `${page} keeps the Letter shape`)
    assert.ok(frame.width <= screen.width * paperTheme.page.widthFraction + 1e-6, 'page fits the width')
    assert.ok(frame.height <= screen.height * paperTheme.page.heightFraction + 1e-6, 'page fits the height')
  }
}
assert.ok(fitPage(iPad, 'portrait').width > fitPage(phone, 'portrait').width * 1.5, 'iPad gets a bigger page')
const roomy = fitPage(phone, 'portrait', 551)
assert.deepEqual(roomy, fitPage(phone, 'portrait'), 'a phone held upright has room: no change')
const sideways = fitPage(phoneLandscape, 'portrait', 169)
close(sideways.height, 169, 'held sideways, the page fits between the top buttons and the bar')
close(sideways.width / sideways.height, 8.5 / 11)
assert.equal(screenOrientation(phone), 'portrait')
assert.equal(screenOrientation(phoneLandscape), 'landscape')
const art = fitArt({ width: 300, height: 400 })
close(art.width, 300 * paperTheme.page.artInset)
close(art.height, art.width, 'line art stays square')
const wideArt = fitArt({ width: 300, height: 400 }, 2)
close(wideArt.width / wideArt.height, 2)

// Rotation: normalize, and a gentle snap within 4 degrees of 0/90/180/270.
close(normalizeDegrees(190), -170)
close(normalizeDegrees(-190), 170)
close(normalizeDegrees(-180), 180)
close(normalizeDegrees(720), 0)
assert.equal(normalizeDegrees(Number.NaN), 0)
assert.equal(snapRotation(3.9), 0)
assert.equal(snapRotation(-3.5), 0)
assert.equal(snapRotation(4.1), 4.1, 'outside the threshold it turns freely')
assert.equal(snapRotation(87), 90)
assert.equal(snapRotation(268), 270)
assert.equal(snapRotation(-92), -90)
assert.equal(snapRotation(45), 45)

// Gestures keep the spot under the fingers still.
const rotated = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90)
close(rotated.x, 0)
close(rotated.y, 10)
assert.equal(clampScale(10), paperTheme.scale.max)
assert.equal(clampScale(0.01), paperTheme.scale.min)
assert.equal(clampScale(Number.NaN), paperTheme.scale.min)
const rest = { x: 195, y: 400 }
const keep = paperTheme.size.keepVisible
assert.deepEqual(clampCenterOffset({ x: 5000, y: -5000 }, rest, phone), { x: phone.width - keep - rest.x, y: keep - rest.y }, 'the guide\'s center stays on screen')
assert.deepEqual(clampCenterOffset({ x: 10, y: -20 }, rest, phone), { x: 10, y: -20 })

// Corner handles: hit testing follows size and turn; dragging a corner resizes and turns around the center.
const page = { width: 200, height: 260 }
const center = { x: 195, y: 400 }
const corner = pageCorner('bottomRight', center, page, 1, 0)
assert.deepEqual(corner, { x: 295, y: 530 })
assert.equal(hitHandle(corner, center, page, 1, 0), 'bottomRight')
assert.equal(hitHandle({ x: 95, y: 270 }, center, page, 1, 0), 'topLeft')
assert.equal(hitHandle(center, center, page, 1, 0), null, 'the middle of the picture moves it')
const turnedCorner = pageCorner('bottomRight', center, page, 1.5, 90)
assert.equal(hitHandle(turnedCorner, center, page, 1.5, 90), 'bottomRight')
assert.equal(hitHandle(corner, center, page, 1.5, 90), null)
const doubled = handleTransform(corner, { x: center.x + (corner.x - center.x) * 2, y: center.y + (corner.y - center.y) * 2 }, center, 0.8, 0)
close(doubled.scale, 1.6)
close(doubled.rotation, 0)
const quarter = handleTransform({ x: center.x + 100, y: center.y }, { x: center.x, y: center.y + 100 }, center, 1, 10)
close(quarter.rotation, 100)
close(quarter.scale, 1)

// The More sheet's cover: the detent until it settles, then where it really is.
close(sheetCover(1000, null), 1000 * paperTheme.moreSheetDetent, 'before it settles, the detent is used')
close(sheetCover(1000, 1000), 1000 * paperTheme.moreSheetDetent, 'a sheet still sliding in from off screen is ignored')
close(sheetCover(1194, 657), 1194 - 657, 'a floating iPad sheet covers everything below its top')
close(sheetCover(1000, 700), 1000 * paperTheme.moreSheetDetent, 'never less than the detent')

// Fade slider: up is stronger. Accessibility steps stay on round numbers within range.
close(fadeFromTrack(0, 300), paperTheme.fade.max)
close(fadeFromTrack(300, 300), paperTheme.fade.min)
close(fadeFromTrack(-40, 300), paperTheme.fade.max)
close(trackFraction(fadeFromTrack(120, 300)), 1 - 120 / 300)
close(stepFade(0.6, 1), 0.65)
close(stepFade(0.6, -1), 0.55)
close(stepFade(1, 1), 1)
close(stepFade(0.15, -1), paperTheme.fade.min)
assert.equal(fadePercent(0.6), 60)

// Remembered setup: the 1.x saved-alignment key keeps working both ways, with one setup per orientation.
const legacyRaw = JSON.stringify({ version: 1, x: 12, y: -8, scale: 1.2, rotation: 15, opacity: 0.5 })
const legacy = parseRememberedSetup(legacyRaw, 'portrait')
assert.deepEqual(legacy, { x: 12, y: -8, scale: 1.2, rotation: 15, opacity: 0.5, page: 'portrait' })
assert.deepEqual(parseRememberedSetup(legacyRaw, 'landscape'), legacy, 'a 1.x setup applies until 2.0 saves its own')
assert.equal(parseRememberedSetup(null, 'portrait'), null)
assert.equal(parseRememberedSetup('{not json', 'portrait'), null)
assert.equal(parseRememberedSetup(JSON.stringify({ x: 'left' }), 'portrait'), null)

const portraitSetup: GuideSetup = { x: 20.123, y: 30, scale: 1.1, rotation: 270, opacity: 0.7, page: 'landscape' }
const afterPortrait = serializeRememberedSetup(legacyRaw, 'portrait', portraitSetup)
assert.deepEqual(parseRememberedSetup(afterPortrait, 'portrait'), { ...portraitSetup, x: 20.12, rotation: -90 })
assert.equal(parseRememberedSetup(afterPortrait, 'landscape'), null, 'landscape starts fresh once orientations are tracked')
const landscapeSetup: GuideSetup = { ...defaultGuideSetup, x: -40, scale: 0.9 }
const afterBoth = serializeRememberedSetup(afterPortrait, 'landscape', landscapeSetup)
assert.equal(parseRememberedSetup(afterBoth, 'portrait')?.x, 20.12, 'saving landscape keeps portrait')
assert.deepEqual(parseRememberedSetup(afterBoth, 'landscape'), landscapeSetup)
const legacyReader = normalizeTraceAlignment(JSON.parse(afterBoth))
assert.deepEqual(legacyReader, { version: 1, x: -40, y: 0, scale: 0.9, rotation: 0, opacity: paperTheme.fade.initial }, '1.x reads the latest setup at the top level')
const clamped = parseRememberedSetup(serializeRememberedSetup(null, 'portrait', { ...defaultGuideSetup, scale: 9, opacity: 0 }), 'portrait')
assert.equal(clamped?.scale, paperTheme.scale.max)
assert.equal(clamped?.opacity, paperTheme.fade.min)
const corrupted = JSON.stringify({ ...JSON.parse(afterBoth), byOrientation: { portrait: { x: 'bad' }, landscape: JSON.parse(afterBoth).byOrientation.landscape } })
assert.equal(parseRememberedSetup(corrupted, 'portrait'), null)
assert.equal(parseRememberedSetup(serializeRememberedSetup(corrupted, 'portrait', defaultGuideSetup), 'landscape')?.x, -40, 'a bad entry does not wipe the other orientation')

// Light lines turn the guide white for dark paper; transparent parts stay transparent.
const svg = '<svg fill="none" stroke="#18243a"><path stroke="#18243A" fill="#ff795d"/><circle fill="none"/></svg>'
const light = lightLinesSvg(svg)
assert.ok(!/#18243a|#ff795d/i.test(light))
assert.equal((light.match(/="#FFFFFF"/g) ?? []).length, 3)
assert.equal((light.match(/fill="none"/g) ?? []).length, 2)

assert.equal(childExitHoldMs, 1500, 'unlock is a 1.5-second hold')

// Picture params from /paper/[id].
// The same catalog as the Picture sheet and Draw: level, legacy ids, typed words and local photos.
for (const level of ['simple', 'detailed'] as const) {
  const fromSheet = resolvePicture({ id: 'happy-crab', level })
  assert.ok(fromSheet)
  const paper = resolvePaperPicture({ ...paramsForPicture(fromSheet), level: fromSheet.level })
  assert.equal(paper?.picture.id, fromSheet.id, `the ${level} pick is the picture the sheet showed`)
  assert.equal(paper?.picture.level, fromSheet.level)
  assert.equal(paper?.kind === 'drawing' && paper.svg, fromSheet.line(), 'and the same line art')
}
assert.equal(resolvePaperPicture({ id: 'happy-crab', legacy: '1' })?.name, 'Happy Crab', 'legacy ids still open')
assert.equal(resolvePaperPicture({ id: 'no-such-picture' }), null)
assert.equal(resolvePaperPicture({}), null)
assert.equal(resolvePaperPicture({ id: 'my-name', text: 'Leon' })?.name, 'Leon')
assert.notEqual(resolvePaperPicture({ id: 'my-name', text: 'Leon' })?.key, resolvePaperPicture({ id: 'my-name', text: 'Ana' })?.key, 'each word is its own session')
const photo = resolvePaperPicture({ id: 'my-photo', photo: 'file:///Old/Documents/tracebuddy-uploads/a.jpg', photoWidth: '1200', photoHeight: '800' }, (uri) => uri.replace('/Old/', '/New/'))
assert.equal(photo?.kind, 'photo')
assert.equal(photo?.kind === 'photo' && photo.uri, 'file:///New/Documents/tracebuddy-uploads/a.jpg', 'the stored photo path moves with the install')
assert.equal(photo?.aspect, 1.5, 'a photo keeps its shape on the page')
assert.equal(resolvePaperPicture({ id: 'my-photo', photo: 'https://example.com/a.jpg' }), null, 'only local photos')
assert.deepEqual(
  pictureRouteParams({ id: ['happy-crab'], level: 'detailed', fault: 'camera', photoName: 'My photo' }),
  { id: 'happy-crab', level: 'detailed', photoName: 'My photo' },
  'Draw and Stick to paper get the picture params, and nothing else',
)
assert.deepEqual(pictureRouteParams({ id: 'my-name', text: 'Leon' }), { id: 'my-name', text: 'Leon' })

console.log('Paper model checks passed.')
