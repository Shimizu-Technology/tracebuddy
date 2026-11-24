import { theme } from '../../ui/theme'

// Tokens for the camera screen only. It sits on a live camera image, so it needs glass, scrims and
// a table stand-in that the light app surfaces never use. Everything else comes from the shared theme.
export const paperTheme = {
  colors: {
    backdrop: '#1D1A16',
    glass: 'rgba(255,255,255,0.92)',
    onCamera: theme.colors.surface,
    toast: 'rgba(23,32,51,0.88)',
    scrim: 'rgba(0,0,0,0.42)',
    track: '#D9D6CE',
    frame: theme.colors.coral,
    lightLines: theme.colors.surface,
    table: { center: '#8B7864', middle: '#6A5A4A', edge: '#4B3F34', grain: '#FFFFFF' },
    paper: '#FAF8F2',
    paperShadow: '#000000',
    confetti: ['#FF7A5C', '#F7D038', '#3AA0FF', '#5CC26A', '#FF5FA2', '#8E5CF7'],
  },
  size: {
    topButton: theme.target.adult + 4,
    barButton: theme.target.child,
    lockButton: theme.target.child + 16,
    lockIcon: 32,
    badge: theme.target.child,
    fader: { width: theme.target.adult + 4, knob: 32, track: 8, maxHeight: 360, heightFraction: 0.4 },
    frame: { stroke: 2.5, dash: 9, gap: 7, outset: 10, radius: 12, handle: 16, handleStroke: 3 },
    handleHit: 36,
    // The guide's center stays at least this far inside the screen, so it can't be lost.
    keepVisible: 48,
    switchRow: theme.target.adult,
    ring: 3,
    nudge: theme.target.adult,
    tipArt: 120,
    cardMaxWidth: 560,
    barMaxWidth: 520,
    // From this width (iPad, phones held sideways) More opens as a bottom card, not a native sheet.
    cardSheetMinWidth: 700,
    cardMaxHeightFraction: 0.62,
    previewArt: 180,
    confettiPiece: { width: 9, height: 6 },
  },
  opacity: { grain: 0.04, shadow: 0.35, stillConfetti: 0.85 },
  // Gentle snap to the square angles. A sheet of paper is rarely more than a few degrees off.
  snapDegrees: 4,
  snapReleaseDegrees: 7,
  nudgeStep: 2,
  fade: { min: 0.15, max: 1, step: 0.05, initial: 0.6 },
  scale: { min: 0.35, max: 2.2 },
  page: { aspect: 8.5 / 11, widthFraction: 0.78, heightFraction: 0.62, artInset: 0.86, tableTilt: -2 },
  timing: { cameraHandoffMs: 350, placementTimeoutMs: 6000, sheetSettleMs: 450, hintMs: 4200, toastMs: 2000, saveDelayMs: 400, cardDismissPx: 80, cardDismissVelocity: 600, confettiMs: 1400 },
  moreSheetDetent: 0.4,
} as const
