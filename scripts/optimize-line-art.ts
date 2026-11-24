import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { optimize } from 'svgo'

const artRoot = fileURLToPath(new URL('../shared/art/', import.meta.url))

for (const level of ['simple', 'detailed']) {
  const directory = resolve(artRoot, level)
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const path = resolve(directory, entry.name, 'line.svg')
    const original = readFileSync(path, 'utf8')
    const { data } = optimize(original, {
      path,
      plugins: [{
        name: 'convertPathData',
        params: {
          // Potrace's coordinates are integers in the transformed group.
          // Keep that precision and avoid approximating the existing curves.
          applyTransforms: false,
          floatPrecision: 0,
          makeArcs: false,
          straightCurves: false,
          convertToQ: false,
        },
      }],
    })
    const optimized = `${data}\n`
    if (optimized.length < original.length) writeFileSync(path, optimized)
  }
}
