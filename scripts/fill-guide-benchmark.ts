import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

import { fillDocumentScale, fillResolution, floodFill, indexFillGuide } from '../mobile/src/features/draw/floodFill.ts'

const pictures = {
  simple: ['t-rex', 'elephant', 'whale', 'castle', 'fire-truck'],
  detailed: ['t-rex', 'elephant', 'whale', 'castle', 'fire-truck', 'heart-pattern', 'flower-mandala', 'star-mandala', 'butterfly-mandala'],
}
const regressionPictures = ['simple/t-rex', 'detailed/t-rex', 'detailed/whale', 'detailed/heart-pattern']
const regressionFile = new URL('./fixtures/coloring-guides.json.gz', import.meta.url)
const largeArea = 500
const repeats = 7

// Use the app's browser rasterizer, including its canvas size and ink threshold.
const pictureSvg = (picture: string) => readFile(`shared/art/${picture}/line.svg`, 'utf8')

async function rasterizePictures(ids: string[]) {
  const { build } = await import('vite')
  const { closeBrowser, findChromeExecutable, launchBrowser } = await import('./browser-utils.mjs')
  const compiled = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      lib: {
        entry: resolve('mobile/src/features/draw/rasterizeFillGuide.ts'),
        name: 'FillGuide',
        formats: ['iife'],
      },
    },
  })
  const [output] = Array.isArray(compiled) ? compiled : [compiled]
  assert.ok('output' in output)
  const bundle = output.output[0]
  assert.equal(bundle.type, 'chunk')

  const browser = await launchBrowser({ executablePath: findChromeExecutable(), args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.addScriptTag({ content: bundle.code })
    const masks: Record<string, string> = {}
    for (const picture of ids) {
      const xml = await pictureSvg(picture)
      masks[picture] = await page.evaluate(async (svg: string) => {
        const api = (window as Window & { FillGuide?: typeof import('../mobile/src/features/draw/rasterizeFillGuide.ts') }).FillGuide
        const pixels = await api?.rasterizeFillGuide(svg)
        if (!pixels) throw new Error('Guide rasterization failed')
        return pixels.toBase64()
      }, xml)
    }
    return masks
  } finally {
    await closeBrowser(browser)
  }
}

function largeRegions(mask: Uint8Array) {
  const size = fillResolution
  const visited = new Uint8Array(mask)
  const queue = new Uint32Array(mask.length)
  const regions: { x: number; y: number; area: number; background: boolean }[] = []
  for (let start = 0; start < mask.length; start++) {
    if (visited[start]) continue
    visited[start] = 1
    queue[0] = start
    let end = 1
    let sumX = 0
    let sumY = 0
    let background = false
    function visit(i: number) {
      if (!visited[i]) {
        visited[i] = 1
        queue[end++] = i
      }
    }
    for (let i = 0; i < end; i++) {
      const p = queue[i]
      const x = p % size
      const y = (p - x) / size
      sumX += x
      sumY += y
      if (x === 0 || x === size - 1 || y === 0 || y === size - 1) background = true
      if (x > 0) visit(p - 1)
      if (x < size - 1) visit(p + 1)
      if (y > 0) visit(p - size)
      if (y < size - 1) visit(p + size)
    }
    if (end < largeArea) continue
    // The centroid can land inside the ink or a hole, so pick its nearest open pixel in this region.
    const cx = sumX / end
    const cy = sumY / end
    let nearest = start
    let nearestDistance = Infinity
    for (let i = 0; i < end; i++) {
      const p = queue[i]
      const x = p % size
      const y = (p - x) / size
      const distance = (x - cx) ** 2 + (y - cy) ** 2
      if (distance < nearestDistance) {
        nearest = p
        nearestDistance = distance
      }
    }
    regions.push({ x: nearest % size, y: Math.floor(nearest / size), area: end, background })
  }
  return regions.sort((a, b) => b.area - a.area)
}

const [option, filename] = process.argv.slice(2)
if (option === '--rasterize') {
  assert.ok(filename, 'Supply a destination for the rasterized masks')
  const ids = Object.entries(pictures).flatMap(([level, ids]) => ids.map((id) => `${level}/${id}`))
  await writeFile(filename, JSON.stringify(await rasterizePictures(ids)))
} else if (option === '--fixtures') {
  const masks = await rasterizePictures(regressionPictures)
  const fixtures = await Promise.all(regressionPictures.map(async (picture) => ({
    picture,
    svgHash: createHash('sha256').update(await pictureSvg(picture)).digest('hex'),
    mask: masks[picture],
  })))
  await writeFile(regressionFile, gzipSync(JSON.stringify(fixtures)))
} else {
  assert.ok(option === '--measure' && filename, 'Use --rasterize <masks.json>, --measure <masks.json> or --fixtures')
  const masks: Record<string, string> = JSON.parse(await readFile(filename, 'utf8'))
  for (const [picture, encoded] of Object.entries(masks)) {
    const mask = Buffer.from(encoded, 'base64')
    const index = indexFillGuide(mask, fillResolution, fillResolution)
    for (const { x, y, area, background } of largeRegions(mask)) {
      const timings: number[] = []
      const limits = { time: 0, corners: 0 }
      const options = { scale: fillDocumentScale }
      let filled: Extract<ReturnType<typeof floodFill>, { status: 'filled' }> | undefined
      for (let i = 0; i < repeats; i++) {
        const start = performance.now()
        const result = floodFill(index, x, y, options)
        timings.push(performance.now() - start)
        if (result.status === 'filled') filled = result
        else if (result.status === 'limit') limits[result.reason]++
        else throw new Error(`Expected an open pixel for ${picture} at ${x},${y}`)
      }
      timings.sort((a, b) => a - b)
      // Smoothed vertices emit one Q each. Small unsmoothed contours only emit M/L.
      const pathCorners = filled ? (filled.path.match(/Q|[ML][^MLQZ]+(?=[MLZ])/g) ?? []).length : null
      console.log(JSON.stringify({
        picture, x, y, area, background, limits,
        medianMs: Number(timings[Math.floor(timings.length / 2)].toFixed(2)),
        maxMs: Number(timings[timings.length - 1].toFixed(2)),
        rawCorners: filled?.corners,
        pathCorners,
        pathHash: filled && createHash('sha256').update(filled.path).digest('hex'),
      }))
    }
  }
}
