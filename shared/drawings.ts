import { curatedTemplateSvgs } from './curatedTemplates'

export type DrawingCategoryId = 'animals' | 'nature' | 'ocean' | 'magic' | 'vehicles' | 'letters' | 'island' | 'seasonal' | 'starters'
export type DrawingCollectionId = 'curated'
export type DrawingFilterId = 'all' | DrawingCollectionId | DrawingCategoryId

export type DrawingDifficulty = 'Starter' | 'Medium' | 'Detailed'

export type Drawing = {
  id: string
  name: string
  theme: string
  category: DrawingCategoryId
  collection?: DrawingCollectionId
  difficulty: DrawingDifficulty
  svg: string
}

const SVG_TEXT_LIMIT = 48

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function sanitizeTraceText(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, SVG_TEXT_LIMIT)
}

function splitTraceText(value: string) {
  const safeText = sanitizeTraceText(value)
  if (!safeText) return []

  const words = safeText.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word
    if (nextLine.length <= 13 || currentLine.length === 0) {
      currentLine = nextLine
    } else {
      lines.push(currentLine)
      currentLine = word
    }
  }

  if (currentLine) lines.push(currentLine)
  return lines.slice(0, 3)
}

export function createTextDrawing(value: string): Drawing {
  const lines = splitTraceText(value)
  const safeName = lines.join(' ') || 'My words'
  const lineHeight = lines.length > 1 ? 82 : 96
  const startY = 210 - ((lines.length - 1) * lineHeight) / 2
  const fontSize = lines.length > 1 ? 64 : 78
  const text = lines.map((line, index) => `<text x="210" y="${startY + index * lineHeight}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="4" fill="none" stroke="#18243a" stroke-width="2.6" stroke-linejoin="round">${escapeSvgText(line)}</text>`).join('')

  return {
    id: `custom-text-${safeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'words'}`,
    name: safeName.length > 24 ? `${safeName.slice(0, 21)}...` : safeName,
    theme: 'Custom words',
    category: 'letters',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none"><path d="M68 300H352" stroke="#18243a" stroke-width="10" stroke-linecap="round" opacity="0.34"/><path d="M68 324H352" stroke="#18243a" stroke-width="4" stroke-linecap="round" opacity="0.2"/>${text}</svg>`,
  }
}

export const drawingCategories: Array<{ id: DrawingFilterId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'curated', label: 'Curated' },
  { id: 'starters', label: 'Starters' },
  { id: 'nature', label: 'Nature' },
  { id: 'animals', label: 'Animals' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'magic', label: 'Magic' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'letters', label: 'Letters' },
  { id: 'island', label: 'Island' },
  { id: 'seasonal', label: 'Seasonal' },
]

const curatedDrawings: Drawing[] = [
  {
    id: 'curated-flower-head-008',
    name: 'Flower Head',
    theme: 'Curated nature pick 008',
    category: 'nature',
    collection: 'curated',
    difficulty: 'Starter',
    svg: curatedTemplateSvgs.flowerHead008,
  },
  {
    id: 'curated-cute-crab-056',
    name: 'Cute Crab',
    theme: 'Curated ocean pick 056',
    category: 'ocean',
    collection: 'curated',
    difficulty: 'Medium',
    svg: curatedTemplateSvgs.cuteCrab056,
  },
  {
    id: 'curated-shell-057',
    name: 'Sea Shell',
    theme: 'Curated ocean pick 057',
    category: 'ocean',
    collection: 'curated',
    difficulty: 'Detailed',
    svg: curatedTemplateSvgs.seaShell057,
  },
  {
    id: 'curated-car-062',
    name: 'Simple Car',
    theme: 'Curated vehicle pick 062',
    category: 'vehicles',
    collection: 'curated',
    difficulty: 'Starter',
    svg: curatedTemplateSvgs.simpleCar062,
  },
  {
    id: 'curated-rocket-064',
    name: 'Rocket',
    theme: 'Curated vehicle pick 064',
    category: 'vehicles',
    collection: 'curated',
    difficulty: 'Starter',
    svg: curatedTemplateSvgs.rocket064,
  },
  {
    id: 'curated-kite-070',
    name: 'Kite',
    theme: 'Curated seasonal pick 070',
    category: 'seasonal',
    collection: 'curated',
    difficulty: 'Starter',
    svg: curatedTemplateSvgs.kite070,
  },
  {
    id: 'curated-snowflake-080',
    name: 'Snowflake',
    theme: 'Curated seasonal pick 080',
    category: 'seasonal',
    collection: 'curated',
    difficulty: 'Medium',
    svg: curatedTemplateSvgs.snowflake080,
  },
  {
    id: 'curated-palm-tree-081',
    name: 'Palm Tree',
    theme: 'Curated island pick 081',
    category: 'island',
    collection: 'curated',
    difficulty: 'Detailed',
    svg: curatedTemplateSvgs.palmTree081,
  },
  {
    id: 'curated-pine-tree-088',
    name: 'Pine Tree',
    theme: 'Curated nature pick 088',
    category: 'nature',
    collection: 'curated',
    difficulty: 'Medium',
    svg: curatedTemplateSvgs.pineTree088,
  },
  {
    id: 'curated-pumpkin-097',
    name: 'Pumpkin',
    theme: 'Curated seasonal pick 097',
    category: 'seasonal',
    collection: 'curated',
    difficulty: 'Medium',
    svg: curatedTemplateSvgs.pumpkin097,
  },
  {
    id: 'curated-airplane-110',
    name: 'Propeller Airplane',
    theme: 'Curated vehicle pick 110',
    category: 'vehicles',
    collection: 'curated',
    difficulty: 'Medium',
    svg: curatedTemplateSvgs.propellerAirplane110,
  },
  {
    id: 'curated-rose-117',
    name: 'Rose',
    theme: 'Curated nature pick 117',
    category: 'nature',
    collection: 'curated',
    difficulty: 'Detailed',
    svg: curatedTemplateSvgs.rose117,
  },
  {
    id: 'curated-fish-118',
    name: 'Cartoon Fish',
    theme: 'Curated ocean pick 118',
    category: 'ocean',
    collection: 'curated',
    difficulty: 'Medium',
    svg: curatedTemplateSvgs.cartoonFish118,
  },
  {
    id: 'curated-flower-120',
    name: 'Big Flower',
    theme: 'Curated nature pick 120',
    category: 'nature',
    collection: 'curated',
    difficulty: 'Detailed',
    svg: curatedTemplateSvgs.bigFlower120,
  },
  {
    id: 'curated-long-stem-flower-257',
    name: 'Long Stem Flower',
    theme: 'Curated nature pick 257',
    category: 'nature',
    collection: 'curated',
    difficulty: 'Medium',
    svg: curatedTemplateSvgs.longStemFlower257,
  },
]

export const drawings: Drawing[] = [
  ...curatedDrawings,
  {
    id: 'flower',
    name: 'Happy Flower',
    theme: 'Easy starter',
    category: 'starters',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><circle cx="210" cy="175" r="42"/><path d="M210 133c-13-55 3-96 42-121 19 42 7 82-42 121Z"/><path d="M252 175c50-27 94-23 128 9-33 31-76 29-128-9Z"/><path d="M210 217c12 56-5 96-44 121-19-42-5-82 44-121Z"/><path d="M168 175c-50 28-93 24-127-8 33-32 76-30 127 8Z"/><path d="M181 145c-47-35-60-75-41-120 42 20 58 58 41 120Z"/><path d="M240 145c17-55 49-82 98-82 0 46-31 75-98 82Z"/><path d="M240 205c47 35 60 75 41 120-42-19-58-58-41-120Z"/><path d="M181 205c-18 55-50 82-98 82 0-46 31-75 98-82Z"/><path d="M213 217c19 50 28 99 27 146"/><path d="M240 306c37-23 70-29 101-18-22 29-55 38-101 18Z"/><path d="M226 327c-39-16-73-15-102 1 27 24 61 24 102-1Z"/></svg>`,
  },
  {
    id: 'smiling-star',
    name: 'Smiling Star',
    theme: 'Easy starter',
    category: 'starters',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M210 47 251 151l112 8-86 72 27 109-94-59-95 59 28-109-86-72 112-8 41-104Z"/><path d="M166 197c12-8 25-8 37 0"/><path d="M217 197c12-8 25-8 37 0"/><path d="M163 236c27 30 67 31 94 0"/></svg>`,
  },
  {
    id: 'cozy-house',
    name: 'Cozy House',
    theme: 'Easy starter',
    category: 'starters',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M80 205 210 94l130 111"/><path d="M110 189v139h200V189"/><path d="M178 328v-86h64v86"/><path d="M135 228h47v45h-47z"/><path d="M247 228h47v45h-47z"/><path d="M284 101v62"/><path d="M260 101h48"/></svg>`,
  },
  {
    id: 'friendly-sun',
    name: 'Friendly Sun',
    theme: 'Warmup lines',
    category: 'starters',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><circle cx="210" cy="210" r="82"/><path d="M210 42v67M210 311v67M42 210h67M311 210h67M91 91l48 48M281 281l48 48M329 91l-48 48M139 281l-48 48"/><path d="M168 194c10-9 22-9 32 0"/><path d="M220 194c10-9 22-9 32 0"/><path d="M168 235c28 25 58 25 86 0"/></svg>`,
  },
  {
    id: 'butterfly',
    name: 'Butterfly',
    theme: 'Symmetry',
    category: 'animals',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M209 156c-38-68-87-101-141-91-37 54-13 114 78 180-74 24-94 63-61 118 67 3 108-36 124-119"/><path d="M211 156c38-68 87-101 141-91 37 54 13 114-78 180 74 24 94 63 61 118-67 3-108-36-124-119"/><path d="M210 146c20 30 29 70 27 120-1 36-10 68-27 95-17-27-26-59-27-95-2-50 7-90 27-120Z"/><path d="M180 108c-21-25-45-40-72-45"/><path d="M240 108c21-25 45-40 72-45"/><path d="M127 143c26 9 49 26 69 50"/><path d="M293 143c-26 9-49 26-69 50"/><path d="M124 308c29-18 57-29 83-33"/><path d="M296 308c-29-18-57-29-83-33"/></svg>`,
  },
  {
    id: 'puppy',
    name: 'Puppy Pal',
    theme: 'Animal friend',
    category: 'animals',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M122 166c0-64 41-111 91-111s91 47 91 111c0 79-41 128-91 128s-91-49-91-128Z"/><path d="M127 139c-44-29-76-20-92 28 24 28 57 33 91 13"/><path d="M299 139c44-29 76-20 92 28-24 28-57 33-91 13"/><circle cx="176" cy="164" r="5" fill="#18243a" stroke="none"/><circle cx="250" cy="164" r="5" fill="#18243a" stroke="none"/><path d="M213 190c-14 0-22 8-22 16s8 16 22 16 22-8 22-16-8-16-22-16Z"/><path d="M213 222v25"/><path d="M172 247c27 21 55 21 82 0"/><path d="M139 288c-34 19-55 46-63 82"/><path d="M287 288c34 19 55 46 63 82"/></svg>`,
  },
  {
    id: 'sleepy-cat',
    name: 'Sleepy Cat',
    theme: 'Animal friend',
    category: 'animals',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M116 193c0-60 42-105 94-105s94 45 94 105c0 65-42 109-94 109s-94-44-94-109Z"/><path d="M137 111 101 47l85 40"/><path d="M283 111l36-64-85 40"/><path d="M165 185c17 14 33 14 50 0"/><path d="M205 185c17 14 33 14 50 0"/><path d="M211 207c-12 0-20 7-20 14s8 14 20 14 20-7 20-14-8-14-20-14Z"/><path d="M211 235v21"/><path d="M175 259c24 16 47 16 71 0"/><path d="M116 220H60M116 246H68M304 220h56M304 246h48"/></svg>`,
  },
  {
    id: 'bunny',
    name: 'Bouncy Bunny',
    theme: 'Animal friend',
    category: 'animals',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M151 157c-35-69-35-116 0-141 42 32 54 81 36 147"/><path d="M269 157c35-69 35-116 0-141-42 32-54 81-36 147"/><path d="M110 230c0-68 44-118 100-118s100 50 100 118c0 67-44 113-100 113s-100-46-100-113Z"/><circle cx="174" cy="215" r="5" fill="#18243a" stroke="none"/><circle cx="246" cy="215" r="5" fill="#18243a" stroke="none"/><path d="M210 238c-12 0-19 7-19 14s7 14 19 14 19-7 19-14-7-14-19-14Z"/><path d="M210 266v31"/><path d="M177 296c22 16 44 16 66 0"/><path d="M127 323c-25 8-43 25-53 51"/><path d="M293 323c25 8 43 25 53 51"/></svg>`,
  },
  {
    id: 'gentle-elephant',
    name: 'Gentle Elephant',
    theme: 'Big shapes',
    category: 'animals',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M124 201c-58-45-99-34-123 33 34 60 78 72 132 36"/><path d="M296 201c58-45 99-34 123 33-34 60-78 72-132 36"/><path d="M111 216c0-76 43-129 99-129s99 53 99 129c0 69-43 116-99 116s-99-47-99-116Z"/><circle cx="174" cy="202" r="5" fill="#18243a" stroke="none"/><circle cx="246" cy="202" r="5" fill="#18243a" stroke="none"/><path d="M210 232c-21 26-30 61-24 105 24 23 52 21 71-6-27 7-48 0-63-21"/><path d="M173 286c-26 18-47 19-63 3M247 286c26 18 47 19 63 3"/><path d="M145 335v40M275 335v40"/></svg>`,
  },
  {
    id: 'panda',
    name: 'Round Panda',
    theme: 'Animal friend',
    category: 'animals',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><circle cx="210" cy="213" r="116"/><circle cx="128" cy="117" r="39"/><circle cx="292" cy="117" r="39"/><path d="M151 196c15-28 48-28 64 0"/><path d="M205 196c15-28 48-28 64 0"/><circle cx="180" cy="204" r="5" fill="#18243a" stroke="none"/><circle cx="240" cy="204" r="5" fill="#18243a" stroke="none"/><path d="M210 228c-13 0-21 7-21 15s8 15 21 15 21-7 21-15-8-15-21-15Z"/><path d="M173 276c25 20 49 20 74 0"/></svg>`,
  },
  {
    id: 'little-duck',
    name: 'Little Duck',
    theme: 'Animal friend',
    category: 'animals',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M72 284c31-61 96-90 190-78 62 8 105 39 124 88-51 48-129 69-222 53-55-9-86-31-92-63Z"/><path d="M236 196c-16-53 10-101 60-111 50-9 91 27 91 78 0 22-8 43-24 60"/><path d="M355 156c29-11 51-2 65 25-22 18-45 18-69 0"/><path d="M171 247c34-16 67-10 99 18-30 23-64 22-99-18Z"/><circle cx="310" cy="150" r="5" fill="#18243a" stroke="none"/><path d="M93 345c76 25 166 26 270 2"/><path d="M57 374c100 27 209 27 327 0"/></svg>`,
  },
  {
    id: 'curly-snail',
    name: 'Curly Snail',
    theme: 'Loops',
    category: 'animals',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M51 306c52 34 122 47 211 39 63-6 104-34 124-83"/><path d="M121 280c0-81 51-139 119-139 56 0 97 38 97 89 0 47-35 82-82 82-41 0-70-27-70-62 0-30 23-52 51-52 24 0 41 16 41 38 0 18-14 31-31 31"/><path d="M314 217c30-28 61-31 92-11 1 37-26 57-84 60"/><path d="M316 188c18-55 45-86 82-94"/><path d="M343 197c19-37 42-55 68-55"/><circle cx="398" cy="94" r="5" fill="#18243a" stroke="none"/><circle cx="411" cy="142" r="5" fill="#18243a" stroke="none"/></svg>`,
  },
  {
    id: 'island-turtle',
    name: 'Island Turtle',
    theme: 'Ocean friend',
    category: 'ocean',
    difficulty: 'Detailed',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M102 220c0-67 50-118 116-118s116 51 116 118-50 118-116 118-116-51-116-118Z"/><path d="M218 103c-22 31-34 70-34 117s12 86 34 117"/><path d="M108 220c64-22 134-22 220 0"/><path d="M153 133c30 29 50 58 61 87M283 133c-30 29-50 58-61 87"/><path d="M325 199c31-24 61-27 87-7 10 31-9 56-44 56-18 0-33-8-43-25"/><path d="M102 203c-33-31-66-38-97-20 12 45 46 60 97 43"/><path d="M109 289 55 333M153 324l-27 55M327 289l52 42M284 324l25 55"/><circle cx="373" cy="207" r="5" fill="#18243a" stroke="none"/></svg>`,
  },
  {
    id: 'friendly-fish',
    name: 'Friendly Fish',
    theme: 'Ocean friend',
    category: 'ocean',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M80 213c55-66 132-89 230-66 40 9 70 32 91 66-21 34-51 57-91 66-98 23-175 0-230-66Z"/><path d="M81 213c-37-39-66-49-88-29 17 37 47 46 88 29Z"/><path d="M81 213c-37 39-66 49-88 29 17-37 47-46 88-29Z"/><path d="M196 159c-20 30-27 67-21 108"/><path d="M246 148c-17 38-20 79-8 123"/><path d="M197 154c33-22 67-27 104-13"/><path d="M197 272c33 18 70 21 110 8"/><circle cx="309" cy="194" r="6" fill="#18243a" stroke="none"/><path d="M293 231c23 13 46 13 69 0"/></svg>`,
  },
  {
    id: 'seahorse',
    name: 'Seahorse',
    theme: 'Ocean friend',
    category: 'ocean',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M251 68c-70-12-121 20-153 91 39-15 71-12 95 10-39 15-62 47-62 91 0 52 37 89 88 89 44 0 76-29 76-68 0-34-24-56-58-56"/><path d="M251 68c51 22 79 60 79 111 0 60-38 103-108 126"/><path d="M231 327c24 29 15 57-26 84-35-26-41-53-18-83"/><path d="M180 114c-24-27-51-38-82-32"/><circle cx="254" cy="127" r="5" fill="#18243a" stroke="none"/><path d="M287 163h73M293 199h54"/><path d="M171 255c34 16 69 16 105 0"/><path d="M228 93c-21 10-36 24-45 42"/></svg>`,
  },
  {
    id: 'starfish',
    name: 'Starfish',
    theme: 'Ocean friend',
    category: 'ocean',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M210 48c29 67 37 112 21 136 42-14 87-46 135-98 7 75-14 127-64 154 45 20 75 61 89 122-73-5-122-30-150-73-25 50-75 80-148 90 10-65 38-110 83-136-53-18-80-68-81-144 49 47 95 76 136 85-17-24-9-69 21-136Z"/><path d="M170 214c18-12 36-12 54 0M196 252c25 17 52 17 77 0"/><circle cx="263" cy="213" r="4" fill="#18243a" stroke="none"/><circle cx="205" cy="185" r="4" fill="#18243a" stroke="none"/><circle cx="229" cy="286" r="4" fill="#18243a" stroke="none"/></svg>`,
  },
  {
    id: 'happy-crab',
    name: 'Happy Crab',
    theme: 'Ocean friend',
    category: 'ocean',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M113 257c0-54 42-94 97-94s97 40 97 94c0 50-42 85-97 85s-97-35-97-85Z"/><path d="M144 207c-37-41-76-51-116-28 8 48 42 72 92 68"/><path d="M276 207c37-41 76-51 116-28-8 48-42 72-92 68"/><path d="M64 181l45 31M71 236l49-24M356 181l-45 31M349 236l-49-24"/><path d="M133 277H54M142 310H76M287 277h79M278 310h66"/><path d="M178 220c13 11 26 11 39 0M203 220c13 11 26 11 39 0"/><path d="M172 275c27 22 49 22 76 0"/><path d="M179 165c-8-22-4-42 12-59M241 165c8-22 4-42-12-59"/></svg>`,
  },
  {
    id: 'tiny-whale',
    name: 'Tiny Whale',
    theme: 'Ocean friend',
    category: 'ocean',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M57 240c50-70 122-101 215-91 73 8 116 47 128 118-55 47-121 65-201 56-73-8-120-36-142-83Z"/><path d="M106 225c-35-43-66-57-93-43 10 40 40 54 93 43Z"/><path d="M250 131c-18-31-15-59 10-85M274 134c18-32 48-49 88-49M234 134c-29-22-42-50-38-84"/><circle cx="307" cy="199" r="5" fill="#18243a" stroke="none"/><path d="M292 234c25 13 49 13 73 0"/><path d="M94 350c78 20 166 21 263 3"/></svg>`,
  },
  {
    id: 'octopus',
    name: 'Octopus',
    theme: 'Ocean friend',
    category: 'ocean',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M123 180c0-68 37-115 87-115s87 47 87 115c0 58-37 96-87 96s-87-38-87-96Z"/><circle cx="181" cy="165" r="5" fill="#18243a" stroke="none"/><circle cx="239" cy="165" r="5" fill="#18243a" stroke="none"/><path d="M175 212c24 18 46 18 70 0"/><path d="M121 253c-48 9-76 34-84 75 42 13 76-5 101-49"/><path d="M158 271c-40 35-54 73-41 114 44-6 70-35 78-87"/><path d="M195 278c-25 47-22 87 10 120 33-23 45-59 35-111"/><path d="M231 278c10 52 32 88 67 107 28-35 23-73-16-114"/><path d="M295 253c48 9 76 34 84 75-42 13-76-5-101-49"/><path d="M210 276v72"/></svg>`,
  },
  {
    id: 'shell',
    name: 'Sea Shell',
    theme: 'Ocean lines',
    category: 'ocean',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M68 297c14-97 61-170 142-219 81 49 128 122 142 219-78 48-206 48-284 0Z"/><path d="M210 80v246"/><path d="M162 103c-25 61-35 126-31 195"/><path d="M258 103c25 61 35 126 31 195"/><path d="M108 178c39 30 73 72 102 126"/><path d="M312 178c-39 30-73 72-102 126"/><path d="M85 300c70 31 154 31 250 0"/><path d="M122 322c56 22 114 22 176 0"/></svg>`,
  },
  {
    id: 'dream-unicorn',
    name: 'Dream Unicorn',
    theme: 'Magic',
    category: 'magic',
    difficulty: 'Detailed',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M210 96 244 23 278 96"/><path d="M191 57h48M181 80h67"/><path d="M158 142c-36-38-42-75-17-109 43 24 59 59 46 109"/><path d="M262 142c36-38 42-75 17-109-43 24-59 59-46 109"/><path d="M116 218c0-78 42-130 94-130s94 52 94 130c0 82-42 136-94 136s-94-54-94-136Z"/><path d="M152 154c-24 24-37 57-37 100 0 54 18 95 52 123"/><path d="M268 154c24 24 37 57 37 100 0 54-18 95-52 123"/><circle cx="176" cy="217" r="5" fill="#18243a" stroke="none"/><circle cx="244" cy="217" r="5" fill="#18243a" stroke="none"/><path d="M210 250c-15 0-24 8-24 17s9 17 24 17 24-8 24-17-9-17-24-17Z"/><path d="M210 284v28"/><path d="M176 313c23 18 45 18 68 0"/><path d="M141 198c-23 20-35 47-36 81M279 198c23 20 35 47 36 81"/></svg>`,
  },
  {
    id: 'fairy-wand',
    name: 'Fairy Wand',
    theme: 'Magic',
    category: 'magic',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M82 356 249 189"/><path d="M291 43 319 116l78 4-60 49 19 76-65-42-66 42 20-76-60-49 78-4 28-73Z"/><path d="M70 133l31 31M101 102l-31 31M49 262h52M75 236v52M318 312l34 34M352 312l-34 34"/><path d="M250 189 291 163"/></svg>`,
  },
  {
    id: 'storybook-castle',
    name: 'Story Castle',
    theme: 'Magic',
    category: 'magic',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M84 358V157h76v201"/><path d="M260 358V157h76v201"/><path d="M148 358V226h124v132"/><path d="M84 157l38-68 38 68"/><path d="M260 157l38-68 38 68"/><path d="M148 226l62-84 62 84"/><path d="M191 358v-78c0-20 38-20 38 0v78"/><path d="M107 214h31M282 214h31M178 252h64"/><path d="M54 358h312"/></svg>`,
  },
  {
    id: 'tiny-dragon',
    name: 'Tiny Dragon',
    theme: 'Magic',
    category: 'magic',
    difficulty: 'Detailed',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M127 223c0-76 40-129 83-129s83 53 83 129c0 79-40 130-83 130s-83-51-83-130Z"/><path d="M165 113 133 49l62 36"/><path d="M255 113 287 49l-62 36"/><path d="M128 221c-46-43-84-52-114-27 19 49 59 66 114 50"/><path d="M292 221c46-43 84-52 114-27-19 49-59 66-114 50"/><path d="M181 96 210 42l29 54"/><path d="M210 94v-44"/><circle cx="178" cy="214" r="5" fill="#18243a" stroke="none"/><circle cx="242" cy="214" r="5" fill="#18243a" stroke="none"/><path d="M175 252c24 18 46 18 70 0"/><path d="M190 279l20 25 20-25"/><path d="M154 164c36 15 76 15 112 0"/><path d="M143 315c-23 19-39 41-47 66M277 315c23 19 39 41 47 66"/></svg>`,
  },
  {
    id: 'royal-crown',
    name: 'Royal Crown',
    theme: 'Magic',
    category: 'magic',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M69 144 150 230l60-141 60 141 81-86-24 181H93L69 144Z"/><circle cx="69" cy="144" r="18"/><circle cx="210" cy="89" r="18"/><circle cx="351" cy="144" r="18"/><path d="M96 325h228"/><path d="M122 278h176"/></svg>`,
  },
  {
    id: 'rainbow-cloud',
    name: 'Rainbow Cloud',
    theme: 'Magic',
    category: 'magic',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M87 302c-38 0-61-22-61-53 0-29 23-50 54-48 15-38 51-61 93-53 22-34 67-44 101-22 25 17 38 42 36 72 47 2 84 32 84 70 0 38-33 64-77 64H108c-8 0-15-1-21-2Z"/><path d="M94 236c8-76 56-132 116-132s108 56 116 132"/><path d="M134 238c7-53 38-92 76-92s69 39 76 92"/><path d="M174 239c4-31 19-53 36-53s32 22 36 53"/></svg>`,
  },
  {
    id: 'rocket-ship',
    name: 'Rocket Ship',
    theme: 'Vehicles',
    category: 'vehicles',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M210 36c61 45 91 105 91 181 0 55-26 104-91 147-65-43-91-92-91-147 0-76 30-136 91-181Z"/><circle cx="210" cy="156" r="35"/><path d="M132 246 72 304l72 12M288 246l60 58-72 12"/><path d="M184 350c-22 24-32 49-31 75M236 350c22 24 32 49 31 75"/><path d="M184 236h52M174 286h72"/></svg>`,
  },
  {
    id: 'race-car',
    name: 'Race Car',
    theme: 'Vehicles',
    category: 'vehicles',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M54 284v-33c24-48 64-76 120-85h91c50 9 86 34 109 75v43H54Z"/><path d="M139 171l50-58h77l48 58"/><path d="M189 113v58M266 113v58"/><path d="M314 178h54l24-35"/><circle cx="130" cy="289" r="35"/><circle cx="300" cy="289" r="35"/><path d="M76 242h56M305 242h53M177 222h82"/><path d="M176 289h88"/></svg>`,
  },
  {
    id: 'airplane',
    name: 'Airplane',
    theme: 'Vehicles',
    category: 'vehicles',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M48 226c70-42 154-65 252-68 49-1 87 22 102 61-33 30-78 45-136 43-78-2-151-14-218-36Z"/><path d="M190 256l-76 83h74l88-76"/><path d="M200 164l-77-75h75l82 70"/><path d="M332 164l34-58h43l-20 88"/><path d="M101 222l-53 45"/><path d="M151 204h18M199 194h18M247 187h18"/></svg>`,
  },
  {
    id: 'delivery-truck',
    name: 'Little Pickup',
    theme: 'Vehicles',
    category: 'vehicles',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M58 222h165v82H58z"/><path d="M223 182h82l55 65v57H223z"/><path d="M253 201v48h98"/><path d="M58 222l28-46h101l36 46"/><circle cx="126" cy="308" r="34"/><circle cx="307" cy="308" r="34"/><path d="M29 304h58M160 304h108M341 304h49"/></svg>`,
  },
  {
    id: 'sailboat',
    name: 'Sailboat',
    theme: 'Vehicles',
    category: 'vehicles',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M210 56v214"/><path d="M210 78 89 262h121"/><path d="M214 111 330 270H214"/><path d="M61 286c27 57 77 86 149 86s122-29 149-86H61Z"/><path d="M66 346c88 24 184 24 288 0"/></svg>`,
  },
  {
    id: 'scooter',
    name: 'Scooter',
    theme: 'Vehicles',
    category: 'vehicles',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><circle cx="112" cy="308" r="38"/><circle cx="312" cy="308" r="38"/><path d="M112 308h149c28 0 47-16 56-48"/><path d="M145 274h127"/><path d="M272 274l53-145"/><path d="M325 129h60"/><path d="M302 179h46"/><path d="M92 242h85"/><path d="M137 242c5 31-6 52-33 65"/></svg>`,
  },
  {
    id: 'abc-practice',
    name: 'ABC Practice',
    theme: 'Letters',
    category: 'letters',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none"><text x="210" y="242" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="116" font-weight="700" letter-spacing="18" fill="none" stroke="#18243a" stroke-width="4.2" stroke-linejoin="round">ABC</text><path d="M64 304H356" stroke="#18243a" stroke-width="10" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'numbers-123',
    name: '123 Practice',
    theme: 'Numbers',
    category: 'letters',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none"><text x="210" y="242" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="122" font-weight="650" letter-spacing="16" fill="none" stroke="#18243a" stroke-width="4.2" stroke-linejoin="round">123</text><path d="M64 304H356" stroke="#18243a" stroke-width="10" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'big-heart-word',
    name: 'Love Letters',
    theme: 'Letters',
    category: 'letters',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M210 332C112 260 64 207 69 145c4-45 39-78 82-78 29 0 50 13 59 38 9-25 30-38 59-38 43 0 78 33 82 78 5 62-43 115-141 187Z"/><text x="210" y="218" dominant-baseline="middle" alignment-baseline="middle" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="700" letter-spacing="6" fill="none" stroke="#18243a" stroke-width="3.2" stroke-linejoin="round">LOVE</text></svg>`,
  },
  {
    id: 'name-banner',
    name: 'Name Banner',
    theme: 'Letters',
    category: 'letters',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M66 134h288v124H66z"/><path d="M66 134 30 170l36 36"/><path d="M354 134l36 36-36 36"/><path d="M100 258v72M320 258v72"/><path d="M111 197h198"/><path d="M142 167v60M181 167v60M220 167v60M259 167v60"/><path d="M108 330h224"/></svg>`,
  },
  {
    id: 'latte-stone',
    name: 'Latte Stone',
    theme: 'Guam island',
    category: 'island',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M118 92h184c18 0 32 14 32 32 0 47-48 83-124 83s-124-36-124-83c0-18 14-32 32-32Z"/><path d="M180 205h60l33 141H147l33-141Z"/><path d="M122 346h176"/><path d="M96 377h228"/></svg>`,
  },
  {
    id: 'palm-island',
    name: 'Coconut Tree',
    theme: 'Guam island',
    category: 'island',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M191 350c25-76 35-141 29-197"/><path d="M220 153c-53-47-106-56-158-27 41 37 93 46 158 27Z"/><path d="M220 153c-28-62-15-108 40-137 27 57 14 102-40 137Z"/><path d="M220 153c56-42 113-47 170-15-47 37-103 42-170 15Z"/><path d="M220 153c56 8 96 36 119 84-55 3-95-25-119-84Z"/><path d="M220 153c-52 19-90 54-113 105 53-5 91-40 113-105Z"/><circle cx="210" cy="172" r="13"/><circle cx="239" cy="167" r="13"/><circle cx="226" cy="196" r="13"/><path d="M204 214c18 11 37 10 57-2M197 251c20 10 41 9 62-3M188 289c22 9 44 8 67-4"/><path d="M86 350c72-28 153-28 244 0"/><path d="M51 378c94-29 200-29 318 0"/></svg>`,
  },
  {
    id: 'hibiscus',
    name: 'Hibiscus',
    theme: 'Guam island',
    category: 'island',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><circle cx="204" cy="205" r="28"/><path d="M204 177c-43-51-39-99 14-145 39 52 33 99-14 145Z"/><path d="M231 192c60-28 107-13 142 45-61 23-108 8-142-45Z"/><path d="M225 232c34 58 21 105-40 140-23-62-9-109 40-140Z"/><path d="M181 229c-53 42-101 40-146-8 54-36 103-33 146 8Z"/><path d="M179 194c-61-23-86-65-74-126 58 27 83 69 74 126Z"/><path d="M226 216c46 23 81 58 105 105"/><circle cx="292" cy="275" r="5" fill="#18243a" stroke="none"/><circle cx="315" cy="303" r="5" fill="#18243a" stroke="none"/><circle cx="336" cy="331" r="5" fill="#18243a" stroke="none"/><path d="M140 202c35-11 70-11 105 0M196 154c10 31 12 61 8 90"/></svg>`,
  },
  {
    id: 'proa-canoe',
    name: 'Proa Canoe',
    theme: 'Guam island',
    category: 'island',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M83 282c68 36 160 36 276 0-31 55-78 82-142 82s-109-27-134-82Z"/><path d="M197 64v214"/><path d="M197 85 83 254h114"/><path d="M202 114c63 22 107 69 132 140H202"/><path d="M79 328H34M363 328h36"/><path d="M34 328c22 19 45 19 67 0"/><path d="M319 328c22 19 45 19 67 0"/></svg>`,
  },
  {
    id: 'beach-hut',
    name: 'Beach Hut',
    theme: 'Guam island',
    category: 'island',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M70 194 210 87l140 107"/><path d="M98 194h224v135H98z"/><path d="M142 329v-75h54v75"/><path d="M236 246h50v45h-50z"/><path d="M85 199c80 22 163 22 250 0"/><path d="M67 362c89-28 191-28 306 0"/><path d="M296 155c15-49 43-75 86-77"/><path d="M323 159c19-31 42-46 69-43"/></svg>`,
  },
  {
    id: 'pumpkin',
    name: 'Pumpkin',
    theme: 'Seasonal',
    category: 'seasonal',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M210 155c-35-28-95-19-136 26-43 47-35 116 18 151 37 25 82 23 118 2 36 21 81 23 118-2 53-35 61-104 18-151-41-45-101-54-136-26Z"/><path d="M151 163c-41 34-62 73-62 116 0 36 28 64 86 81"/><path d="M269 163c41 34 62 73 62 116 0 36-28 64-86 81"/><path d="M210 156c-25 33-38 72-38 116 0 39 13 66 38 82 25-16 38-43 38-82 0-44-13-83-38-116Z"/><path d="M205 154c-12-36 6-66 52-89l15 42c-18 20-40 35-67 47Z"/><path d="M264 110c34-18 64-12 88 18"/><path d="M150 263c40 22 80 22 120 0"/></svg>`,
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    theme: 'Seasonal',
    category: 'seasonal',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"><path d="M210 48v324M69 129l282 162M69 291l282-162"/><path d="M176 84l34 34 34-34M176 336l34-34 34 34"/><path d="M101 113l48 13-13-48M319 307l-48-13 13 48"/><path d="M101 307l35-35-48-13M319 113l-35 35 48 13"/><path d="M168 177l42 33 42-33M168 243l42-33 42 33"/><path d="M191 187h38l19 33-19 33h-38l-19-33 19-33Z"/></svg>`,
  },
  {
    id: 'heart-balloons',
    name: 'Heart Balloons',
    theme: 'Seasonal',
    category: 'seasonal',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M135 182c-54-40-76-70-70-106 5-28 29-47 58-43 19 3 34 15 41 33 12-14 29-20 48-15 29 8 46 36 39 64-10 35-42 55-116 67Z"/><path d="M292 195c-59-34-85-61-84-98 1-29 23-51 52-51 19 0 36 10 45 26 10-16 26-26 45-26 29 0 51 22 52 51 1 37-25 64-110 98Z"/><path d="M135 182c15 63 12 125-9 186"/><path d="M292 195c-7 66-2 123 15 171"/><path d="M126 368c41-24 101-25 181-2"/></svg>`,
  },
  {
    id: 'flying-kite',
    name: 'Flying Kite',
    theme: 'Seasonal',
    category: 'seasonal',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M214 43 330 158 214 273 98 158 214 43Z"/><path d="M214 43v230M98 158h232"/><path d="M214 273c8 31 1 56-21 76-19 18-16 38 9 53"/><path d="M75 86c18-15 38-17 59-7"/><path d="M287 60c23-16 45-17 68-2"/></svg>`,
  },
  {
    id: 'birthday-cake',
    name: 'Birthday Cake',
    theme: 'Seasonal',
    category: 'seasonal',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M89 205h242v142H89z"/><path d="M118 159h184v46H118z"/><path d="M145 159v-45M210 159v-45M275 159v-45"/><path d="M145 114c-18-20-16-41 0-62 16 21 18 42 0 62Z"/><path d="M210 114c-18-20-16-41 0-62 16 21 18 42 0 62Z"/><path d="M275 114c-18-20-16-41 0-62 16 21 18 42 0 62Z"/><path d="M89 253c42 24 82 24 121 0 42 24 82 24 121 0"/><path d="M122 303h176"/></svg>`,
  }
]
