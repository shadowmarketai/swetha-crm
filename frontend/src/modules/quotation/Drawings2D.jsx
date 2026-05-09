/**
 * Drawings2D — Professional SVG PEB Engineering Drawings
 *
 * Generates 4 drawing sheets from building params:
 *  1. Cross Section  — structural cross-section with all components
 *  2. Architectural Plan — top/floor plan with columns, openings
 *  3. Front Elevation — front face with gable/slope
 *  4. Side Elevation — side face showing bays
 *
 * Each sheet includes dimension lines, leader labels, area details,
 * and a professional title block matching Swetha Structures format.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Download, Grid3X3, Printer, Building2, Search,
  ChevronDown, Loader2, FileText, Sliders, Ruler, ArrowUp, Layers,
  Plus, Minus, Sparkles, Send, X, History, MessageSquare,
  ZoomIn, ZoomOut, Maximize2, Minimize2, Move, RotateCcw,
  ChevronLeft, ChevronRight, FileImage, Wind, Sun, Hammer,
} from 'lucide-react'
import { Card, CardHeader, Button, PageHeader, Badge } from '../../components/ui/primitives'
import { quotationAPI } from '../../services/api'

/* ═══════════════════════════════════════════
   CONSTANTS & UTILITIES
   ═══════════════════════════════════════════ */

const VIEWS = ['cross_section', 'plan', 'foundation', 'roof_framing', 'front', 'side']
const VIEW_LABELS = {
  cross_section: 'Cross Section',
  plan: 'Architectural Plan',
  foundation: 'Foundation Plan',
  roof_framing: 'Roof Framing Plan',
  front: 'Front Elevation',
  side: 'Side Elevation',
}
const VIEW_DRG_PREFIX = {
  cross_section: 'CS', plan: 'AP', foundation: 'FP', roof_framing: 'RF', front: 'FE', side: 'SE',
}

const LINE = '#1a2744'       // main structural lines
const LINE_THIN = '#3b5998'  // secondary lines
const DIM_COLOR = '#546e7a'  // dimension lines & text
const LABEL_COLOR = '#1a1a1a'
const STEEL_COL = '#c62828'  // steel column color
const RAFTER_COL = '#1565c0' // rafter/beam color
const PURLIN_COL = '#6a1b9a' // purlin color
const ROOF_COL = '#e65100'   // roof sheet accent
const CLAD_COL = '#0277bd'   // cladding color
const MASONRY_COL = '#90a4ae'
const FOUND_COL = '#78909c'
const GROUND_COL = '#bcaaa4'
const MEZZ_COL = '#2e7d32'
const GUTTER_COL = '#f57f17'
const GRID_COL = '#cfd8dc'

function fmtDim(ft) {
  const f = Math.floor(+ft)
  const inches = Math.round((+ft - f) * 12)
  if (inches === 12) return `${f + 1}'-0"`
  return `${f}'-${inches}"`
}

function fmtArea(sqft) {
  return (+sqft).toLocaleString('en-IN', { maximumFractionDigits: 0 }) + ' Sq.ft'
}

function today() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}


/* ═══════════════════════════════════════════
   SHARED SVG DEFS (markers, patterns)
   ═══════════════════════════════════════════ */

function SvgDefs() {
  return (
    <defs>
      {/* Dimension arrow markers */}
      <marker id="dimArrowL" viewBox="0 0 10 6" refX="0" refY="3" markerWidth="8" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 3 L 10 0 L 10 6 z" fill={DIM_COLOR} />
      </marker>
      <marker id="dimArrowR" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="5" orient="auto">
        <path d="M 0 0 L 10 3 L 0 6 z" fill={DIM_COLOR} />
      </marker>
      {/* Leader dot */}
      <marker id="leaderDot" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4">
        <circle cx="3" cy="3" r="2.5" fill={LINE} />
      </marker>
      {/* Ground hatching */}
      <pattern id="groundHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke={GROUND_COL} strokeWidth="1" />
      </pattern>
      <pattern id="groundHatchDense" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="5" stroke="#a1887f" strokeWidth="0.8" />
      </pattern>
      {/* Brick pattern */}
      <pattern id="brickPat" width="16" height="8" patternUnits="userSpaceOnUse">
        <rect width="16" height="8" fill="#e8d5c4" />
        <line x1="0" y1="4" x2="16" y2="4" stroke="#bcaaa4" strokeWidth="0.5" />
        <line x1="8" y1="0" x2="8" y2="4" stroke="#bcaaa4" strokeWidth="0.5" />
        <line x1="0" y1="4" x2="0" y2="8" stroke="#bcaaa4" strokeWidth="0.5" />
        <line x1="16" y1="4" x2="16" y2="8" stroke="#bcaaa4" strokeWidth="0.5" />
      </pattern>
      {/* Concrete cross-hatch */}
      <pattern id="concHatch" width="6" height="6" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="6" y2="6" stroke="#90a4ae" strokeWidth="0.4" />
        <line x1="6" y1="0" x2="0" y2="6" stroke="#90a4ae" strokeWidth="0.4" />
      </pattern>
      {/* Grid */}
      <pattern id="gridPat" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke={GRID_COL} strokeWidth="0.3" />
      </pattern>
    </defs>
  )
}


/* ═══════════════════════════════════════════
   DIMENSION LINE COMPONENTS
   ═══════════════════════════════════════════ */

function DimH({ x1, x2, y, label, ext = 12, fontSize = 10 }) {
  const mx = (x1 + x2) / 2
  return (
    <g>
      <line x1={x1} y1={y - ext} x2={x1} y2={y + 4} stroke={DIM_COLOR} strokeWidth="0.4" />
      <line x1={x2} y1={y - ext} x2={x2} y2={y + 4} stroke={DIM_COLOR} strokeWidth="0.4" />
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={DIM_COLOR} strokeWidth="0.6"
        markerStart="url(#dimArrowL)" markerEnd="url(#dimArrowR)" />
      <rect x={mx - label.length * 3.2} y={y - fontSize - 1} width={label.length * 6.4} height={fontSize + 3}
        fill="white" stroke="none" />
      <text x={mx} y={y - 3} textAnchor="middle" fontSize={fontSize} fill={DIM_COLOR}
        fontFamily="'Courier New', monospace" fontWeight="bold">{label}</text>
    </g>
  )
}

function DimV({ y1, y2, x, label, ext = 12, fontSize = 10 }) {
  const my = (y1 + y2) / 2
  return (
    <g>
      <line x1={x - ext} y1={y1} x2={x + 4} y2={y1} stroke={DIM_COLOR} strokeWidth="0.4" />
      <line x1={x - ext} y1={y2} x2={x + 4} y2={y2} stroke={DIM_COLOR} strokeWidth="0.4" />
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={DIM_COLOR} strokeWidth="0.6"
        markerStart="url(#dimArrowL)" markerEnd="url(#dimArrowR)" />
      <g transform={`translate(${x - 4}, ${my}) rotate(-90)`}>
        <rect x={-label.length * 3.2} y={-fontSize - 1} width={label.length * 6.4} height={fontSize + 3}
          fill="white" stroke="none" />
        <text x="0" y="-3" textAnchor="middle" fontSize={fontSize} fill={DIM_COLOR}
          fontFamily="'Courier New', monospace" fontWeight="bold">{label}</text>
      </g>
    </g>
  )
}

/** Leader label — line from point to label position */
function Leader({ x1, y1, x2, y2, label, align = 'left', fontSize = 9 }) {
  const textX = align === 'left' ? x2 + 4 : x2 - 4
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={LINE} strokeWidth="0.5" markerStart="url(#leaderDot)" />
      <line x1={x2} y1={y2} x2={align === 'left' ? x2 + 60 : x2 - 60} y2={y2} stroke={LINE} strokeWidth="0.5" />
      <text x={textX} y={y2 - 2} textAnchor={align === 'left' ? 'start' : 'end'}
        fontSize={fontSize} fill={LABEL_COLOR} fontWeight="600">{label}</text>
    </g>
  )
}

/** Level marker — horizontal dashed line with label (FFL, NGL, etc.) */
function LevelMark({ x1, x2, y, label, side = 'left' }) {
  const tx = side === 'left' ? x1 - 6 : x2 + 6
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={LINE} strokeWidth="0.6" strokeDasharray="6,3" />
      <text x={tx} y={y + 3} textAnchor={side === 'left' ? 'end' : 'start'}
        fontSize="9" fill={LINE} fontWeight="bold">{label}</text>
    </g>
  )
}

/** Detail callout — circle with detail tag pointing to a feature on the drawing */
function DetailCallout({ x, y, r = 14, tag, sheet = '01', leaderTo, color = '#c62828' }) {
  return (
    <g>
      {leaderTo && (
        <line x1={leaderTo.x} y1={leaderTo.y} x2={x} y2={y}
          stroke={color} strokeWidth="0.6" strokeDasharray="3,2" />
      )}
      <circle cx={x} cy={y} r={r} fill="white" stroke={color} strokeWidth="1.2" />
      {/* Horizontal divider in callout */}
      <line x1={x - r} y1={y} x2={x + r} y2={y} stroke={color} strokeWidth="0.6" />
      <text x={x} y={y - 3} textAnchor="middle" fontSize="9" fill={color} fontWeight="bold">{tag}</text>
      <text x={x} y={y + 9} textAnchor="middle" fontSize="7" fill={color}>{sheet}</text>
    </g>
  )
}

/** Section cut line — bold dashed line with arrow markers and A-A label at both ends */
function SectionCutLine({ x1, y1, x2, y2, label = 'A' }) {
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.hypot(dx, dy)
  const ux = dx / len, uy = dy / len
  // Arrow points perpendicular to cut, indicating viewing direction
  const px = -uy, py = ux
  const arrowLen = 14
  return (
    <g>
      {/* Bold cut line */}
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="#1a2744" strokeWidth="1.2" strokeDasharray="14,3,3,3" />
      {/* End markers — bullet circles at both ends */}
      {[[x1, y1], [x2, y2]].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="10" fill="white" stroke="#1a2744" strokeWidth="1.2" />
          <text x={cx} y={cy + 3} textAnchor="middle" fontSize="9" fill="#1a2744" fontWeight="bold">{label}</text>
          {/* View direction arrow */}
          <line x1={cx} y1={cy} x2={cx + px * arrowLen} y2={cy + py * arrowLen}
            stroke="#1a2744" strokeWidth="1.2" markerEnd="url(#dimArrowR)" />
        </g>
      ))}
      {/* Center label "A-A" */}
      <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle"
        fontSize="9" fill="#1a2744" fontWeight="bold">{`${label}-${label}`}</text>
    </g>
  )
}

/** Bay dimension chain — continuous individual + total dimension */
function BayDimChain({ x1, x2, y, segments, totalLabel, fontSize = 9, ext = 12 }) {
  // segments: [{label, frac}] where frac is cumulative position 0..1
  const total = segments.reduce((a, b) => a + b.size, 0)
  let cumX = x1
  return (
    <g>
      {/* Individual segments — small dim arrows */}
      {segments.map((seg, i) => {
        const segLen = (seg.size / total) * (x2 - x1)
        const a = cumX, b = cumX + segLen
        cumX = b
        return (
          <g key={i}>
            <line x1={a} y1={y - ext / 2} x2={a} y2={y + 4} stroke={DIM_COLOR} strokeWidth="0.4" />
            <line x1={a} y1={y} x2={b} y2={y} stroke={DIM_COLOR} strokeWidth="0.4"
              markerStart="url(#dimArrowL)" markerEnd="url(#dimArrowR)" />
            <rect x={(a + b) / 2 - String(seg.label).length * 2.6} y={y - fontSize - 1}
              width={String(seg.label).length * 5.2} height={fontSize + 2} fill="white" />
            <text x={(a + b) / 2} y={y - 3} textAnchor="middle" fontSize={fontSize - 1} fill={DIM_COLOR}
              fontFamily="'Courier New', monospace" fontWeight="bold">{seg.label}</text>
          </g>
        )
      })}
      {/* End tick */}
      <line x1={x2} y1={y - ext / 2} x2={x2} y2={y + 4} stroke={DIM_COLOR} strokeWidth="0.4" />
      {/* Total dim below */}
      <line x1={x1} y1={y + ext + 10} x2={x2} y2={y + ext + 10} stroke={DIM_COLOR} strokeWidth="0.6"
        markerStart="url(#dimArrowL)" markerEnd="url(#dimArrowR)" />
      <line x1={x1} y1={y} x2={x1} y2={y + ext + 14} stroke={DIM_COLOR} strokeWidth="0.4" />
      <line x1={x2} y1={y} x2={x2} y2={y + ext + 14} stroke={DIM_COLOR} strokeWidth="0.4" />
      <rect x={(x1 + x2) / 2 - String(totalLabel).length * 3.4} y={y + ext + 10 - fontSize - 1}
        width={String(totalLabel).length * 6.8} height={fontSize + 2} fill="white" />
      <text x={(x1 + x2) / 2} y={y + ext + 7} textAnchor="middle" fontSize={fontSize + 1} fill={DIM_COLOR}
        fontFamily="'Courier New', monospace" fontWeight="bold">{totalLabel}</text>
    </g>
  )
}


/* ═══════════════════════════════════════════
   TITLE BLOCK
   ═══════════════════════════════════════════ */

function TitleBlock({ x, y, w, h, drawingTitle, projectName, clientName, clientLocation, projectNo, drawingNo, viewKey }) {
  const colWidths = [w * 0.15, w * 0.22, w * 0.15, w * 0.28, w * 0.10, w * 0.10]
  const cols = [x]
  for (let i = 0; i < colWidths.length; i++) cols.push(cols[i] + colWidths[i])

  const midY = y + h * 0.5
  const splitY = y + h * 0.55

  return (
    <g>
      {/* Outer border */}
      <rect x={x} y={y} width={w} height={h} fill="white" stroke={LINE} strokeWidth="1.5" />
      {/* Column dividers */}
      {cols.slice(1, -1).map((cx, i) => (
        <line key={i} x1={cx} y1={y} x2={cx} y2={y + h} stroke={LINE} strokeWidth="0.6" />
      ))}
      {/* Horizontal split in last 2 cols */}
      <line x1={cols[4]} y1={splitY} x2={cols[6]} y2={splitY} stroke={LINE} strokeWidth="0.4" />
      <line x1={cols[4]} y1={splitY + (y + h - splitY) * 0.5} x2={cols[6]} y2={splitY + (y + h - splitY) * 0.5} stroke={LINE} strokeWidth="0.3" />

      {/* Col 1: Drawing Title */}
      <text x={cols[0] + 6} y={y + 12} fontSize="7" fill={DIM_COLOR} fontWeight="bold">DRAWING TITLE :</text>
      <text x={cols[0] + colWidths[0] / 2} y={midY + 4} textAnchor="middle"
        fontSize="10" fill={LINE} fontWeight="bold">{drawingTitle}</text>

      {/* Col 2: Project Title */}
      <text x={cols[1] + 6} y={y + 12} fontSize="7" fill={DIM_COLOR} fontWeight="bold">PROJECT TITLE :</text>
      <text x={cols[1] + colWidths[1] / 2} y={midY - 2} textAnchor="middle"
        fontSize="9" fill={LINE} fontWeight="bold">{projectName || 'PROPOSED INDUSTRIAL BUILDING'}</text>
      {clientLocation && (
        <text x={cols[1] + colWidths[1] / 2} y={midY + 12} textAnchor="middle"
          fontSize="8" fill={LINE} fontWeight="bold">@ {clientLocation.toUpperCase()}</text>
      )}

      {/* Col 3: Client */}
      <text x={cols[2] + 6} y={y + 12} fontSize="7" fill={DIM_COLOR} fontWeight="bold">CLIENT :</text>
      <text x={cols[2] + colWidths[2] / 2} y={midY} textAnchor="middle"
        fontSize="8" fill={LINE} fontWeight="600">{clientName || '—'}</text>
      {clientLocation && (
        <text x={cols[2] + colWidths[2] / 2} y={midY + 12} textAnchor="middle"
          fontSize="7" fill={DIM_COLOR}>{clientLocation}</text>
      )}

      {/* Col 4: Turnkey Contractor */}
      <text x={cols[3] + 6} y={y + 12} fontSize="7" fill={DIM_COLOR} fontWeight="bold">TURNKEY CONTRACTOR :</text>
      {/* Logo circle */}
      <circle cx={cols[3] + colWidths[3] / 2} cy={midY - 6} r="10" fill="none" stroke={LINE} strokeWidth="1" />
      <text x={cols[3] + colWidths[3] / 2} y={midY - 3} textAnchor="middle" fontSize="8" fill={LINE} fontWeight="bold">SS</text>
      <text x={cols[3] + colWidths[3] / 2} y={midY + 10} textAnchor="middle"
        fontSize="9" fill={LINE} fontWeight="bold">SWETHA STRUCTURES PVT LTD</text>
      <text x={cols[3] + colWidths[3] / 2} y={midY + 20} textAnchor="middle"
        fontSize="6" fill={DIM_COLOR}>44,Algu Nagar, Kalapatti Main Road, Saravanampatti</text>
      <text x={cols[3] + colWidths[3] / 2} y={midY + 28} textAnchor="middle"
        fontSize="6" fill={DIM_COLOR}>Coimbatore-641 035, Tamilnadu, Ph: +91 9444053074</text>

      {/* Col 5-6 top: Design/Drawn/Date */}
      <text x={cols[4] + 4} y={y + 12} fontSize="7" fill={DIM_COLOR} fontWeight="bold">DESIGN BY :</text>
      <text x={cols[5] + 4} y={y + 12} fontSize="7" fill={DIM_COLOR} fontWeight="bold">SCALE & SHEET SIZE :</text>
      <text x={cols[4] + colWidths[4] / 2} y={y + 24} textAnchor="middle" fontSize="9" fill={LINE} fontWeight="bold">KS</text>
      <text x={cols[5] + colWidths[5] / 2} y={y + 24} textAnchor="middle" fontSize="8" fill={LINE} fontWeight="bold">NTS & A2</text>

      <text x={cols[4] + 4} y={splitY + 10} fontSize="7" fill={DIM_COLOR} fontWeight="bold">DRAWN BY :</text>
      <text x={cols[5] + 4} y={splitY + 10} fontSize="7" fill={DIM_COLOR} fontWeight="bold">PROJECT NO :</text>
      <text x={cols[4] + colWidths[4] / 2} y={splitY + 22} textAnchor="middle" fontSize="9" fill={LINE} fontWeight="bold">PS</text>
      <text x={cols[5] + colWidths[5] / 2} y={splitY + 22} textAnchor="middle" fontSize="8" fill={LINE} fontWeight="bold">{projectNo || '—'}</text>

      {/* Bottom row */}
      {h > 75 && (
        <>
          <text x={cols[4] + 4} y={y + h - 12} fontSize="7" fill={DIM_COLOR} fontWeight="bold">DATE :</text>
          <text x={cols[4] + colWidths[4] / 2} y={y + h - 2} textAnchor="middle" fontSize="8" fill={LINE}>{today()}</text>
          <text x={cols[5] + 4} y={y + h - 12} fontSize="7" fill={DIM_COLOR} fontWeight="bold">DRAWING NO :</text>
          <text x={cols[5] + colWidths[5] / 2} y={y + h - 2} textAnchor="middle" fontSize="8" fill={LINE} fontWeight="bold">
            {drawingNo || `AR-01-${VIEW_DRG_PREFIX[viewKey] || 'XX'}-01`}
          </text>
        </>
      )}
    </g>
  )
}


/** North compass for plan views */
function NorthCompass({ cx, cy, r = 22 }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={LINE} strokeWidth="1" />
      <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke={LINE} strokeWidth="0.4" />
      {/* Arrow */}
      <polygon points={`${cx},${cy - r + 4} ${cx - 5},${cy + 4} ${cx},${cy - 2} ${cx + 5},${cy + 4}`}
        fill={LINE} stroke={LINE} strokeWidth="0.5" />
      <polygon points={`${cx},${cy + r - 4} ${cx - 5},${cy - 4} ${cx},${cy + 2} ${cx + 5},${cy - 4}`}
        fill="white" stroke={LINE} strokeWidth="0.5" />
      <text x={cx} y={cy - r - 4} textAnchor="middle" fontSize="11" fill={LINE} fontWeight="bold">N</text>
      {/* Crosshairs */}
      {['E', 'S', 'W'].map((d, i) => {
        const angle = (i + 1) * 90 * Math.PI / 180
        const tx = cx + Math.sin(angle) * (r + 10)
        const ty = cy - Math.cos(angle) * (r + 10)
        return <text key={d} x={tx} y={ty + 3} textAnchor="middle" fontSize="7" fill={DIM_COLOR}>{d}</text>
      })}
    </g>
  )
}


/* ═══════════════════════════════════════════
   DRAWING HELPERS
   ═══════════════════════════════════════════ */

function calcJoinery(L, W) {
  const windowsLong = Math.max(2, Math.floor(L / 20))
  const windowsShort = Math.max(1, Math.floor(W / 25))
  const totalWindows = (windowsLong + windowsShort) * 2
  const numRS = W >= 40 ? 2 : 1
  const numDoors = Math.max(2, Math.ceil((L + W) / 80))
  return {
    windows: { count: totalWindows, size: "6'0\" x 4'0\"" },
    rollingShutters: [
      { id: 'RS-1', count: 1, size: `${Math.min(22, Math.floor(W * 0.3))}'0\" x 16'0\"` },
      ...(numRS > 1 ? [{ id: 'RS-2', count: numRS - 1, size: "16'0\" x 16'0\"" }] : []),
    ],
    doors: { count: numDoors, size: "4'0\" x 7'0\"" },
  }
}


/* ═══════════════════════════════════════════
   DIMENSION SLIDER (mirrors 3D viewer control)
   ═══════════════════════════════════════════ */

function DimSlider({ label, icon: Icon, value, min, max, step = 1, unit = 'ft', onChange }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onChange(Math.max(min, value - step))}
            className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors">
            <Minus className="w-3 h-3" />
          </button>
          <input type="number" value={value} min={min} max={max} step={step}
            onChange={e => onChange(Math.max(min, Math.min(max, +e.target.value || min)))}
            className="w-16 text-center text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 tabular-nums" />
          <button onClick={() => onChange(Math.min(max, value + step))}
            className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors">
            <Plus className="w-3 h-3" />
          </button>
          <span className="text-[10px] text-slate-400 ml-0.5 w-4">{unit}</span>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        className="w-full h-1.5 rounded-full appearance-none bg-slate-200 dark:bg-slate-700 accent-[var(--brand-primary)] cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--brand-primary)]
          [&::-webkit-slider-thumb]:shadow-[0_2px_6px_-1px_var(--brand-primary)]" />
    </div>
  )
}


/* ═══════════════════════════════════════════
   PROMPT PARSER (mirrors 3D viewer)
   ═══════════════════════════════════════════ */

function parsePrompt(text, currentParams) {
  const p = { ...currentParams }
  const t = text.toLowerCase().trim()
  let changes = []

  const lenMatch = t.match(/(?:length|long)\s*(?:to|=|:)?\s*(\d+)/i) || t.match(/(\d+)\s*(?:ft|feet)?\s*(?:length|long)/i)
  if (lenMatch) { p.building_length = +lenMatch[1]; changes.push(`Length -> ${lenMatch[1]}ft`) }

  const widMatch = t.match(/(?:width|wide)\s*(?:to|=|:)?\s*(\d+)/i) || t.match(/(\d+)\s*(?:ft|feet)?\s*(?:width|wide)/i)
  if (widMatch) { p.building_width = +widMatch[1]; changes.push(`Width -> ${widMatch[1]}ft`) }

  const fhMatch = t.match(/(?:full\s*height|ridge\s*height|total\s*height|height)\s*(?:to|=|:)?\s*(\d+)/i) || t.match(/(\d+)\s*(?:ft|feet)?\s*(?:full|ridge|total)?\s*height/i)
  if (fhMatch) { p.full_height = +fhMatch[1]; changes.push(`Full Height -> ${fhMatch[1]}ft`) }

  const whMatch = t.match(/(?:wall\s*height|eave\s*height)\s*(?:to|=|:)?\s*(\d+)/i) || t.match(/(\d+)\s*(?:ft|feet)?\s*(?:wall|eave)\s*height/i)
  if (whMatch) { p.wall_height = +whMatch[1]; changes.push(`Wall Height -> ${whMatch[1]}ft`) }

  if (/gable|a[\s-]?type/.test(t)) { p.roof_type = 'gable'; changes.push('Roof -> Gable (A-Type)') }
  if (/mono\s*slope|single[\s-]?slope/.test(t)) { p.roof_type = 'single_slope'; changes.push('Roof -> Single Slope') }

  if (/puf\s*(?:panel|roof)/.test(t)) { p.roof_sheet_type = 'puf_panel_50mm'; changes.push('Roof -> PUF Panel') }
  if (/galvalume\s*roof|bare\s*roof/.test(t)) { p.roof_sheet_type = 'bare_galvalume_0.47mm'; changes.push('Roof -> Galvalume') }

  if (/puf\s*(?:clad|wall|side)/.test(t)) { p.side_cladding_type = 'puf_panel_50mm'; changes.push('Cladding -> PUF') }
  if (/galvalume\s*(?:clad|wall|side)|bare\s*(?:clad|wall|side)/.test(t)) { p.side_cladding_type = 'bare_colour_galvalume'; changes.push('Cladding -> Galvalume') }

  if (/add\s*mezz|enable\s*mezz|with\s*mezz|mezzanine\s*yes/.test(t)) {
    p.mezzanine_required = true
    if (!p.mezz_length || p.mezz_length <= 0) p.mezz_length = Math.round(p.building_length * 0.5)
    if (!p.mezz_width || p.mezz_width <= 0) p.mezz_width = Math.round(p.building_width * 0.8)
    changes.push(`Mezzanine ON (${p.mezz_length} x ${p.mezz_width}ft)`)
  }
  if (/remove\s*mezz|no\s*mezz|disable\s*mezz|mezzanine\s*no/.test(t)) {
    p.mezzanine_required = false; changes.push('Mezzanine OFF')
  }

  const mzlMatch = t.match(/mezz(?:anine)?\s*length\s*(?:to|=|:)?\s*(\d+)/i)
  if (mzlMatch) { p.mezz_length = +mzlMatch[1]; p.mezzanine_required = true; changes.push(`Mezz Length -> ${mzlMatch[1]}ft`) }
  const mzwMatch = t.match(/mezz(?:anine)?\s*width\s*(?:to|=|:)?\s*(\d+)/i)
  if (mzwMatch) { p.mezz_width = +mzwMatch[1]; p.mezzanine_required = true; changes.push(`Mezz Width -> ${mzwMatch[1]}ft`) }

  const incMatch = t.match(/(?:increase|bigger|larger|expand|grow)\s*(?:the\s*)?(?:building\s*)?(?:by\s*)?(\d+)?/i)
  if (incMatch && changes.length === 0) {
    const f = incMatch[1] ? +incMatch[1] / 100 : 0.2
    p.building_length = Math.round(p.building_length * (1 + f)); p.building_width = Math.round(p.building_width * (1 + f))
    changes.push(`Scaled up ${Math.round(f * 100)}%`)
  }
  const decMatch = t.match(/(?:decrease|smaller|shrink|reduce|compact)\s*(?:the\s*)?(?:building\s*)?(?:by\s*)?(\d+)?/i)
  if (decMatch && changes.length === 0) {
    const f = decMatch[1] ? +decMatch[1] / 100 : 0.2
    p.building_length = Math.max(20, Math.round(p.building_length * (1 - f))); p.building_width = Math.max(10, Math.round(p.building_width * (1 - f)))
    changes.push(`Scaled down ${Math.round(f * 100)}%`)
  }

  p.cladding_height = Math.max(0, p.full_height - p.wall_height)
  return { params: p, changes }
}


/* ═══════════════════════════════════════════
   CROSS SECTION VIEW
   ═══════════════════════════════════════════ */

function CrossSectionSheet({ params, projectName, clientName, clientLocation, projectNo }) {
  const W = +params.building_width || 60
  const Hf = +params.full_height || 30
  const Hw = +params.wall_height || 20
  const roofType = params.roof_type || 'gable'
  const hasMezz = !!params.mezzanine_required
  const mezzH = Hw * 0.5
  const roofIsPuf = (params.roof_sheet_type || '').includes('puf')
  const cladIsPuf = (params.side_cladding_type || '').includes('puf')
  const slope = roofType === 'gable' ? W / 2 / 10 : W / 10
  const ridgeH = Hf

  // Optional features (default on for industrial completeness)
  const showTurboVent = params.turbo_vent !== false
  const showRidgeMonitor = !!params.ridge_monitor
  const showLightSheets = params.light_sheets !== false
  const showCraneRail = !!params.crane_required
  const showLouvers = params.louvers !== false
  const showShutter = params.shutter_in_section !== false
  const craneH = Math.min(Hw * 0.65, +params.crane_height || Hw * 0.6)

  // Scaling: fit within 900px wide x 550px tall drawing area
  const drawW = 750, drawH = 520
  const s = Math.min(drawW / W, drawH / Hf) * 0.75

  // Origin: ground level center
  const cx = 700, gy = 720 // ground y
  const leftX = cx - (W * s) / 2
  const rightX = cx + (W * s) / 2
  const eaveY = gy - Hw * s
  const ridgeY = gy - ridgeH * s
  const fflY = gy - 3
  const foundH = 25 // foundation depth in px
  const pedW = 18, pedH = foundH
  const colW = 8

  // Cladding zone: from eaveY to wall masonry top
  const masonryH = Math.min(Hw * 0.25, 5) * s
  const masonryTop = gy - masonryH
  const cladBot = masonryTop

  // Label positions (right side)
  const labelX = rightX + 100
  const labels = []
  let labelY = ridgeY - 10

  // Helper: position on roof slope at fraction t (0=left eave, 1=right eave for gable, ridge at 0.5)
  const roofPt = (t) => {
    if (roofType === 'gable') {
      if (t <= 0.5) return { px: leftX + t * 2 * (cx - leftX), py: eaveY + t * 2 * (ridgeY - eaveY) }
      return { px: cx + (t - 0.5) * 2 * (rightX - cx), py: ridgeY + (t - 0.5) * 2 * (eaveY - ridgeY) }
    }
    return { px: leftX + t * (rightX - leftX), py: ridgeY + t * (eaveY - ridgeY) }
  }

  return (
    <svg viewBox="0 0 1400 960" className="w-full" style={{ background: 'white' }}>
      <SvgDefs />
      {/* Sheet border */}
      <rect x="15" y="15" width="1370" height="930" fill="none" stroke={LINE} strokeWidth="2" />
      <rect x="20" y="20" width="1360" height="920" fill="none" stroke={LINE} strokeWidth="0.5" />

      {/* ── Ground & Foundation ── */}
      <rect x={leftX - 30} y={gy} width={W * s + 60} height={foundH + 15} fill="url(#groundHatch)" />
      <line x1={leftX - 50} y1={gy} x2={rightX + 50} y2={gy} stroke={LINE} strokeWidth="1.5" />
      {/* Ground hatching lines below */}
      {Array.from({ length: 30 }).map((_, i) => (
        <line key={i} x1={leftX - 30 + i * 15} y1={gy + 1} x2={leftX - 30 + i * 15 - 8} y2={gy + 10}
          stroke="#8d6e63" strokeWidth="0.5" />
      ))}

      {/* RCC Pedestals */}
      <rect x={leftX - pedW / 2} y={gy} width={pedW} height={pedH} fill="url(#concHatch)" stroke={LINE} strokeWidth="1" />
      <rect x={rightX - pedW / 2} y={gy} width={pedW} height={pedH} fill="url(#concHatch)" stroke={LINE} strokeWidth="1" />

      {/* FFL & NGL markers */}
      <LevelMark x1={leftX - 60} x2={leftX - 8} y={fflY} label="FFL" />
      <LevelMark x1={leftX - 60} x2={leftX - 8} y={gy} label="NGL" />

      {/* ── Masonry Walls ── */}
      <rect x={leftX - colW / 2 - 2} y={cladBot} width={colW + 4} height={gy - cladBot}
        fill="url(#brickPat)" stroke={LINE} strokeWidth="0.6" />
      <rect x={rightX - colW / 2 - 2} y={cladBot} width={colW + 4} height={gy - cladBot}
        fill="url(#brickPat)" stroke={LINE} strokeWidth="0.6" />

      {/* ── Steel Columns ── */}
      <rect x={leftX - colW / 2} y={eaveY} width={colW} height={gy - eaveY}
        fill="white" stroke={STEEL_COL} strokeWidth="1.5" />
      <rect x={rightX - colW / 2} y={eaveY} width={colW} height={gy - eaveY}
        fill="white" stroke={STEEL_COL} strokeWidth="1.5" />
      {/* Column cross lines (I-beam representation) */}
      {[0.25, 0.5, 0.75].map(f => (
        <g key={f}>
          <line x1={leftX - colW / 2} y1={eaveY + (gy - eaveY) * f} x2={leftX + colW / 2} y2={eaveY + (gy - eaveY) * f}
            stroke={STEEL_COL} strokeWidth="0.5" />
          <line x1={rightX - colW / 2} y1={eaveY + (gy - eaveY) * f} x2={rightX + colW / 2} y2={eaveY + (gy - eaveY) * f}
            stroke={STEEL_COL} strokeWidth="0.5" />
        </g>
      ))}

      {/* ── Side Cladding ── */}
      <rect x={leftX - colW / 2 - 3} y={eaveY} width={3} height={cladBot - eaveY}
        fill={cladIsPuf ? '#bbdefb' : '#cfd8dc'} stroke={CLAD_COL} strokeWidth="0.8" />
      <rect x={rightX + colW / 2} y={eaveY} width={3} height={cladBot - eaveY}
        fill={cladIsPuf ? '#bbdefb' : '#cfd8dc'} stroke={CLAD_COL} strokeWidth="0.8" />
      {/* Cladding rails */}
      {[0.2, 0.4, 0.6, 0.8].map(f => {
        const cy = eaveY + (cladBot - eaveY) * f
        return (
          <g key={f}>
            <line x1={leftX - colW / 2 - 5} y1={cy} x2={leftX - colW / 2} y2={cy} stroke={LINE_THIN} strokeWidth="0.6" />
            <rect x={leftX - colW / 2 - 6} y={cy - 1.5} width="2" height="3" fill={LINE_THIN} />
            <line x1={rightX + colW / 2} y1={cy} x2={rightX + colW / 2 + 5} y2={cy} stroke={LINE_THIN} strokeWidth="0.6" />
            <rect x={rightX + colW / 2 + 4} y={cy - 1.5} width="2" height="3" fill={LINE_THIN} />
          </g>
        )
      })}

      {/* ── Eave Beam ── */}
      <line x1={leftX} y1={eaveY} x2={rightX} y2={eaveY} stroke={RAFTER_COL} strokeWidth="1.5" />

      {/* ── Rafters ── */}
      {roofType === 'gable' ? (
        <>
          {/* Left rafter */}
          <line x1={leftX} y1={eaveY} x2={cx} y2={ridgeY} stroke={RAFTER_COL} strokeWidth="2.5" />
          {/* Right rafter */}
          <line x1={rightX} y1={eaveY} x2={cx} y2={ridgeY} stroke={RAFTER_COL} strokeWidth="2.5" />
          {/* Roof sheet outline (slightly above rafters) */}
          <line x1={leftX - 12} y1={eaveY + 2} x2={cx} y2={ridgeY - 6} stroke={ROOF_COL} strokeWidth="1.5" />
          <line x1={cx} y1={ridgeY - 6} x2={rightX + 12} y2={eaveY + 2} stroke={ROOF_COL} strokeWidth="1.5" />
          {/* Roof sheet fill */}
          <polygon
            points={`${leftX - 12},${eaveY + 2} ${cx},${ridgeY - 6} ${rightX + 12},${eaveY + 2}
                     ${rightX + 12},${eaveY - 2} ${cx},${ridgeY - 10} ${leftX - 12},${eaveY - 2}`}
            fill={roofIsPuf ? '#e3f2fd' : '#fff3e0'} stroke="none" opacity="0.7" />
          {/* Ridge cap */}
          <rect x={cx - 6} y={ridgeY - 12} width="12" height="6" rx="2" fill={GUTTER_COL} stroke={LINE} strokeWidth="0.5" />
          {/* Slope annotation */}
          <g transform={`translate(${cx - (W * s) / 4}, ${(eaveY + ridgeY) / 2 - 15})`}>
            <text textAnchor="middle" fontSize="9" fill={DIM_COLOR} fontWeight="bold"
              transform="rotate(-12)">1 in 10</text>
          </g>
          <g transform={`translate(${cx + (W * s) / 4}, ${(eaveY + ridgeY) / 2 - 15})`}>
            <text textAnchor="middle" fontSize="9" fill={DIM_COLOR} fontWeight="bold"
              transform="rotate(12)">1 in 10</text>
          </g>
        </>
      ) : (
        <>
          <line x1={leftX} y1={ridgeY} x2={rightX} y2={eaveY} stroke={RAFTER_COL} strokeWidth="2.5" />
          <line x1={leftX - 12} y1={ridgeY - 4} x2={rightX + 12} y2={eaveY + 2} stroke={ROOF_COL} strokeWidth="1.5" />
          <polygon
            points={`${leftX - 12},${ridgeY - 4} ${rightX + 12},${eaveY + 2}
                     ${rightX + 12},${eaveY - 2} ${leftX - 12},${ridgeY - 8}`}
            fill={roofIsPuf ? '#e3f2fd' : '#fff3e0'} stroke="none" opacity="0.7" />
          <g transform={`translate(${cx}, ${(eaveY + ridgeY) / 2 - 15})`}>
            <text textAnchor="middle" fontSize="9" fill={DIM_COLOR} fontWeight="bold"
              transform="rotate(6)">1 in 10</text>
          </g>
        </>
      )}

      {/* ── Purlins (small circles on rafter) ── */}
      {Array.from({ length: Math.ceil(W / 6) + 1 }).map((_, i) => {
        const t = i / Math.ceil(W / 6)
        let py, px
        if (roofType === 'gable') {
          if (t <= 0.5) {
            px = leftX + t * 2 * (cx - leftX)
            py = eaveY + t * 2 * (ridgeY - eaveY)
          } else {
            px = cx + (t - 0.5) * 2 * (rightX - cx)
            py = ridgeY + (t - 0.5) * 2 * (eaveY - ridgeY)
          }
        } else {
          px = leftX + t * (rightX - leftX)
          py = ridgeY + t * (eaveY - ridgeY)
        }
        return (
          <circle key={i} cx={px} cy={py - 4} r="2.5" fill={PURLIN_COL} stroke="white" strokeWidth="0.5" />
        )
      })}

      {/* ── Gutters ── */}
      <g>
        {/* Left gutter */}
        <path d={`M ${leftX - 14} ${eaveY + 2} L ${leftX - 14} ${eaveY + 10} L ${leftX - 6} ${eaveY + 10} L ${leftX - 6} ${eaveY + 4}`}
          fill="none" stroke={GUTTER_COL} strokeWidth="1.2" />
        {/* Right gutter */}
        <path d={`M ${rightX + 14} ${eaveY + 2} L ${rightX + 14} ${eaveY + 10} L ${rightX + 6} ${eaveY + 10} L ${rightX + 6} ${eaveY + 4}`}
          fill="none" stroke={GUTTER_COL} strokeWidth="1.2" />
      </g>

      {/* ── Downtake Pipes ── */}
      <line x1={rightX + 10} y1={eaveY + 10} x2={rightX + 10} y2={gy} stroke={CLAD_COL} strokeWidth="1.5" />
      <circle cx={rightX + 10} cy={eaveY + 10} r="2" fill={CLAD_COL} />

      {/* ── Mezzanine ── */}
      {hasMezz && (
        <g>
          <line x1={leftX + colW} y1={gy - mezzH * s} x2={rightX - colW} y2={gy - mezzH * s}
            stroke={MEZZ_COL} strokeWidth="2" strokeDasharray="8,4" />
          <rect x={leftX + colW} y={gy - mezzH * s - 3} width={(rightX - leftX) * 0.5} height="6"
            fill="#c8e6c9" stroke={MEZZ_COL} strokeWidth="0.8" />
          <text x={leftX + colW + 10} y={gy - mezzH * s - 8} fontSize="8" fill={MEZZ_COL} fontWeight="bold">DECK SLAB</text>
        </g>
      )}

      {/* ── Crane Rail (gantry crane) ── */}
      {showCraneRail && (() => {
        const rY = gy - craneH * s
        const bracketW = 14
        return (
          <g>
            {/* Crane corbel brackets on columns */}
            <polygon points={`${leftX + colW / 2},${rY} ${leftX + colW / 2 + bracketW},${rY} ${leftX + colW / 2},${rY + 14}`}
              fill="#fff3e0" stroke={STEEL_COL} strokeWidth="0.8" />
            <polygon points={`${rightX - colW / 2},${rY} ${rightX - colW / 2 - bracketW},${rY} ${rightX - colW / 2},${rY + 14}`}
              fill="#fff3e0" stroke={STEEL_COL} strokeWidth="0.8" />
            {/* Crane rail (I-beam representation) */}
            <rect x={leftX + colW / 2 + bracketW - 2} y={rY - 4} width={(rightX - leftX) - 2 * (colW / 2 + bracketW - 2)}
              height="8" fill="#fff8e1" stroke={STEEL_COL} strokeWidth="1" />
            <line x1={leftX + colW / 2 + bracketW} y1={rY} x2={rightX - colW / 2 - bracketW} y2={rY}
              stroke={STEEL_COL} strokeWidth="0.5" />
            {/* Crane hook/trolley indicator */}
            <g transform={`translate(${cx - 12}, ${rY + 6})`}>
              <rect x="0" y="0" width="24" height="6" fill="#ffe0b2" stroke={STEEL_COL} strokeWidth="0.6" />
              <line x1="12" y1="6" x2="12" y2="18" stroke={STEEL_COL} strokeWidth="0.8" />
              <path d="M 9 18 Q 12 22 15 18" fill="none" stroke={STEEL_COL} strokeWidth="0.8" />
            </g>
            <text x={cx} y={rY - 8} textAnchor="middle" fontSize="7" fill={STEEL_COL} fontWeight="bold">EOT CRANE — {params.crane_capacity || '5'}T</text>
          </g>
        )
      })()}

      {/* ── Louvers (upper wall, near eave) ── */}
      {showLouvers && (() => {
        const lvW = 24, lvH = 18
        const lvY = eaveY + 8
        return (
          <g>
            {/* Right wall louver */}
            <rect x={rightX + 0.5} y={lvY} width={lvW * 0.4} height={lvH}
              fill="white" stroke={LINE} strokeWidth="0.6" />
            {Array.from({ length: 5 }).map((_, i) => (
              <line key={i} x1={rightX + 1} y1={lvY + 2 + i * 3.2} x2={rightX + lvW * 0.4 - 1} y2={lvY + 4 + i * 3.2}
                stroke={DIM_COLOR} strokeWidth="0.5" />
            ))}
            {/* Left wall louver */}
            <rect x={leftX - lvW * 0.4 - 0.5} y={lvY} width={lvW * 0.4} height={lvH}
              fill="white" stroke={LINE} strokeWidth="0.6" />
            {Array.from({ length: 5 }).map((_, i) => (
              <line key={`l${i}`} x1={leftX - lvW * 0.4} y1={lvY + 2 + i * 3.2} x2={leftX - 1} y2={lvY + 4 + i * 3.2}
                stroke={DIM_COLOR} strokeWidth="0.5" />
            ))}
          </g>
        )
      })()}

      {/* ── Shutter cut view in section (right wall) ── */}
      {showShutter && (
        <g>
          {/* Shutter box at eave */}
          <rect x={rightX - colW / 2 - 8} y={eaveY + (cladBot - eaveY) * 0.4 - 6}
            width="14" height="12" fill="#eceff1" stroke={LINE} strokeWidth="0.6" />
          {/* Shutter curtain (rolled-down representation, dashed) */}
          <line x1={rightX - colW / 2 - 1} y1={eaveY + (cladBot - eaveY) * 0.4 + 6}
            x2={rightX - colW / 2 - 1} y2={gy} stroke={LINE_THIN} strokeWidth="0.8" strokeDasharray="2,2" />
        </g>
      )}

      {/* ── Light Sheets (translucent panels on roof) ── */}
      {showLightSheets && (() => {
        // 2 light sheet panels per slope
        const positions = roofType === 'gable' ? [0.18, 0.32, 0.68, 0.82] : [0.2, 0.4, 0.6, 0.8]
        return (
          <g>
            {positions.map((t, i) => {
              const a = roofPt(Math.max(0.02, t - 0.04))
              const b = roofPt(Math.min(0.98, t + 0.04))
              return (
                <g key={i}>
                  <line x1={a.px} y1={a.py - 3} x2={b.px} y2={b.py - 3}
                    stroke="#42a5f5" strokeWidth="3.5" opacity="0.6" />
                  <line x1={a.px} y1={a.py - 3} x2={b.px} y2={b.py - 3}
                    stroke="#1976d2" strokeWidth="0.8" strokeDasharray="2,2" />
                </g>
              )
            })}
          </g>
        )
      })()}

      {/* ── Turbo Ventilators (rooftop spinners on ridge) ── */}
      {showTurboVent && (() => {
        const ventCount = roofType === 'gable' ? 3 : 2
        return (
          <g>
            {Array.from({ length: ventCount }).map((_, i) => {
              const t = roofType === 'gable'
                ? 0.5  // all on ridge for gable
                : 0.15 + i * (0.7 / Math.max(1, ventCount - 1))
              const offset = roofType === 'gable' ? (i - (ventCount - 1) / 2) * 30 : 0
              const pt = roofPt(t)
              const vx = pt.px + offset
              const vy = pt.py - 14
              return (
                <g key={i}>
                  {/* Throat cylinder */}
                  <rect x={vx - 5} y={vy} width="10" height="8" fill="white" stroke={LINE} strokeWidth="0.7" />
                  {/* Spinning dome (trapezoid + curved top) */}
                  <path d={`M ${vx - 7} ${vy} Q ${vx - 7} ${vy - 8} ${vx} ${vy - 12} Q ${vx + 7} ${vy - 8} ${vx + 7} ${vy}`}
                    fill="#cfd8dc" stroke={LINE} strokeWidth="0.7" />
                  {/* Vent fins */}
                  {[-3, 0, 3].map((d, k) => (
                    <line key={k} x1={vx + d} y1={vy - 2} x2={vx + d - 1.5} y2={vy - 9}
                      stroke={LINE} strokeWidth="0.5" />
                  ))}
                  {/* Arrow indicating air outflow */}
                  <line x1={vx} y1={vy - 14} x2={vx} y2={vy - 22} stroke="#1976d2" strokeWidth="0.6"
                    markerEnd="url(#dimArrowR)" />
                </g>
              )
            })}
          </g>
        )
      })()}

      {/* ── Ridge Monitor (clerestory raised structure) ── */}
      {showRidgeMonitor && roofType === 'gable' && (() => {
        const rmW = Math.min((rightX - leftX) * 0.32, 90)
        const rmH = 22
        const rmTop = ridgeY - rmH - 4
        return (
          <g>
            {/* Side walls of monitor */}
            <rect x={cx - rmW / 2} y={rmTop} width={rmW} height={rmH}
              fill="white" stroke={LINE} strokeWidth="1" />
            {/* Mini gable cap above */}
            <polygon points={`${cx - rmW / 2 - 5},${rmTop} ${cx},${rmTop - 14} ${cx + rmW / 2 + 5},${rmTop}`}
              fill={roofIsPuf ? '#e3f2fd' : '#fff8e1'} stroke={LINE} strokeWidth="1" />
            <polygon points={`${cx - rmW / 2 - 7},${rmTop + 2} ${cx},${rmTop - 16} ${cx + rmW / 2 + 7},${rmTop + 2}`}
              fill="none" stroke={ROOF_COL} strokeWidth="1" />
            {/* Louvered side openings */}
            {[0, 1, 2, 3].map(i => (
              <line key={i} x1={cx - rmW / 2 + 3} y1={rmTop + 4 + i * 4}
                x2={cx + rmW / 2 - 3} y2={rmTop + 4 + i * 4}
                stroke={DIM_COLOR} strokeWidth="0.5" />
            ))}
          </g>
        )
      })()}

      {/* ── Detail Callouts (eave, ridge, foundation) ── */}
      <DetailCallout x={rightX + 30} y={eaveY + 18} tag="A" sheet="EAVE"
        leaderTo={{ x: rightX + 4, y: eaveY + 6 }} />
      {roofType === 'gable' && (
        <DetailCallout x={cx + 70} y={ridgeY - 30} tag="B" sheet="RIDGE"
          leaderTo={{ x: cx + 4, y: ridgeY - 4 }} />
      )}
      <DetailCallout x={leftX - 60} y={gy + foundH / 2} tag="C" sheet="FDN"
        leaderTo={{ x: leftX - pedW / 2 - 2, y: gy + foundH / 2 }} />

      {/* ── Eave Height Dimension ── */}
      <DimV y1={gy} y2={eaveY} x={leftX - 45} label={`${Hw}'`} fontSize={11} />
      {/* Full Height (left edge) */}
      {Hf !== Hw && (
        <DimV y1={gy} y2={ridgeY} x={leftX - 80} label={`${Hf}'`} fontSize={11} />
      )}
      {/* Eave height label */}
      <text x={leftX - 20} y={eaveY - 4} textAnchor="end" fontSize="9" fill={STEEL_COL} fontWeight="bold">EAVE HEIGHT</text>

      {/* ── Width Dimension ── */}
      <DimH x1={leftX} x2={rightX} y={gy + foundH + 25} label={fmtDim(W)} fontSize={12} />

      {/* ── Right Side Labels ── */}
      <Leader x1={cx + 20} y1={ridgeY - 7} x2={labelX} y2={ridgeY - 30} label="ROOFING SHEET" />
      <Leader x1={cx - 30} y1={ridgeY + 5} x2={labelX - 80} y2={ridgeY - 10} label="PURLIN" />
      <Leader x1={rightX + 12} y1={eaveY + 6} x2={labelX} y2={eaveY + 10} label="GUTTER" />
      <Leader x1={rightX + 3} y1={(eaveY + cladBot) / 2} x2={labelX} y2={eaveY + 95} label="CLADDING SHEET" />
      <Leader x1={rightX + 10} y1={eaveY + 30} x2={labelX} y2={eaveY + 115} label="DOWNTAKE PIPE" />
      <Leader x1={rightX + colW / 2 + 5} y1={(eaveY + cladBot) / 2 + 15} x2={labelX} y2={eaveY + 135} label="CLADDING RAIL" />
      <Leader x1={rightX} y1={gy - (gy - eaveY) * 0.3} x2={labelX} y2={gy - 40} label="STEEL COLUMN" />
      <Leader x1={rightX} y1={gy + pedH / 2} x2={labelX} y2={gy + 15} label="RCC PEDESTAL" />
      {/* Optional component labels */}
      {showTurboVent && (
        <Leader x1={cx + 6} y1={(roofType === 'gable' ? ridgeY : (ridgeY + eaveY) / 2) - 22}
          x2={labelX} y2={ridgeY - 56} label="TURBO VENTILATOR" />
      )}
      {showRidgeMonitor && roofType === 'gable' && (
        <Leader x1={cx - 30} y1={ridgeY - 18} x2={labelX - 100} y2={ridgeY - 80} label="RIDGE MONITOR" />
      )}
      {showLightSheets && (
        <Leader x1={roofPt(0.7).px - 6} y1={roofPt(0.7).py - 6} x2={labelX} y2={eaveY + 55} label="LIGHT SHEET" />
      )}
      {showCraneRail && (
        <Leader x1={cx + 14} y1={gy - craneH * s} x2={labelX} y2={eaveY + 75} label="CRANE RAIL (EOT)" />
      )}
      {showLouvers && (
        <Leader x1={rightX + 8} y1={eaveY + 16} x2={labelX} y2={eaveY + 35} label="LOUVERS" />
      )}
      {showShutter && (
        <Leader x1={rightX - colW / 2 - 4} y1={eaveY + (cladBot - eaveY) * 0.4 + 6}
          x2={labelX - 60} y2={gy - 60} label="ROLLING SHUTTER" />
      )}

      {/* ── Drawing Title ── */}
      <text x={cx} y={gy + foundH + 60} textAnchor="middle" fontSize="14" fill={LINE} fontWeight="bold"
        textDecoration="underline">TYPICAL CROSS SECTION</text>

      {/* ── Area Details box ── */}
      <g>
        <rect x="1080" y="770" width="270" height="50" fill="white" stroke={LINE} strokeWidth="0.8" />
        <text x="1090" y="785" fontSize="9" fill={LINE} fontWeight="bold" textDecoration="underline">AREA DETAILS:</text>
        <text x="1090" y="802" fontSize="8" fill={DIM_COLOR}>
          ROOF FRAME AREA{'\u00A0\u00A0'}-{'\u00A0\u00A0'}{fmtArea(params.building_length * params.building_width)}
        </text>
        {hasMezz && (
          <text x="1090" y="814" fontSize="8" fill={DIM_COLOR}>
            MEZZANINE AREA{'\u00A0\u00A0'}-{'\u00A0\u00A0'}{fmtArea((+params.mezz_length || 0) * (+params.mezz_width || 0))}
          </text>
        )}
      </g>

      {/* ── Notes ── */}
      <g>
        <text x="1100" y="55" fontSize="8" fill={LINE} fontWeight="bold" textDecoration="underline">NOTES:</text>
        <text x="1100" y="70" fontSize="7" fill={DIM_COLOR}>1. ALL DIMENSIONS ARE IN FEET & INCHES.</text>
        <text x="1100" y="82" fontSize="7" fill={DIM_COLOR}>2. NOT TO SCALE (NTS).</text>
        <text x="1100" y="94" fontSize="7" fill={DIM_COLOR}>3. ROOF SLOPE : 1 IN 10.</text>
      </g>

      {/* ── Title Block ── */}
      <TitleBlock
        x={20} y={850} w={1360} h={85}
        drawingTitle="CROSS SECTIONS"
        projectName={projectName}
        clientName={clientName}
        clientLocation={clientLocation}
        projectNo={projectNo}
        viewKey="cross_section"
      />
    </svg>
  )
}


/* ═══════════════════════════════════════════
   ARCHITECTURAL PLAN VIEW
   ═══════════════════════════════════════════ */

function ArchPlanSheet({ params, projectName, clientName, clientLocation, projectNo }) {
  const L = +params.building_length || 100
  const W = +params.building_width || 60
  const hasMezz = !!params.mezzanine_required
  const mL = +params.mezz_length || Math.round(L * 0.5)
  const mW = +params.mezz_width || Math.round(W * 0.8)

  // Scale to fit in drawing area (~900 x 650)
  const s = Math.min(850 / L, 600 / W) * 0.8

  // Origin: top-left of building
  const ox = 150, oy = 100
  const bw = L * s, bh = W * s

  // Column grid
  const baySpacing = Math.min(25, L / Math.max(2, Math.ceil(L / 25)))
  const numBays = Math.ceil(L / baySpacing)
  const colPositions = Array.from({ length: numBays + 1 }, (_, i) => i * (L / numBays))

  const joinery = calcJoinery(L, W)

  // Window positions along long sides
  const wLong = Math.max(2, Math.floor(L / 20))
  const wShort = Math.max(1, Math.floor(W / 25))
  const windowSize = 8

  return (
    <svg viewBox="0 0 1400 960" className="w-full" style={{ background: 'white' }}>
      <SvgDefs />
      <rect x="15" y="15" width="1370" height="930" fill="none" stroke={LINE} strokeWidth="2" />
      <rect x="20" y="20" width="1360" height="920" fill="none" stroke={LINE} strokeWidth="0.5" />

      {/* ── Building Outline ── */}
      <rect x={ox} y={oy} width={bw} height={bh} fill="white" stroke={LINE} strokeWidth="2" />
      {/* Inner wall line (double line) */}
      <rect x={ox + 3} y={oy + 3} width={bw - 6} height={bh - 6} fill="none" stroke={LINE} strokeWidth="0.5" />

      {/* ── Column Grid (dashed) ── */}
      {colPositions.map((pos, i) => {
        const x = ox + pos * s
        return (
          <g key={`col-${i}`}>
            <line x1={x} y1={oy - 15} x2={x} y2={oy + bh + 15}
              stroke="#e53935" strokeWidth="0.5" strokeDasharray="6,4" />
            {/* Grid label */}
            <circle cx={x} cy={oy - 22} r="8" fill="none" stroke="#e53935" strokeWidth="0.6" />
            <text x={x} y={oy - 19} textAnchor="middle" fontSize="8" fill="#e53935" fontWeight="bold">
              {String.fromCharCode(65 + i)}
            </text>
          </g>
        )
      })}
      {/* Transverse grid lines */}
      <line x1={ox - 15} y1={oy} x2={ox + bw + 15} y2={oy} stroke="#e53935" strokeWidth="0.5" strokeDasharray="6,4" />
      <line x1={ox - 15} y1={oy + bh} x2={ox + bw + 15} y2={oy + bh} stroke="#e53935" strokeWidth="0.5" strokeDasharray="6,4" />
      <circle cx={ox - 22} cy={oy} r="8" fill="none" stroke="#e53935" strokeWidth="0.6" />
      <text x={ox - 22} y={oy + 3} textAnchor="middle" fontSize="8" fill="#e53935" fontWeight="bold">1</text>
      <circle cx={ox - 22} cy={oy + bh} r="8" fill="none" stroke="#e53935" strokeWidth="0.6" />
      <text x={ox - 22} y={oy + bh + 3} textAnchor="middle" fontSize="8" fill="#e53935" fontWeight="bold">2</text>

      {/* ── Column Pedestals ── */}
      {colPositions.map((pos, ci) => {
        const x = ox + pos * s
        return (
          <g key={`ped-${ci}`}>
            {/* Bottom row */}
            <rect x={x - 5} y={oy - 5} width="10" height="10" fill="#ffcdd2" stroke="#e53935" strokeWidth="0.8" />
            <rect x={x - 5} y={oy + bh - 5} width="10" height="10" fill="#ffcdd2" stroke="#e53935" strokeWidth="0.8" />
          </g>
        )
      })}

      {/* ── Windows (W) along long sides ── */}
      {Array.from({ length: wLong }).map((_, i) => {
        const x = ox + ((i + 1) / (wLong + 1)) * bw
        return (
          <g key={`wt-${i}`}>
            {/* Top wall */}
            <rect x={x - windowSize / 2} y={oy - 1} width={windowSize} height="4" fill="white" stroke={CLAD_COL} strokeWidth="0.8" />
            <text x={x} y={oy - 5} textAnchor="middle" fontSize="7" fill={LINE} fontWeight="bold">W</text>
            {/* Bottom wall */}
            <rect x={x - windowSize / 2} y={oy + bh - 3} width={windowSize} height="4" fill="white" stroke={CLAD_COL} strokeWidth="0.8" />
            <text x={x} y={oy + bh + 12} textAnchor="middle" fontSize="7" fill={LINE} fontWeight="bold">W</text>
          </g>
        )
      })}

      {/* ── Windows (W) along short sides ── */}
      {Array.from({ length: wShort }).map((_, i) => {
        const y = oy + ((i + 1) / (wShort + 1)) * bh
        return (
          <g key={`ws-${i}`}>
            {/* Left wall */}
            <rect x={ox - 1} y={y - windowSize / 2} width="4" height={windowSize} fill="white" stroke={CLAD_COL} strokeWidth="0.8" />
            <text x={ox - 8} y={y + 3} textAnchor="middle" fontSize="7" fill={LINE} fontWeight="bold">W</text>
            {/* Right wall */}
            <rect x={ox + bw - 3} y={y - windowSize / 2} width="4" height={windowSize} fill="white" stroke={CLAD_COL} strokeWidth="0.8" />
            <text x={ox + bw + 8} y={y + 3} textAnchor="middle" fontSize="7" fill={LINE} fontWeight="bold">W</text>
          </g>
        )
      })}

      {/* ── Rolling Shutter (bottom wall center) ── */}
      {(() => {
        const rsW = Math.min(bw * 0.2, 60)
        const rsX = ox + bw / 2 - rsW / 2
        return (
          <g>
            <rect x={rsX} y={oy + bh - 3} width={rsW} height="6" fill="#bbdefb" stroke={CLAD_COL} strokeWidth="1.2" />
            <text x={rsX + rsW / 2} y={oy + bh + 16} textAnchor="middle" fontSize="7" fill={LINE} fontWeight="bold">RS</text>
          </g>
        )
      })()}

      {/* ── Door (D) left wall ── */}
      <g>
        <rect x={ox - 1} y={oy + bh - 20} width="4" height="14" fill="#fff9c4" stroke={LINE} strokeWidth="0.8" />
        <text x={ox - 8} y={oy + bh - 11} textAnchor="middle" fontSize="7" fill={LINE} fontWeight="bold">D</text>
        {/* Door swing arc */}
        <path d={`M ${ox + 3} ${oy + bh - 20} A 14 14 0 0 1 ${ox + 17} ${oy + bh - 6}`}
          fill="none" stroke={LINE} strokeWidth="0.4" strokeDasharray="2,2" />
      </g>

      {/* ── Mezzanine (if enabled) ── */}
      {hasMezz && (
        <g>
          <rect x={ox + 3} y={oy + 3} width={mL * s} height={mW * s}
            fill="none" stroke={MEZZ_COL} strokeWidth="1.5" strokeDasharray="10,5" />
          <text x={ox + mL * s / 2} y={oy + mW * s / 2 - 6} textAnchor="middle"
            fontSize="10" fill={MEZZ_COL} fontWeight="bold">MEZZANINE ABOVE</text>
          <text x={ox + mL * s / 2} y={oy + mW * s / 2 + 8} textAnchor="middle"
            fontSize="9" fill={MEZZ_COL}>{mL}'0" x {mW}'0"</text>
          {/* Staircase indicator */}
          <g transform={`translate(${ox + mL * s + 10}, ${oy + mW * s / 2 - 15})`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <rect key={i} x={0} y={i * 5} width="15" height="4.5" fill="#e8f5e9" stroke={MEZZ_COL} strokeWidth="0.5" />
            ))}
            <text x="7.5" y="-4" textAnchor="middle" fontSize="6" fill={MEZZ_COL}>UP</text>
          </g>
        </g>
      )}

      {/* ── Working Area Label ── */}
      <text x={ox + bw / 2} y={oy + bh / 2 + (hasMezz ? bh * 0.2 : 0)} textAnchor="middle"
        fontSize="11" fill={LINE} fontWeight="bold">WORKING AREA</text>
      <text x={ox + bw / 2} y={oy + bh / 2 + 15 + (hasMezz ? bh * 0.2 : 0)} textAnchor="middle"
        fontSize="10" fill={LINE}>{L}'0" x {W}'0"</text>

      {/* ── Dimension Lines ── */}
      {/* Continuous bay dimension chain (length, top) */}
      {(() => {
        const bayPx = bw / numBays
        const bayFt = (L / numBays).toFixed(0)
        const segs = Array.from({ length: numBays }).map(() => ({ size: bayPx, label: `${bayFt}'` }))
        return (
          <BayDimChain x1={ox} x2={ox + bw} y={oy - 50}
            segments={segs} totalLabel={fmtDim(L)} fontSize={9} />
        )
      })()}

      {/* Width at left (single dim) */}
      <DimV y1={oy} y2={oy + bh} x={ox - 45} label={fmtDim(W)} fontSize={11} />

      {/* ── Section Cut Lines ── */}
      {/* A-A: longitudinal cut along centerline (horizontal across length) */}
      <SectionCutLine x1={ox - 30} y1={oy + bh / 2} x2={ox + bw + 30} y2={oy + bh / 2} label="A" />
      {/* B-B: transverse cut at mid-length (vertical across width) */}
      <SectionCutLine x1={ox + bw / 2} y1={oy - 30} x2={ox + bw / 2} y2={oy + bh + 30} label="B" />

      {/* ── Detail Callouts ── */}
      <DetailCallout x={ox + bw + 35} y={oy + bh + 35} tag="1" sheet="DETL"
        leaderTo={{ x: ox + bw - 6, y: oy + bh - 6 }} />

      {/* Roof slope arrows */}
      <g transform={`translate(${ox + bw + 50}, ${oy + bh / 2 + 70})`}>
        <text x="0" y="-8" fontSize="8" fill={DIM_COLOR} fontWeight="bold">SLOPE 1 IN 10</text>
        <line x1="0" y1="0" x2="40" y2="0" stroke={DIM_COLOR} strokeWidth="0.8"
          markerEnd="url(#dimArrowR)" />
      </g>

      {/* ── North Compass ── */}
      <NorthCompass cx={ox + bw + 100} cy={oy + 50} />

      {/* ── Drawing Title ── */}
      <text x={ox + bw / 2} y={oy + bh + 60} textAnchor="middle" fontSize="14" fill={LINE} fontWeight="bold"
        textDecoration="underline">ARCHITECTURAL PLAN</text>

      {/* ── Joinery Details ── */}
      <g>
        <rect x="1060" y="600" width="300" height="120" fill="white" stroke={LINE} strokeWidth="0.8" />
        <text x="1070" y="616" fontSize="9" fill={LINE} fontWeight="bold" textDecoration="underline">JOINARIES DETAILS:</text>
        <text x="1070" y="634" fontSize="8" fill={DIM_COLOR}>
          WINDOW W{'\u00A0\u00A0'}-{'\u00A0\u00A0'}{joinery.windows.count} Nos{'\u00A0\u00A0'}-{'\u00A0\u00A0'}{joinery.windows.size}
        </text>
        {joinery.rollingShutters.map((rs, i) => (
          <text key={i} x={1070} y={650 + i * 14} fontSize="8" fill={DIM_COLOR}>
            ROLLING SHUTTER {rs.id}{'\u00A0\u00A0'}-{'\u00A0\u00A0'}{rs.count} No{rs.count > 1 ? 's' : ''}{'\u00A0\u00A0'}-{'\u00A0\u00A0'}{rs.size}
          </text>
        ))}
        <text x={1070} y={650 + joinery.rollingShutters.length * 14} fontSize="8" fill={DIM_COLOR}>
          STEEL DOOR D{'\u00A0\u00A0'}-{'\u00A0\u00A0'}{joinery.doors.count} Nos{'\u00A0\u00A0'}-{'\u00A0\u00A0'}{joinery.doors.size}
        </text>
      </g>

      {/* ── Area Details ── */}
      <g>
        <rect x="1060" y="730" width="300" height={hasMezz ? 60 : 40} fill="white" stroke={LINE} strokeWidth="0.8" />
        <text x="1070" y="746" fontSize="9" fill={LINE} fontWeight="bold" textDecoration="underline">AREA DETAILS:</text>
        <text x="1070" y="762" fontSize="8" fill={DIM_COLOR}>
          WORKING AREA{'\u00A0\u00A0'}-{'\u00A0\u00A0'}{fmtArea(L * W)}
        </text>
        {hasMezz && (
          <text x="1070" y="778" fontSize="8" fill={DIM_COLOR}>
            MEZZANINE AREA{'\u00A0\u00A0'}-{'\u00A0\u00A0'}{fmtArea(mL * mW)}
          </text>
        )}
      </g>

      {/* ── Notes ── */}
      <g>
        <text x="1080" y="50" fontSize="8" fill={LINE} fontWeight="bold" textDecoration="underline">NOTES:</text>
        <text x="1080" y="65" fontSize="7" fill={DIM_COLOR}>1. ALL DIMENSIONS ARE IN FEET & INCHES.</text>
      </g>

      {/* ── Title Block ── */}
      <TitleBlock
        x={20} y={850} w={1360} h={85}
        drawingTitle="ARCH PLAN & SECTION"
        projectName={projectName}
        clientName={clientName}
        clientLocation={clientLocation}
        projectNo={projectNo}
        viewKey="plan"
      />
    </svg>
  )
}


/* ═══════════════════════════════════════════
   FOUNDATION PLAN VIEW
   ═══════════════════════════════════════════ */

function FoundationPlanSheet({ params, projectName, clientName, clientLocation, projectNo }) {
  const L = +params.building_length || 100
  const W = +params.building_width || 60

  // Same scale + origin as plan
  const s = Math.min(850 / L, 600 / W) * 0.8
  const ox = 150, oy = 110
  const bw = L * s, bh = W * s

  const baySpacing = Math.min(25, L / Math.max(2, Math.ceil(L / 25)))
  const numBays = Math.ceil(L / baySpacing)
  const bayLen = L / numBays
  const colXs = Array.from({ length: numBays + 1 }, (_, i) => ox + i * (bw / numBays))
  const rowYs = [oy, oy + bh] // 2 transverse rows for bays in width direction

  // Footing dimensions in feet (typical industrial pad footing)
  const isoF = { L: 6, W: 6, D: 4 } // F1 isolated footing 6x6x4 ft
  const cornerF = { L: 7, W: 7, D: 4.5 } // F2 corner footing slightly larger
  const fpx = isoF.L * s * 0.9 // visual size of footing in plan (px)
  const fcpx = cornerF.L * s * 0.9

  return (
    <svg viewBox="0 0 1400 960" className="w-full" style={{ background: 'white' }}>
      <SvgDefs />
      <rect x="15" y="15" width="1370" height="930" fill="none" stroke={LINE} strokeWidth="2" />
      <rect x="20" y="20" width="1360" height="920" fill="none" stroke={LINE} strokeWidth="0.5" />

      {/* ── Building outline (light dashed for reference) ── */}
      <rect x={ox} y={oy} width={bw} height={bh}
        fill="none" stroke={LINE_THIN} strokeWidth="0.6" strokeDasharray="6,4" />

      {/* ── Plinth Beam Grid (PB lines connecting footings) ── */}
      <g>
        {/* Long PB lines */}
        {rowYs.map((y, i) => (
          <line key={`pbh-${i}`} x1={ox} y1={y} x2={ox + bw} y2={y}
            stroke={FOUND_COL} strokeWidth="2.5" />
        ))}
        {/* Transverse PB lines (between paired columns) */}
        {colXs.map((x, i) => (
          <line key={`pbv-${i}`} x1={x} y1={oy} x2={x} y2={oy + bh}
            stroke={FOUND_COL} strokeWidth="2.5" />
        ))}
        {/* Plinth beam parallel doubled lines for thickness */}
        {rowYs.map((y, i) => (
          <g key={`pbht-${i}`}>
            <line x1={ox} y1={y - 3} x2={ox + bw} y2={y - 3} stroke={FOUND_COL} strokeWidth="0.6" />
            <line x1={ox} y1={y + 3} x2={ox + bw} y2={y + 3} stroke={FOUND_COL} strokeWidth="0.6" />
          </g>
        ))}
      </g>

      {/* ── Column Footings (F1 typical, F2 corners) ── */}
      {colXs.flatMap((x, ci) =>
        rowYs.map((y, ri) => {
          const isCorner = (ci === 0 || ci === colXs.length - 1) && (ri === 0 || ri === rowYs.length - 1)
          const px = isCorner ? fcpx : fpx
          const tag = isCorner ? 'F2' : 'F1'
          return (
            <g key={`f-${ci}-${ri}`}>
              {/* Outer footing pad */}
              <rect x={x - px / 2} y={y - px / 2} width={px} height={px}
                fill="url(#concHatch)" stroke={LINE} strokeWidth="1" />
              {/* Inner pedestal (smaller square) */}
              <rect x={x - 5} y={y - 5} width="10" height="10"
                fill="#ffcdd2" stroke="#c62828" strokeWidth="0.8" />
              {/* Anchor bolts (4 dots) */}
              {[[-3, -3], [3, -3], [-3, 3], [3, 3]].map(([dx, dy], k) => (
                <circle key={k} cx={x + dx} cy={y + dy} r="0.9" fill="#1a2744" />
              ))}
              {/* Footing tag */}
              <text x={x + px / 2 - 2} y={y - px / 2 + 8} textAnchor="end"
                fontSize="7" fill="#c62828" fontWeight="bold">{tag}</text>
            </g>
          )
        })
      )}

      {/* ── Column Grid Labels (perimeter) ── */}
      {colXs.map((x, i) => (
        <g key={`gl-${i}`}>
          <line x1={x} y1={oy - 30} x2={x} y2={oy - 5}
            stroke="#e53935" strokeWidth="0.5" strokeDasharray="4,3" />
          <circle cx={x} cy={oy - 38} r="9" fill="white" stroke="#e53935" strokeWidth="0.8" />
          <text x={x} y={oy - 35} textAnchor="middle" fontSize="9" fill="#e53935" fontWeight="bold">
            {String.fromCharCode(65 + i)}
          </text>
        </g>
      ))}
      {[1, 2].map((n, i) => (
        <g key={`gv-${i}`}>
          <circle cx={ox - 38} cy={oy + i * bh} r="9" fill="white" stroke="#e53935" strokeWidth="0.8" />
          <text x={ox - 38} y={oy + i * bh + 3} textAnchor="middle" fontSize="9" fill="#e53935" fontWeight="bold">{n}</text>
        </g>
      ))}

      {/* ── Bay dimension chain (top) ── */}
      {(() => {
        const bayPx = bw / numBays
        const bayFt = bayLen.toFixed(0)
        const segs = Array.from({ length: numBays }).map(() => ({ size: bayPx, label: `${bayFt}'` }))
        return (
          <BayDimChain x1={ox} x2={ox + bw} y={oy - 65}
            segments={segs} totalLabel={fmtDim(L)} fontSize={9} />
        )
      })()}
      {/* Width dim left */}
      <DimV y1={oy} y2={oy + bh} x={ox - 60} label={fmtDim(W)} fontSize={11} />

      {/* ── Detail callout: Foundation detail ── */}
      <DetailCallout x={ox + bw + 35} y={oy + 30} tag="C" sheet="FDN"
        leaderTo={{ x: colXs[colXs.length - 1] + fpx / 2, y: oy + 8 }} />

      {/* ── North Compass ── */}
      <NorthCompass cx={ox + bw + 100} cy={oy + bh + 60} />

      {/* ── Drawing Title ── */}
      <text x={ox + bw / 2} y={oy + bh + 60} textAnchor="middle" fontSize="14" fill={LINE} fontWeight="bold"
        textDecoration="underline">FOUNDATION PLAN</text>

      {/* ── Footing Schedule ── */}
      <g>
        <rect x="1060" y="610" width="300" height="160" fill="white" stroke={LINE} strokeWidth="0.8" />
        <text x="1070" y="626" fontSize="9" fill={LINE} fontWeight="bold" textDecoration="underline">FOOTING SCHEDULE:</text>
        {/* Header */}
        <line x1="1070" y1="638" x2="1350" y2="638" stroke={LINE} strokeWidth="0.4" />
        <text x="1078" y="649" fontSize="7.5" fill={LINE} fontWeight="bold">MARK</text>
        <text x="1135" y="649" fontSize="7.5" fill={LINE} fontWeight="bold">L x W (ft)</text>
        <text x="1215" y="649" fontSize="7.5" fill={LINE} fontWeight="bold">DEPTH</text>
        <text x="1265" y="649" fontSize="7.5" fill={LINE} fontWeight="bold">QTY</text>
        <text x="1305" y="649" fontSize="7.5" fill={LINE} fontWeight="bold">BAR</text>
        <line x1="1070" y1="654" x2="1350" y2="654" stroke={LINE} strokeWidth="0.4" />
        {/* Rows */}
        <text x="1078" y="668" fontSize="8" fill={DIM_COLOR}>F1</text>
        <text x="1135" y="668" fontSize="8" fill={DIM_COLOR}>{isoF.L} x {isoF.W}</text>
        <text x="1215" y="668" fontSize="8" fill={DIM_COLOR}>{isoF.D}'0"</text>
        <text x="1265" y="668" fontSize="8" fill={DIM_COLOR}>{(numBays + 1) * 2 - 4}</text>
        <text x="1305" y="668" fontSize="8" fill={DIM_COLOR}>16#@150</text>

        <text x="1078" y="684" fontSize="8" fill={DIM_COLOR}>F2</text>
        <text x="1135" y="684" fontSize="8" fill={DIM_COLOR}>{cornerF.L} x {cornerF.W}</text>
        <text x="1215" y="684" fontSize="8" fill={DIM_COLOR}>{cornerF.D}'0"</text>
        <text x="1265" y="684" fontSize="8" fill={DIM_COLOR}>4</text>
        <text x="1305" y="684" fontSize="8" fill={DIM_COLOR}>20#@125</text>

        <text x="1078" y="700" fontSize="8" fill={DIM_COLOR}>PB</text>
        <text x="1135" y="700" fontSize="8" fill={DIM_COLOR}>1.0 x 1.5</text>
        <text x="1215" y="700" fontSize="8" fill={DIM_COLOR}>—</text>
        <text x="1265" y="700" fontSize="8" fill={DIM_COLOR}>{numBays + 2}</text>
        <text x="1305" y="700" fontSize="8" fill={DIM_COLOR}>4-12#</text>
        <line x1="1070" y1="708" x2="1350" y2="708" stroke={LINE} strokeWidth="0.4" />

        {/* Legend */}
        <rect x="1078" y="720" width="14" height="14" fill="url(#concHatch)" stroke={LINE} strokeWidth="0.5" />
        <text x="1098" y="730" fontSize="7" fill={DIM_COLOR}>RCC ISOLATED FOOTING</text>
        <rect x="1078" y="740" width="14" height="14" fill="#ffcdd2" stroke="#c62828" strokeWidth="0.5" />
        <text x="1098" y="750" fontSize="7" fill={DIM_COLOR}>RCC PEDESTAL (450 x 450)</text>
        <line x1="1078" y1="762" x2="1092" y2="762" stroke={FOUND_COL} strokeWidth="2" />
        <text x="1098" y="765" fontSize="7" fill={DIM_COLOR}>PLINTH BEAM (300 x 450)</text>
      </g>

      {/* ── Notes ── */}
      <g>
        <text x="1080" y="50" fontSize="8" fill={LINE} fontWeight="bold" textDecoration="underline">FOUNDATION NOTES:</text>
        <text x="1080" y="65" fontSize="7" fill={DIM_COLOR}>1. ALL DIMENSIONS IN FT &amp; INCHES.</text>
        <text x="1080" y="77" fontSize="7" fill={DIM_COLOR}>2. CONCRETE GRADE: M25 (FOOTINGS &amp; PEDESTAL).</text>
        <text x="1080" y="89" fontSize="7" fill={DIM_COLOR}>3. STEEL: Fe-500 TMT.</text>
        <text x="1080" y="101" fontSize="7" fill={DIM_COLOR}>4. SBC: 150 KN/M² (MIN).</text>
        <text x="1080" y="113" fontSize="7" fill={DIM_COLOR}>5. PCC 100mm THK BELOW ALL FOOTINGS.</text>
        <text x="1080" y="125" fontSize="7" fill={DIM_COLOR}>6. ANCHOR BOLTS: M24 GRADE 8.8, 4 NOS PER BASE.</text>
      </g>

      {/* ── Title Block ── */}
      <TitleBlock
        x={20} y={850} w={1360} h={85}
        drawingTitle="FOUNDATION PLAN"
        projectName={projectName}
        clientName={clientName}
        clientLocation={clientLocation}
        projectNo={projectNo}
        viewKey="foundation"
      />
    </svg>
  )
}


/* ═══════════════════════════════════════════
   ROOF FRAMING PLAN VIEW
   ═══════════════════════════════════════════ */

function RoofFramingPlanSheet({ params, projectName, clientName, clientLocation, projectNo }) {
  const L = +params.building_length || 100
  const W = +params.building_width || 60
  const roofType = params.roof_type || 'gable'

  const s = Math.min(850 / L, 600 / W) * 0.8
  const ox = 150, oy = 110
  const bw = L * s, bh = W * s

  const baySpacing = Math.min(25, L / Math.max(2, Math.ceil(L / 25)))
  const numBays = Math.ceil(L / baySpacing)
  const bayLen = L / numBays
  const colXs = Array.from({ length: numBays + 1 }, (_, i) => ox + i * (bw / numBays))

  // Purlin spacing ~5 ft c/c
  const purSpacing = 5
  const numPurlins = Math.max(2, Math.floor(W / purSpacing))
  const purYs = Array.from({ length: numPurlins + 1 }, (_, i) => oy + (i / numPurlins) * bh)

  return (
    <svg viewBox="0 0 1400 960" className="w-full" style={{ background: 'white' }}>
      <SvgDefs />
      <rect x="15" y="15" width="1370" height="930" fill="none" stroke={LINE} strokeWidth="2" />
      <rect x="20" y="20" width="1360" height="920" fill="none" stroke={LINE} strokeWidth="0.5" />

      {/* ── Building outline ── */}
      <rect x={ox} y={oy} width={bw} height={bh}
        fill="white" stroke={LINE} strokeWidth="1.5" />

      {/* ── Purlins (horizontal lines spanning length) ── */}
      {purYs.map((y, i) => (
        <line key={`p-${i}`} x1={ox} y1={y} x2={ox + bw} y2={y}
          stroke={PURLIN_COL} strokeWidth="0.6" strokeDasharray="3,1.5" />
      ))}

      {/* ── Rafters (transverse, at each column line) ── */}
      {colXs.map((x, i) => (
        <g key={`r-${i}`}>
          <line x1={x} y1={oy} x2={x} y2={oy + bh}
            stroke={RAFTER_COL} strokeWidth="2.2" />
          {/* Doubled line for I-beam representation */}
          <line x1={x - 1.5} y1={oy} x2={x - 1.5} y2={oy + bh}
            stroke={RAFTER_COL} strokeWidth="0.4" />
          <line x1={x + 1.5} y1={oy} x2={x + 1.5} y2={oy + bh}
            stroke={RAFTER_COL} strokeWidth="0.4" />
        </g>
      ))}

      {/* ── Ridge Line (gable only) ── */}
      {roofType === 'gable' && (
        <g>
          <line x1={ox - 5} y1={oy + bh / 2} x2={ox + bw + 5} y2={oy + bh / 2}
            stroke="#d84315" strokeWidth="1.8" strokeDasharray="10,3,3,3" />
          <text x={ox + bw / 2} y={oy + bh / 2 - 6} textAnchor="middle"
            fontSize="9" fill="#d84315" fontWeight="bold">RIDGE LINE</text>
        </g>
      )}

      {/* ── Eave Struts (along long edges) ── */}
      <line x1={ox} y1={oy} x2={ox + bw} y2={oy} stroke="#1a2744" strokeWidth="2.5" />
      <line x1={ox} y1={oy + bh} x2={ox + bw} y2={oy + bh} stroke="#1a2744" strokeWidth="2.5" />

      {/* ── Cross / X Bracing (in end bays + every 4th) ── */}
      {Array.from({ length: numBays }).map((_, i) => {
        if (!(i === 0 || i === numBays - 1 || (numBays > 4 && i % 4 === 2))) return null
        const x1 = colXs[i], x2 = colXs[i + 1]
        return (
          <g key={`xb-${i}`}>
            <line x1={x1} y1={oy} x2={x2} y2={oy + bh}
              stroke="#7b1fa2" strokeWidth="0.8" strokeDasharray="6,3" />
            <line x1={x2} y1={oy} x2={x1} y2={oy + bh}
              stroke="#7b1fa2" strokeWidth="0.8" strokeDasharray="6,3" />
            {/* Brace tag */}
            <text x={(x1 + x2) / 2} y={oy + bh / 2} textAnchor="middle"
              fontSize="7" fill="#7b1fa2" fontWeight="bold"
              style={{ background: 'white' }}>BR-{i + 1}</text>
          </g>
        )
      })}

      {/* ── Tie Rods / Sag Rods (between rafters at midspan) ── */}
      {colXs.slice(0, -1).map((x, i) => {
        const x2 = colXs[i + 1]
        return (
          <g key={`sr-${i}`}>
            <line x1={x + 2} y1={oy + bh * 0.25} x2={x2 - 2} y2={oy + bh * 0.25}
              stroke="#558b2f" strokeWidth="0.4" />
            <line x1={x + 2} y1={oy + bh * 0.75} x2={x2 - 2} y2={oy + bh * 0.75}
              stroke="#558b2f" strokeWidth="0.4" />
          </g>
        )
      })}

      {/* ── Column Grid Labels ── */}
      {colXs.map((x, i) => (
        <g key={`gl-${i}`}>
          <circle cx={x} cy={oy - 38} r="9" fill="white" stroke="#e53935" strokeWidth="0.8" />
          <text x={x} y={oy - 35} textAnchor="middle" fontSize="9" fill="#e53935" fontWeight="bold">
            {String.fromCharCode(65 + i)}
          </text>
        </g>
      ))}
      {[1, 2].map((n, i) => (
        <g key={`gv-${i}`}>
          <circle cx={ox - 38} cy={oy + i * bh} r="9" fill="white" stroke="#e53935" strokeWidth="0.8" />
          <text x={ox - 38} y={oy + i * bh + 3} textAnchor="middle" fontSize="9" fill="#e53935" fontWeight="bold">{n}</text>
        </g>
      ))}

      {/* ── Bay dim chain (top) ── */}
      {(() => {
        const bayPx = bw / numBays
        const segs = Array.from({ length: numBays }).map(() => ({ size: bayPx, label: `${bayLen.toFixed(0)}'` }))
        return (
          <BayDimChain x1={ox} x2={ox + bw} y={oy - 65}
            segments={segs} totalLabel={fmtDim(L)} fontSize={9} />
        )
      })()}
      <DimV y1={oy} y2={oy + bh} x={ox - 60} label={fmtDim(W)} fontSize={11} />

      {/* ── Purlin spacing dim (right side) ── */}
      <g transform={`translate(${ox + bw + 25}, ${oy})`}>
        <text x="0" y="-2" fontSize="7" fill={PURLIN_COL} fontWeight="bold">PURLIN @ {purSpacing}' c/c</text>
        {Array.from({ length: Math.min(3, numPurlins) }).map((_, i) => {
          const y1 = (i / numPurlins) * bh, y2 = ((i + 1) / numPurlins) * bh
          return (
            <g key={i}>
              <line x1="0" y1={y1} x2="0" y2={y2} stroke={PURLIN_COL} strokeWidth="0.6"
                markerStart="url(#dimArrowL)" markerEnd="url(#dimArrowR)" />
              <text x="3" y={(y1 + y2) / 2 + 3} fontSize="7" fill={PURLIN_COL}>{purSpacing}'</text>
            </g>
          )
        })}
      </g>

      {/* ── Detail callout (ridge) ── */}
      {roofType === 'gable' && (
        <DetailCallout x={ox + bw + 40} y={oy + bh / 2} tag="B" sheet="RIDGE"
          leaderTo={{ x: ox + bw + 6, y: oy + bh / 2 }} />
      )}

      {/* ── Drawing Title ── */}
      <text x={ox + bw / 2} y={oy + bh + 60} textAnchor="middle" fontSize="14" fill={LINE} fontWeight="bold"
        textDecoration="underline">ROOF FRAMING PLAN</text>

      {/* ── North Compass ── */}
      <NorthCompass cx={ox + bw + 100} cy={oy + bh + 60} />

      {/* ── Member Schedule + Legend ── */}
      <g>
        <rect x="1060" y="600" width="300" height="180" fill="white" stroke={LINE} strokeWidth="0.8" />
        <text x="1070" y="616" fontSize="9" fill={LINE} fontWeight="bold" textDecoration="underline">MEMBER SCHEDULE:</text>
        <line x1="1070" y1="624" x2="1350" y2="624" stroke={LINE} strokeWidth="0.4" />
        <text x="1078" y="638" fontSize="7.5" fill={LINE} fontWeight="bold">MARK</text>
        <text x="1145" y="638" fontSize="7.5" fill={LINE} fontWeight="bold">SECTION</text>
        <text x="1245" y="638" fontSize="7.5" fill={LINE} fontWeight="bold">QTY</text>
        <line x1="1070" y1="644" x2="1350" y2="644" stroke={LINE} strokeWidth="0.4" />

        <text x="1078" y="658" fontSize="8" fill={DIM_COLOR}>R1</text>
        <text x="1145" y="658" fontSize="8" fill={DIM_COLOR}>RAFTER 450 BUILT-UP</text>
        <text x="1245" y="658" fontSize="8" fill={DIM_COLOR}>{numBays + 1}</text>

        <text x="1078" y="674" fontSize="8" fill={DIM_COLOR}>P1</text>
        <text x="1145" y="674" fontSize="8" fill={DIM_COLOR}>Z-PURLIN 200×60</text>
        <text x="1245" y="674" fontSize="8" fill={DIM_COLOR}>{(numPurlins + 1) * numBays}</text>

        <text x="1078" y="690" fontSize="8" fill={DIM_COLOR}>ES</text>
        <text x="1145" y="690" fontSize="8" fill={DIM_COLOR}>EAVE STRUT 150×75</text>
        <text x="1245" y="690" fontSize="8" fill={DIM_COLOR}>{2 * numBays}</text>

        <text x="1078" y="706" fontSize="8" fill={DIM_COLOR}>BR</text>
        <text x="1145" y="706" fontSize="8" fill={DIM_COLOR}>X-BRACING ROD φ20</text>
        <text x="1245" y="706" fontSize="8" fill={DIM_COLOR}>{(2 + (numBays > 4 ? Math.floor(numBays / 4) : 0)) * 2}</text>

        <text x="1078" y="722" fontSize="8" fill={DIM_COLOR}>SR</text>
        <text x="1145" y="722" fontSize="8" fill={DIM_COLOR}>SAG ROD φ12</text>
        <text x="1245" y="722" fontSize="8" fill={DIM_COLOR}>{2 * numBays}</text>
        <line x1="1070" y1="730" x2="1350" y2="730" stroke={LINE} strokeWidth="0.4" />

        <text x="1078" y="744" fontSize="7" fill={LINE} fontWeight="bold">LEGEND:</text>
        <line x1="1078" y1="752" x2="1100" y2="752" stroke={RAFTER_COL} strokeWidth="2.2" />
        <text x="1108" y="755" fontSize="7" fill={DIM_COLOR}>Rafter (R1)</text>
        <line x1="1078" y1="762" x2="1100" y2="762" stroke={PURLIN_COL} strokeWidth="0.6" strokeDasharray="3,1.5" />
        <text x="1108" y="765" fontSize="7" fill={DIM_COLOR}>Purlin (P1)</text>
        <line x1="1078" y1="772" x2="1100" y2="772" stroke="#7b1fa2" strokeWidth="0.8" strokeDasharray="6,3" />
        <text x="1108" y="775" fontSize="7" fill={DIM_COLOR}>X-Bracing (BR)</text>
      </g>

      {/* ── Notes ── */}
      <g>
        <text x="1080" y="50" fontSize="8" fill={LINE} fontWeight="bold" textDecoration="underline">ROOF FRAMING NOTES:</text>
        <text x="1080" y="65" fontSize="7" fill={DIM_COLOR}>1. ALL STEEL AS PER IS 800:2007.</text>
        <text x="1080" y="77" fontSize="7" fill={DIM_COLOR}>2. WELDS: E70XX, FILLET 6mm UNO.</text>
        <text x="1080" y="89" fontSize="7" fill={DIM_COLOR}>3. PRIMER 1 COAT + ENAMEL 2 COATS.</text>
        <text x="1080" y="101" fontSize="7" fill={DIM_COLOR}>4. PURLIN c/c: {purSpacing}'0".</text>
        <text x="1080" y="113" fontSize="7" fill={DIM_COLOR}>5. END BAYS BRACED IN BOTH PLANES.</text>
      </g>

      {/* ── Title Block ── */}
      <TitleBlock
        x={20} y={850} w={1360} h={85}
        drawingTitle="ROOF FRAMING PLAN"
        projectName={projectName}
        clientName={clientName}
        clientLocation={clientLocation}
        projectNo={projectNo}
        viewKey="roof_framing"
      />
    </svg>
  )
}


/* ═══════════════════════════════════════════
   FRONT ELEVATION VIEW
   ═══════════════════════════════════════════ */

function FrontElevSheet({ params, projectName, clientName, clientLocation, projectNo }) {
  const W = +params.building_width || 60
  const Hf = +params.full_height || 30
  const Hw = +params.wall_height || 20
  const roofType = params.roof_type || 'gable'
  const roofIsPuf = (params.roof_sheet_type || '').includes('puf')
  const cladIsPuf = (params.side_cladding_type || '').includes('puf')
  const slope = roofType === 'gable' ? W / 2 / 10 : W / 10

  const s = Math.min(900 / W, 500 / Hf) * 0.7
  const cx = 650, gy = 730
  const leftX = cx - (W * s) / 2
  const rightX = cx + (W * s) / 2
  const eaveY = gy - Hw * s
  const ridgeY = gy - Hf * s
  const foundH = 20

  const wCount = Math.max(2, Math.floor(W / 15))

  return (
    <svg viewBox="0 0 1400 960" className="w-full" style={{ background: 'white' }}>
      <SvgDefs />
      <rect x="15" y="15" width="1370" height="930" fill="none" stroke={LINE} strokeWidth="2" />
      <rect x="20" y="20" width="1360" height="920" fill="none" stroke={LINE} strokeWidth="0.5" />

      {/* ── Ground ── */}
      <rect x={leftX - 30} y={gy} width={(rightX - leftX) + 60} height={foundH + 10} fill="url(#groundHatch)" />
      <line x1={leftX - 40} y1={gy} x2={rightX + 40} y2={gy} stroke={LINE} strokeWidth="1.5" />
      {Array.from({ length: 25 }).map((_, i) => (
        <line key={i} x1={leftX - 30 + i * 14} y1={gy + 1} x2={leftX - 30 + i * 14 - 7} y2={gy + 9}
          stroke="#8d6e63" strokeWidth="0.5" />
      ))}

      {/* ── Wall ── */}
      <rect x={leftX} y={eaveY} width={rightX - leftX} height={gy - eaveY}
        fill="#f5f5f5" stroke={LINE} strokeWidth="1.5" />

      {/* ── Masonry (lower portion) ── */}
      <rect x={leftX} y={gy - (gy - eaveY) * 0.3} width={rightX - leftX} height={(gy - eaveY) * 0.3}
        fill="url(#brickPat)" stroke="none" />

      {/* ── Columns ── */}
      <rect x={leftX - 2} y={eaveY} width="8" height={gy - eaveY} fill="white" stroke={STEEL_COL} strokeWidth="1.2" />
      <rect x={rightX - 6} y={eaveY} width="8" height={gy - eaveY} fill="white" stroke={STEEL_COL} strokeWidth="1.2" />

      {/* ── Cladding sheet ── */}
      <rect x={leftX + 6} y={eaveY} width={rightX - leftX - 12} height={(gy - eaveY) * 0.65}
        fill={cladIsPuf ? '#e3f2fd' : '#eceff1'} stroke={CLAD_COL} strokeWidth="0.5" opacity="0.5" />
      {/* Vertical cladding ribs */}
      {Array.from({ length: Math.ceil((rightX - leftX) / 12) }).map((_, i) => (
        <line key={i} x1={leftX + 8 + i * 12} y1={eaveY} x2={leftX + 8 + i * 12} y2={eaveY + (gy - eaveY) * 0.65}
          stroke={CLAD_COL} strokeWidth="0.2" opacity="0.4" />
      ))}

      {/* ── Roof / Gable ── */}
      {roofType === 'gable' ? (
        <>
          <polygon points={`${leftX - 8},${eaveY} ${cx},${ridgeY} ${rightX + 8},${eaveY}`}
            fill={roofIsPuf ? '#e3f2fd' : '#fff8e1'} stroke={LINE} strokeWidth="1.5" />
          {/* Roof sheet line */}
          <line x1={leftX - 10} y1={eaveY + 2} x2={cx} y2={ridgeY - 3} stroke={ROOF_COL} strokeWidth="2" />
          <line x1={cx} y1={ridgeY - 3} x2={rightX + 10} y2={eaveY + 2} stroke={ROOF_COL} strokeWidth="2" />
          {/* Gable cladding fill */}
          <polygon points={`${leftX},${eaveY} ${cx},${ridgeY + 3} ${rightX},${eaveY}`}
            fill={cladIsPuf ? '#bbdefb' : '#cfd8dc'} stroke="none" opacity="0.3" />
          {/* Ridge cap */}
          <circle cx={cx} cy={ridgeY - 6} r="5" fill={GUTTER_COL} stroke={LINE} strokeWidth="0.5" />
        </>
      ) : (
        <>
          <rect x={leftX - 8} y={eaveY - 5} width={rightX - leftX + 16} height="5"
            fill={roofIsPuf ? '#e3f2fd' : '#fff8e1'} stroke={LINE} strokeWidth="1" />
          <line x1={leftX - 10} y1={eaveY - 5} x2={rightX + 10} y2={eaveY - 5} stroke={ROOF_COL} strokeWidth="2" />
        </>
      )}

      {/* ── Windows ── */}
      {Array.from({ length: wCount }).map((_, i) => {
        const wx = leftX + ((i + 1) / (wCount + 1)) * (rightX - leftX)
        const ww = Math.min(16, (rightX - leftX) / (wCount + 1) * 0.4)
        const wh = (gy - eaveY) * 0.25
        const wy = gy - (gy - eaveY) * 0.55
        return (
          <g key={i}>
            <rect x={wx - ww / 2} y={wy} width={ww} height={wh} fill="#e3f2fd" stroke={CLAD_COL} strokeWidth="0.8" />
            <line x1={wx} y1={wy} x2={wx} y2={wy + wh} stroke={CLAD_COL} strokeWidth="0.4" />
            <line x1={wx - ww / 2} y1={wy + wh / 2} x2={wx + ww / 2} y2={wy + wh / 2} stroke={CLAD_COL} strokeWidth="0.4" />
          </g>
        )
      })}

      {/* ── Rolling Shutter ── */}
      {(() => {
        const rsW = Math.min((rightX - leftX) * 0.22, 60)
        const rsH = (gy - eaveY) * 0.7
        return (
          <g>
            <rect x={cx - rsW / 2} y={gy - rsH} width={rsW} height={rsH}
              fill="#e8eaf6" stroke={LINE} strokeWidth="1" />
            {/* Shutter lines */}
            {Array.from({ length: Math.floor(rsH / 4) }).map((_, i) => (
              <line key={i} x1={cx - rsW / 2 + 1} y1={gy - rsH + i * 4} x2={cx + rsW / 2 - 1} y2={gy - rsH + i * 4}
                stroke={DIM_COLOR} strokeWidth="0.3" />
            ))}
            <text x={cx} y={gy - rsH - 4} textAnchor="middle" fontSize="7" fill={LINE} fontWeight="bold">RS</text>
          </g>
        )
      })()}

      {/* ── Gutters ── */}
      <rect x={leftX - 12} y={eaveY - 2} width="6" height="8" fill="none" stroke={GUTTER_COL} strokeWidth="1" />
      <rect x={rightX + 6} y={eaveY - 2} width="6" height="8" fill="none" stroke={GUTTER_COL} strokeWidth="1" />

      {/* ── Dimensions ── */}
      <DimH x1={leftX} x2={rightX} y={gy + foundH + 18} label={fmtDim(W)} fontSize={12} />
      <DimV y1={gy} y2={eaveY} x={leftX - 40} label={`${Hw}'`} fontSize={11} />
      {Hf !== Hw && (
        <DimV y1={gy} y2={ridgeY} x={leftX - 75} label={`${Hf}'`} fontSize={11} />
      )}

      {/* ── Level marks ── */}
      <LevelMark x1={leftX - 90} x2={leftX - 15} y={gy} label="NGL" />
      <LevelMark x1={leftX - 90} x2={leftX - 15} y={gy - 3} label="FFL" />

      {/* ── Title ── */}
      <text x={cx} y={gy + foundH + 50} textAnchor="middle" fontSize="14" fill={LINE} fontWeight="bold"
        textDecoration="underline">FRONT ELEVATION</text>

      {/* ── Notes ── */}
      <text x="1100" y="55" fontSize="8" fill={LINE} fontWeight="bold" textDecoration="underline">NOTES:</text>
      <text x="1100" y="70" fontSize="7" fill={DIM_COLOR}>1. ALL DIMENSIONS ARE IN FEET & INCHES.</text>

      <TitleBlock
        x={20} y={850} w={1360} h={85}
        drawingTitle="FRONT ELEVATION"
        projectName={projectName}
        clientName={clientName}
        clientLocation={clientLocation}
        projectNo={projectNo}
        viewKey="front"
      />
    </svg>
  )
}


/* ═══════════════════════════════════════════
   SIDE ELEVATION VIEW
   ═══════════════════════════════════════════ */

function SideElevSheet({ params, projectName, clientName, clientLocation, projectNo }) {
  const L = +params.building_length || 100
  const W = +params.building_width || 60
  const Hf = +params.full_height || 30
  const Hw = +params.wall_height || 20
  const roofType = params.roof_type || 'gable'
  const roofIsPuf = (params.roof_sheet_type || '').includes('puf')
  const cladIsPuf = (params.side_cladding_type || '').includes('puf')
  const slope = roofType === 'gable' ? W / 2 / 10 : W / 10

  const s = Math.min(950 / L, 500 / Hf) * 0.7
  const ox = 130, gy = 720
  const bw = L * s
  const eaveY = gy - Hw * s
  const ridgeY = gy - Hf * s
  const foundH = 20

  // Bay spacing
  const baySpacing = Math.min(25, L / Math.max(2, Math.ceil(L / 25)))
  const numBays = Math.ceil(L / baySpacing)
  const colPositions = Array.from({ length: numBays + 1 }, (_, i) => ox + i * (bw / numBays))

  const wCount = Math.max(3, Math.floor(L / 20))

  return (
    <svg viewBox="0 0 1400 960" className="w-full" style={{ background: 'white' }}>
      <SvgDefs />
      <rect x="15" y="15" width="1370" height="930" fill="none" stroke={LINE} strokeWidth="2" />
      <rect x="20" y="20" width="1360" height="920" fill="none" stroke={LINE} strokeWidth="0.5" />

      {/* ── Ground ── */}
      <rect x={ox - 20} y={gy} width={bw + 40} height={foundH + 10} fill="url(#groundHatch)" />
      <line x1={ox - 30} y1={gy} x2={ox + bw + 30} y2={gy} stroke={LINE} strokeWidth="1.5" />
      {Array.from({ length: Math.ceil(bw / 12) }).map((_, i) => (
        <line key={i} x1={ox - 15 + i * 12} y1={gy + 1} x2={ox - 15 + i * 12 - 6} y2={gy + 8}
          stroke="#8d6e63" strokeWidth="0.5" />
      ))}

      {/* ── Wall ── */}
      <rect x={ox} y={eaveY} width={bw} height={gy - eaveY}
        fill="#f5f5f5" stroke={LINE} strokeWidth="1.5" />

      {/* Masonry (lower) */}
      <rect x={ox} y={gy - (gy - eaveY) * 0.3} width={bw} height={(gy - eaveY) * 0.3}
        fill="url(#brickPat)" stroke="none" />

      {/* ── Columns (visible from side) ── */}
      {colPositions.map((x, i) => (
        <rect key={i} x={x - 3} y={eaveY} width="6" height={gy - eaveY}
          fill="white" stroke={STEEL_COL} strokeWidth="0.8" />
      ))}

      {/* ── Cladding (between columns) ── */}
      <rect x={ox} y={eaveY} width={bw} height={(gy - eaveY) * 0.65}
        fill={cladIsPuf ? '#e3f2fd' : '#eceff1'} stroke="none" opacity="0.3" />

      {/* ── Roof Line ── */}
      {roofType === 'gable' ? (
        <>
          {/* Gable roof from side = flat eave line */}
          <rect x={ox - 8} y={eaveY - 5} width={bw + 16} height="5"
            fill={roofIsPuf ? '#e3f2fd' : '#fff8e1'} stroke={LINE} strokeWidth="1" />
          <line x1={ox - 10} y1={eaveY - 5} x2={ox + bw + 10} y2={eaveY - 5} stroke={ROOF_COL} strokeWidth="2" />
          {/* Ridge beam visible above */}
          <line x1={ox - 8} y1={ridgeY} x2={ox + bw + 8} y2={ridgeY} stroke={RAFTER_COL} strokeWidth="1.5" />
          <text x={ox + bw / 2} y={ridgeY - 5} textAnchor="middle" fontSize="7" fill={DIM_COLOR}>RIDGE LINE</text>
        </>
      ) : (
        <>
          {/* Monoslope: sloped roof from left (high) to right (low) or just show the higher side */}
          <line x1={ox - 8} y1={ridgeY} x2={ox + bw + 8} y2={eaveY}
            stroke={ROOF_COL} strokeWidth="2" />
          <polygon
            points={`${ox - 8},${ridgeY} ${ox + bw + 8},${eaveY} ${ox + bw + 8},${eaveY - 4} ${ox - 8},${ridgeY - 4}`}
            fill={roofIsPuf ? '#e3f2fd' : '#fff8e1'} stroke="none" opacity="0.5" />
        </>
      )}

      {/* ── Windows (along length) ── */}
      {Array.from({ length: wCount }).map((_, i) => {
        const wx = ox + ((i + 1) / (wCount + 1)) * bw
        const ww = Math.min(14, bw / (wCount + 1) * 0.35)
        const wh = (gy - eaveY) * 0.25
        const wy = gy - (gy - eaveY) * 0.55
        return (
          <g key={i}>
            <rect x={wx - ww / 2} y={wy} width={ww} height={wh} fill="#e3f2fd" stroke={CLAD_COL} strokeWidth="0.8" />
            <line x1={wx} y1={wy} x2={wx} y2={wy + wh} stroke={CLAD_COL} strokeWidth="0.4" />
            <line x1={wx - ww / 2} y1={wy + wh / 2} x2={wx + ww / 2} y2={wy + wh / 2} stroke={CLAD_COL} strokeWidth="0.4" />
          </g>
        )
      })}

      {/* ── Gutters at eave ── */}
      <rect x={ox - 10} y={eaveY - 2} width="5" height="7" fill="none" stroke={GUTTER_COL} strokeWidth="0.8" />
      <rect x={ox + bw + 5} y={eaveY - 2} width="5" height="7" fill="none" stroke={GUTTER_COL} strokeWidth="0.8" />

      {/* ── Downtake pipes ── */}
      <line x1={ox - 8} y1={eaveY + 5} x2={ox - 8} y2={gy} stroke={CLAD_COL} strokeWidth="1.2" />
      <line x1={ox + bw + 8} y1={eaveY + 5} x2={ox + bw + 8} y2={gy} stroke={CLAD_COL} strokeWidth="1.2" />

      {/* ── Dimensions ── */}
      <DimH x1={ox} x2={ox + bw} y={gy + foundH + 18} label={fmtDim(L)} fontSize={12} />
      <DimV y1={gy} y2={eaveY} x={ox - 35} label={`${Hw}'`} fontSize={11} />
      {Hf !== Hw && roofType !== 'gable' && (
        <DimV y1={gy} y2={ridgeY} x={ox - 65} label={`${Hf}'`} fontSize={11} />
      )}

      {/* Bay dimensions along top */}
      {colPositions.length > 2 && colPositions.slice(0, -1).map((x, i) => {
        const x2 = colPositions[i + 1]
        const bayFt = (L / numBays).toFixed(0)
        return (
          <DimH key={i} x1={x} x2={x2} y={eaveY - 20} label={`${bayFt}'`} fontSize={8} ext={8} />
        )
      })}

      {/* Column grid labels */}
      {colPositions.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={eaveY - 38} r="7" fill="none" stroke="#e53935" strokeWidth="0.6" />
          <text x={x} y={eaveY - 35} textAnchor="middle" fontSize="7" fill="#e53935" fontWeight="bold">
            {String.fromCharCode(65 + i)}
          </text>
        </g>
      ))}

      {/* Level marks */}
      <LevelMark x1={ox - 80} x2={ox - 15} y={gy} label="NGL" />
      <LevelMark x1={ox - 80} x2={ox - 15} y={gy - 3} label="FFL" />

      {/* Eave height label */}
      <text x={ox - 12} y={eaveY - 4} textAnchor="end" fontSize="8" fill={STEEL_COL} fontWeight="bold">EAVE HEIGHT</text>

      {/* ── Title ── */}
      <text x={ox + bw / 2} y={gy + foundH + 50} textAnchor="middle" fontSize="14" fill={LINE} fontWeight="bold"
        textDecoration="underline">SIDE ELEVATION</text>

      <text x="1100" y="55" fontSize="8" fill={LINE} fontWeight="bold" textDecoration="underline">NOTES:</text>
      <text x="1100" y="70" fontSize="7" fill={DIM_COLOR}>1. ALL DIMENSIONS ARE IN FEET & INCHES.</text>

      <TitleBlock
        x={20} y={850} w={1360} h={85}
        drawingTitle="SIDE ELEVATION"
        projectName={projectName}
        clientName={clientName}
        clientLocation={clientLocation}
        projectNo={projectNo}
        viewKey="side"
      />
    </svg>
  )
}


/* ═══════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════ */

const DEFAULT_PARAMS = {
  building_length: 100, building_width: 60, full_height: 30,
  wall_height: 20, cladding_height: 10, roof_type: 'gable',
  roof_sheet_type: 'bare_galvalume_0.47mm', side_cladding_type: 'bare_colour_galvalume',
  mezzanine_required: false, mezz_length: 0, mezz_width: 0,
  // Optional drawing-only features
  turbo_vent: true, ridge_monitor: false, light_sheets: true,
  louvers: true, shutter_in_section: true,
  crane_required: false, crane_capacity: 5, crane_height: 14,
}

export default function Drawings2D() {
  const location = useLocation()
  const navigate = useNavigate()
  const { quotationId: routeQuotationId } = useParams()
  const { params: passedParams } = location.state || {}

  const [params, setParams] = useState(passedParams || DEFAULT_PARAMS)
  const [activeView, setActiveView] = useState('cross_section')

  // Project selector
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [loadingProjects, setLoadingProjects] = useState(false)

  // Prompt
  const [prompt, setPrompt] = useState('')
  const [promptHistory, setPromptHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const promptRef = useRef(null)

  // Zoom / Pan / Fullscreen
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, startPan: { x: 0, y: 0 } })
  const drawingContainerRef = useRef(null)
  const printAreaRef = useRef(null)

  const resetZoom = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [])
  const zoomIn = useCallback(() => setZoom(z => Math.min(5, +(z + 0.25).toFixed(2))), [])
  const zoomOut = useCallback(() => setZoom(z => Math.max(0.4, +(z - 0.25).toFixed(2))), [])

  const onWheel = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const delta = -Math.sign(e.deltaY) * 0.15
    setZoom(z => Math.max(0.4, Math.min(5, +(z + delta).toFixed(2))))
  }, [])

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    if (e.target.closest('button, input, a, select, [data-no-pan]')) return
    setIsPanning(true)
    panStart.current = { x: e.clientX, y: e.clientY, startPan: pan }
    e.preventDefault()
  }, [pan])

  const onMouseMove = useCallback((e) => {
    if (!isPanning) return
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    setPan({ x: panStart.current.startPan.x + dx, y: panStart.current.startPan.y + dy })
  }, [isPanning])

  const stopPan = useCallback(() => setIsPanning(false), [])

  useEffect(() => {
    if (!isPanning) return
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', stopPan)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', stopPan)
    }
  }, [isPanning, onMouseMove, stopPan])

  const toggleFullscreen = useCallback(() => {
    const el = drawingContainerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => { })
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => { })
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // Reset pan/zoom when switching sheets
  useEffect(() => { resetZoom() }, [activeView, resetZoom])

  // Load projects
  useEffect(() => {
    const load = async () => {
      setLoadingProjects(true)
      try {
        const { data } = await quotationAPI.getAll({ limit: 200 })
        setProjects(data?.items || data || [])
      } catch { /* ignore */ }
      finally { setLoadingProjects(false) }
    }
    load()
  }, [])

  // Load specific quotation from route
  useEffect(() => {
    if (!routeQuotationId) return
    const load = async () => {
      try {
        const { data } = await quotationAPI.get(routeQuotationId)
        applyProject(data)
      } catch { toast.error('Could not load quotation') }
    }
    load()
  }, [routeQuotationId])

  const applyProject = useCallback((project) => {
    setSelectedProject(project)
    setShowProjectPicker(false)
    const bp = project.building_params || {}
    setParams({
      ...DEFAULT_PARAMS, ...bp,
      building_length: +(bp.building_length || DEFAULT_PARAMS.building_length),
      building_width: +(bp.building_width || DEFAULT_PARAMS.building_width),
      full_height: +(bp.full_height || DEFAULT_PARAMS.full_height),
      wall_height: +(bp.wall_height || DEFAULT_PARAMS.wall_height),
      cladding_height: +(bp.cladding_height || Math.max(0, +(bp.full_height || 30) - +(bp.wall_height || 20))),
      roof_type: bp.roof_type || DEFAULT_PARAMS.roof_type,
      roof_sheet_type: bp.roof_sheet_type || DEFAULT_PARAMS.roof_sheet_type,
      side_cladding_type: bp.side_cladding_type || DEFAULT_PARAMS.side_cladding_type,
      mezzanine_required: !!bp.mezzanine_required,
      mezz_length: +(bp.mezz_length || 0),
      mezz_width: +(bp.mezz_width || 0),
      turbo_vent: bp.turbo_vent !== undefined ? !!bp.turbo_vent : DEFAULT_PARAMS.turbo_vent,
      ridge_monitor: !!bp.ridge_monitor,
      light_sheets: bp.light_sheets !== undefined ? !!bp.light_sheets : DEFAULT_PARAMS.light_sheets,
      louvers: bp.louvers !== undefined ? !!bp.louvers : DEFAULT_PARAMS.louvers,
      shutter_in_section: bp.shutter_in_section !== undefined ? !!bp.shutter_in_section : true,
      crane_required: !!bp.crane_required,
      crane_capacity: +(bp.crane_capacity || DEFAULT_PARAMS.crane_capacity),
      crane_height: +(bp.crane_height || DEFAULT_PARAMS.crane_height),
    })
    toast.success(`Loaded: ${project.project_name}`)
  }, [])

  const updateParam = useCallback((key, value) => {
    setParams(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'full_height' || key === 'wall_height')
        next.cladding_height = Math.max(0, (next.full_height || 0) - (next.wall_height || 0))
      return next
    })
  }, [])

  const runPrompt = useCallback((text) => {
    if (!text.trim()) return
    const { params: newParams, changes } = parsePrompt(text, params)
    if (changes.length === 0) {
      toast.error('Could not understand that. Try: "length to 150", "add mezzanine", "gable roof"')
      return
    }
    setParams(newParams)
    setPromptHistory(prev => [{ text, changes, ts: Date.now() }, ...prev].slice(0, 20))
    toast.success(changes.join(' | '))
    setPrompt('')
    promptRef.current?.focus()
  }, [params])

  const handlePrompt = useCallback(() => runPrompt(prompt), [prompt, runPrompt])

  const filteredProjects = projects.filter(p =>
    (p.project_name || '').toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.client_name || '').toLowerCase().includes(projectSearch.toLowerCase())
  )

  const projectName = selectedProject?.project_name || 'PROPOSED INDUSTRIAL BUILDING'
  const clientName = selectedProject?.client_name || ''
  const clientLocation = selectedProject?.client_location || ''
  const projectNo = selectedProject ? `SS/${new Date().getFullYear()}-${selectedProject.id}` : ''

  const L = +params.building_length || 100
  const W = +params.building_width || 60
  const Hf = +params.full_height || 30
  const roofLabel = (params.roof_type === 'gable' || params.roof_type === 'a_type') ? 'Gable' : 'Single Slope'

  const sheetProps = { params, projectName, clientName, clientLocation, projectNo }

  // Helper: serialize a specific SVG element to a standalone string (with xmlns)
  const serializeSvg = (svgEl) => {
    const clone = svgEl.cloneNode(true)
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    if (!clone.getAttribute('xmlns:xlink')) clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
    return new XMLSerializer().serializeToString(clone)
  }

  const handleDownloadSVG = () => {
    const svg = document.querySelector('#drawing-sheet svg')
    if (!svg) return toast.error('No drawing to download')
    const svgStr = serializeSvg(svg)
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${VIEW_DRG_PREFIX[activeView]}_${(projectName || 'drawing').replace(/\s+/g, '_')}.svg`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('SVG downloaded')
  }

  // Convert active SVG to PNG via canvas, scaled up for high resolution
  const handleDownloadPNG = useCallback(async () => {
    const svg = document.querySelector('#drawing-sheet svg')
    if (!svg) return toast.error('No drawing to download')
    const svgStr = serializeSvg(svg)
    const vb = svg.viewBox.baseVal
    const w = vb.width || 1400, h = vb.height || 960
    const scale = 2 // 2x for sharp output
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    try {
      await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve()
        }
        img.onerror = reject
        img.src = url
      })
      const pngBlob = await new Promise(res => canvas.toBlob(res, 'image/png', 0.95))
      const pngUrl = URL.createObjectURL(pngBlob)
      const a = document.createElement('a')
      a.href = pngUrl
      a.download = `${VIEW_DRG_PREFIX[activeView]}_${(projectName || 'drawing').replace(/\s+/g, '_')}.png`
      a.click()
      URL.revokeObjectURL(pngUrl)
      toast.success('PNG downloaded')
    } catch (err) {
      toast.error('PNG export failed')
    } finally {
      URL.revokeObjectURL(url)
    }
  }, [activeView, projectName])

  // Print active sheet (single page A2 landscape)
  const handlePrint = () => {
    const svg = document.querySelector('#drawing-sheet svg')
    if (!svg) return toast.error('No drawing to print')
    const svgStr = serializeSvg(svg)
    const w = window.open('', '_blank')
    if (!w) return toast.error('Pop-up blocked — allow pop-ups to print')
    w.document.write(`<!doctype html><html><head><title>${VIEW_LABELS[activeView]} — ${projectName}</title>
      <style>
        @page{size:A2 landscape;margin:0}
        html,body{margin:0;padding:0;background:white}
        body{display:flex;justify-content:center;align-items:center;min-height:100vh}
        svg{width:100%;height:100%;max-width:100vw;max-height:100vh}
      </style></head><body>${svgStr}</body></html>`)
    w.document.close()
    setTimeout(() => { w.print() }, 400)
  }

  // Print ALL sheets as multi-page A2 PDF (via browser print dialog → "Save as PDF")
  const handlePrintAll = () => {
    if (!printAreaRef.current) return toast.error('Print area not ready')
    const sheetSvgs = printAreaRef.current.querySelectorAll('svg')
    if (!sheetSvgs.length) return toast.error('No sheets to print')
    const html = Array.from(sheetSvgs).map(s => `<div class="sheet">${serializeSvg(s)}</div>`).join('')
    const w = window.open('', '_blank')
    if (!w) return toast.error('Pop-up blocked — allow pop-ups to print')
    w.document.write(`<!doctype html><html><head><title>${projectName} — Drawings</title>
      <style>
        @page{size:A2 landscape;margin:0}
        html,body{margin:0;padding:0;background:white;font-family:sans-serif}
        .sheet{width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;page-break-after:always;break-after:page}
        .sheet:last-child{page-break-after:auto}
        svg{width:100%;height:100%;max-width:100vw;max-height:100vh;display:block}
      </style></head><body>${html}</body></html>`)
    w.document.close()
    setTimeout(() => { w.print() }, 700)
    toast.success(`Printing ${sheetSvgs.length} sheets — choose "Save as PDF" in dialog`)
  }

  // Sheet navigation
  const goPrev = useCallback(() => {
    if (activeView === 'all') return
    const idx = VIEWS.indexOf(activeView)
    setActiveView(VIEWS[(idx - 1 + VIEWS.length) % VIEWS.length])
  }, [activeView])
  const goNext = useCallback(() => {
    if (activeView === 'all') return
    const idx = VIEWS.indexOf(activeView)
    setActiveView(VIEWS[(idx + 1) % VIEWS.length])
  }, [activeView])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
      else if (e.key === '+' || e.key === '=') zoomIn()
      else if (e.key === '-') zoomOut()
      else if (e.key === '0') resetZoom()
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext, zoomIn, zoomOut, resetZoom, toggleFullscreen])

  const renderSheet = (v) => {
    const props = sheetProps
    if (v === 'cross_section') return <CrossSectionSheet {...props} />
    if (v === 'plan') return <ArchPlanSheet {...props} />
    if (v === 'foundation') return <FoundationPlanSheet {...props} />
    if (v === 'roof_framing') return <RoofFramingPlanSheet {...props} />
    if (v === 'front') return <FrontElevSheet {...props} />
    if (v === 'side') return <SideElevSheet {...props} />
    return null
  }

  // Drawings are PEB-specific (gable warehouses + factories with portal-frame
  // geometry). For commercial / showroom typologies the engineering drawings
  // would need a completely different generator, so we show a friendly notice
  // pointing the user to the AI render flow instead.
  const btype = (params?.building_type || '').toLowerCase()
  if (btype === 'commercial' || btype === 'showroom') {
    return (
      <div className="space-y-5 max-w-3xl mx-auto">
        <PageHeader
          title="2D Engineering Drawings"
          subtitle={selectedProject?.project_name || `${L}ft x ${W}ft x ${Hf}ft`}
          actions={
            <Button variant="secondary" leftIcon={ArrowLeft} onClick={() => navigate(-1)}>
              Back
            </Button>
          }
        />
        <Card>
          <div className="px-8 py-12 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center">
              <FileText className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              2D drawings are PEB-specific
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Engineering plans, elevations, and sections are generated only for
              warehouse / factory typologies (portal-frame geometry).
              This quotation is a <span className="font-semibold capitalize">{btype}</span> —
              switch the building type in the quote, or use the AI Render flow
              for photoreal previews.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="primary"
                onClick={() => navigate(
                  routeQuotationId ? `/quotation/ai-image?quotationId=${routeQuotationId}` : '/quotation/ai-image',
                  { state: { params, lead: selectedProject ? { company: selectedProject.client_name } : null, quotationId: routeQuotationId ? Number(routeQuotationId) : null } }
                )}
              >
                Open AI Render
              </Button>
              <Button variant="secondary" onClick={() => navigate(-1)}>Go back</Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="2D Engineering Drawings"
        subtitle={selectedProject
          ? `${selectedProject.project_name} — ${L}ft x ${W}ft x ${Hf}ft — ${roofLabel}`
          : `${L}ft x ${W}ft x ${Hf}ft — ${roofLabel}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" leftIcon={ArrowLeft} onClick={() => navigate(-1)}>Back</Button>
            <Button variant="secondary" leftIcon={Download} onClick={handleDownloadSVG}>SVG</Button>
            <Button variant="secondary" leftIcon={FileImage} onClick={handleDownloadPNG}>PNG</Button>
            <Button variant="secondary" leftIcon={Printer} onClick={handlePrint}>Print Sheet</Button>
            <Button variant="primary" leftIcon={FileText} onClick={handlePrintAll}>Print PDF (All)</Button>
          </div>
        }
      />

      {/* View Tabs */}
      <div className="flex gap-2 flex-wrap items-center">
        <button onClick={goPrev}
          aria-label="Previous sheet"
          className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {VIEWS.map(v => {
          const active = activeView === v
          return (
            <button key={v} onClick={() => setActiveView(v)}
              className={`inline-flex items-center h-9 px-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${active
                ? 'text-white shadow-[0_4px_14px_-4px_var(--brand-primary)] hover:-translate-y-0.5'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              style={active ? { background: 'linear-gradient(135deg, var(--brand-primary), color-mix(in oklab, var(--brand-primary) 70%, var(--brand-accent, var(--brand-primary))))' } : undefined}>
              {VIEW_LABELS[v]}
            </button>
          )
        })}
        <button onClick={() => setActiveView('all')}
          className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${activeView === 'all'
            ? 'text-white shadow-[0_4px_14px_-4px_var(--brand-primary)] hover:-translate-y-0.5'
            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          style={activeView === 'all' ? { background: 'linear-gradient(135deg, var(--brand-primary), color-mix(in oklab, var(--brand-primary) 70%, var(--brand-accent, var(--brand-primary))))' } : undefined}>
          <Grid3X3 className="w-4 h-4" /> All
        </button>
        <button onClick={goNext}
          aria-label="Next sheet"
          className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="ml-auto text-[11px] text-slate-400 hidden md:flex items-center gap-3">
          <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">←/→</kbd> nav</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">+/-</kbd> zoom</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">F</kbd> fullscreen</span>
        </span>
      </div>

      {/* ═══════════════════════════════════════════
          MAIN LAYOUT: Controls (left) + Drawing (right)
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-4">

        {/* ── LEFT PANEL: Project Picker + Dimension Controls + Prompt ── */}
        <div className="space-y-4 order-2 xl:order-1">

          {/* Project Picker */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Select Project</span>
            </div>
            <div className="relative">
              <button onClick={() => setShowProjectPicker(!showProjectPicker)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                <span className={selectedProject ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400'}>
                  {selectedProject ? selectedProject.project_name : 'Choose a quotation...'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showProjectPicker ? 'rotate-180' : ''}`} />
              </button>
              {showProjectPicker && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl max-h-72 overflow-hidden">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                      <Search className="w-3.5 h-3.5 text-slate-400" />
                      <input autoFocus value={projectSearch} onChange={e => setProjectSearch(e.target.value)}
                        placeholder="Search projects..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {loadingProjects ? (
                      <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                    ) : filteredProjects.length === 0 ? (
                      <div className="text-center py-6 text-sm text-slate-400">No projects found</div>
                    ) : filteredProjects.map(p => (
                      <button key={p.id} onClick={() => applyProject(p)}
                        className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${selectedProject?.id === p.id ? 'bg-slate-50 dark:bg-slate-800' : ''}`}>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{p.project_name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{p.client_name || 'No client'} {p.building_params?.building_length ? `· ${p.building_params.building_length}x${p.building_params.building_width}ft` : ''}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Dimension Controls */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Sliders className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Dimensions</span>
            </div>
            <div className="space-y-4">
              <DimSlider label="Length" icon={Ruler} value={L} min={20} max={500} onChange={v => updateParam('building_length', v)} />
              <DimSlider label="Width" icon={Ruler} value={W} min={10} max={300} onChange={v => updateParam('building_width', v)} />
              <DimSlider label="Full Height (Ridge)" icon={ArrowUp} value={Hf} min={10} max={100} onChange={v => updateParam('full_height', v)} />
              <DimSlider label="Wall Height (Eave)" icon={Layers} value={+params.wall_height || 20} min={5} max={80} onChange={v => updateParam('wall_height', v)} />
            </div>

            {/* Roof & Cladding */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Roof Type</label>
                <div className="flex gap-2">
                  {[{ val: 'gable', label: 'Gable (A-Type)' }, { val: 'single_slope', label: 'Single Slope' }].map(opt => (
                    <button key={opt.val} onClick={() => updateParam('roof_type', opt.val)}
                      className={`flex-1 text-xs font-semibold py-2 rounded-lg border transition-all ${
                        params.roof_type === opt.val || (opt.val === 'gable' && params.roof_type === 'a_type')
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                      }`}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Roof Sheet</label>
                <div className="flex gap-2">
                  {[{ val: 'bare_galvalume_0.47mm', label: 'Galvalume' }, { val: 'puf_panel_50mm', label: 'PUF Panel' }].map(opt => (
                    <button key={opt.val} onClick={() => updateParam('roof_sheet_type', opt.val)}
                      className={`flex-1 text-xs font-semibold py-2 rounded-lg border transition-all ${
                        (params.roof_sheet_type || '').includes(opt.val.split('_')[0])
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                      }`}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Side Cladding</label>
                <div className="flex gap-2">
                  {[{ val: 'bare_colour_galvalume', label: 'Galvalume' }, { val: 'puf_panel_50mm', label: 'PUF Panel' }].map(opt => (
                    <button key={opt.val} onClick={() => updateParam('side_cladding_type', opt.val)}
                      className={`flex-1 text-xs font-semibold py-2 rounded-lg border transition-all ${
                        (params.side_cladding_type || '').includes(opt.val.split('_')[0])
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                      }`}>{opt.label}</button>
                  ))}
                </div>
              </div>

              {/* Mezzanine */}
              <div className="pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Mezzanine Floor</label>
                  <button onClick={() => {
                    const next = !params.mezzanine_required
                    updateParam('mezzanine_required', next)
                    if (next && (!params.mezz_length || +params.mezz_length <= 0))
                      setParams(p => ({ ...p, mezzanine_required: true, mezz_length: Math.round(L * 0.5), mezz_width: Math.round(W * 0.8) }))
                  }}
                    className={`relative w-10 h-5 rounded-full transition-colors ${params.mezzanine_required ? 'bg-[var(--brand-primary)]' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${params.mezzanine_required ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {params.mezzanine_required && (
                  <div className="mt-3 space-y-3 pl-2 border-l-2 border-emerald-200 dark:border-emerald-800">
                    <DimSlider label="Mezz Length" icon={Ruler} value={+params.mezz_length || 0} min={5} max={L} onChange={v => updateParam('mezz_length', v)} />
                    <DimSlider label="Mezz Width" icon={Ruler} value={+params.mezz_width || 0} min={5} max={W} onChange={v => updateParam('mezz_width', v)} />
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Drawing Components / Optional Features */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Hammer className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Components</span>
            </div>
            <div className="space-y-2.5">
              {[
                { key: 'turbo_vent', label: 'Turbo Ventilator', icon: Wind },
                { key: 'ridge_monitor', label: 'Ridge Monitor', icon: ArrowUp },
                { key: 'light_sheets', label: 'Light Sheets', icon: Sun },
                { key: 'louvers', label: 'Louvers', icon: Layers },
                { key: 'shutter_in_section', label: 'Rolling Shutter', icon: Layers },
                { key: 'crane_required', label: 'EOT Crane', icon: Hammer },
              ].map(opt => {
                const Icon = opt.icon
                const on = !!params[opt.key]
                return (
                  <div key={opt.key} className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <Icon className="w-3.5 h-3.5" /> {opt.label}
                    </label>
                    <button onClick={() => updateParam(opt.key, !on)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${on ? 'bg-[var(--brand-primary)]' : 'bg-slate-300 dark:bg-slate-600'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                )
              })}
              {params.crane_required && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5 pl-2 border-l-2 border-amber-200 dark:border-amber-800">
                  <DimSlider label="Crane Capacity" icon={Hammer}
                    value={+params.crane_capacity || 5} min={1} max={50} unit="T"
                    onChange={v => updateParam('crane_capacity', v)} />
                  <DimSlider label="Crane Rail Ht" icon={ArrowUp}
                    value={+params.crane_height || 14} min={8} max={Math.max(8, +params.wall_height - 4)}
                    onChange={v => updateParam('crane_height', v)} />
                </div>
              )}
            </div>
          </Card>

          {/* Prompt Studio */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Prompt Studio</span>
              </div>
              {promptHistory.length > 0 && (
                <button onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
                  <History className="w-3 h-3" />{promptHistory.length}
                </button>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mb-2.5 leading-relaxed">
              Describe changes in plain English:<br />
              <span className="text-slate-500 font-medium">"length to 150"</span> &#183;
              <span className="text-slate-500 font-medium"> "add mezzanine"</span> &#183;
              <span className="text-slate-500 font-medium"> "gable roof"</span> &#183;
              <span className="text-slate-500 font-medium"> "make it bigger"</span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input ref={promptRef} value={prompt} onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handlePrompt() }}
                  placeholder="e.g. length to 200, wall height 25..."
                  className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)] outline-none transition-all" />
                {prompt && (
                  <button onClick={() => setPrompt('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button onClick={handlePrompt} disabled={!prompt.trim()}
                className="h-10 w-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all hover:-translate-y-0.5 shadow-[0_4px_14px_-4px_var(--brand-primary)]"
                style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent, var(--brand-primary)))' }}>
                <Send className="w-4 h-4" />
              </button>
            </div>
            {/* Quick prompts */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {['length to 150', 'add mezzanine', 'gable roof', 'single slope', 'puf roof', 'make it bigger', 'wall height 25', 'width to 80'].map(q => (
                <button key={q} onClick={() => runPrompt(q)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  {q}
                </button>
              ))}
            </div>
            {/* History */}
            {showHistory && promptHistory.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 max-h-40 overflow-y-auto space-y-2">
                {promptHistory.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-slate-600 dark:text-slate-400 font-medium">"{h.text}"</span>
                      <div className="text-slate-400 mt-0.5">{h.changes.join(' | ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── RIGHT PANEL: Drawing Sheets ── */}
        <div className="space-y-4 order-1 xl:order-2">
          {activeView === 'all' ? (
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
              {VIEWS.map(v => (
                <Card key={v} className="overflow-hidden">
                  <CardHeader title={VIEW_LABELS[v]} subtitle="Click to enlarge" />
                  <div className="cursor-pointer" onClick={() => setActiveView(v)}>
                    {renderSheet(v)}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden" id="drawing-sheet" ref={drawingContainerRef}>
              <CardHeader title={VIEW_LABELS[activeView]}
                subtitle={`Sheet: A2 — Scale: NTS — ${today()} — Sheet ${VIEWS.indexOf(activeView) + 1} of ${VIEWS.length}`}
                action={
                  <div className="flex items-center gap-1.5" data-no-pan>
                    <Badge>{VIEW_DRG_PREFIX[activeView]}-01</Badge>
                    <div className="hidden sm:flex items-center gap-0.5 ml-2 px-1 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                      <button onClick={zoomOut} title="Zoom out (-)"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors">
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums w-10 text-center">
                        {Math.round(zoom * 100)}%
                      </span>
                      <button onClick={zoomIn} title="Zoom in (+)"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors">
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={resetZoom} title="Reset (0)"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-0.5" />
                      <button onClick={toggleFullscreen} title="Fullscreen (F)"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors">
                        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                } />
              <div className="border-t border-slate-100 dark:border-slate-800 relative overflow-hidden bg-slate-50 dark:bg-slate-950"
                onWheel={onWheel}
                onMouseDown={onMouseDown}
                style={{
                  cursor: isPanning ? 'grabbing' : (zoom > 1 ? 'grab' : 'default'),
                  height: isFullscreen ? '100vh' : 'auto',
                  background: isFullscreen ? '#fff' : undefined,
                }}>
                <div
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                    willChange: 'transform',
                  }}>
                  {renderSheet(activeView)}
                </div>
                {zoom !== 1 && (
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur text-white text-[10px] font-bold flex items-center gap-1.5 pointer-events-none">
                    <Move className="w-3 h-3" /> Drag to pan · Ctrl+wheel to zoom
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Drawing Notes */}
          <Card>
            <div className="px-6 py-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">General Drawing Notes</p>
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-500 dark:text-slate-400">
                <li>All dimensions are in feet & inches. Drawings are Not To Scale (NTS).</li>
                <li>Column spacing: ~{Math.min(25, Math.round(L / Math.max(2, Math.ceil(L / 25))))} ft c/c (typical PEB bay spacing)</li>
                <li>Roof slope: 1 in 10 ({roofLabel} type)</li>
                <li>Roof sheet: {(params.roof_sheet_type || '').includes('puf') ? 'PUF Panel' : 'Bare Galvalume'}</li>
                <li>Side cladding: {(params.side_cladding_type || '').includes('puf') ? 'PUF Panel' : 'Colour Coated Galvalume'}</li>
                {params.mezzanine_required && <li>Mezzanine floor: {params.mezz_length || '-'} x {params.mezz_width || '-'} ft</li>}
                {params.crane_required && <li>EOT crane: {params.crane_capacity || '-'}T capacity at {params.crane_height || '-'}ft rail height</li>}
                <li>Optional: {[
                  params.turbo_vent && 'Turbo Vent',
                  params.ridge_monitor && 'Ridge Monitor',
                  params.light_sheets && 'Light Sheets',
                  params.louvers && 'Louvers',
                ].filter(Boolean).join(' · ') || 'None'}</li>
                <li>Refer to detailed structural drawings for fabrication and erection.</li>
                <li>All steel sections as per IS 800:2007 and relevant IS codes.</li>
              </ul>
            </div>
          </Card>
        </div>
      </div>

      {/* Hidden render target — used by Print PDF (All) to serialize every sheet */}
      <div ref={printAreaRef}
        aria-hidden="true"
        style={{ position: 'absolute', left: '-99999px', top: 0, width: '1400px', visibility: 'hidden', pointerEvents: 'none' }}>
        {VIEWS.map(v => <div key={v}>{renderSheet(v)}</div>)}
      </div>
    </div>
  )
}
