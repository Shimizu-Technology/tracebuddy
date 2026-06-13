export type DrawingCategoryId = 'animals' | 'ocean' | 'magic' | 'vehicles' | 'letters' | 'island' | 'seasonal' | 'starters'

export type DrawingDifficulty = 'Starter' | 'Medium' | 'Detailed'

export type Drawing = {
  id: string
  name: string
  theme: string
  category: DrawingCategoryId
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

export const drawingCategories: Array<{ id: 'all' | DrawingCategoryId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'starters', label: 'Starters' },
  { id: 'animals', label: 'Animals' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'magic', label: 'Magic' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'letters', label: 'Letters' },
  { id: 'island', label: 'Island' },
  { id: 'seasonal', label: 'Seasonal' },
]

export const drawings: Drawing[] = [
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
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M118 220c0-78 55-137 128-137 64 0 111 48 111 115 0 63-43 111-103 118"/><path d="M161 164c-54-36-98-26-132 30 31 52 81 67 137 31"/><path d="M326 176c37 7 60 29 69 66-28 25-61 27-98 5"/><path d="M241 211c30 34 37 79 19 135-39-5-61-30-65-74"/><circle cx="269" cy="162" r="5" fill="#18243a" stroke="none"/><path d="M113 311v57M316 293v75"/><path d="M144 349h44M289 349h44"/></svg>`,
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
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M93 269c14-72 71-116 149-116h43c51 0 88 34 88 81 0 64-58 108-145 108-65 0-112-27-135-73Z"/><path d="M164 158c-9-50 13-91 66-122 37 42 39 83 6 122"/><path d="M276 199c48-25 86-21 114 12-27 34-65 38-114 13"/><circle cx="240" cy="181" r="5" fill="#18243a" stroke="none"/><path d="M91 333c74 23 149 23 224 0"/><path d="M49 361c102 26 207 26 315 0"/></svg>`,
  },
  {
    id: 'curly-snail',
    name: 'Curly Snail',
    theme: 'Loops',
    category: 'animals',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M55 301c50 35 118 50 205 45 64-4 106-34 126-89"/><path d="M129 281c0-83 51-144 121-144 57 0 99 39 99 92 0 49-36 84-84 84-42 0-72-27-72-63 0-31 23-53 52-53 24 0 42 17 42 39 0 18-14 31-32 31"/><path d="M301 183c20-56 49-87 88-92"/><path d="M336 185c21-37 46-56 75-56"/><circle cx="389" cy="91" r="5" fill="#18243a" stroke="none"/><circle cx="411" cy="129" r="5" fill="#18243a" stroke="none"/></svg>`,
  },
  {
    id: 'island-turtle',
    name: 'Island Turtle',
    theme: 'Ocean friend',
    category: 'ocean',
    difficulty: 'Detailed',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M128 217c0-67 49-117 116-117s116 50 116 117-49 117-116 117-116-50-116-117Z"/><path d="M244 102c-23 30-35 68-35 115s12 85 35 115"/><path d="M132 217c69-21 143-21 224 0"/><path d="M178 126c34 29 55 59 63 91M310 126c-34 29-55 59-63 91"/><path d="M127 204c-30-29-63-35-89-16-17 13-20 38-5 55 21 24 60 13 94-39Z"/><path d="M341 132c20-37 51-49 76-29 15 13 14 36-2 50-20 18-48 10-74-21Z"/><path d="M127 294l-49 41M169 326l-23 54M329 294l50 41M289 326l24 54"/><circle cx="383" cy="126" r="5" fill="#18243a" stroke="none"/></svg>`,
  },
  {
    id: 'friendly-fish',
    name: 'Friendly Fish',
    theme: 'Ocean friend',
    category: 'ocean',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M74 213c55-66 132-91 232-75 41 7 73 32 96 75-23 43-55 68-96 75-100 16-177-9-232-75Z"/><path d="M74 213c-35-34-62-43-82-27 17 36 45 45 82 27Z"/><path d="M74 213c-35 34-62 43-82 27 17-36 45-45 82-27Z"/><circle cx="300" cy="190" r="6" fill="#18243a" stroke="none"/><path d="M238 157c-19 34-25 71-17 112"/><path d="M163 164c22 28 35 61 38 98"/><path d="M120 323c58 18 126 19 205 2"/></svg>`,
  },
  {
    id: 'seahorse',
    name: 'Seahorse',
    theme: 'Ocean friend',
    category: 'ocean',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M248 72c-70-14-119 17-147 91 39-17 72-15 99 7-42 12-67 41-67 82 0 48 34 82 82 82 45 0 77-30 77-72 0-35-25-59-59-59"/><path d="M248 72c50 20 77 59 77 112 0 59-36 99-107 119"/><path d="M230 326c24 30 17 59-21 86-35-26-41-54-18-86"/><path d="M178 114c-21-29-45-43-72-40"/><circle cx="252" cy="129" r="5" fill="#18243a" stroke="none"/><path d="M291 169h72M296 204h54"/><path d="M177 254c32 14 66 14 102 0"/></svg>`,
  },
  {
    id: 'starfish',
    name: 'Starfish',
    theme: 'Ocean friend',
    category: 'ocean',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M210 42c35 74 42 121 22 142 42-10 88-39 138-86 4 88-21 138-75 150 43 23 71 63 84 121-76-7-125-32-147-75-24 46-73 72-147 79 13-61 41-102 84-125-55-12-80-62-75-150 50 47 96 76 138 86-20-21-13-68 22-142Z"/><path d="M171 206c20-12 39-12 58 0"/><path d="M190 245c24 15 48 15 72 0"/><circle cx="260" cy="206" r="4" fill="#18243a" stroke="none"/></svg>`,
  },
  {
    id: 'happy-crab',
    name: 'Happy Crab',
    theme: 'Ocean friend',
    category: 'ocean',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M116 244c0-55 41-96 94-96s94 41 94 96c0 51-41 87-94 87s-94-36-94-87Z"/><path d="M143 161c-18-48-51-68-95-60-17 47 2 81 57 98"/><path d="M277 161c18-48 51-68 95-60 17 47-2 81-57 98"/><path d="M130 266H56M137 301H72M290 266h74M283 301h61"/><path d="M174 222c13 10 26 10 39 0M207 222c13 10 26 10 39 0"/><path d="M170 268c27 22 53 22 80 0"/></svg>`,
  },
  {
    id: 'tiny-whale',
    name: 'Tiny Whale',
    theme: 'Ocean friend',
    category: 'ocean',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M57 236c51-70 122-101 214-91 73 8 116 47 129 117-54 47-121 65-201 56-73-9-120-36-142-82Z"/><path d="M105 221c-35-43-66-57-92-43 9 40 39 54 92 43Z"/><path d="M266 145c7-51 32-80 75-87 16 42 0 73-49 93"/><path d="M252 147c-20-42-16-75 13-101 33 27 37 60 12 98"/><path d="M296 210c23 12 45 12 68 0"/><circle cx="306" cy="195" r="5" fill="#18243a" stroke="none"/><path d="M94 345c78 20 165 21 262 3"/></svg>`,
  },
  {
    id: 'octopus',
    name: 'Octopus',
    theme: 'Ocean friend',
    category: 'ocean',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M124 183c0-68 36-116 86-116s86 48 86 116c0 61-36 101-86 101s-86-40-86-101Z"/><circle cx="180" cy="166" r="5" fill="#18243a" stroke="none"/><circle cx="240" cy="166" r="5" fill="#18243a" stroke="none"/><path d="M176 211c23 17 45 17 68 0"/><path d="M124 260c-49 9-77 34-84 75 42 12 75-5 99-50"/><path d="M165 279c-37 38-48 76-31 115 43-10 65-41 65-93"/><path d="M210 284c-18 49-10 87 24 114 32-27 39-64 20-113"/><path d="M255 279c37 38 48 76 31 115-43-10-65-41-65-93"/><path d="M296 260c49 9 77 34 84 75-42 12-75-5-99-50"/></svg>`,
  },
  {
    id: 'shell',
    name: 'Sea Shell',
    theme: 'Ocean lines',
    category: 'ocean',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M75 302c17-120 62-190 135-210 73 20 118 90 135 210-70 48-160 48-270 0Z"/><path d="M210 94v231"/><path d="M166 112c-21 62-31 125-30 190"/><path d="M254 112c21 62 31 125 30 190"/><path d="M116 181c35 31 66 73 93 126"/><path d="M304 181c-35 31-66 73-93 126"/><path d="M97 305c71 27 146 27 226 0"/></svg>`,
  },
  {
    id: 'dream-unicorn',
    name: 'Dream Unicorn',
    theme: 'Magic',
    category: 'magic',
    difficulty: 'Detailed',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M115 284c28-86 88-136 180-150 52-8 91 13 111 62-25 62-76 96-151 101"/><path d="M178 197c-47-14-86-5-117 27 28 30 65 36 111 18"/><path d="M259 133c-12-48 0-88 39-120 22 39 18 78-13 118"/><path d="M309 139c29-26 60-36 93-29-9 33-33 57-73 70"/><circle cx="321" cy="189" r="5" fill="#18243a" stroke="none"/><path d="M339 228c18 9 35 9 52 0"/><path d="M189 230c34 15 67 38 98 69"/><path d="M160 279c38 25 82 35 132 30"/><path d="M126 133c20-10 38-8 54 7M102 176c24-17 48-20 73-9M82 314c31-13 60-8 87 14"/></svg>`,
  },
  {
    id: 'fairy-wand',
    name: 'Fairy Wand',
    theme: 'Magic',
    category: 'magic',
    difficulty: 'Starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M82 358 268 172"/><path d="M290 38 318 113l80 4-62 50 20 78-66-43-68 43 22-78-62-50 80-4 28-75Z"/><path d="M73 132l30 30M103 102l-30 30M50 260h50M75 235v50M319 310l34 34M353 310l-34 34"/></svg>`,
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
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M92 260c35-76 93-113 174-111 56 2 95 31 117 86-39 52-91 71-158 57"/><path d="M139 219c-35-38-73-47-113-27 12 50 47 68 104 55"/><path d="M218 150c-34-42-40-79-18-114 46 19 63 55 50 108"/><path d="M281 158c24-38 57-54 98-47-6 44-34 67-83 70"/><path d="M312 207c25 4 47 17 65 39-30 20-59 19-87-4"/><circle cx="322" cy="196" r="5" fill="#18243a" stroke="none"/><path d="M165 286l-32 72M226 292l5 76M290 276l38 66"/><path d="M151 183c27 22 48 51 63 87M202 171c29 20 50 48 64 84"/></svg>`,
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
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M79 263c0-76 59-137 131-137s131 61 131 137"/><path d="M118 263c0-54 41-98 92-98s92 44 92 98"/><path d="M157 263c0-33 24-60 53-60s53 27 53 60"/><path d="M97 305c-40 0-65-23-65-53 0-29 24-50 55-47 14-36 49-58 88-49 20-32 62-41 94-19 23 16 35 40 33 68 46 0 83 30 83 68 0 36-32 63-75 63H97Z"/></svg>`,
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
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M52 258c23-54 63-85 120-94h98c51 9 85 40 102 94v44H52v-44Z"/><path d="M133 167l43-55h84l42 55"/><path d="M176 112v55M260 112v55"/><circle cx="130" cy="304" r="34"/><circle cx="296" cy="304" r="34"/><path d="M72 250h54M300 250h58M176 221h82"/><path d="M190 167h78"/></svg>`,
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
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><circle cx="111" cy="309" r="39"/><circle cx="314" cy="309" r="39"/><path d="M111 309h129c45 0 75-25 83-75"/><path d="M169 309l61-112h82"/><path d="M312 197l-32-72h63"/><path d="M343 125h42"/><path d="M93 244h92"/><path d="M144 244c2 34-10 55-37 64"/></svg>`,
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
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M210 328C111 254 64 207 69 143c4-43 38-74 80-74 29 0 51 13 61 38 10-25 32-38 61-38 42 0 76 31 80 74 5 64-42 111-141 185Z"/><text x="210" y="227" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="68" font-weight="700" letter-spacing="8" fill="none" stroke="#18243a" stroke-width="3.2" stroke-linejoin="round">LOVE</text></svg>`,
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
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M207 344c12-83 20-148 24-195"/><path d="M232 149c-45-45-93-53-146-24 42 34 91 42 146 24Z"/><path d="M232 149c-16-58 4-101 61-128 14 56-6 99-61 128Z"/><path d="M232 149c55-37 110-37 164 1-50 29-105 29-164-1Z"/><path d="M232 149c21 48 55 77 103 86 0-49-34-78-103-86Z"/><path d="M203 220c20 11 39 10 58-2M194 257c21 10 42 9 63-3M185 296c23 9 45 8 67-4"/><circle cx="225" cy="170" r="14"/><circle cx="254" cy="164" r="14"/><circle cx="239" cy="191" r="14"/><path d="M94 345c68-27 145-27 232 0"/><path d="M56 374c91-28 194-28 308 0"/></svg>`,
  },
  {
    id: 'hibiscus',
    name: 'Hibiscus',
    theme: 'Guam island',
    category: 'island',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><circle cx="210" cy="210" r="31"/><path d="M210 179c-45-50-45-100 0-150 45 50 45 100 0 150Z"/><path d="M240 200c57-34 106-24 147 30-58 29-107 19-147-30Z"/><path d="M230 238c39 55 31 104-25 147-29-59-20-108 25-147Z"/><path d="M190 238c-45 49-94 54-146 15 48-43 98-48 146-15Z"/><path d="M180 200c-64-16-94-55-89-119 61 20 91 60 89 119Z"/><path d="M230 220c44 25 78 60 102 105"/><path d="M289 286c33-3 59 9 78 36-33 10-59-2-78-36Z"/><circle cx="337" cy="334" r="5" fill="#18243a" stroke="none"/></svg>`,
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
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M210 122c-22-30-15-62 27-91"/><path d="M237 31c27 18 32 44 14 76"/><path d="M210 126c-71 0-126 45-126 112 0 69 52 116 126 116s126-47 126-116c0-67-55-112-126-112Z"/><path d="M170 134c-35 25-55 62-55 104 0 47 25 87 65 108"/><path d="M250 134c35 25 55 62 55 104 0 47-25 87-65 108"/><path d="M210 128c-22 31-33 68-33 110 0 46 12 85 33 114 21-29 33-68 33-114 0-42-11-79-33-110Z"/><path d="M151 246c39 24 79 24 118 0"/><path d="M274 102c30-16 57-16 80 0"/></svg>`,
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    theme: 'Seasonal',
    category: 'seasonal',
    difficulty: 'Medium',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M210 50v320M71 130l278 160M71 290l278-160"/><path d="m169 88 41 41 41-41M169 332l41-41 41 41"/><path d="m99 112 56 15-15-56M321 308l-56-15 15 56"/><path d="m99 308 41-41-56-15M321 112l-41 41 56 15"/><path d="m210 130-35 35M210 130l35 35M210 290l-35-35M210 290l35-35"/><circle cx="210" cy="210" r="18"/></svg>`,
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
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M214 42 330 157 214 272 98 157 214 42Z"/><path d="M214 42v230M98 157h232"/><path d="M214 272c-2 44 16 73 54 88"/><path d="M268 360c-28 7-47 2-58-15"/><path d="M303 379c-23 15-46 14-68-4"/><path d="M75 84c18-15 37-17 58-7"/><path d="M287 58c23-16 45-17 67-2"/></svg>`,
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
