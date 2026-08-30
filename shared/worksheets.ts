import type { Drawing } from './drawings'

export type WorksheetOptions = { title?: string; subtitle?: string; steps?: readonly string[] }

function escapeMarkup(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function drawingDataUri(drawing: Drawing) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(drawing.svg)}`
}

function wrapText(value: string, maxCharacters: number) {
  const words = value.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  for (const word of words) {
    const current = lines.at(-1)
    if (!current || current.length + word.length + 1 > maxCharacters) lines.push(word)
    else lines[lines.length - 1] = `${current} ${word}`
  }
  return lines.length > 0 ? lines : ['']
}

export function worksheetFileName(title: string) {
  const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tracebuddy-worksheet'
  return `${safeTitle}-tracebuddy.svg`
}

export function buildWorksheetSvg(drawing: Drawing, options: WorksheetOptions = {}) {
  const title = escapeMarkup(options.title ?? drawing.name)
  const subtitleLines = wrapText(options.subtitle ?? 'Trace the lines, then add your own color and details.', 76).slice(0, 2)
  const steps = (options.steps ?? []).slice(0, 3)
  const subtitleMarkup = `<text x="72" y="164" font-family="Arial, Helvetica, sans-serif" font-size="17" fill="#667085">${subtitleLines.map((line, index) => `<tspan x="72" dy="${index === 0 ? 0 : 22}">${escapeMarkup(line)}</tspan>`).join('')}</text>`
  const stepMarkup = steps.map((step, index) => {
    const lines = wrapText(step, 58).slice(0, 2)
    return `<text x="104" y="${840 + index * 48}" font-family="Arial, Helvetica, sans-serif" font-size="19" fill="#344054"><tspan font-weight="700">${index + 1}.</tspan> ${lines.map((line, lineIndex) => `<tspan x="${lineIndex === 0 ? 126 : 126}" dy="${lineIndex === 0 ? 0 : 23}">${escapeMarkup(line)}</tspan>`).join('')}</text>`
  }).join('')
  const guideTop = subtitleLines.length > 1 ? 204 : 188
  const guideBottom = steps.length > 0 ? 804 : 905
  const guideHeight = guideBottom - guideTop

  return `<svg xmlns="http://www.w3.org/2000/svg" width="816" height="1056" viewBox="0 0 816 1056" role="img" aria-label="${title} tracing worksheet"><rect width="816" height="1056" fill="#FFFCF7"/><rect x="42" y="42" width="732" height="972" rx="28" fill="#FFFFFF" stroke="#D9DEE8" stroke-width="3"/><text x="72" y="96" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" letter-spacing="2" fill="#C44F38">TRACEBUDDY WORKSHEET</text><text x="72" y="136" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="#18243A">${title}</text>${subtitleMarkup}<rect x="72" y="${guideTop}" width="672" height="${guideHeight}" rx="22" fill="#FFF9EF" stroke="#E8DED0" stroke-width="2"/><image href="${drawingDataUri(drawing)}" x="116" y="${guideTop + 28}" width="584" height="${Math.max(420, guideHeight - 56)}" preserveAspectRatio="xMidYMid meet"/>${stepMarkup}<path d="M72 982H744" stroke="#D9DEE8" stroke-width="2"/><text x="72" y="1008" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#667085">Name _________________________</text><text x="520" y="1008" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#667085">Date ______________</text></svg>`
}

export function buildWorksheetHtml(drawing: Drawing, options: WorksheetOptions = {}) {
  const title = escapeMarkup(options.title ?? drawing.name)
  const worksheet = buildWorksheetSvg(drawing, options)
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — TraceBuddy worksheet</title><style>html,body{margin:0;background:#eee7dc;font-family:Arial,Helvetica,sans-serif}.toolbar{position:sticky;top:0;display:flex;justify-content:center;padding:12px;background:#18243a}.toolbar button{min-height:44px;padding:0 22px;border:0;border-radius:999px;background:#ff795d;color:#fff;font-weight:800;cursor:pointer}.sheet{width:min(816px,100%);margin:18px auto;background:#fff;box-shadow:0 18px 60px rgba(24,36,58,.18)}.sheet svg{display:block;width:100%;height:auto}@media print{html,body{background:#fff}.toolbar{display:none}.sheet{width:100%;margin:0;box-shadow:none}@page{size:letter;margin:0}}</style></head><body><div class="toolbar"><button type="button" onclick="window.print()">Print worksheet</button></div><main class="sheet">${worksheet}</main></body></html>`
}
