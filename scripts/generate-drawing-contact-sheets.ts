import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drawings } from '../shared/drawings'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const outputDirectory = resolve(scriptDirectory, '../artifacts/drawings')

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function positionNestedSvg(svg: string, x: number, y: number, size: number) {
  return svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${size}" height="${size}" `)
}

function buildContactSheet(tileSize: 160 | 420) {
  const columns = tileSize === 160 ? 6 : 4
  const horizontalGap = tileSize === 160 ? 24 : 36
  const labelHeight = tileSize === 160 ? 46 : 64
  const margin = tileSize === 160 ? 28 : 44
  const cellWidth = tileSize + horizontalGap
  const cellHeight = tileSize + labelHeight
  const rows = Math.ceil(drawings.length / columns)
  const width = margin * 2 + columns * cellWidth - horizontalGap
  const height = margin * 2 + 54 + rows * cellHeight
  const titleSize = tileSize === 160 ? 24 : 32
  const nameSize = tileSize === 160 ? 13 : 19
  const idSize = tileSize === 160 ? 9 : 13

  const cells = drawings.map((drawing, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = margin + column * cellWidth
    const y = margin + 54 + row * cellHeight
    const art = positionNestedSvg(drawing.svg, x, y, tileSize)
    const labelY = y + tileSize + nameSize + 4

    return `<g><rect x="${x}" y="${y}" width="${tileSize}" height="${tileSize}" rx="12" fill="#fffdf7" stroke="#d9d5c8"/>${art}<text x="${x}" y="${labelY}" font-family="Arial, Helvetica, sans-serif" font-size="${nameSize}" font-weight="700" fill="#18243a">${escapeXml(drawing.name)}</text><text x="${x}" y="${labelY + idSize + 5}" font-family="Arial, Helvetica, sans-serif" font-size="${idSize}" fill="#657087">${escapeXml(drawing.id)}</text></g>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f4f1e8"/><text x="${margin}" y="${margin + titleSize}" font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="700" fill="#18243a">TraceBuddy drawing catalog — ${tileSize} × ${tileSize}</text>${cells}</svg>`
}

await mkdir(outputDirectory, { recursive: true })

for (const size of [160, 420] as const) {
  const outputPath = resolve(outputDirectory, `contact-sheet-${size}.svg`)
  await writeFile(outputPath, buildContactSheet(size), 'utf8')
  console.log(outputPath)
}
