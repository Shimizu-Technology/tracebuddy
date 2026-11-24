import { normalizeTraceAlignment } from '../../../../shared/setup'
import { paperTheme } from './paperTheme'

// Pure geometry and storage rules for On paper. Functions marked 'worklet' also run on the UI thread
// inside gesture callbacks; the directive is a plain string everywhere else, so model checks run them in Node.

export type PageOrientation = 'portrait' | 'landscape'
export type ScreenOrientation = 'portrait' | 'landscape'
export type Size = { width: number; height: number }
export type Point = { x: number; y: number }
export type Handle = 'topLeft' | 'bottomRight'

/** x and y are offsets in points from the stage center. Scale is relative to the fitted page. */
export type GuideSetup = {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  page: PageOrientation
}

export const defaultGuideSetup: GuideSetup = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: paperTheme.fade.initial,
  page: 'portrait',
}

export function clamp(value: number, min: number, max: number) {
  'worklet'
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function clampScale(scale: number) {
  'worklet'
  return clamp(scale, paperTheme.scale.min, paperTheme.scale.max)
}

export function clampFade(opacity: number) {
  'worklet'
  return clamp(opacity, paperTheme.fade.min, paperTheme.fade.max)
}

export function screenOrientation({ width, height }: Size): ScreenOrientation {
  return width > height ? 'landscape' : 'portrait'
}

/** The page-shaped guide frame, fitted to the screen like a sheet of paper seen from a stand. */
export function fitPage(screen: Size, page: PageOrientation): Size {
  const { aspect, widthFraction, heightFraction } = paperTheme.page
  const ratio = page === 'portrait' ? aspect : 1 / aspect
  const width = Math.max(1, Math.min(screen.width * widthFraction, screen.height * heightFraction * ratio))
  return { width, height: width / ratio }
}

/** The picture sits inside the page with a margin, keeping its own shape. */
export function fitArt(page: Size, artAspect = 1): Size {
  const box = Math.min(page.width, page.height) * paperTheme.page.artInset
  const aspect = clamp(artAspect, 0.25, 4)
  return aspect >= 1 ? { width: box, height: box / aspect } : { width: box * aspect, height: box }
}

/** Degrees in the range (-180, 180]. */
export function normalizeDegrees(degrees: number) {
  'worklet'
  if (!Number.isFinite(degrees)) return 0
  const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180
  return wrapped === -180 ? 180 : wrapped
}

export function nearestSquareAngle(degrees: number) {
  'worklet'
  // `|| 0` turns -0 into 0.
  return Math.round(degrees / 90) * 90 || 0
}

/** Within the threshold of 0/90/180/270 the guide settles on the square angle. */
// Worklets don't capture module values used in default parameters, so these defaults are applied in the body.
export function snapRotation(degrees: number, threshold?: number) {
  'worklet'
  const limit = threshold ?? paperTheme.snapDegrees
  const square = nearestSquareAngle(degrees)
  return Math.abs(degrees - square) < limit ? square : degrees
}

export function rotatePoint(point: Point, center: Point, degrees: number): Point {
  'worklet'
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos }
}

export function pageCorner(handle: Handle, center: Point, page: Size, scale: number, rotation: number): Point {
  'worklet'
  const sign = handle === 'topLeft' ? -1 : 1
  const corner = { x: center.x + (sign * page.width * scale) / 2, y: center.y + (sign * page.height * scale) / 2 }
  return rotatePoint(corner, center, rotation)
}

/** A one-finger drag that starts on a corner handle resizes and turns instead of moving. */
export function hitHandle(touch: Point, center: Point, page: Size, scale: number, rotation: number, radius?: number): Handle | null {
  'worklet'
  const reach = radius ?? paperTheme.size.handleHit
  const handles: Handle[] = ['topLeft', 'bottomRight']
  for (const handle of handles) {
    const corner = pageCorner(handle, center, page, scale, rotation)
    if (Math.hypot(touch.x - corner.x, touch.y - corner.y) <= reach) return handle
  }
  return null
}

export function handleTransform(start: Point, touch: Point, center: Point, startScale: number, startRotation: number) {
  'worklet'
  const startDistance = Math.max(1, Math.hypot(start.x - center.x, start.y - center.y))
  const distance = Math.hypot(touch.x - center.x, touch.y - center.y)
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x)
  const angle = Math.atan2(touch.y - center.y, touch.x - center.x)
  return {
    scale: clampScale((startScale * distance) / startDistance),
    rotation: startRotation + ((angle - startAngle) * 180) / Math.PI,
  }
}

/**
 * Keeps the guide's center inside the stage, inset a little, so some of the guide is always on screen and
 * within reach. `rest` is where the guide sits with no offset.
 */
export function clampCenterOffset(offset: Point, rest: Point, stage: Size, inset?: number): Point {
  'worklet'
  const keep = inset ?? paperTheme.size.keepVisible
  return {
    x: clamp(offset.x, keep - rest.x, stage.width - keep - rest.x),
    y: clamp(offset.y, keep - rest.y, stage.height - keep - rest.y),
  }
}

/**
 * How much of the screen, from the bottom up, the More sheet takes. Its measured top once it settles
 * (iPad floats form sheets mid-screen); until then, its detent. Never less than the detent.
 */
export function sheetCover(screenHeight: number, sheetTop: number | null) {
  const estimate = screenHeight * paperTheme.moreSheetDetent
  return sheetTop !== null && sheetTop > 0 && sheetTop < screenHeight ? Math.max(estimate, screenHeight - sheetTop) : estimate
}

export function fadeFromTrack(position: number, trackHeight: number) {
  'worklet'
  const { min, max } = paperTheme.fade
  const fraction = 1 - clamp(position / Math.max(1, trackHeight), 0, 1)
  return clampFade(min + fraction * (max - min))
}

export function trackFraction(opacity: number) {
  'worklet'
  const { min, max } = paperTheme.fade
  return (clampFade(opacity) - min) / (max - min)
}

export function stepFade(opacity: number, direction: 1 | -1) {
  const { step } = paperTheme.fade
  return clampFade(Math.round((opacity + direction * step) / step) * step)
}

export function fadePercent(opacity: number) {
  return Math.round(clampFade(opacity) * 100)
}

type StoredEntry = { version: 1; x: number; y: number; scale: number; rotation: number; opacity: number; page: PageOrientation }

function round(value: number) {
  return Math.round(value * 100) / 100
}

/** Where the 1.x camera screen drew its square overlay before any user offset (App.tsx). */
export function legacyOverlayBase(stage: Size) {
  return { size: Math.min(stage.width * 0.78, stage.height * 0.44, 430), center: { x: stage.width / 2, y: stage.height / 2 - 24 } }
}

export type RestoreGeometry = { stage: Size; rest: Point; artWidth: number }

/**
 * A 1.x setup offset a square overlay from a different center and scaled a different base size. Move it into
 * 2.0's coordinates so the picture lands where and as big as it was.
 */
export function fromLegacySetup(setup: GuideSetup, geometry: RestoreGeometry): GuideSetup {
  const base = legacyOverlayBase(geometry.stage)
  return {
    ...setup,
    x: base.center.x + setup.x - geometry.rest.x,
    y: base.center.y + setup.y - geometry.rest.y,
    scale: clampScale((setup.scale * base.size) / Math.max(1, geometry.artWidth)),
  }
}

function entryToSetup(value: unknown): GuideSetup | null {
  const alignment = normalizeTraceAlignment(value)
  if (!alignment) return null
  const page = (value as { page?: unknown }).page === 'landscape' ? 'landscape' : 'portrait'
  const { x, y, scale, rotation, opacity } = alignment
  return { x, y, scale, rotation: normalizeDegrees(rotation), opacity, page }
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function storedOrientations(value: unknown) {
  const byOrientation = value && typeof value === 'object' ? (value as { byOrientation?: unknown }).byOrientation : undefined
  if (!byOrientation || typeof byOrientation !== 'object') return null
  const entries: Partial<Record<ScreenOrientation, GuideSetup>> = {}
  for (const orientation of ['portrait', 'landscape'] as const) {
    const setup = entryToSetup((byOrientation as Record<string, unknown>)[orientation])
    if (setup) entries[orientation] = setup
  }
  return entries
}

/**
 * Reads tracebuddy.savedAlignment.v1. 2.0 adds byOrientation beside the original top-level fields,
 * so a setup saved with the 1.x Save button still opens, and 1.x still reads the latest 2.0 setup.
 */
export function parseRememberedSetup(raw: string | null, orientation: ScreenOrientation): GuideSetup | null {
  return readRememberedSetup(raw, orientation)?.setup ?? null
}

/** The saved setup for this orientation, and whether it is a 1.x setup that still needs converting. */
export function readRememberedSetup(raw: string | null, orientation: ScreenOrientation) {
  const value = parseJson(raw)
  const entries = storedOrientations(value)
  if (entries) {
    const setup = entries[orientation]
    return setup ? { setup, legacy: false } : null
  }
  const setup = entryToSetup(value)
  return setup ? { setup, legacy: true } : null
}

/** The setup to show: converted from 1.x if needed, and always with its center on screen. */
export function restoreSetup(raw: string | null, orientation: ScreenOrientation, geometry: RestoreGeometry): GuideSetup {
  const saved = readRememberedSetup(raw, orientation)
  if (!saved) return defaultGuideSetup
  const setup = saved.legacy ? fromLegacySetup(saved.setup, geometry) : saved.setup
  // A restored guide comes back well inside the screen, where it is easy to grab, not tucked under a button.
  const inset = Math.min(geometry.stage.width, geometry.stage.height) / 4
  return { ...setup, ...clampCenterOffset({ x: setup.x, y: setup.y }, geometry.rest, geometry.stage, inset) }
}

export function serializeRememberedSetup(previousRaw: string | null, orientation: ScreenOrientation, setup: GuideSetup) {
  const entry: StoredEntry = {
    version: 1,
    x: round(setup.x),
    y: round(setup.y),
    scale: round(clampScale(setup.scale)),
    rotation: round(normalizeDegrees(setup.rotation)),
    opacity: round(clampFade(setup.opacity)),
    page: setup.page,
  }
  const kept: Partial<Record<ScreenOrientation, StoredEntry>> = {}
  for (const [key, value] of Object.entries(storedOrientations(parseJson(previousRaw)) ?? {})) {
    if (key !== orientation && value) kept[key as ScreenOrientation] = { version: 1, ...value }
  }
  return JSON.stringify({ ...entry, byOrientation: { ...kept, [orientation]: entry } })
}

const colorAttribute = /\b(stroke|fill)="(#[0-9a-fA-F]{3,8}|black|currentColor)"/g

/** Light lines for dark paper: every colored stroke and fill in the guide turns white. */
export function lightLinesSvg(svg: string, color: string = paperTheme.colors.lightLines) {
  return svg.replace(colorAttribute, (_match, attribute: string) => `${attribute}="${color}"`)
}
