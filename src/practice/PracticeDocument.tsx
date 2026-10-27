import { keepsakeStamps } from '../../shared/finishFind'
import type { KeepsakeStamp } from '../../shared/finishFind'
import { useId } from 'react'
import type { Ref } from 'react'
import { guideBounds, inkGroups, normalizePracticeStrokeWidth } from './document'
import type { InkStroke, PracticeDocumentSize } from './document'

type Props = {
  stamp?: KeepsakeStamp
  size: PracticeDocumentSize
  strokes: InkStroke[]
  guide: string
  guideOpacity: number
  guideOnTop: boolean
  svgRef?: Ref<SVGSVGElement>
  className?: string
}

export function PracticeDocument({ size, strokes, guide, guideOpacity, guideOnTop, svgRef, className, stamp }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const bounds = guideBounds(size)
  const groups = inkGroups(strokes)
  const strokePath = (stroke: InkStroke, index: number, erase = false) => (
    <path key={index} d={stroke.path} transform={stroke.transform} fill="none" stroke={erase ? '#000000' : stroke.color}
      strokeWidth={normalizePracticeStrokeWidth(stroke.width)} opacity={stroke.opacity} strokeDasharray={stroke.dasharray} strokeLinecap="round" strokeLinejoin="round" />
  )
  return (
    <svg ref={svgRef} className={className} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect width={size.width} height={size.height} fill="#ffffff" />
      <image className="practice-guide-image" href={guide} {...bounds} preserveAspectRatio="xMidYMid meet" opacity={guideOpacity} />
      <g className="practice-ink">
        <defs>
          {groups.map((group, index) => group.erasers.length > 0 && (
            <mask key={index} id={`${id}-erase-${index}`} maskUnits="userSpaceOnUse" x="0" y="0" width={size.width} height={size.height} style={{ maskType: 'luminance' }}>
              <rect width={size.width} height={size.height} fill="#ffffff" />
              {group.erasers.map((stroke, i) => strokePath(stroke, i, true))}
            </mask>
          ))}
        </defs>
        {groups.map((group, index) => (
          <g key={index} mask={group.erasers.length ? `url(#${id}-erase-${index})` : undefined}>
            {group.draws.map((stroke, i) => strokePath(stroke, i))}
          </g>
        ))}
      </g>
      {guideOnTop && <image className="practice-guide-image on-top" href={guide} {...bounds} preserveAspectRatio="xMidYMid meet" opacity={Math.max(guideOpacity, 0.48)} style={{ mixBlendMode: 'multiply' }} />}
      {stamp && <g className="keepsake-stamp" transform={`translate(${size.width - 120} ${size.height - 120}) scale(2.5)`}><circle cx="16" cy="16" r="18" fill="#fff8ef" /><path d={keepsakeStamps.find((item) => item.id === stamp)?.path} fill="none" stroke="#a43f2b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></g>}
    </svg>
  )
}
