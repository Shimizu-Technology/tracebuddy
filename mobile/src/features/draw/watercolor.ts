import { theme } from '../../ui/theme'

// Blue needs a cyan-leaning pigment so it still has enough green to mix
// with yellow. Red uses a warm pigment for the same reason.
const pigmentByColor: Record<string, string> = {
  [theme.crayon.colors[8].value]: '#189DDC',
  [theme.crayon.colors[1].value]: '#F04422',
  [theme.crayon.colors[4].value]: '#FFE431',
}

export function watercolorPigment(color: string) {
  return pigmentByColor[color.toUpperCase()] ?? color
}
