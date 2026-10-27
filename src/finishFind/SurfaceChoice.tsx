import type { DrawingMode } from '../../shared/finishFind'
export function SurfaceChoice({ mode, onChange }: { mode: DrawingMode; onChange: (mode: DrawingMode) => void }) {
  return <section className="surface-choice" aria-label="Paper or screen">
    <div className="surface-switch" role="group" aria-label="Tracing surface">
      <button type="button" aria-label="Trace on paper" className={mode === 'camera' ? 'active' : ''} aria-pressed={mode === 'camera'} onClick={() => onChange('camera')}>
        <svg viewBox="0 0 120 72" aria-hidden="true"><path className="choice-paper" d="m14 54 51-5 29 14-51 6Z"/><g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M94 59V13H74M90 16l-8 12M75 27 60 40"/><rect x="48" y="16" width="36" height="20" rx="5"/><path d="m41 56 7-2 6 3m6 2 7-1M95 60l10 4H82"/></g></svg>
        <strong>Trace on paper</strong><small>Needs a stand</small><span className="surface-selected">{mode === 'camera' ? '✓ Selected' : 'Choose paper'}</span>
      </button>
      <button type="button" aria-label="Draw on screen" className={mode === 'screen' ? 'active' : ''} aria-pressed={mode === 'screen'} onClick={() => onChange('screen')}>
        <svg viewBox="0 0 120 72" aria-hidden="true"><rect className="choice-paper" x="16" y="8" width="74" height="56" rx="7"/><g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M80 16H24v40h56M33 44q5-25 17-5t15-12M77 50 60 34c-6-6-12 1-7 6l12 13-5-2c-8-3-9 5-3 8l13 7h25l7-8-13-16c-4-5-10-4-10 2"/></g></svg>
        <strong>Draw on screen</strong><small>Finger or stylus</small><span className="surface-selected">{mode === 'screen' ? '✓ Selected' : 'Choose screen'}</span>
      </button>
    </div>
    <p>Paper needs a stand. Screen works anywhere.</p>
  </section>
}
