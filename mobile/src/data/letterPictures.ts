import type { ArtLevel, Picture } from './catalog'
import { textGuideSvg } from './textGuide'
import type { TextGuideStyle } from './textGuide'
import { theme } from '../ui/theme'

export const textStyleForLevel = { simple: 'bubble', detailed: 'practice' } as const satisfies Record<ArtLevel, TextGuideStyle>

const letters = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ', (letter) => ({
  id: `letter-${letter.toLowerCase()}`, name: letter, text: letter + letter.toLowerCase(),
}))
const numbers = Array.from('0123456789', (digit) => ({ id: `number-${digit}`, name: digit, text: digit }))
const fills = [
  theme.pastels.sky, theme.pastels.peach, theme.pastels.lilac,
  theme.pastels.butter, theme.pastels.mint, theme.pastels.rose,
]
export const letterPictureSections = [
  { title: 'ABC', ids: letters.map(({ id }) => id) },
  { title: '123', ids: numbers.map(({ id }) => id) },
]

export function letterPictures(level: ArtLevel): Picture[] {
  const style = textStyleForLevel[level]
  return [...letters, ...numbers].map(({ id, name, text }, index) => ({
    id, name, category: 'letters', level,
    line: { kind: 'inline', xml: textGuideSvg(text, style) },
    colorXml: () => textGuideSvg(text, style, { fill: fills[index % fills.length] }),
  }))
}
