export type TraceAlignment = {
  version: 1
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function normalizeTraceAlignment(value: unknown): TraceAlignment | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<TraceAlignment>
  if (![candidate.x, candidate.y, candidate.scale, candidate.rotation, candidate.opacity].every((entry) => typeof entry === 'number' && Number.isFinite(entry))) return null
  return {
    version: 1,
    x: clamp(candidate.x as number, -2000, 2000),
    y: clamp(candidate.y as number, -2000, 2000),
    scale: clamp(candidate.scale as number, 0.35, 2.2),
    rotation: clamp(candidate.rotation as number, -180, 180),
    opacity: clamp(candidate.opacity as number, 0.15, 1),
  }
}
