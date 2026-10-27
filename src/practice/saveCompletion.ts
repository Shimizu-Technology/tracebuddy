export type SaveOutcome = 'committed' | 'empty' | 'superseded' | 'failed'

// A superseded request says nothing about durability. Explicit flush callers
// follow replacements until the newest request settles in the same editor.
export async function settleCurrentSave(
  pending: Promise<SaveOutcome>,
  latest: () => Promise<SaveOutcome> | null,
  isCurrent: () => boolean,
): Promise<SaveOutcome> {
  while (true) {
    const result = await pending
    if (!isCurrent()) return 'failed'
    const replacement = latest()
    if (replacement && replacement !== pending) {
      pending = replacement
      continue
    }
    return result === 'superseded' ? 'failed' : result
  }
}
