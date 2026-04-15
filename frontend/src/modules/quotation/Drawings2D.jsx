/**
 * Drawings2D — SVG Engineering Drawings (Plan, Front Elevation, Side Elevation, Cross-Section)
 */

import { useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Maximize2, Grid3X3 } from 'lucide-react'
import { Card, CardHeader, Button, PageHeader } from '../../components/ui/primitives'

const VIEWS = ['plan', 'front', 'side', 'cross_section']
const VIEW_LABELS = { plan: 'Plan View', front: 'Front Elevation', side: 'Side Elevation', cross_section: 'Cross Section' }

function DimensionLine({ x1, y1, x2, y2, label, offset = 20, fontSize = 10 }) {
  const isH = Math.abs(y1 - y2) < 2
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const ox = isH ? 0 : offset, oy = isH ? offset : 0

  return (
    <g className="text-slate-500" stroke="#94A3B8" strokeWidth="0.5" fill="none">
      <line x1={x1} y1={y1 + oy} x2={x2} y2={y2 + oy} markerStart="url(#arrowL)" markerEnd="url(#arrowR)" />
      <line x1={x1} y1={y1} x2={x1} y2={y1 + oy + 5} strokeDasharray="2,2" />
      <line x1={x2} y1={y2} x2={x2} y2={y2 + oy + 5} strokeDasharray="2,2" />
      <text x={mx + (isH ? 0 : offset + 4)} y={my + (isH ? offset + fontSize : 0)} textAnchor="middle" fontSize={fontSize} fill="#64748B">{label}</text>
    </g>
  )
}

function PlanView({ L, W, s, hasMezz, mL, mW }) {
  const sL = L * s, sW = W * s, ox = 40, oy = 40
  return (
    <svg viewBox={`0 0 ${sL + 100} ${sW + 100}`} className="w-full h-full" style={{ maxHeight: 400 }}>
      <defs>
        <marker id="arrowL" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 5 L 10 0 L 10 10 z" fill="#94A3B8" /></marker>
        <marker id="arrowR" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8" /></marker>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E2E8F0" strokeWidth="0.5" /></pattern>
      </defs>
      <rect x={ox} y={oy} width={sL} height={sW} fill="url(#grid)" stroke="#D97706" strokeWidth="2" />
      {/* Column grid */}
      {Array.from({ length: Math.ceil(L / 20) + 1 }).map((_, i) => {
        const x = ox + (i / Math.ceil(L / 20)) * sL
        return <line key={i} x1={x} y1={oy} x2={x} y2={oy + sW} stroke="#F59E0B" strokeWidth="1" strokeDasharray="4,4" />
      })}
      {/* Mezzanine */}
      {hasMezz && <rect x={ox} y={oy} width={(mL || L * 0.5) * s} height={(mW || W * 0.5) * s} fill="#FEF3C7" stroke="#B45309" strokeWidth="1.5" strokeDasharray="6,3" />}
      {hasMezz && <text x={ox + 10} y={oy + 20} fontSize="10" fill="#92400E">MEZZANINE</text>}
      {/* Door */}
      <rect x={ox + sL * 0.4} y={oy - 2} width={sL * 0.15} height={4} fill="#D97706" />
      <text x={ox + sL * 0.4 + sL * 0.075} y={oy - 6} textAnchor="middle" fontSize="8" fill="#92400E">DOOR</text>
      {/* Dimensions */}
      <DimensionLine x1={ox} y1={oy + sW} x2={ox + sL} y2={oy + sW} label={`${L} ft`} offset={25} />
      <DimensionLine x1={ox + sL} y1={oy} x2={ox + sL} y2={oy + sW} label={`${W} ft`} offset={25} />
      {/* Grid labels */}
      {Array.from({ length: Math.ceil(L / 20) + 1 }).map((_, i) => (
        <text key={i} x={ox + (i / Math.ceil(L / 20)) * sL} y={oy - 8} textAnchor="middle" fontSize="9" fill="#D97706" fontWeight="bold">{String.fromCharCode(65 + i)}</text>
      ))}
      <text x={ox + sL / 2} y={15} textAnchor="middle" fontSize="12" fill="#1E293B" fontWeight="bold">PLAN VIEW</text>
    </svg>
  )
}

function FrontElevation({ L, W, Hf, Hw, s, roofType }) {
  const sL = L * s, sHw = Hw * s, sHf = Hf * s
  const ridgeH = sHf - sHw, ox = 40, oy = sHf + 40
  return (
    <svg viewBox={`0 0 ${sL + 100} ${sHf + 100}`} className="w-full h-full" style={{ maxHeight: 400 }}>
      <defs>
        <marker id="arrowL2" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 5 L 10 0 L 10 10 z" fill="#94A3B8" /></marker>
        <marker id="arrowR2" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8" /></marker>
      </defs>
      {/* Walls */}
      <rect x={ox} y={oy - sHw} width={sL} height={sHw} fill="#F1F5F9" stroke="#475569" strokeWidth="1.5" />
      {/* Roof */}
      {roofType === 'gable' ? (
        <polygon points={`${ox},${oy - sHw} ${ox + sL / 2},${oy - sHf} ${ox + sL},${oy - sHw}`}
          fill="#FEF3C7" stroke="#D97706" strokeWidth="2" />
      ) : (
        <polygon points={`${ox},${oy - sHw} ${ox},${oy - sHf} ${ox + sL},${oy - sHw}`}
          fill="#FEF3C7" stroke="#D97706" strokeWidth="2" />
      )}
      {/* Columns */}
      {Array.from({ length: Math.ceil(L / 20) + 1 }).map((_, i) => {
        const x = ox + (i / Math.ceil(L / 20)) * sL
        return <rect key={i} x={x - 3} y={oy - sHw} width={6} height={sHw} fill="#D97706" opacity="0.7" />
      })}
      {/* Door */}
      <rect x={ox + sL * 0.4} y={oy - sHw * 0.6} width={sL * 0.15} height={sHw * 0.6} fill="#334155" stroke="#1E293B" strokeWidth="1" />
      {/* Ground line */}
      <line x1={ox - 10} y1={oy} x2={ox + sL + 10} y2={oy} stroke="#475569" strokeWidth="2" />
      {/* Hatching ground */}
      {Array.from({ length: 20 }).map((_, i) => (
        <line key={i} x1={ox + i * (sL / 19) - 5} y1={oy} x2={ox + i * (sL / 19) - 10} y2={oy + 8} stroke="#94A3B8" strokeWidth="0.5" />
      ))}
      {/* Dimensions */}
      <DimensionLine x1={ox} y1={oy} x2={ox + sL} y2={oy} label={`${L} ft`} offset={20} />
      {/* Height dim */}
      <line x1={ox - 20} y1={oy} x2={ox - 20} y2={oy - sHw} stroke="#94A3B8" strokeWidth="0.5" markerStart="url(#arrowL2)" markerEnd="url(#arrowR2)" />
      <text x={ox - 30} y={oy - sHw / 2} textAnchor="middle" fontSize="9" fill="#64748B" transform={`rotate(-90, ${ox - 30}, ${oy - sHw / 2})`}>{Hw} ft</text>
      <line x1={ox - 35} y1={oy} x2={ox - 35} y2={oy - sHf} stroke="#94A3B8" strokeWidth="0.5" markerStart="url(#arrowL2)" markerEnd="url(#arrowR2)" />
      <text x={ox - 45} y={oy - sHf / 2} textAnchor="middle" fontSize="9" fill="#64748B" transform={`rotate(-90, ${ox - 45}, ${oy - sHf / 2})`}>{Hf} ft</text>
      <text x={ox + sL / 2} y={15} textAnchor="middle" fontSize="12" fill="#1E293B" fontWeight="bold">FRONT ELEVATION</text>
    </svg>
  )
}

function SideElevation({ L, W, Hf, Hw, s, roofType }) {
  const sW = W * s, sHw = Hw * s, sHf = Hf * s
  const ridgeH = sHf - sHw, ox = 40, oy = sHf + 40
  return (
    <svg viewBox={`0 0 ${sW + 100} ${sHf + 100}`} className="w-full h-full" style={{ maxHeight: 400 }}>
      <rect x={ox} y={oy - sHw} width={sW} height={sHw} fill="#F1F5F9" stroke="#475569" strokeWidth="1.5" />
      {roofType === 'gable' ? (
        <polygon points={`${ox},${oy - sHw} ${ox + sW / 2},${oy - sHf} ${ox + sW},${oy - sHw}`}
          fill="#FEF3C7" stroke="#D97706" strokeWidth="2" />
      ) : (
        <polygon points={`${ox},${oy - sHf} ${ox + sW},${oy - sHw} ${ox},${oy - sHw}`}
          fill="#FEF3C7" stroke="#D97706" strokeWidth="2" />
      )}
      <line x1={ox - 10} y1={oy} x2={ox + sW + 10} y2={oy} stroke="#475569" strokeWidth="2" />
      <DimensionLine x1={ox} y1={oy} x2={ox + sW} y2={oy} label={`${W} ft`} offset={20} />
      <text x={ox + sW / 2} y={15} textAnchor="middle" fontSize="12" fill="#1E293B" fontWeight="bold">SIDE ELEVATION</text>
    </svg>
  )
}

function CrossSection({ W, Hf, Hw, s, roofType, hasMezz }) {
  const sW = W * s, sHw = Hw * s, sHf = Hf * s
  const ridgeH = sHf - sHw, ox = 50, oy = sHf + 50
  return (
    <svg viewBox={`0 0 ${sW + 120} ${sHf + 120}`} className="w-full h-full" style={{ maxHeight: 400 }}>
      {/* Foundation */}
      <rect x={ox - 8} y={oy} width={sW + 16} height={12} fill="#94A3B8" stroke="#64748B" strokeWidth="1" />
      {/* Left column */}
      <rect x={ox - 5} y={oy - sHw} width={10} height={sHw} fill="#D97706" stroke="#92400E" strokeWidth="1" />
      {/* Right column */}
      <rect x={ox + sW - 5} y={oy - sHw} width={10} height={sHw} fill="#D97706" stroke="#92400E" strokeWidth="1" />
      {/* Eave beam */}
      <rect x={ox} y={oy - sHw - 4} width={sW} height={4} fill="#F59E0B" />
      {/* Roof truss */}
      {roofType === 'gable' ? (
        <>
          <line x1={ox} y1={oy - sHw} x2={ox + sW / 2} y2={oy - sHf} stroke="#D97706" strokeWidth="2.5" />
          <line x1={ox + sW / 2} y1={oy - sHf} x2={ox + sW} y2={oy - sHw} stroke="#D97706" strokeWidth="2.5" />
          {/* Roof panels */}
          <line x1={ox - 8} y1={oy - sHw + 2} x2={ox + sW / 2} y2={oy - sHf - 4} stroke="#94A3B8" strokeWidth="3" />
          <line x1={ox + sW / 2} y1={oy - sHf - 4} x2={ox + sW + 8} y2={oy - sHw + 2} stroke="#94A3B8" strokeWidth="3" />
          {/* Bottom chord */}
          <line x1={ox} y1={oy - sHw} x2={ox + sW} y2={oy - sHw} stroke="#B45309" strokeWidth="1.5" strokeDasharray="4,2" />
          {/* Vertical web members */}
          {[0.25, 0.5, 0.75].map(f => {
            const x = ox + sW * f
            const roofY = oy - sHw - ridgeH * (f <= 0.5 ? f * 2 : (1 - f) * 2)
            return <line key={f} x1={x} y1={oy - sHw} x2={x} y2={roofY} stroke="#B45309" strokeWidth="1" />
          })}
        </>
      ) : (
        <>
          <line x1={ox} y1={oy - sHf} x2={ox + sW} y2={oy - sHw} stroke="#D97706" strokeWidth="2.5" />
          <line x1={ox - 8} y1={oy - sHf - 4} x2={ox + sW + 8} y2={oy - sHw + 2} stroke="#94A3B8" strokeWidth="3" />
        </>
      )}
      {/* Mezzanine */}
      {hasMezz && (
        <>
          <line x1={ox} y1={oy - sHw * 0.5} x2={ox + sW * 0.5} y2={oy - sHw * 0.5} stroke="#B45309" strokeWidth="2" strokeDasharray="6,3" />
          <text x={ox + sW * 0.25} y={oy - sHw * 0.5 - 5} textAnchor="middle" fontSize="8" fill="#92400E">MEZZ FL</text>
        </>
      )}
      {/* Dimensions */}
      <DimensionLine x1={ox} y1={oy + 12} x2={ox + sW} y2={oy + 12} label={`${W} ft`} offset={15} />
      <text x={ox + sW / 2} y={15} textAnchor="middle" fontSize="12" fill="#1E293B" fontWeight="bold">CROSS SECTION</text>
    </svg>
  )
}

export default function Drawings2D() {
  const location = useLocation()
  const navigate = useNavigate()
  const { params: passedParams, boq } = location.state || {}
  const [activeView, setActiveView] = useState('plan')

  const p = passedParams || {
    building_length: 100, building_width: 60, full_height: 30,
    wall_height: 20, cladding_height: 18, roof_type: 'gable',
    mezzanine_required: false, mezz_length: 0, mezz_width: 0,
  }

  const L = parseFloat(p.building_length), W = parseFloat(p.building_width)
  const Hf = parseFloat(p.full_height), Hw = parseFloat(p.wall_height)
  const hasMezz = p.mezzanine_required
  const mL = parseFloat(p.mezz_length) || 0, mW = parseFloat(p.mezz_width) || 0

  // Scale to fit ~500px wide
  const sH = 350 / Math.max(L, W)  // for plan
  const sV = 300 / Hf               // for elevations

  const renderView = (v, scaleH, scaleV) => (
    <>
      {v === 'plan' && <PlanView L={L} W={W} s={scaleH} hasMezz={hasMezz} mL={mL} mW={mW} />}
      {v === 'front' && <FrontElevation L={L} W={W} Hf={Hf} Hw={Hw} s={scaleV} roofType={p.roof_type} />}
      {v === 'side' && <SideElevation L={L} W={W} Hf={Hf} Hw={Hw} s={scaleV} roofType={p.roof_type} />}
      {v === 'cross_section' && <CrossSection W={W} Hf={Hf} Hw={Hw} s={scaleV} roofType={p.roof_type} hasMezz={hasMezz} />}
    </>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="2D Engineering Drawings"
        subtitle={`${L}ft x ${W}ft x ${Hf}ft — ${p.roof_type === 'gable' ? 'Gable Roof' : 'Single Slope'}`}
        actions={
          <Button variant="secondary" leftIcon={ArrowLeft} onClick={() => navigate(-1)}>
            Back
          </Button>
        }
      />

      {/* View Tabs */}
      <div className="flex gap-2 flex-wrap">
        {VIEWS.map(v => {
          const active = activeView === v
          return (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`inline-flex items-center h-9 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
                active
                  ? 'text-white shadow-[0_4px_14px_-4px_var(--brand-primary)] hover:-translate-y-0.5'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              style={
                active
                  ? {
                      background:
                        'linear-gradient(135deg, var(--brand-primary), color-mix(in oklab, var(--brand-primary) 70%, var(--brand-accent, var(--brand-primary))))',
                    }
                  : undefined
              }
            >
              {VIEW_LABELS[v]}
            </button>
          )
        })}
        <button
          onClick={() => setActiveView('all')}
          className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
            activeView === 'all'
              ? 'text-white shadow-[0_4px_14px_-4px_var(--brand-primary)] hover:-translate-y-0.5'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          style={
            activeView === 'all'
              ? {
                  background:
                    'linear-gradient(135deg, var(--brand-primary), color-mix(in oklab, var(--brand-primary) 70%, var(--brand-accent, var(--brand-primary))))',
                }
              : undefined
          }
        >
          <Grid3X3 className="w-4 h-4" /> All Views
        </button>
      </div>

      {/* Drawing Canvas */}
      {activeView === 'all' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {VIEWS.map(v => (
            <Card key={v}>
              <CardHeader title={VIEW_LABELS[v]} />
              <div className="px-6 py-5">
                {renderView(v, sH * 0.7, sV * 0.7)}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader title={VIEW_LABELS[activeView] || 'Drawing'} />
          <div className="px-6 py-6">
            {renderView(activeView, sH, sV)}
          </div>
        </Card>
      )}

      {/* Drawing Notes */}
      <Card>
        <div className="px-6 py-5">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Drawing Notes</p>
          <ul className="list-disc list-inside space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <li>All dimensions in feet. Not to scale.</li>
            <li>Column spacing: ~20 ft c/c (typical for PEB structures)</li>
            <li>Amber lines indicate steel frame members</li>
            {hasMezz && <li>Mezzanine floor shown with dashed outline</li>}
            <li>Refer to detailed structural drawings for fabrication</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
