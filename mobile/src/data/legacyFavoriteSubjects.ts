// TraceBuddy 1.2 template IDs (8f07a5f) mapped to subjects available in both 2.0 art sets.
// Several older guides can represent the same subject. Saved drawings still use their original IDs.
export const legacyFavoriteSubjects: ReadonlyMap<string, string> = new Map(Object.entries({
  'curated-flower-head-008': 'flower',
  'curated-cute-crab-056': 'crab',
  'curated-shell-057': 'seashell',
  'curated-rocket-064': 'rocket',
  'curated-kite-070': 'kite',
  'curated-snowflake-080': 'snowflake',
  'curated-palm-tree-081': 'coconut-tree',
  'curated-pumpkin-097': 'jack-o-lantern',
  'curated-airplane-110': 'airplane',
  'curated-rose-117': 'rose',
  'curated-fish-118': 'fish',
  'curated-flower-120': 'flower',
  'curated-long-stem-flower-257': 'flower',
  flower: 'flower',
  'cozy-house': 'house',
  'friendly-sun': 'sun',
  butterfly: 'butterfly',
  puppy: 'puppy',
  'sleepy-cat': 'cat',
  bunny: 'bunny',
  'gentle-elephant': 'elephant',
  panda: 'panda',
  'little-duck': 'duck',
  'curly-snail': 'snail',
  'island-turtle': 'sea-turtle',
  'friendly-fish': 'fish',
  seahorse: 'seahorse',
  starfish: 'sea-star',
  'happy-crab': 'crab',
  'tiny-whale': 'whale',
  octopus: 'octopus',
  shell: 'seashell',
  'dream-unicorn': 'unicorn',
  'fairy-wand': 'magic-wand',
  'storybook-castle': 'castle',
  'tiny-dragon': 'dragon',
  'royal-crown': 'crown',
  'rainbow-cloud': 'rainbow',
  'rocket-ship': 'rocket',
  'race-car': 'race-car',
  airplane: 'airplane',
  sailboat: 'sailboat',
  'latte-stone': 'latte-stone',
  'palm-island': 'coconut-tree',
  hibiscus: 'hibiscus',
  'proa-canoe': 'proa',
  snowflake: 'snowflake',
  'heart-balloons': 'balloons',
  'flying-kite': 'kite',
  'birthday-cake': 'birthday-cake',
  'baby-dinosaur': 'long-neck',
  ladybug: 'ladybug',
  jellyfish: 'jellyfish',
  'happy-train': 'train',
  'guam-outline': 'guam-island',
  'coconut-crab': 'coconut-crab',
}))

export function mergeLegacyFavoriteSubjects(artIds: string[], legacyIds: string[]): string[] {
  const ids = new Set(artIds)
  for (const id of legacyIds) {
    const subject = legacyFavoriteSubjects.get(id)
    if (subject) ids.add(subject)
  }
  return [...ids]
}
