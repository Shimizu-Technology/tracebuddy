/** Keep only small raster results. Immutable stroke arrays identify the exact revision. */
export function createPracticePreviewCache(limit = 16) {
  const entries = new Map<string, { revision: object; uri: string }>()
  const revisionIds = new WeakMap<object, number>()
  let nextRevision = 0
  return {
    key(sessionId: string, revision: object) {
      if (!revisionIds.has(revision)) revisionIds.set(revision, ++nextRevision)
      return `${sessionId}-${revisionIds.get(revision)}`
    },
    get(sessionId: string, revision: object) {
      const entry = entries.get(sessionId)
      if (!entry || entry.revision !== revision) return undefined
      entries.delete(sessionId)
      entries.set(sessionId, entry)
      return entry.uri
    },
    set(sessionId: string, revision: object, uri: string) {
      entries.delete(sessionId)
      entries.set(sessionId, { revision, uri })
      while (entries.size > limit) entries.delete(entries.keys().next().value!)
    },
    clear() { entries.clear() },
  }
}
