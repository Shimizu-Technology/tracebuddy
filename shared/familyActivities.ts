import { drawings } from './drawings'
import type { Drawing } from './drawings'

export type FamilyActivityTone = 'coral' | 'sky' | 'mint' | 'sun'

export type FamilyActivity = {
  id: string
  title: string
  invitation: string
  description: string
  minutes: number
  people: string
  starterDrawingId: string
  tone: FamilyActivityTone
  steps: readonly [string, string, string]
}

export const familyActivities: readonly FamilyActivity[] = [
  { id: 'take-turn-doodle', title: 'Take-Turn Doodle', invitation: 'One picture, many imaginations', description: 'Pass the drawing back and forth. Each person adds one new line, shape, or tiny surprise.', minutes: 8, people: '2 or more', starterDrawingId: 'loops-spirals', tone: 'coral', steps: ['Trace one loop or spiral.', 'Pass it over for one new idea.', 'Keep taking turns until a picture appears.'] },
  { id: 'mirror-my-marks', title: 'Mirror My Marks', invitation: 'Practice watching and matching', description: 'One person adds a mark on one side. The other tries to mirror it on the other side.', minutes: 7, people: '2', starterDrawingId: 'butterfly', tone: 'sky', steps: ['Choose one side of the butterfly.', 'Add a dot, stripe, or shape.', 'Mirror the same idea on the other wing.'] },
  { id: 'family-portrait-relay', title: 'Family Portrait Relay', invitation: 'Everyone belongs in the picture', description: 'Build a family scene together. People, pets, favorite things, and funny details all count.', minutes: 12, people: '2 or more', starterDrawingId: 'cozy-house', tone: 'sun', steps: ['Trace the house together.', 'Each person adds someone or something they love.', 'Finish with names, a date, and color.'] },
  { id: 'guam-memory-map', title: 'Guam Memory Map', invitation: 'Draw places your family remembers', description: 'Turn the Guam outline into a map of beaches, villages, foods, and family memories.', minutes: 15, people: 'All ages', starterDrawingId: 'guam-outline', tone: 'mint', steps: ['Trace the island outline.', 'Mark one meaningful place per person.', 'Add tiny pictures or labels for each memory.'] },
  { id: 'island-story-chain', title: 'Island Story Chain', invitation: 'Tell an adventure one turn at a time', description: 'Start with a proa and let each person add the next part of an island adventure.', minutes: 12, people: '2 or more', starterDrawingId: 'proa-canoe', tone: 'sky', steps: ['Trace the proa.', 'One person adds where it is going.', 'Take turns adding weather, friends, and treasure.'] },
  { id: 'kindness-card', title: 'Kindness Card', invitation: 'Make a small gift for someone', description: 'Decorate a heart, add a kind message, and save or print it for someone special.', minutes: 10, people: '1 or more', starterDrawingId: 'big-heart-word', tone: 'coral', steps: ['Trace and color the heart.', 'Write one kind sentence.', 'Add the person’s favorite colors or tiny symbols.'] },
  { id: 'weather-reporter', title: 'Weather Reporter', invitation: 'Look outside, then draw the day', description: 'Notice the sky together and turn the weather guide into today’s little report.', minutes: 8, people: '1 or more', starterDrawingId: 'rain-cloud', tone: 'sky', steps: ['Look outside for one full minute.', 'Trace the cloud and add today’s weather.', 'Draw what your family could do in it.'] },
  { id: 'guess-my-drawing', title: 'Guess My Drawing', invitation: 'Turn simple lines into a surprise', description: 'One person chooses a line path and secretly turns it into an object while everyone guesses.', minutes: 7, people: '2 or more', starterDrawingId: 'line-paths', tone: 'sun', steps: ['Pick one line without saying your idea.', 'Add clues a little at a time.', 'Let everyone guess before the final detail.'] },
  { id: 'pattern-partners', title: 'Pattern Partners', invitation: 'Build a rhythm with lines and color', description: 'Alternate waves, zigzags, colors, and dots to make one shared repeating pattern.', minutes: 8, people: '2', starterDrawingId: 'waves-zigzags', tone: 'mint', steps: ['Person one traces a line in one color.', 'Person two adds the next line or pattern.', 'Repeat the pair across the page.'] },
  { id: 'creature-habitat', title: 'Creature Habitat', invitation: 'Give an animal a whole world', description: 'Trace the baby dinosaur, then work together to invent its home, food, friends, and name.', minutes: 12, people: '2 or more', starterDrawingId: 'baby-dinosaur', tone: 'mint', steps: ['Trace and name the dinosaur.', 'Each person adds one thing it needs.', 'Tell a short story about its day.'] },
  { id: 'build-a-vehicle', title: 'Build-a-Vehicle', invitation: 'Invent a ride that could go anywhere', description: 'Start with a train and take turns adding wild parts for land, sea, sky, or space.', minutes: 10, people: '2 or more', starterDrawingId: 'happy-train', tone: 'coral', steps: ['Trace the train.', 'Each person adds one impossible feature.', 'Name it and decide where it goes first.'] },
  { id: 'birthday-together', title: 'Birthday Together', invitation: 'Design a cake for someone you love', description: 'Choose flavors, decorations, candles, and a message as a family, then keep the finished design.', minutes: 10, people: 'All ages', starterDrawingId: 'birthday-cake', tone: 'sun', steps: ['Trace the cake.', 'Each person adds one decoration or flavor clue.', 'Write the person’s name and save the keepsake.'] },
] as const

export function drawingForFamilyActivity(activity: FamilyActivity): Drawing {
  const drawing = drawings.find((candidate) => candidate.id === activity.starterDrawingId)
  if (!drawing) throw new Error(`Missing family activity drawing: ${activity.starterDrawingId}`)
  return drawing
}
