import { theme } from '../../ui/theme'

type Shade = { name: string; value: string }
type Crayon = (typeof theme.crayon.colors)[number]

const skinShades: Shade[] = [
  { name: 'Very light skin', value: '#FFE1C6' },
  { name: 'Light skin', value: '#E6AC84' },
  { name: 'Medium skin', value: '#B77955' },
  { name: 'Dark skin', value: '#874D36' },
  { name: 'Deep skin', value: '#502E23' },
]

function channels(hex: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
}

function mix(hex: string, target: number, fraction: number) {
  return '#' + channels(hex).map((value) => Math.round(value + (target - value) * fraction).toString(16).padStart(2, '0')).join('').toUpperCase()
}

export const crayons = theme.crayon.colors.map((crayon: Crayon) => ({
  ...crayon,
  shades: crayon.name === 'Skin' ? skinShades : crayon.name === 'White' ? [
    { name: 'Cool white', value: '#F4F8FF' },
    { name: 'Warm white', value: '#FFFCF1' },
    crayon,
    { name: 'Soft white', value: '#F2EFEA' },
    { name: 'Deep ivory', value: '#E1D8CB' },
  ] : [
    { name: `Very light ${crayon.name.toLowerCase()}`, value: mix(crayon.value, 255, 0.78) },
    { name: `Light ${crayon.name.toLowerCase()}`, value: mix(crayon.value, 255, 0.43) },
    crayon,
    { name: `Dark ${crayon.name.toLowerCase()}`, value: mix(crayon.value, 0, 0.26) },
    { name: `Very dark ${crayon.name.toLowerCase()}`, value: mix(crayon.value, 0, 0.52) },
  ],
}))

export function selectedCrayon(color: string) {
  const hex = color.toUpperCase()
    .replace(/^#([\dA-F])([\dA-F])([\dA-F])[\dA-F]?$/, '#$1$1$2$2$3$3')
    .replace(/^(#[\dA-F]{6})[\dA-F]{2}$/, '$1')
  const base = crayons.findIndex(({ value }) => value.toUpperCase() === hex)
  if (base !== -1) return base
  const shade = crayons.findIndex(({ shades }) => shades.some(({ value }) => value === hex))
  if (shade !== -1) return shade
  // Preserve a legacy color and show it in the nearest color family's place.
  if (!/^#[\dA-F]{6}$/.test(hex)) return 0
  const rgb = channels(hex)
  const distance = (value: string) => channels(value).reduce((total, channel, index) => total + (channel - rgb[index]) ** 2, 0)
  return crayons.reduce((best, crayon, index) => distance(crayon.value) < distance(crayons[best].value) ? index : best, 0)
}
