import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent } from 'react'
import './App.css'

type AppMode = 'welcome' | 'picker' | 'trace'
type CameraStatus = 'idle' | 'starting' | 'ready' | 'blocked' | 'unsupported'
type Direction = 'up' | 'right' | 'down' | 'left'

type Drawing = {
  id: string
  name: string
  theme: string
  svg: string
}

type Transform = {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  locked: boolean
  outline: boolean
}

type IconProps = {
  className?: string
}

type WakeLockSentinelLike = {
  release: () => Promise<void>
  addEventListener?: (type: 'release', listener: () => void) => void
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
  }
}

const drawings: Drawing[] = [
  {
    id: 'turtle',
    name: 'Island Turtle',
    theme: 'Ocean friend',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M139 211c0-73 48-127 113-127 61 0 106 49 106 113 0 66-49 118-112 118-64 0-107-43-107-104Z"/><path d="M247 88c-21 28-33 68-33 119 0 47 12 85 34 106"/><path d="M143 209c58-18 128-17 211 2"/><path d="M184 116c27 21 46 52 55 93"/><path d="M315 117c-26 21-44 51-53 92"/><path d="M135 200c-25-23-56-28-78-12-18 13-21 38-7 55 18 22 56 14 85-43Z"/><path d="M323 112c13-35 42-51 69-39 18 8 27 28 20 46-10 26-48 27-89-7Z"/><path d="M121 296l-36 43"/><path d="M161 320l-16 54"/><path d="M331 293l38 39"/><path d="M295 321l19 52"/><circle cx="385" cy="98" r="4" fill="#18243a" stroke="none"/></svg>`,
  },
  {
    id: 'unicorn',
    name: 'Dream Unicorn',
    theme: 'Magic',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M153 303c-27-32-31-72-8-110 20-34 54-54 98-62 40-7 77 7 102 39 23 29 28 67 14 106-17 48-60 76-111 74-38-1-70-17-95-47Z"/><path d="M233 130c-5-42 8-78 39-108 19 36 18 72-4 108"/><path d="M280 126c31-25 62-33 94-23-11 28-36 49-72 62"/><path d="M161 202c-39-3-70 7-94 30 30 13 61 12 94-2"/><path d="M219 181c35 12 65 34 88 67"/><path d="M202 237c34-3 66 6 96 28"/><path d="M177 296c35 12 72 14 112 4"/><circle cx="306" cy="191" r="5" fill="#18243a" stroke="none"/><path d="M327 229c13 8 26 9 39 4"/><path d="M109 112c18-6 33-3 45 10"/><path d="M91 160c19-17 39-22 61-15"/><path d="M77 280c27-13 52-10 74 8"/></svg>`,
  },
  {
    id: 'flower',
    name: 'Happy Flower',
    theme: 'Easy starter',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><circle cx="210" cy="175" r="42"/><path d="M210 133c-13-55 3-96 42-121 19 42 7 82-42 121Z"/><path d="M252 175c50-27 94-23 128 9-33 31-76 29-128-9Z"/><path d="M210 217c12 56-5 96-44 121-19-42-5-82 44-121Z"/><path d="M168 175c-50 28-93 24-127-8 33-32 76-30 127 8Z"/><path d="M181 145c-47-35-60-75-41-120 42 20 58 58 41 120Z"/><path d="M240 145c17-55 49-82 98-82 0 46-31 75-98 82Z"/><path d="M240 205c47 35 60 75 41 120-42-19-58-58-41-120Z"/><path d="M181 205c-18 55-50 82-98 82 0-46 31-75 98-82Z"/><path d="M213 217c19 50 28 99 27 146"/><path d="M240 306c37-23 70-29 101-18-22 29-55 38-101 18Z"/><path d="M226 327c-39-16-73-15-102 1 27 24 61 24 102-1Z"/></svg>`,
  },
  {
    id: 'butterfly',
    name: 'Butterfly',
    theme: 'Symmetry',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" fill="none" stroke="#18243a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M209 156c-38-68-87-101-141-91-37 54-13 114 78 180-74 24-94 63-61 118 67 3 108-36 124-119"/><path d="M211 156c38-68 87-101 141-91 37 54 13 114-78 180 74 24 94 63 61 118-67 3-108-36-124-119"/><path d="M210 146c20 30 29 70 27 120-1 36-10 68-27 95-17-27-26-59-27-95-2-50 7-90 27-120Z"/><path d="M180 108c-21-25-45-40-72-45"/><path d="M240 108c21-25 45-40 72-45"/><path d="M127 143c26 9 49 26 69 50"/><path d="M293 143c-26 9-49 26-69 50"/><path d="M124 308c29-18 57-29 83-33"/><path d="M296 308c-29-18-57-29-83-33"/></svg>`,
  },
]

const defaultTransform: Transform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 0.62,
  locked: false,
  outline: false,
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function App() {
  const [mode, setMode] = useState<AppMode>('welcome')
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing>(drawings[0])
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [transform, setTransform] = useState<Transform>(defaultTransform)
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle')
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 })
  const cameraRequestRef = useRef(0)
  const mountedRef = useRef(false)
  const modeRef = useRef<AppMode>(mode)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)

  const overlaySrc = uploadedImage ?? svgToDataUrl(selectedDrawing.svg)
  const pictureName = uploadedImage ? 'Uploaded picture' : selectedDrawing.name
  const pictureTheme = uploadedImage ? 'Local image from this device' : selectedDrawing.theme

  const stopStream = useCallback((stream: MediaStream) => {
    stream.getTracks().forEach((track) => track.stop())
  }, [])

  const isCurrentCameraRequest = useCallback((requestId: number) => {
    return mountedRef.current && modeRef.current === 'trace' && cameraRequestRef.current === requestId
  }, [])

  const stopActiveCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
  }, [])

  const stopCamera = useCallback(({ resetStatus = true }: { resetStatus?: boolean } = {}) => {
    cameraRequestRef.current += 1
    stopActiveCamera()

    if (resetStatus && mountedRef.current) {
      setCameraStatus('idle')
      setCameraError('')
    }
  }, [stopActiveCamera])

  const requestWakeLock = useCallback(async () => {
    if (wakeLockRef.current || document.visibilityState !== 'visible') return

    const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock
    if (!wakeLock) return

    try {
      const sentinel = await wakeLock.request('screen')

      if (wakeLockRef.current || modeRef.current !== 'trace' || document.visibilityState !== 'visible') {
        await sentinel.release()
        return
      }

      wakeLockRef.current = sentinel
      sentinel.addEventListener?.('release', () => {
        wakeLockRef.current = null
      })
    } catch {
      // Wake Lock is optional and unavailable in several mobile browsers.
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    const sentinel = wakeLockRef.current
    wakeLockRef.current = null
    if (!sentinel) return

    try {
      await sentinel.release()
    } catch {
      // The lock may already be released by the browser.
    }
  }, [])

  const startCamera = useCallback(async () => {
    const requestId = cameraRequestRef.current + 1
    cameraRequestRef.current = requestId
    stopActiveCamera()

    if (!navigator.mediaDevices?.getUserMedia) {
      if (isCurrentCameraRequest(requestId)) {
        setCameraStatus('unsupported')
        setCameraError('This browser does not support camera access. You can still preview the tracing controls in demo mode.')
      }
      return
    }

    if (mountedRef.current) {
      setCameraStatus('starting')
      setCameraError('')
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      if (!isCurrentCameraRequest(requestId)) {
        stopStream(stream)
        return
      }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      if (!isCurrentCameraRequest(requestId)) {
        stopActiveCamera()
        return
      }

      setCameraStatus('ready')
    } catch (error) {
      if (!isCurrentCameraRequest(requestId)) return

      stopActiveCamera()
      setCameraStatus('blocked')
      setCameraError(error instanceof Error ? error.message : 'Camera permission was blocked or unavailable.')
    }
  }, [isCurrentCameraRequest, stopActiveCamera, stopStream])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      stopCamera({ resetStatus: false })
      void releaseWakeLock()
    }
  }, [releaseWakeLock, stopCamera])

  useEffect(() => {
    modeRef.current = mode

    const task = window.setTimeout(() => {
      if (mode === 'trace') {
        void startCamera()
        void requestWakeLock()
      } else {
        stopCamera()
        void releaseWakeLock()
      }
    }, 0)

    return () => window.clearTimeout(task)
  }, [mode, releaseWakeLock, requestWakeLock, startCamera, stopCamera])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && modeRef.current === 'trace') {
        void requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [requestWakeLock])

  function openTrace(drawing?: Drawing) {
    if (drawing) {
      setSelectedDrawing(drawing)
      setUploadedImage(null)
    }
    setTransform(defaultTransform)
    setMode('trace')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updateTransform(partial: Partial<Transform>) {
    setTransform((current) => ({ ...current, ...partial }))
  }

  function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      input.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setUploadedImage(String(reader.result))
      setTransform(defaultTransform)
      setMode('trace')
      input.value = ''
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    reader.onerror = () => {
      input.value = ''
    }
    reader.readAsDataURL(file)
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (transform.locked) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      baseX: transform.x,
      baseY: transform.y,
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active || transform.locked) return
    const dx = event.clientX - dragRef.current.startX
    const dy = event.clientY - dragRef.current.startY
    updateTransform({ x: dragRef.current.baseX + dx, y: dragRef.current.baseY + dy })
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    dragRef.current.active = false
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer may already be released if the drag was cancelled.
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setMode('welcome')} aria-label="TraceBuddy home">
          <span className="brand-mark" aria-hidden="true"><PencilIcon /></span>
          <span>
            <strong>TraceBuddy</strong>
            <small>Camera tracing helper</small>
          </span>
        </button>
        <nav aria-label="Main navigation">
          <button className={mode === 'welcome' ? 'active' : ''} type="button" onClick={() => setMode('welcome')} aria-current={mode === 'welcome' ? 'page' : undefined}>Home</button>
          <button className={mode === 'picker' ? 'active' : ''} type="button" onClick={() => setMode('picker')} aria-current={mode === 'picker' ? 'page' : undefined}>Pictures</button>
          <button className={mode === 'trace' ? 'active' : ''} type="button" onClick={() => openTrace()} aria-current={mode === 'trace' ? 'page' : undefined}>Trace mode</button>
        </nav>
      </header>

      {mode === 'welcome' && <WelcomeScreen onStart={() => setMode('picker')} onDemo={() => openTrace(drawings[0])} />}
      {mode === 'picker' && <PickerScreen selectedDrawing={selectedDrawing} onSelect={openTrace} onUpload={onUpload} />}
      {mode === 'trace' && (
        <TraceScreen
          pictureName={pictureName}
          pictureTheme={pictureTheme}
          overlaySrc={overlaySrc}
          transform={transform}
          cameraStatus={cameraStatus}
          cameraError={cameraError}
          videoRef={videoRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          updateTransform={updateTransform}
          onUpload={onUpload}
          onPicker={() => setMode('picker')}
          onRetryCamera={startCamera}
          onReset={() => setTransform(defaultTransform)}
        />
      )}
    </main>
  )
}

function WelcomeScreen({ onStart, onDemo }: { onStart: () => void; onDemo: () => void }) {
  return (
    <section className="hero-screen">
      <div className="hero-copy">
        <p className="eyebrow">Camera overlay drawing practice</p>
        <h1>Trace drawings on real paper with your camera.</h1>
        <p className="lede">
          Pick a cute picture, place your phone or iPad on a stand, and TraceBuddy overlays the drawing on the camera view so kids can trace with confidence.
        </p>
        <div className="hero-actions">
          <button className="primary-button" type="button" onClick={onStart}>Pick a picture</button>
          <button className="secondary-button" type="button" onClick={onDemo}>Try trace mode</button>
        </div>
        <div className="trust-row" aria-label="Privacy and safety boundaries">
          <span>No account</span>
          <span>No ads</span>
          <span>Camera stays local</span>
        </div>
      </div>

      <div className="hero-demo-card" aria-label="TraceBuddy demo preview">
        <div className="mock-device">
          <div className="mock-camera-bg">
            <span className="paper-sheet" />
            <img src={svgToDataUrl(drawings[1].svg)} alt="Dream Unicorn overlay preview" />
          </div>
        </div>
        <div className="setup-card">
          <h2>Simple setup</h2>
          <ol>
            <li>Put paper on the table.</li>
            <li>Place phone or iPad on a stand.</li>
            <li>Move the overlay, lock it, and trace.</li>
          </ol>
        </div>
      </div>
    </section>
  )
}

function PickerScreen({
  selectedDrawing,
  onSelect,
  onUpload,
}: {
  selectedDrawing: Drawing
  onSelect: (drawing: Drawing) => void
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <section className="picker-screen">
      <div className="section-heading">
        <p className="eyebrow">Choose a tracing picture</p>
        <h1>Start with something fun and simple.</h1>
        <p>Built-in line art works immediately. Parents can also upload a local image — it stays on the device for this MVP.</p>
      </div>

      <div className="drawing-grid">
        {drawings.map((drawing) => (
          <button
            key={drawing.id}
            type="button"
            className={`drawing-card ${selectedDrawing.id === drawing.id ? 'selected' : ''}`}
            onClick={() => onSelect(drawing)}
          >
            <img src={svgToDataUrl(drawing.svg)} alt={`${drawing.name} tracing line art`} />
            <strong>{drawing.name}</strong>
            <small>{drawing.theme}</small>
          </button>
        ))}

        <label className="drawing-card upload-card" aria-label="Upload your own tracing image">
          <span className="drawing-icon" aria-hidden="true"><ImageIcon /></span>
          <strong>Upload your own</strong>
          <small>Use a photo or drawing from this device.</small>
          <input type="file" accept="image/*" onChange={onUpload} />
        </label>
      </div>
    </section>
  )
}

function TraceScreen({
  pictureName,
  pictureTheme,
  overlaySrc,
  transform,
  cameraStatus,
  cameraError,
  videoRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  updateTransform,
  onUpload,
  onPicker,
  onRetryCamera,
  onReset,
}: {
  pictureName: string
  pictureTheme: string
  overlaySrc: string
  transform: Transform
  cameraStatus: CameraStatus
  cameraError: string
  videoRef: React.RefObject<HTMLVideoElement | null>
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void
  updateTransform: (partial: Partial<Transform>) => void
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onPicker: () => void
  onRetryCamera: () => void
  onReset: () => void
}) {
  const cameraMessage = useMemo(() => {
    if (cameraStatus === 'ready') return 'Camera ready — place paper in view.'
    if (cameraStatus === 'starting') return 'Starting camera.'
    if (cameraStatus === 'unsupported') return 'Camera unsupported — demo surface shown.'
    if (cameraStatus === 'blocked') return 'Camera blocked — demo surface shown.'
    return 'Camera idle.'
  }, [cameraStatus])

  return (
    <section className="trace-screen">
      <div className="trace-header">
        <div>
          <p className="eyebrow">Trace mode</p>
          <h1>{pictureName}</h1>
          <p aria-live="polite">{cameraMessage} <span>{pictureTheme}</span></p>
        </div>
        <div className="trace-header-actions">
          <button className="secondary-button compact" type="button" onClick={onPicker}>Change picture</button>
          <label className="secondary-button compact file-button">
            Upload
            <input type="file" accept="image/*" onChange={onUpload} />
          </label>
        </div>
      </div>

      <div className="trace-layout">
        <div className="camera-stage" aria-label="Camera tracing stage">
          <video ref={videoRef} className={cameraStatus === 'ready' ? 'camera-video visible' : 'camera-video'} playsInline muted />
          <div className={`demo-camera ${cameraStatus === 'ready' ? 'hidden' : ''}`}>
            <div className="desk-grid" />
            <div className="demo-paper">
              <span>Paper preview</span>
            </div>
          </div>

          <div
            className={`overlay-layer ${transform.locked ? 'locked' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{
              transform: `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px)) rotate(${transform.rotation}deg) scale(${transform.scale})`,
              opacity: transform.opacity,
            }}
          >
            <img className={transform.outline ? 'outline-filter' : ''} src={overlaySrc} alt="Tracing overlay" draggable={false} />
          </div>

          <div className="stage-badge">
            <span aria-hidden="true">{transform.locked ? <LockIcon /> : <MoveIcon />}</span>
            <span>{transform.locked ? 'Locked — trace now' : 'Drag picture to move'}</span>
          </div>

          {cameraStatus !== 'ready' && (
            <div className="camera-help">
              <strong>{cameraStatus === 'starting' ? 'Starting camera' : 'Demo mode'}</strong>
              <span>{cameraError || 'Use HTTPS on a phone or iPad to test the real camera.'}</span>
              <button type="button" onClick={onRetryCamera}>Retry camera</button>
            </div>
          )}
        </div>

        <aside className="controls-panel" aria-label="Tracing controls">
          <div className="control-card primary-control">
            <span>Step 1</span>
            <strong>Prop your device above the paper.</strong>
            <small>A stand, box, or gooseneck holder works best.</small>
          </div>

          <Slider label="Opacity" value={transform.opacity} min={0.15} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(value) => updateTransform({ opacity: value })} />
          <Slider label="Size" value={transform.scale} min={0.35} max={2.2} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(value) => updateTransform({ scale: value })} />
          <Slider label="Rotate" value={transform.rotation} min={-180} max={180} step={1} format={(v) => `${Math.round(v)}°`} onChange={(value) => updateTransform({ rotation: value })} />

          <div className="toggle-grid">
            <button className={transform.locked ? 'toggle active' : 'toggle'} type="button" aria-pressed={transform.locked} onClick={() => updateTransform({ locked: !transform.locked })}>
              {transform.locked ? 'Unlock' : 'Lock'}
              <small>{transform.locked ? 'Move again' : 'Trace safely'}</small>
            </button>
            <button className={transform.outline ? 'toggle active' : 'toggle'} type="button" aria-pressed={transform.outline} onClick={() => updateTransform({ outline: !transform.outline })}>
              Outline
              <small>High contrast</small>
            </button>
          </div>

          <div className="nudge-grid" aria-label="Nudge overlay position">
            <button type="button" aria-label="Move overlay up" onClick={() => updateTransform({ y: transform.y - 10 })}><ArrowIcon direction="up" /></button>
            <button type="button" aria-label="Move overlay left" onClick={() => updateTransform({ x: transform.x - 10 })}><ArrowIcon direction="left" /></button>
            <button type="button" aria-label="Move overlay right" onClick={() => updateTransform({ x: transform.x + 10 })}><ArrowIcon direction="right" /></button>
            <button type="button" aria-label="Move overlay down" onClick={() => updateTransform({ y: transform.y + 10 })}><ArrowIcon direction="down" /></button>
          </div>

          <button className="reset-button" type="button" onClick={onReset}>Reset overlay</button>
          <p className="privacy-note">Privacy: this MVP does not upload photos or camera video anywhere.</p>
        </aside>
      </div>
    </section>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  return (
    <label className="slider-control">
      <span>
        <strong>{label}</strong>
        <small>{format(value)}</small>
      </span>
      <input type="range" value={value} min={min} max={max} step={step} aria-valuetext={format(value)} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

function PencilIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 16.8 15.7 5.1a2.2 2.2 0 0 1 3.2 3.2L7.2 20 3.5 20.5 4 16.8Z" fill="#ff795d" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m14.4 6.4 3.2 3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ImageIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="m4.5 17 4.8-5.2 3.6 3.8 2.2-2.3L20 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16.5" cy="8.5" r="1.5" fill="currentColor" />
    </svg>
  )
}

function MoveIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m8 7 4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 10V7.8a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 14v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ArrowIcon({ direction, className }: IconProps & { direction: Direction }) {
  const rotation = {
    up: 0,
    right: 90,
    down: 180,
    left: 270,
  }[direction]

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ transform: `rotate(${rotation}deg)` }}>
      <path d="M12 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m6.5 10.5 5.5-5.5 5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default App
