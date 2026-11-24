import { useCallback, useEffect, useRef, useState } from 'react'

import { followLatestSave, operationGuard } from '../../../practiceOperations'
import type { SavedPracticeSession } from '../../../practiceStorageModel'
import { deleteDrawing, hasDrawingContent, newDrawing, readDrawing, saveDrawing } from '../../data/drawingLibrary'

const autosaveMs = 450

export function useDrawSession(initial: SavedPracticeSession, wasSaved: boolean) {
  const [session, setSession] = useState(initial)
  const [saveFailed, setSaveFailed] = useState(false)
  const [dirty, setDirty] = useState(false)
  const current = useRef(initial)
  const generation = useRef(0)
  const revision = useRef(0)
  const savedRevision = useRef(0)
  const mayExist = useRef(wasSaved)
  const clearing = useRef(false)
  const pending = useRef<{ revision: number; save: Promise<boolean> } | null>(null)

  const change = useCallback((update: (session: SavedPracticeSession) => SavedPracticeSession) => {
    if (clearing.current) return
    const next = update(current.current)
    if (next === current.current) return
    current.current = { ...next, updatedAt: new Date().toISOString(), guideOnTop: true }
    revision.current += 1
    setSession(current.current)
    setDirty(true)
  }, [])

  const save = useCallback(async () => {
    if (clearing.current) return false
    const isCurrent = operationGuard(generation.current, () => generation.current)
    const snapshot = current.current
    const version = revision.current
    if (pending.current?.revision === version) {
      return followLatestSave(pending.current.save, () => pending.current?.save ?? null, isCurrent)
    }
    if (version === savedRevision.current) return true

    const write = async () => {
      try {
        if (hasDrawingContent(snapshot)) {
          mayExist.current = true
          if (!await saveDrawing(snapshot, isCurrent)) return false
        } else if (mayExist.current) {
          if (!await deleteDrawing(snapshot.sessionId, isCurrent)) return false
        }
        if (!isCurrent()) return false
        if (version !== revision.current) return false
        savedRevision.current = version
        setSaveFailed(false)
        setDirty(false)
        return true
      } catch {
        if (isCurrent() && version === revision.current) setSaveFailed(true)
        return false
      }
    }

    const attempt = write()
    pending.current = { revision: version, save: attempt }
    void attempt.then(() => { if (pending.current?.save === attempt) pending.current = null })
    return followLatestSave(attempt, () => pending.current?.save ?? null, isCurrent)
  }, [])

  const clear = useCallback(async () => {
    if (clearing.current) return false
    clearing.current = true
    const old = current.current
    const token = ++generation.current
    const isCurrent = operationGuard(token, () => generation.current)
    pending.current = null
    try {
      if (mayExist.current && !await deleteDrawing(old.sessionId, isCurrent)) return false
      current.current = newDrawing(old.source)
      revision.current += 1
      savedRevision.current = revision.current
      mayExist.current = false
      setSession(current.current)
      setDirty(false)
      setSaveFailed(false)
      return true
    } catch {
      if (isCurrent()) setSaveFailed(true)
      return false
    } finally {
      clearing.current = false
    }
  }, [])

  const refreshStamp = useCallback(async (id: string) => {
    const version = revision.current
    const stamp = current.current.stamp
    const token = generation.current
    try {
      const saved = await readDrawing(id)
      if (!saved || clearing.current || generation.current !== token || current.current.sessionId !== id) return
      if (current.current.stamp !== stamp || saved.stamp === stamp) return
      const updatedAt = version === revision.current ? saved.updatedAt : current.current.updatedAt
      current.current = { ...current.current, stamp: saved.stamp, updatedAt }
      revision.current += 1
      setSession(current.current)
      setDirty(true)
    } catch {
      // A failed refresh can be retried by returning to My drawings.
    }
  }, [])

  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => { void save() }, autosaveMs)
    return () => clearTimeout(timer)
  }, [dirty, save, session])

  return { session, change, save, clear, refreshStamp, saveFailed, dirty }
}
