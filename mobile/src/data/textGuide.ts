import { createTextDrawing, sanitizeTraceText } from '../../../shared/drawings'
import { guideFonts } from './glyphs.generated'

export type TextGuideStyle = keyof typeof guideFonts

const size = 1000
const margin = 80
const ink = '#172033'
const lettersPerLine = 10

function breakLines(text: string): string[] {
  const lineCount = Math.min(3, Math.ceil(text.length / lettersPerLine))
  const lines: string[] = []
  let remaining = text
  for (let count = lineCount; count > 1; count -= 1) {
    const target = Math.ceil(remaining.length / count)
    let cut = target
    // Prefer a nearby space, but split long unbroken words to keep letters at a useful size.
    for (let distance = 0; distance <= Math.max(3, Math.floor(target / 3)); distance += 1) {
      if (remaining[target + distance] === ' ') {
        cut = target + distance
        break
      }
      if (remaining[target - distance] === ' ') {
        cut = target - distance
        break
      }
    }
    lines.push(remaining.slice(0, cut).trimEnd())
    remaining = remaining.slice(cut).trimStart()
  }
  return [...lines, remaining]
}

export function layoutTextGuide(value: string, style: TextGuideStyle) {
  const text = sanitizeTraceText(value).normalize('NFC')
  const font = guideFonts[style]
  if (!text || Array.from(text).some((character) => !font.glyphs[character])) return null

  const practice = style === 'practice'
  const stroke = font.unitsPerEm * (practice ? 0.076 : 0.088)
  const ruleStroke = font.unitsPerEm * 0.01
  const lineStep = font.unitsPerEm * 1.22
  const lines = breakLines(text).map((text, row) => {
    let cursor = 0
    let left = Infinity
    let right = -Infinity
    let top = practice ? font.capHeight + ruleStroke / 2 : -Infinity
    let bottom = practice ? -ruleStroke / 2 : Infinity
    let previous = ''
    const glyphs = Array.from(text).flatMap((character) => {
      const [path, advance, xMin, yMin, xMax, yMax] = font.glyphs[character]!
      const kern = font.kerning[previous]?.[character] ?? 0
      const x = path ? Math.max(cursor + kern, right + stroke / 2 + font.unitsPerEm * 0.015 - xMin) : cursor
      cursor = x + advance + stroke / 2
      previous = character
      if (!path) return []
      left = Math.min(left, x + xMin - stroke / 2)
      right = Math.max(right, x + xMax + stroke / 2)
      top = Math.max(top, yMax + stroke / 2)
      bottom = Math.min(bottom, yMin - stroke / 2)
      return [{ path, x }]
    })
    return { text, glyphs, center: (left + right) / 2, width: right - left, top, bottom, baseline: row * lineStep }
  })

  const lineWidth = Math.max(...lines.map(({ width }) => width))
  const ruleWidth = lineWidth + font.unitsPerEm * 0.16
  const width = practice ? ruleWidth + ruleStroke : lineWidth
  const top = Math.min(...lines.map((line) => line.baseline - line.top))
  const bottom = Math.max(...lines.map((line) => line.baseline - line.bottom))
  const height = bottom - top
  const scale = (size - margin * 2) / Math.max(width, height)

  return {
    lines,
    scale,
    stroke,
    offsetY: size / 2 - (top + bottom) * scale / 2,
    width: width * scale,
    height: height * scale,
    rules: practice ? { width: ruleWidth, stroke: ruleStroke, capHeight: font.capHeight, xHeight: font.xHeight } : null,
  }
}

export function textGuideSvg(value: string, style: TextGuideStyle, options: { fill?: string; preview?: boolean } = {}) {
  const layout = layoutTextGuide(value, style)
  if (!layout) return createTextDrawing(value).svg

  const { lines, scale, stroke, offsetY, rules } = layout
  const number = (value: number) => Number(value.toFixed(4))
  const center = size / 2
  const height = options.preview ? Math.max(300, Math.ceil(layout.height) + margin) : size
  const viewBox = `0 ${(size - height) / 2} ${size} ${height}`
  const art = lines.map(({ baseline, center: lineCenter, glyphs }) => {
    const y = number(offsetY + baseline * scale)
    const guides = rules ? `<g fill="none" stroke="${ink}" stroke-width="${number(rules.stroke)}" opacity=".3" stroke-linecap="round">`
      + `<path d="M${number(-rules.width / 2)} ${rules.capHeight}h${number(rules.width)}M${number(-rules.width / 2)} 0h${number(rules.width)}"/>`
      + `<path d="M${number(-rules.width / 2)} ${rules.xHeight}h${number(rules.width)}" stroke-dasharray="32 32"/></g>` : ''
    const paths = glyphs.map(({ path, x }) => `<path transform="translate(${number(x - lineCenter)} 0)" d="${path}"/>`).join('')
    return `<g transform="translate(${center} ${y}) scale(${number(scale)} ${number(-scale)})">${guides}`
      + `<g fill="${options.fill ?? 'none'}" stroke="${ink}" stroke-width="${number(stroke)}" stroke-linejoin="round">${paths}</g></g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${art}</svg>`
}
