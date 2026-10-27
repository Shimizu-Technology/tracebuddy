import { useEffect, useRef, useState } from 'react'
import { keepsakeStamps } from '../../shared/finishFind'
import type { KeepsakeStamp } from '../../shared/finishFind'
import { StampIcon } from './StampIcon'

export function KeepsakeDialog({ title, date, children, stamp, saving, status, onStamp, onSave, onClose, onGallery }: {
  title: string; date: string; children: React.ReactNode; stamp?: KeepsakeStamp; saving: boolean; status: React.ReactNode
  onStamp: (stamp: KeepsakeStamp) => void; onSave: () => void; onClose: () => void; onGallery: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [closing, setClosing] = useState(false)
  const closeActionRef = useRef(onClose)
  const timerRef = useRef<number | undefined>(undefined)
  const closingRef = useRef(false)
  const requestCloseRef = useRef<() => void>(() => undefined)
  useEffect(() => {
    const dialog = dialogRef.current!
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // A same-route entry makes browser Back behave like Keep drawing.
    const state = window.history.state
    if (!state?.tracebuddyKeepsake) window.history.pushState({ ...state, tracebuddyKeepsake: true }, '')
    dialog.showModal()
    const close = () => {
      if (closingRef.current) return
      closingRef.current = true
      setClosing(true)
      timerRef.current = window.setTimeout(() => { dialog.close(); closeActionRef.current() }, 150)
    }
    const back = () => close()
    requestCloseRef.current = () => {
      if (window.history.state?.tracebuddyKeepsake) window.history.back()
      else close()
    }
    window.addEventListener('popstate', back)
    return () => {
      window.clearTimeout(timerRef.current)
      window.removeEventListener('popstate', back)
      document.body.style.overflow = overflow
      focus?.focus()
    }
  }, [])
  return <dialog ref={dialogRef} className="keepsake-dialog" data-open={!closing} aria-labelledby="keepsake-title" onCancel={(event) => { event.preventDefault(); requestCloseRef.current() }}>
    <div className="keepsake-heading"><div><h2 id="keepsake-title">{title}</h2><p>{date}</p></div><button className="secondary-button" type="button" autoFocus onClick={() => requestCloseRef.current()}>Keep drawing</button></div>
    <div className="keepsake-picture">{children}</div>
    <div className="keepsake-stamps" role="group" aria-label="Add a stamp (optional)">
      <p>Add a stamp, if you like</p>
      <div>{keepsakeStamps.map((item) => <button key={item.id} type="button" aria-label={item.label} aria-pressed={stamp === item.id} onClick={() => onStamp(item.id)}><StampIcon stamp={item.id} /></button>)}</div>
    </div>
    {status}
    <div className="keepsake-actions"><button className="primary-button" type="button" disabled={saving} onClick={onSave}>{saving ? 'Saving…' : 'Save picture'}</button><button className="secondary-button" type="button" onClick={() => { closeActionRef.current = onGallery; requestCloseRef.current() }}>My drawings</button></div>
  </dialog>
}
