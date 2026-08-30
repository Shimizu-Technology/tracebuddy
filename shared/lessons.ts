import type { Drawing, DrawingCategoryId, DrawingDifficulty } from './drawings'

export type GuidedLessonStep = {
  title: string
  instruction: string
  fragment: string
}

export type GuidedLesson = {
  id: string
  title: string
  description: string
  category: DrawingCategoryId
  difficulty: DrawingDifficulty
  estimatedMinutes: number
  steps: GuidedLessonStep[]
}

export type LearningProgress = {
  version: 1
  completedLessonIds: string[]
  stepByLessonId: Record<string, number>
}

const strokeAttributes = 'fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"'

export const guidedLessons: GuidedLesson[] = [
  {
    id: 'line-control',
    title: 'Line Control Warm-up',
    description: 'Build a steady hand with five friendly paths.',
    category: 'starters',
    difficulty: 'Starter',
    estimatedMinutes: 4,
    steps: [
      { title: 'Across the page', instruction: 'Start at the dot and draw one slow line across.', fragment: '<circle cx="72" cy="92" r="8" fill="currentColor"/><path d="M72 92H348"/>' },
      { title: 'Down the page', instruction: 'Move from top to bottom without rushing.', fragment: '<circle cx="92" cy="148" r="8" fill="currentColor"/><path d="M92 148V348"/>' },
      { title: 'Gentle wave', instruction: 'Let your hand float up and down like water.', fragment: '<circle cx="132" cy="166" r="8" fill="currentColor"/><path d="M132 166c36-46 72 46 108 0s72 46 108 0"/>' },
      { title: 'Mountain zigzag', instruction: 'Pause softly at each mountain point.', fragment: '<circle cx="132" cy="248" r="8" fill="currentColor"/><path d="m132 248 54-48 54 48 54-48 54 48"/>' },
      { title: 'Round spiral', instruction: 'Circle inward and make each turn a little smaller.', fragment: '<path d="M302 326c0-46-128-52-142 2-13 49 107 75 148 20 45-60-49-133-128-96-76 36-53 129 9 151"/>' },
    ],
  },
  {
    id: 'easy-flower',
    title: 'Easy Flower',
    description: 'Turn circles and curves into a cheerful flower.',
    category: 'nature',
    difficulty: 'Starter',
    estimatedMinutes: 5,
    steps: [
      { title: 'Flower center', instruction: 'Begin with one round circle in the middle.', fragment: '<circle cx="210" cy="154" r="42"/>' },
      { title: 'Four petals', instruction: 'Add a petal above, below, and on both sides.', fragment: '<ellipse cx="210" cy="82" rx="34" ry="48"/><ellipse cx="210" cy="226" rx="34" ry="48"/><ellipse cx="138" cy="154" rx="48" ry="34"/><ellipse cx="282" cy="154" rx="48" ry="34"/>' },
      { title: 'Stem', instruction: 'Pull two long lines down from the flower.', fragment: '<path d="M198 267v112M222 267v112"/>' },
      { title: 'Leaves', instruction: 'Finish with one curved leaf on each side.', fragment: '<path d="M198 315c-45-33-75-14-76 24 34 8 62-1 76-24ZM222 340c43-33 74-14 76 24-34 8-61-1-76-24Z"/>' },
    ],
  },
  {
    id: 'easy-tree',
    title: 'Easy Tree',
    description: 'Stack large shapes to make an island-day tree.',
    category: 'nature',
    difficulty: 'Starter',
    estimatedMinutes: 5,
    steps: [
      { title: 'Tree trunk', instruction: 'Draw two tall lines and connect them at the bottom.', fragment: '<path d="M180 360V220M240 360V220M180 360h60"/>' },
      { title: 'Big treetop', instruction: 'Make a bumpy cloud shape over the trunk.', fragment: '<path d="M117 216c-31-10-42-47-19-70 10-11 25-16 40-13-4-31 23-57 54-50 14-30 58-30 72 0 31-7 58 19 54 50 31-7 58 18 57 50-1 30-30 52-59 43-13 25-45 34-69 16-23 20-59 17-78-7-18 8-38 1-52-19Z"/>' },
      { title: 'Branches', instruction: 'Add three branches reaching into the leaves.', fragment: '<path d="M210 226v-68M210 199l-44-34M210 187l45-39"/>' },
      { title: 'Ground and fruit', instruction: 'Add a ground line and a few round fruits.', fragment: '<path d="M104 360h212"/><circle cx="154" cy="146" r="10"/><circle cx="260" cy="126" r="10"/><circle cx="289" cy="177" r="10"/>' },
    ],
  },
  {
    id: 'happy-ladybug',
    title: 'Happy Ladybug',
    description: 'Practice symmetry with a round little garden friend.',
    category: 'animals',
    difficulty: 'Starter',
    estimatedMinutes: 6,
    steps: [
      { title: 'Round body', instruction: 'Draw one big oval for the shell.', fragment: '<ellipse cx="210" cy="226" rx="110" ry="132"/>' },
      { title: 'Head and middle', instruction: 'Add a round head and a line down the shell.', fragment: '<circle cx="210" cy="92" r="56"/><path d="M210 150v208"/>' },
      { title: 'Legs and feelers', instruction: 'Give your ladybug six legs and two feelers.', fragment: '<path d="M114 180 65 145M102 232H48M116 286l-47 38M306 180l49-35M318 232h54M304 286l47 38M184 48l-31-31M236 48l31-31"/>' },
      { title: 'Spot pattern', instruction: 'Finish with matching spots on both sides.', fragment: '<circle cx="158" cy="196" r="17"/><circle cx="262" cy="196" r="17"/><circle cx="146" cy="272" r="17"/><circle cx="274" cy="272" r="17"/><circle cx="171" cy="328" r="14"/><circle cx="249" cy="328" r="14"/>' },
    ],
  },
  {
    id: 'baby-dinosaur',
    title: 'Baby Dinosaur',
    description: 'Use big curves first, then add friendly details.',
    category: 'animals',
    difficulty: 'Medium',
    estimatedMinutes: 7,
    steps: [
      { title: 'Head and back', instruction: 'Start with one long curve from the nose to the tail.', fragment: '<path d="M92 183c25-76 118-99 177-46 25 22 38 55 37 87 31 0 58 16 74 43-30 3-54 14-75 34H144c-54 0-82-67-52-118Z"/>' },
      { title: 'Belly and legs', instruction: 'Close the body and add two sturdy legs.', fragment: '<path d="M144 301c8 31 6 58-8 82h57l12-61h61l14 61h57c-20-30-28-58-25-82"/>' },
      { title: 'Face', instruction: 'Add one bright eye and a little smile.', fragment: '<circle cx="126" cy="180" r="9" fill="currentColor"/><path d="M104 214c18 15 39 15 57 0"/>' },
      { title: 'Back spikes', instruction: 'Finish with soft triangle shapes along the back.', fragment: '<path d="m167 114 18-42 27 37 26-38 17 48 37-23 4 53"/>' },
    ],
  },
  {
    id: 'happy-train',
    title: 'Happy Train',
    description: 'Build a vehicle from rectangles, circles, and lines.',
    category: 'vehicles',
    difficulty: 'Medium',
    estimatedMinutes: 7,
    steps: [
      { title: 'Engine body', instruction: 'Draw a long rectangle for the engine.', fragment: '<rect x="78" y="190" width="254" height="116" rx="18"/>' },
      { title: 'Cab', instruction: 'Stack a cab and window on the back.', fragment: '<path d="M226 190v-92h92v92"/><rect x="246" y="119" width="51" height="47" rx="8"/>' },
      { title: 'Wheels', instruction: 'Add two big wheels and one small wheel.', fragment: '<circle cx="142" cy="329" r="43"/><circle cx="270" cy="329" r="43"/><circle cx="342" cy="319" r="29"/>' },
      { title: 'Chimney and details', instruction: 'Finish the chimney, front, and connecting rods.', fragment: '<path d="M120 190v-66H91V90h88v34h-29v66M332 218h42v64h-42M142 329h128"/>' },
    ],
  },
  {
    id: 'sea-turtle',
    title: 'Sea Turtle',
    description: 'Combine ovals and sweeping flipper curves.',
    category: 'ocean',
    difficulty: 'Medium',
    estimatedMinutes: 7,
    steps: [
      { title: 'Shell', instruction: 'Begin with one wide oval for the shell.', fragment: '<ellipse cx="210" cy="220" rx="116" ry="91"/>' },
      { title: 'Head and tail', instruction: 'Add a small head in front and a point behind.', fragment: '<path d="M326 195c48-23 78 2 64 31-10 21-36 23-64 19M94 220 54 196l11 43Z"/>' },
      { title: 'Four flippers', instruction: 'Sweep four curved flippers away from the shell.', fragment: '<path d="M143 146c-35-54-69-60-80-35-10 24 25 57 57 74M278 151c30-58 65-69 79-45 13 23-17 59-50 80M139 290c-38 49-32 83-6 88 25 5 50-35 61-69M280 289c43 45 40 80 14 88-24 8-54-29-68-62"/>' },
      { title: 'Shell pattern', instruction: 'Finish with one center shape and shell sections.', fragment: '<path d="m210 167 54 39-20 62h-68l-20-62 54-39ZM156 206l-47-15M264 206l47-15M176 268l-29 31M244 268l29 31"/><circle cx="360" cy="213" r="7" fill="currentColor"/>' },
    ],
  },
  {
    id: 'friendly-robot',
    title: 'Friendly Robot',
    description: 'Use clear shapes to invent a smiling helper.',
    category: 'magic',
    difficulty: 'Starter',
    estimatedMinutes: 6,
    steps: [
      { title: 'Head', instruction: 'Draw a rounded square for the robot head.', fragment: '<rect x="132" y="64" width="156" height="120" rx="26"/>' },
      { title: 'Body', instruction: 'Add a bigger box below the head.', fragment: '<rect x="111" y="210" width="198" height="134" rx="22"/><path d="M210 184v26"/>' },
      { title: 'Arms and legs', instruction: 'Use simple lines and circles for arms and legs.', fragment: '<path d="M111 241 55 284M309 241l56 43M162 344v53M258 344v53"/><circle cx="48" cy="290" r="14"/><circle cx="372" cy="290" r="14"/><path d="M137 397h50M233 397h50"/>' },
      { title: 'Friendly face', instruction: 'Finish with round eyes, a smile, and buttons.', fragment: '<circle cx="177" cy="119" r="11" fill="currentColor"/><circle cx="243" cy="119" r="11" fill="currentColor"/><path d="M171 151c24 20 54 20 78 0"/><circle cx="180" cy="262" r="10"/><circle cx="210" cy="292" r="10"/><circle cx="240" cy="322" r="10"/><path d="M210 64V37M193 37h34"/>' },
    ],
  },
]

const lessonIds = new Set(guidedLessons.map(({ id }) => id))

export const emptyLearningProgress: LearningProgress = {
  version: 1,
  completedLessonIds: [],
  stepByLessonId: {},
}

function clampStep(lesson: GuidedLesson, value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.min(lesson.steps.length - 1, Math.max(0, Math.floor(value)))
}

export function normalizeLearningProgress(value: unknown): LearningProgress {
  if (!value || typeof value !== 'object') return { ...emptyLearningProgress, stepByLessonId: {} }
  const candidate = value as Partial<LearningProgress>
  const completedLessonIds = Array.isArray(candidate.completedLessonIds)
    ? candidate.completedLessonIds.filter((id, index): id is string => typeof id === 'string' && lessonIds.has(id) && candidate.completedLessonIds?.indexOf(id) === index)
    : []
  const stepByLessonId: Record<string, number> = {}
  if (candidate.stepByLessonId && typeof candidate.stepByLessonId === 'object') {
    for (const lesson of guidedLessons) {
      if (lesson.id in candidate.stepByLessonId) stepByLessonId[lesson.id] = clampStep(lesson, candidate.stepByLessonId[lesson.id])
    }
  }
  return { version: 1, completedLessonIds, stepByLessonId }
}

export function updateLearningStep(progress: LearningProgress, lesson: GuidedLesson, stepIndex: number): LearningProgress {
  return {
    ...progress,
    stepByLessonId: { ...progress.stepByLessonId, [lesson.id]: clampStep(lesson, stepIndex) },
  }
}

export function completeGuidedLesson(progress: LearningProgress, lesson: GuidedLesson): LearningProgress {
  return {
    version: 1,
    completedLessonIds: progress.completedLessonIds.includes(lesson.id) ? progress.completedLessonIds : [...progress.completedLessonIds, lesson.id],
    stepByLessonId: { ...progress.stepByLessonId, [lesson.id]: lesson.steps.length - 1 },
  }
}

function lessonSvg(lesson: GuidedLesson, stepIndex: number, includeFuture: boolean) {
  const activeStep = clampStep(lesson, stepIndex)
  const rendered = lesson.steps.map((step, index) => {
    if (!includeFuture && index > activeStep) return ''
    const color = index === activeStep && !includeFuture ? '#FF795D' : '#18243A'
    const opacity = index < activeStep && !includeFuture ? 0.34 : 1
    return `<g color="${color}" stroke="${color}" opacity="${opacity}" ${strokeAttributes}>${step.fragment}</g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420">${rendered}</svg>`
}

export function guidedLessonPreviewDrawing(lesson: GuidedLesson): Drawing {
  return {
    id: `lesson-preview-${lesson.id}`,
    name: lesson.title,
    theme: `${lesson.steps.length} gentle steps`,
    category: lesson.category,
    difficulty: lesson.difficulty,
    svg: lessonSvg(lesson, lesson.steps.length - 1, true),
  }
}

export function guidedLessonStepDrawing(lesson: GuidedLesson, stepIndex: number): Drawing {
  const activeStep = clampStep(lesson, stepIndex)
  return {
    id: `lesson-${lesson.id}-step-${activeStep + 1}`,
    name: `${lesson.title} · Step ${activeStep + 1}`,
    theme: lesson.steps[activeStep].title,
    category: lesson.category,
    difficulty: lesson.difficulty,
    svg: lessonSvg(lesson, activeStep, false),
  }
}
