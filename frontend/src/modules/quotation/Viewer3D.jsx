/**
 * Viewer3D — Interactive 3D PEB Building Visualization
 *
 * Features:
 *  - Project/Quotation selector: pick any saved quotation to load its building params
 *  - Direct dimension controls: sliders + inputs for length, width, heights
 *  - Prompt panel: natural language input to alter the 3D model
 *  - Camera presets + orbit controls
 *  - Live BOQ stats (area, volume, tonnage, cost)
 */

import { Component, useState, useCallback, useEffect, Suspense, useMemo, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Sky, ContactShadows, Loader, GizmoHelper, GizmoViewport, Html, useGLTF } from '@react-three/drei'
import { EffectComposer, SSAO, Bloom, Vignette, BrightnessContrast, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import * as THREE from 'three'
import toast from 'react-hot-toast'
import {
  ArrowLeft, RotateCcw, Eye, ArrowUp, ArrowRight, Camera,
  Box, Search, ChevronDown, Sliders, MessageSquare, Send,
  Loader2, Maximize2, Minimize2, Building2, Ruler, Layers,
  TriangleRight, Plus, Minus, Sparkles, History, X,
  Wind, Sun, Hammer, FileImage, Pause, Play, AlertTriangle, EyeOff,
  Boxes, Crosshair, FileBox, User, Sparkle,
} from 'lucide-react'
import PEBBuilding from './PEBBuilding'
import BuildingForType from './BuildingForType'
import { Card, CardHeader, Stat, Button, PageHeader, Badge } from '../../components/ui/primitives'
import { quotationAPI } from '../../services/api'
import { calcBOQ } from '../../utils/boqEngine'

/* ─── Error Boundary for WebGL crashes ─── */
class ThreeErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('Three.js error:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-full min-h-[400px] bg-slate-900 text-white">
          <div className="text-center max-w-sm px-6">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <p className="text-sm font-semibold">3D Viewer crashed</p>
            <p className="text-xs text-slate-400 mt-1.5">
              {String(this.state.error?.message || 'WebGL rendering error')}
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

/* ─── HDRI Lighting Presets ─── */
const ENV_PRESETS = [
  { id: 'warehouse', label: 'Warehouse', desc: 'Neutral indoor — recommended' },
  { id: 'city', label: 'City', desc: 'Urban skyline reflections' },
  { id: 'sunset', label: 'Sunset', desc: 'Warm dramatic' },
  { id: 'park', label: 'Park', desc: 'Natural outdoor' },
  { id: 'studio', label: 'Studio', desc: 'Bright neutral' },
]

/* ─── In-Canvas Helpers ─── */

/** MeasurementOverlay — yellow endpoints + dashed line + ft distance label */
function MeasurementOverlay({ points }) {
  if (points.length === 0) return null
  const a = points[0]
  const b = points[1]
  const dist = b ? Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) : 0
  const mid = b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] : null
  const ftLabel = dist > 0
    ? `${Math.floor(dist)}'-${Math.round((dist - Math.floor(dist)) * 12)}"   (${dist.toFixed(2)} ft)`
    : ''
  return (
    <group>
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.4, 16, 12]} />
          <meshBasicMaterial color="#facc15" depthTest={false} transparent opacity={0.95} />
        </mesh>
      ))}
      {b && (
        <>
          <line>
            <bufferGeometry attach="geometry">
              <bufferAttribute
                attach="attributes-position"
                array={new Float32Array([...a, ...b])}
                count={2}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#facc15" linewidth={2} depthTest={false} transparent />
          </line>
          {mid && (
            <Html position={mid} center distanceFactor={18}>
              <div className="px-2 py-1 rounded-md bg-yellow-400 text-black text-xs font-bold whitespace-nowrap shadow-lg pointer-events-none">
                {ftLabel}
              </div>
            </Html>
          )}
        </>
      )}
    </group>
  )
}

/** HoverTooltip — shows element name when hovering over a tagged mesh */
function HoverTooltip({ info }) {
  if (!info) return null
  return (
    <Html position={info.point} center>
      <div className="px-2 py-0.5 rounded bg-black/85 text-white text-[11px] font-mono whitespace-nowrap pointer-events-none -translate-y-7 backdrop-blur-sm">
        {info.name}
      </div>
    </Html>
  )
}

/** HumanScale — procedural 5'10" figure for size reference. rotationY: which way it faces */
function HumanScale({ position = [0, 0, 0], rotationY = 0 }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Head */}
      <mesh position={[0, 5.5, 0]} castShadow>
        <sphereGeometry args={[0.42, 16, 12]} />
        <meshStandardMaterial color="#f5d6a8" roughness={0.6} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 3.8, 0]} castShadow>
        <boxGeometry args={[1.45, 2.5, 0.7]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.7} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.4, 1.4, 0]} castShadow>
        <boxGeometry args={[0.42, 2.6, 0.55]} />
        <meshStandardMaterial color="#1f2937" roughness={0.7} />
      </mesh>
      <mesh position={[0.4, 1.4, 0]} castShadow>
        <boxGeometry args={[0.42, 2.6, 0.55]} />
        <meshStandardMaterial color="#1f2937" roughness={0.7} />
      </mesh>
      {/* Arms */}
      <mesh position={[-0.92, 3.95, 0]} castShadow rotation={[0, 0, 0.08]}>
        <boxGeometry args={[0.32, 2.2, 0.42]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.7} />
      </mesh>
      <mesh position={[0.92, 3.95, 0]} castShadow rotation={[0, 0, -0.08]}>
        <boxGeometry args={[0.32, 2.2, 0.42]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.7} />
      </mesh>
      {/* Floating scale label */}
      <Html position={[0, 7, 0]} center distanceFactor={18}>
        <div className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold whitespace-nowrap pointer-events-none shadow-lg">
          5'10" scale
        </div>
      </Html>
    </group>
  )
}

/** Tree — detailed deciduous tree with branches + 24 foliage clusters in varied greens */
function Tree({ position = [0, 0, 0], height = 18, scale = 1 }) {
  // Per-instance deterministic seed based on position
  const seed = Math.abs(Math.round(position[0] * 0.7 + position[2] * 1.3))

  const trunkH = height * 0.4
  const crownH = height * 0.6
  const crownCenterY = trunkH + crownH * 0.45
  const crownR = height * 0.32

  // Generate ~24 foliage cluster positions in a roughly spherical crown
  const clusters = useMemo(() => {
    const arr = []
    const greens = [
      "#2d5e3a", "#3a7d4a", "#4a9054", "#266b35",
      "#56a25a", "#3e8048", "#1f5b2d", "#5fa86a",
    ]
    for (let i = 0; i < 24; i++) {
      // Spherical Fibonacci-like distribution
      const phi = Math.acos(1 - 2 * (i + 0.5) / 24)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i + (seed % 6.28)
      // Squashed sphere (wider than tall)
      const r = crownR * (0.7 + ((i + seed) % 5) * 0.06)
      const x = r * 1.1 * Math.sin(phi) * Math.cos(theta)
      const z = r * 1.1 * Math.sin(phi) * Math.sin(theta)
      const y = crownCenterY + r * 0.85 * Math.cos(phi)
      const size = crownR * (0.3 + ((i + seed * 3) % 4) * 0.08)
      const colorIdx = (i + seed) % greens.length
      arr.push({ pos: [x, y, z], r: size, color: greens[colorIdx] })
    }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, crownR, crownCenterY])

  // Visible branches (4 main branches reaching up-and-out from trunk top)
  const branches = useMemo(() => {
    const arr = []
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + (seed * 0.31)
      const len = trunkH * 0.45
      const tilt = 0.5 + (i % 2) * 0.15
      arr.push({
        rotY: a,
        rotZ: tilt,
        len,
      })
    }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, trunkH])

  return (
    <group position={position} scale={scale}>
      {/* Trunk — tapered, slight irregularity via segments */}
      <mesh position={[0, trunkH * 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.6, trunkH, 10]} />
        <meshStandardMaterial color="#5a3e2a" roughness={0.95} />
      </mesh>
      {/* Bark detail rings */}
      {[0.2, 0.45, 0.7].map((t, i) => (
        <mesh key={`bark-${i}`} position={[0, trunkH * t, 0]}>
          <cylinderGeometry args={[0.43 + ((i + seed) % 2) * 0.04, 0.46, 0.06, 10]} />
          <meshStandardMaterial color="#3a2818" roughness={0.95} />
        </mesh>
      ))}
      {/* Branches reaching up-and-out from trunk top */}
      {branches.map((b, i) => (
        <group key={`br-${i}`} position={[0, trunkH * 0.85, 0]} rotation={[0, b.rotY, b.rotZ]}>
          <mesh position={[b.len * 0.5, 0, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.14, b.len, 6]} />
            <meshStandardMaterial color="#4a3220" roughness={0.95} />
          </mesh>
        </group>
      ))}
      {/* Foliage cluster spheres — varied positions, sizes, greens */}
      {clusters.map((c, i) => (
        <mesh key={`fol-${i}`} position={c.pos} castShadow receiveShadow>
          <sphereGeometry args={[c.r, 10, 8]} />
          <meshStandardMaterial color={c.color} roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

/** PalmTree — detailed: tall thin trunk with ring scars + 16 fronds with leaflets + coconuts */
function PalmTree({ position = [0, 0, 0], height = 22, scale = 1 }) {
  const trunkH = height * 0.78
  const frondLen = height * 0.42

  return (
    <group position={position} scale={scale}>
      {/* Trunk — tall, thin, slightly tapered */}
      <mesh position={[0, trunkH * 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.55, trunkH, 14]} />
        <meshStandardMaterial color="#7a5b3e" roughness={0.95} />
      </mesh>
      {/* Trunk leaf-base rings (12 visible scars at increasing intervals) */}
      {Array.from({ length: 14 }).map((_, i) => {
        const t = (i + 1) / 15
        const r = 0.36 + (1 - t) * 0.12   // wider at bottom
        return (
          <mesh key={`ring-${i}`} position={[0, trunkH * t, 0]}>
            <cylinderGeometry args={[r + 0.04, r + 0.04, 0.08, 14]} />
            <meshStandardMaterial color="#5a4530" roughness={0.95} />
          </mesh>
        )
      })}
      {/* Crown / fronds — 16 in 3D arrangement */}
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i / 16) * Math.PI * 2
        // Vary droop angle for natural look (some fronds more horizontal, some drooping more)
        const droop = -0.25 - (i % 4) * 0.12
        const len = frondLen * (0.85 + (i % 3) * 0.08)
        const isUpper = i < 8
        return (
          <group key={`fr-${i}`} position={[0, trunkH + (isUpper ? 0.3 : 0), 0]} rotation={[0, a, droop]}>
            {/* Frond stem — long thin tapered cone */}
            <mesh position={[len * 0.5, 0, 0]} castShadow rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[0.08, len, 5, 1]} />
              <meshStandardMaterial color={i % 2 === 0 ? "#3a7d3e" : "#2e6b32"} roughness={0.85} />
            </mesh>
            {/* Leaflets — small angled cones along the frond */}
            {Array.from({ length: 6 }).map((_, j) => {
              const t = (j + 1) / 7
              const xPos = len * t
              const leafLen = len * 0.22 * (1 - t * 0.4)
              return (
                <group key={`lf-${j}`} position={[xPos, -t * 0.3, 0]}>
                  {/* Top-side leaflet */}
                  <mesh rotation={[0, 0, -0.2 + j * 0.05]} position={[0, 0, leafLen * 0.4]} castShadow>
                    <coneGeometry args={[0.14, leafLen, 4, 1]} />
                    <meshStandardMaterial
                      color={j % 2 === 0 ? "#4a8e54" : "#3a7d3e"}
                      roughness={0.85}
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                  {/* Bottom-side leaflet */}
                  <mesh rotation={[Math.PI, 0, -0.2 + j * 0.05]} position={[0, 0, -leafLen * 0.4]} castShadow>
                    <coneGeometry args={[0.14, leafLen, 4, 1]} />
                    <meshStandardMaterial
                      color={j % 2 === 0 ? "#266b35" : "#3a7d3e"}
                      roughness={0.85}
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                </group>
              )
            })}
          </group>
        )
      })}
      {/* Coconut cluster — 5 small brown spheres at crown center */}
      {Array.from({ length: 5 }).map((_, i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <mesh
            key={`coco-${i}`}
            position={[0.4 * Math.cos(a), trunkH + 0.15, 0.4 * Math.sin(a)]}
            castShadow
          >
            <sphereGeometry args={[0.32, 10, 8]} />
            <meshStandardMaterial color="#4a3a25" roughness={0.85} />
          </mesh>
        )
      })}
      {/* Crown center cap (visible from below) */}
      <mesh position={[0, trunkH + 0.05, 0]}>
        <sphereGeometry args={[0.42, 12, 8]} />
        <meshStandardMaterial color="#3d2d1c" roughness={0.95} />
      </mesh>
    </group>
  )
}

/** Car — detailed procedural sedan with proper proportions, lights, mirrors, hubcaps, grille */
function Car({ position = [0, 0, 0], rotation = 0, color = "#dc2626" }) {
  // All measurements in feet — typical sedan: ~15.5 ft long, 6 ft wide, 4.7 ft tall
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* ── BODY ── */}
      {/* Lower chassis (full length) */}
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[15.0, 1.0, 5.8]} />
        <meshStandardMaterial color={color} metalness={0.78} roughness={0.28} envMapIntensity={1.4} />
      </mesh>
      {/* Mid body (slightly inset) */}
      <mesh position={[0, 1.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[14.3, 0.9, 5.85]} />
        <meshStandardMaterial color={color} metalness={0.78} roughness={0.28} envMapIntensity={1.4} />
      </mesh>
      {/* Hood (front, slightly sloped) */}
      <mesh position={[5.2, 2.3, 0]} rotation={[0, 0, -0.06]} castShadow>
        <boxGeometry args={[4.2, 0.4, 5.6]} />
        <meshStandardMaterial color={color} metalness={0.78} roughness={0.28} envMapIntensity={1.4} />
      </mesh>
      {/* Trunk lid (back, slight slope) */}
      <mesh position={[-5.6, 2.35, 0]} rotation={[0, 0, 0.04]} castShadow>
        <boxGeometry args={[3.2, 0.4, 5.6]} />
        <meshStandardMaterial color={color} metalness={0.78} roughness={0.28} envMapIntensity={1.4} />
      </mesh>

      {/* ── CABIN (greenhouse) ── */}
      {/* Roof */}
      <mesh position={[0, 3.5, 0]} castShadow>
        <boxGeometry args={[6.5, 0.18, 4.9]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.32} envMapIntensity={1.4} />
      </mesh>
      {/* A-pillar / B-pillar / C-pillar (left) */}
      {[3.2, -3.2].map((px, i) => (
        <mesh key={`pillar-r-${i}`} position={[px, 2.95, 2.45]} rotation={[0, 0, i === 0 ? -0.45 : 0.4]} castShadow>
          <boxGeometry args={[0.25, 1.3, 0.18]} />
          <meshStandardMaterial color={color} metalness={0.7} roughness={0.32} />
        </mesh>
      ))}
      {[3.2, -3.2].map((px, i) => (
        <mesh key={`pillar-l-${i}`} position={[px, 2.95, -2.45]} rotation={[0, 0, i === 0 ? -0.45 : 0.4]} castShadow>
          <boxGeometry args={[0.25, 1.3, 0.18]} />
          <meshStandardMaterial color={color} metalness={0.7} roughness={0.32} />
        </mesh>
      ))}
      {/* B-pillar (middle, vertical) */}
      {[2.45, -2.45].map((zp, i) => (
        <mesh key={`pillar-b-${i}`} position={[0, 2.95, zp]} castShadow>
          <boxGeometry args={[0.22, 1.3, 0.18]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}

      {/* ── GLASS ── */}
      {/* Windshield (sloped) */}
      <mesh position={[3.2, 2.95, 0]} rotation={[0, 0, -0.5]} castShadow>
        <boxGeometry args={[2.6, 1.6, 4.85]} />
        <meshPhysicalMaterial
          color="#1a2238" metalness={0.1} roughness={0.04}
          transmission={0.6} transparent opacity={0.55} envMapIntensity={2.5}
          clearcoat={1} clearcoatRoughness={0.05}
        />
      </mesh>
      {/* Rear glass (sloped opposite) */}
      <mesh position={[-3.2, 2.95, 0]} rotation={[0, 0, 0.5]} castShadow>
        <boxGeometry args={[2.4, 1.6, 4.85]} />
        <meshPhysicalMaterial
          color="#1a2238" metalness={0.1} roughness={0.04}
          transmission={0.6} transparent opacity={0.55} envMapIntensity={2.5}
          clearcoat={1} clearcoatRoughness={0.05}
        />
      </mesh>
      {/* Side windows (left + right) */}
      {[2.55, -2.55].map((zp, i) => (
        <mesh key={`sw-${i}`} position={[0, 2.95, zp]}>
          <boxGeometry args={[6.0, 1.0, 0.06]} />
          <meshPhysicalMaterial
            color="#1a2238" metalness={0.1} roughness={0.04}
            transmission={0.55} transparent opacity={0.5} envMapIntensity={2.5}
          />
        </mesh>
      ))}

      {/* ── WHEELS ── */}
      {[
        [4.5, 1.0, 2.85], [4.5, 1.0, -2.85],
        [-4.5, 1.0, 2.85], [-4.5, 1.0, -2.85],
      ].map(([wx, wy, wz], i) => (
        <group key={`wh-${i}`} position={[wx, wy, wz]}>
          {/* Tire */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[1.1, 1.1, 0.7, 16]} />
            <meshStandardMaterial color="#0e0e0e" roughness={0.95} />
          </mesh>
          {/* Tire sidewall ring detail */}
          {[-0.36, 0.36].map((zo, k) => (
            <mesh key={`tw-${k}`} position={[0, 0, zo]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.95, 0.08, 6, 14]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
            </mesh>
          ))}
          {/* Hubcap rim */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.62, 0.62, 0.72, 16]} />
            <meshStandardMaterial color="#888" metalness={0.92} roughness={0.18} envMapIntensity={1.8} />
          </mesh>
          {/* Hubcap spokes (5-spoke pattern) */}
          {Array.from({ length: 5 }).map((_, k) => {
            const a = (k / 5) * Math.PI * 2
            return (
              <mesh
                key={`spoke-${k}`}
                position={[Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32]}
                rotation={[Math.PI / 2, 0, a]}
              >
                <boxGeometry args={[0.55, 0.74, 0.1]} />
                <meshStandardMaterial color="#a8a8a8" metalness={0.85} roughness={0.25} envMapIntensity={1.5} />
              </mesh>
            )
          })}
          {/* Center cap */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.74, 12]} />
            <meshStandardMaterial color="#444" metalness={0.7} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Wheel arches (subtle dark surrounds) */}
      {[4.5, -4.5].map((wx, i) =>
        [2.85, -2.85].map((wz, j) => (
          <mesh key={`arch-${i}-${j}`} position={[wx, 1.3, wz]} rotation={[0, 0, 0]}>
            <torusGeometry args={[1.35, 0.18, 6, 12, Math.PI]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
          </mesh>
        ))
      )}

      {/* ── FRONT DETAILS ── */}
      {/* Grille */}
      <mesh position={[7.4, 1.5, 0]} castShadow>
        <boxGeometry args={[0.15, 0.65, 4.2]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Grille horizontal slats */}
      {[1.3, 1.5, 1.7].map((py, i) => (
        <mesh key={`gs-${i}`} position={[7.45, py, 0]}>
          <boxGeometry args={[0.05, 0.06, 4.0]} />
          <meshStandardMaterial color="#666" metalness={0.85} roughness={0.3} />
        </mesh>
      ))}
      {/* Headlights — pair of horizontal rectangular */}
      {[2.4, -2.4].map(z => (
        <group key={`hl-${z}`} position={[7.45, 1.85, z]}>
          {/* Lens housing */}
          <mesh castShadow>
            <boxGeometry args={[0.18, 0.6, 1.4]} />
            <meshStandardMaterial color="#fffce0" emissive="#ffffaa" emissiveIntensity={0.5} />
          </mesh>
          {/* Glass cover */}
          <mesh position={[0.05, 0, 0]}>
            <boxGeometry args={[0.12, 0.55, 1.3]} />
            <meshPhysicalMaterial
              color="#ffffe0" metalness={0.1} roughness={0.05}
              transmission={0.7} transparent opacity={0.8}
            />
          </mesh>
        </group>
      ))}
      {/* Front bumper */}
      <mesh position={[7.0, 1.0, 0]}>
        <boxGeometry args={[0.5, 0.5, 5.7]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* License plate area */}
      <mesh position={[7.45, 1.05, 0]}>
        <boxGeometry args={[0.05, 0.4, 1.4]} />
        <meshStandardMaterial color="#f5f5f5" emissive="#ffffe0" emissiveIntensity={0.1} />
      </mesh>

      {/* ── REAR DETAILS ── */}
      {/* Tail lights */}
      {[2.4, -2.4].map(z => (
        <group key={`tl-${z}`} position={[-7.45, 1.85, z]}>
          <mesh castShadow>
            <boxGeometry args={[0.18, 0.55, 1.3]} />
            <meshStandardMaterial color="#a83232" emissive="#dc2626" emissiveIntensity={0.55} />
          </mesh>
        </group>
      ))}
      {/* Rear bumper */}
      <mesh position={[-7.0, 1.0, 0]}>
        <boxGeometry args={[0.5, 0.5, 5.7]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} metalness={0.3} />
      </mesh>

      {/* ── SIDE DETAILS ── */}
      {/* Side mirrors */}
      {[2.95, -2.95].map(z => (
        <group key={`mr-${z}`} position={[2.0, 2.85, z]}>
          {/* Mirror arm */}
          <mesh>
            <boxGeometry args={[0.1, 0.1, 0.4]} />
            <meshStandardMaterial color={color} metalness={0.78} roughness={0.28} />
          </mesh>
          {/* Mirror cup */}
          <mesh position={[0, 0, z > 0 ? 0.35 : -0.35]} rotation={[0, 0, -0.15]} castShadow>
            <boxGeometry args={[0.5, 0.45, 0.4]} />
            <meshStandardMaterial color={color} metalness={0.78} roughness={0.28} />
          </mesh>
          {/* Mirror glass */}
          <mesh position={[0.05, 0, z > 0 ? 0.45 : -0.45]} rotation={[0, 0, -0.15]}>
            <boxGeometry args={[0.06, 0.35, 0.3]} />
            <meshPhysicalMaterial color="#aaa" metalness={0.95} roughness={0.05} envMapIntensity={2.5} />
          </mesh>
        </group>
      ))}
      {/* Door handles */}
      {[1.8, -1.8].map(x =>
        [2.95, -2.95].map(z => (
          <mesh key={`dh-${x}-${z}`} position={[x, 1.85, z]}>
            <boxGeometry args={[0.4, 0.12, 0.08]} />
            <meshStandardMaterial color="#888" metalness={0.85} roughness={0.3} />
          </mesh>
        ))
      )}
      {/* Door seam lines (subtle dark inset) */}
      {[1.5, -1.5].map(x =>
        [2.96, -2.96].map(z => (
          <mesh key={`ds-${x}-${z}`} position={[x, 1.5, z]}>
            <boxGeometry args={[0.04, 1.6, 0.02]} />
            <meshStandardMaterial color="#000" />
          </mesh>
        ))
      )}
      {/* Side trim (chrome strip) */}
      {[2.93, -2.93].map((zp, i) => (
        <mesh key={`trim-${i}`} position={[0, 1.45, zp]}>
          <boxGeometry args={[13.5, 0.1, 0.04]} />
          <meshStandardMaterial color="#aaa" metalness={0.92} roughness={0.18} envMapIntensity={1.8} />
        </mesh>
      ))}
    </group>
  )
}

/** Motorbike — detailed: engine, tank, seat, tail, exhaust, fork, mirrors */
function Motorbike({ position = [0, 0, 0], rotation = 0, color = "#1f2937" }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* ── ENGINE BLOCK (center, dark metal) ── */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <boxGeometry args={[1.6, 1.0, 0.95]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.85} roughness={0.32} envMapIntensity={1.4} />
      </mesh>
      {/* Engine cooling fins (parallel slits) */}
      {[-0.3, 0, 0.3].map((py, i) => (
        <mesh key={`ef-${i}`} position={[0.05, 1.4 + py, 0]}>
          <boxGeometry args={[1.65, 0.05, 0.97]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.85} roughness={0.4} />
        </mesh>
      ))}
      {/* Crankcase (lower silver block) */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[1.4, 0.4, 0.85]} />
        <meshStandardMaterial color="#888" metalness={0.92} roughness={0.22} envMapIntensity={1.6} />
      </mesh>

      {/* ── FUEL TANK (curvy via stacked boxes) ── */}
      <mesh position={[0.5, 2.15, 0]} castShadow>
        <boxGeometry args={[2.0, 0.85, 1.1]} />
        <meshStandardMaterial color={color} metalness={0.78} roughness={0.28} envMapIntensity={1.6} />
      </mesh>
      <mesh position={[0.5, 2.62, 0]} castShadow>
        <boxGeometry args={[1.6, 0.3, 0.85]} />
        <meshStandardMaterial color={color} metalness={0.78} roughness={0.28} />
      </mesh>
      {/* Tank graphic stripe */}
      <mesh position={[0.5, 2.16, 0.56]}>
        <boxGeometry args={[1.7, 0.5, 0.04]} />
        <meshStandardMaterial color="#f5f5f5" roughness={0.5} metalness={0.3} />
      </mesh>

      {/* ── SEAT ── */}
      <mesh position={[-1.0, 2.25, 0]} castShadow>
        <boxGeometry args={[2.2, 0.35, 1.0]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.85} />
      </mesh>
      {/* Seat backrest */}
      <mesh position={[-2.0, 2.55, 0]} rotation={[0, 0, -0.2]} castShadow>
        <boxGeometry args={[0.4, 0.7, 0.95]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.85} />
      </mesh>

      {/* ── TAIL SECTION ── */}
      <mesh position={[-2.4, 2.4, 0]} rotation={[0, 0, 0.25]} castShadow>
        <boxGeometry args={[1.2, 0.5, 0.85]} />
        <meshStandardMaterial color={color} metalness={0.78} roughness={0.28} />
      </mesh>
      {/* Tail light */}
      <mesh position={[-3.0, 2.5, 0]}>
        <boxGeometry args={[0.2, 0.25, 0.45]} />
        <meshStandardMaterial color="#a83232" emissive="#dc2626" emissiveIntensity={0.5} />
      </mesh>

      {/* ── WHEELS ── */}
      {/* Front wheel (slightly larger) */}
      <group position={[2.4, 1.05, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[1.1, 1.1, 0.42, 16]} />
          <meshStandardMaterial color="#0e0e0e" roughness={0.95} />
        </mesh>
        {/* Sidewall ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.95, 0.08, 6, 14]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
        </mesh>
        {/* Hub */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.43, 14]} />
          <meshStandardMaterial color="#a8a8a8" metalness={0.92} roughness={0.18} envMapIntensity={1.8} />
        </mesh>
        {/* Spokes (5) */}
        {Array.from({ length: 5 }).map((_, k) => {
          const a = (k / 5) * Math.PI * 2
          return (
            <mesh
              key={`fs-${k}`}
              position={[Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3]}
              rotation={[Math.PI / 2, 0, a]}
            >
              <boxGeometry args={[0.45, 0.44, 0.06]} />
              <meshStandardMaterial color="#888" metalness={0.92} roughness={0.2} />
            </mesh>
          )
        })}
      </group>
      {/* Rear wheel (slightly smaller, wider tire) */}
      <group position={[-2.5, 1.0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[1.0, 1.0, 0.55, 16]} />
          <meshStandardMaterial color="#0e0e0e" roughness={0.95} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.85, 0.08, 6, 14]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.56, 14]} />
          <meshStandardMaterial color="#a8a8a8" metalness={0.92} roughness={0.18} envMapIntensity={1.8} />
        </mesh>
        {Array.from({ length: 5 }).map((_, k) => {
          const a = (k / 5) * Math.PI * 2
          return (
            <mesh
              key={`rs-${k}`}
              position={[Math.cos(a) * 0.27, 0, Math.sin(a) * 0.27]}
              rotation={[Math.PI / 2, 0, a]}
            >
              <boxGeometry args={[0.4, 0.57, 0.06]} />
              <meshStandardMaterial color="#888" metalness={0.92} roughness={0.2} />
            </mesh>
          )
        })}
      </group>

      {/* ── FRONT FORK (twin tubes) ── */}
      {[-0.18, 0.18].map((zo, i) => (
        <mesh key={`fork-${i}`} position={[2.1, 1.85, zo]} rotation={[0, 0, -0.22]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1.7, 8]} />
          <meshStandardMaterial color="#aaa" metalness={0.95} roughness={0.15} envMapIntensity={1.8} />
        </mesh>
      ))}
      {/* Front fender */}
      <mesh position={[2.4, 1.95, 0]} castShadow>
        <boxGeometry args={[1.0, 0.18, 0.6]} />
        <meshStandardMaterial color={color} metalness={0.78} roughness={0.28} />
      </mesh>

      {/* ── HANDLEBAR ── */}
      <mesh position={[1.85, 2.85, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 1.7, 10]} />
        <meshStandardMaterial color="#0f0f0f" roughness={0.6} />
      </mesh>
      {/* Hand grips */}
      {[-0.8, 0.8].map((zo, i) => (
        <mesh key={`grip-${i}`} position={[1.85, 2.85, zo]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.4, 10]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
        </mesh>
      ))}
      {/* Speedometer cluster */}
      <mesh position={[1.85, 3.05, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.15, 12]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* ── HEADLIGHT ── */}
      <group position={[2.35, 2.5, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.42, 14, 10]} />
          <meshStandardMaterial color="#fffce0" emissive="#ffffaa" emissiveIntensity={0.5} />
        </mesh>
        {/* Lens housing rim */}
        <mesh position={[-0.1, 0, 0]}>
          <torusGeometry args={[0.42, 0.08, 8, 14]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>

      {/* ── EXHAUST PIPE (right side, sweeping back) ── */}
      <mesh position={[-1.0, 1.1, 0.6]} rotation={[0, 0.1, -0.05]} castShadow>
        <cylinderGeometry args={[0.18, 0.16, 3.0, 10]} />
        <meshStandardMaterial color="#888" metalness={0.92} roughness={0.18} envMapIntensity={1.8} />
      </mesh>
      {/* Exhaust muffler (rear silver canister) */}
      <mesh position={[-2.6, 1.2, 0.7]} castShadow>
        <cylinderGeometry args={[0.25, 0.22, 1.4, 12]} />
        <meshStandardMaterial color="#a0a0a0" metalness={0.92} roughness={0.18} envMapIntensity={1.8} />
      </mesh>

      {/* ── MIRRORS (twin) ── */}
      {[-0.5, 0.5].map((zo, i) => (
        <group key={`mr-${i}`} position={[1.7, 3.15, zo]}>
          {/* Stem */}
          <mesh>
            <cylinderGeometry args={[0.04, 0.04, 0.5, 6]} />
            <meshStandardMaterial color="#0a0a0a" />
          </mesh>
          {/* Mirror cup */}
          <mesh position={[0.2, 0.25, 0]} rotation={[0, 0, -0.4]} castShadow>
            <boxGeometry args={[0.4, 0.3, 0.18]} />
            <meshStandardMaterial color="#0a0a0a" metalness={0.5} roughness={0.4} />
          </mesh>
          {/* Mirror glass */}
          <mesh position={[0.28, 0.3, 0]} rotation={[0, 0, -0.4]}>
            <boxGeometry args={[0.05, 0.25, 0.13]} />
            <meshPhysicalMaterial color="#aaa" metalness={0.95} roughness={0.05} envMapIntensity={2.5} />
          </mesh>
        </group>
      ))}

      {/* Footpegs */}
      {[-0.3, 0.3].map((zo, i) => (
        <mesh key={`fp-${i}`} position={[-0.3, 1.0, zo]}>
          <boxGeometry args={[0.5, 0.1, 0.15]} />
          <meshStandardMaterial color="#444" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

/* ─── GLB Asset Loader (with graceful procedural fallback) ─── */

// Configure URLs here. Drop CC0 GLB files into /public/models/ to upgrade visuals.
// See /public/models/README.md for recommended free model sources.
const MODEL_DEFAULTS = {
  tree:      { src: '/models/tree.glb',      scale: 5.5 },
  palm:      { src: '/models/palm.glb',      scale: 7.0 },
  // Default car.glb is the Cesium delivery truck (CC0, ships with the repo, ~15 ft long at scale 2.0)
  car:       { src: '/models/car.glb',       scale: 2.0 },
  motorbike: { src: '/models/motorbike.glb', scale: 2.2 },
}

class AssetErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error) {
    // Silently swallow — fallback handles it.
    if (typeof window !== 'undefined' && !window.__glbWarned) {
      window.__glbWarned = new Set()
    }
    const msg = String(error?.message || '')
    const url = msg.match(/\/models\/[^\s]+/)?.[0]
    if (url && window.__glbWarned && !window.__glbWarned.has(url)) {
      window.__glbWarned.add(url)
      console.info(`[Viewer3D] No GLB at ${url} — using procedural fallback. See /public/models/README.md`)
    }
  }
  render() {
    if (this.state.error) return this.props.fallback || null
    return this.props.children
  }
}

/** GLBModel — loads + clones a GLB scene, optionally tinting body material */
function GLBModel({ src, color, position = [0, 0, 0], rotation = 0, scale = 1 }) {
  const gltf = useGLTF(src)
  const scene = useMemo(() => {
    const c = gltf.scene.clone(true)
    c.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (color && child.material) {
          // Re-tint body materials (heuristic: name contains body/paint/main)
          const mat = child.material.clone()
          const lowerName = (mat.name || '').toLowerCase()
          if (lowerName.includes('body') || lowerName.includes('paint') ||
              lowerName.includes('main') || lowerName.includes('frame') ||
              !mat.name) {
            if (mat.color) mat.color.set(color)
          }
          child.material = mat
        }
      }
    })
    return c
  }, [gltf.scene, color])

  return (
    <primitive
      object={scene}
      position={position}
      rotation={[0, rotation, 0]}
      scale={scale}
    />
  )
}

/** ModelOrFallback — render GLB if available, else procedural fallback */
function ModelOrFallback({ src, fallback, ...props }) {
  if (!src) return fallback
  return (
    <AssetErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <GLBModel src={src} {...props} />
      </Suspense>
    </AssetErrorBoundary>
  )
}

/** Bush — small low shrub */
function Bush({ position = [0, 0, 0], scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.8, 0]} castShadow>
        <sphereGeometry args={[1.2, 12, 8]} />
        <meshStandardMaterial color="#3b6e4a" roughness={0.85} />
      </mesh>
      <mesh position={[0.55, 1.05, 0.3]} castShadow>
        <sphereGeometry args={[0.75, 10, 8]} />
        <meshStandardMaterial color="#4a8050" roughness={0.85} />
      </mesh>
      <mesh position={[-0.4, 1.0, -0.4]} castShadow>
        <sphereGeometry args={[0.65, 10, 8]} />
        <meshStandardMaterial color="#5a9050" roughness={0.85} />
      </mesh>
    </group>
  )
}

/** Landscape — paved parking lot with cars/bikes + lawns + asphalt road (no trees/bushes per user request) */
function Landscape({ L, W }) {
  // Parking lot pavement + cars + bikes in front of shutter (-L end)
  const lot = useMemo(() => {
    const lotW = Math.min(W * 1.2, 60)
    const lotD = 40
    const lotCenterX = -L / 2 - lotD / 2 - 2
    return { lotW, lotD, lotCenterX }
  }, [L, W])

  const cars = useMemo(() => {
    const carColors = ['#dc2626', '#ffffff', '#1e293b', '#94a3b8', '#0d9488']
    return [
      { pos: [lot.lotCenterX - 2, 0, -lot.lotW / 2 + 6], rot: Math.PI / 2, c: carColors[0] },
      { pos: [lot.lotCenterX - 2, 0, -lot.lotW / 2 + 16], rot: Math.PI / 2, c: carColors[1] },
      { pos: [lot.lotCenterX - 2, 0, lot.lotW / 2 - 6], rot: Math.PI / 2, c: carColors[2] },
      { pos: [lot.lotCenterX - 2, 0, lot.lotW / 2 - 16], rot: Math.PI / 2, c: carColors[3] },
    ]
  }, [lot])

  const bikes = useMemo(() => [
    { pos: [-L / 2 - 6, 0, -lot.lotW / 4], rot: Math.PI / 2 },
    { pos: [-L / 2 - 6, 0, -lot.lotW / 4 + 4], rot: Math.PI / 2 },
    { pos: [-L / 2 - 6, 0, -lot.lotW / 4 + 8], rot: Math.PI / 2, c: '#dc2626' },
  ], [L, lot])

  return (
    <group>
      {/* ── ASPHALT PARKING LOT (in front of shutter) ── */}
      <mesh position={[lot.lotCenterX, 0.04, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[lot.lotD, lot.lotW]} />
        <meshStandardMaterial color="#2c2c2c" roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Parking line markings (white) */}
      {Array.from({ length: 5 }).map((_, i) => {
        const stripeZ = -lot.lotW / 2 + (i + 1) * (lot.lotW / 6)
        return (
          <mesh key={`line-${i}`} position={[lot.lotCenterX - lot.lotD * 0.18, 0.06, stripeZ]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[8, 0.2]} />
            <meshStandardMaterial color="#fff8e0" roughness={0.7} />
          </mesh>
        )
      })}
      {/* Curb between lot and grass */}
      <mesh position={[lot.lotCenterX - lot.lotD / 2 - 0.15, 0.4, 0]}>
        <boxGeometry args={[0.3, 0.7, lot.lotW]} />
        <meshStandardMaterial color="#9b9b95" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Asphalt road (further out, parallel to lot, simulating street) */}
      <mesh position={[lot.lotCenterX - lot.lotD - 12, 0.03, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, lot.lotW + 60]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.92} metalness={0.05} />
      </mesh>
      {/* Road centerline (white dashed) */}
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={`rd-${i}`} position={[lot.lotCenterX - lot.lotD - 12, 0.05, -(lot.lotW + 60) / 2 + 6 + i * 8]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.3, 3.5]} />
          <meshStandardMaterial color="#fff8e0" roughness={0.7} />
        </mesh>
      ))}

      {/* ── GRASS LAWN (around the building, beyond paved areas) ── */}
      <mesh position={[L * 0.2, 0.01, W / 2 + 12]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[L * 1.4, 25]} />
        <meshStandardMaterial color="#3a7d3e" roughness={0.95} />
      </mesh>
      <mesh position={[L * 0.2, 0.01, -W / 2 - 12]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[L * 1.4, 25]} />
        <meshStandardMaterial color="#3a7d3e" roughness={0.95} />
      </mesh>
      <mesh position={[L / 2 + 25, 0.01, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[35, W + 50]} />
        <meshStandardMaterial color="#3a7d3e" roughness={0.95} />
      </mesh>

      {/* Trees + bushes removed per user request */}

      {/* ── VEHICLES (GLB if present, else procedural) ── */}
      {cars.map((c, i) => (
        <ModelOrFallback
          key={`c-${i}`}
          src={MODEL_DEFAULTS.car.src}
          fallback={<Car position={c.pos} rotation={c.rot} color={c.c} />}
          position={c.pos}
          rotation={c.rot}
          scale={MODEL_DEFAULTS.car.scale}
          color={c.c}
        />
      ))}
      {bikes.map((b, i) => (
        <ModelOrFallback
          key={`bk-${i}`}
          src={MODEL_DEFAULTS.motorbike.src}
          fallback={<Motorbike position={b.pos} rotation={b.rot} color={b.c} />}
          position={b.pos}
          rotation={b.rot}
          scale={MODEL_DEFAULTS.motorbike.scale}
          color={b.c}
        />
      ))}
    </group>
  )
}

/* ─── Camera presets ─── */
const cameraPresets = [
  { label: 'Perspective', icon: Eye,        pos: (L, W, H) => [L * 0.8, H * 3, W * 1.2] },
  { label: 'Front',       icon: ArrowUp,    pos: (L, W, H) => [0, H * 1.5, W * 2] },
  { label: 'Side',        icon: ArrowRight,  pos: (L, W, H) => [L * 1.5, H * 1.5, 0] },
  { label: 'Top',         icon: Camera,      pos: (L, W, H) => [0, Math.max(L, W) * 1.5, 0.01] },
]

/* ─── Default building params ─── */
const DEFAULT_PARAMS = {
  building_length: 100, building_width: 60, full_height: 30,
  wall_height: 20, cladding_height: 10, roof_type: 'gable',
  roof_sheet_type: 'bare_galvalume_0.47mm', side_cladding_type: 'bare_colour_galvalume',
  mezzanine_required: false, mezz_length: 0, mezz_width: 0,
  // Optional drawing-only features (mirrored with Drawings2D)
  turbo_vent: true, ridge_monitor: false, light_sheets: true,
  louvers: false, shutter_in_section: true,
  crane_required: false, crane_capacity: 5, crane_height: 14,
  x_ray_mode: true,
}

/* ─── Prompt command parser ─── */
function parsePrompt(text, currentParams) {
  const p = { ...currentParams }
  const t = text.toLowerCase().trim()
  let changes = []

  // Length
  const lenMatch = t.match(/(?:length|long)\s*(?:to|=|:)?\s*(\d+)/i) || t.match(/(\d+)\s*(?:ft|feet)?\s*(?:length|long)/i)
  if (lenMatch) { p.building_length = +lenMatch[1]; changes.push(`Length -> ${lenMatch[1]}ft`) }

  // Width
  const widMatch = t.match(/(?:width|wide)\s*(?:to|=|:)?\s*(\d+)/i) || t.match(/(\d+)\s*(?:ft|feet)?\s*(?:width|wide)/i)
  if (widMatch) { p.building_width = +widMatch[1]; changes.push(`Width -> ${widMatch[1]}ft`) }

  // Full height / ridge height
  const fhMatch = t.match(/(?:full\s*height|ridge\s*height|total\s*height|height)\s*(?:to|=|:)?\s*(\d+)/i) || t.match(/(\d+)\s*(?:ft|feet)?\s*(?:full|ridge|total)?\s*height/i)
  if (fhMatch) { p.full_height = +fhMatch[1]; changes.push(`Full Height -> ${fhMatch[1]}ft`) }

  // Wall height / eave height
  const whMatch = t.match(/(?:wall\s*height|eave\s*height)\s*(?:to|=|:)?\s*(\d+)/i) || t.match(/(\d+)\s*(?:ft|feet)?\s*(?:wall|eave)\s*height/i)
  if (whMatch) { p.wall_height = +whMatch[1]; changes.push(`Wall Height -> ${whMatch[1]}ft`) }

  // Roof type
  if (/gable|a[\s-]?type/.test(t)) { p.roof_type = 'gable'; changes.push('Roof -> Gable (A-Type)') }
  if (/mono\s*slope|single[\s-]?slope/.test(t)) { p.roof_type = 'single_slope'; changes.push('Roof -> Single Slope') }

  // Roof material
  if (/puf\s*(?:panel|roof)/.test(t)) { p.roof_sheet_type = 'puf_panel_50mm'; changes.push('Roof Material -> PUF Panel 50mm') }
  if (/galvalume\s*roof|bare\s*roof/.test(t)) { p.roof_sheet_type = 'bare_galvalume_0.47mm'; changes.push('Roof Material -> Bare Galvalume') }

  // Cladding material
  if (/puf\s*(?:clad|wall|side)/.test(t)) { p.side_cladding_type = 'puf_panel_50mm'; changes.push('Cladding -> PUF Panel') }
  if (/galvalume\s*(?:clad|wall|side)|bare\s*(?:clad|wall|side)/.test(t)) { p.side_cladding_type = 'bare_colour_galvalume'; changes.push('Cladding -> Galvalume') }

  // Mezzanine
  if (/add\s*mezz|enable\s*mezz|with\s*mezz|mezzanine\s*yes/.test(t)) {
    p.mezzanine_required = true
    if (!p.mezz_length || p.mezz_length <= 0) p.mezz_length = Math.round(p.building_length * 0.5)
    if (!p.mezz_width || p.mezz_width <= 0) p.mezz_width = Math.round(p.building_width * 0.8)
    changes.push(`Mezzanine ON (${p.mezz_length} x ${p.mezz_width}ft)`)
  }
  if (/remove\s*mezz|no\s*mezz|disable\s*mezz|mezzanine\s*no/.test(t)) {
    p.mezzanine_required = false
    changes.push('Mezzanine OFF')
  }

  // Mezzanine dimensions
  const mzlMatch = t.match(/mezz(?:anine)?\s*length\s*(?:to|=|:)?\s*(\d+)/i)
  if (mzlMatch) { p.mezz_length = +mzlMatch[1]; p.mezzanine_required = true; changes.push(`Mezzanine Length -> ${mzlMatch[1]}ft`) }
  const mzwMatch = t.match(/mezz(?:anine)?\s*width\s*(?:to|=|:)?\s*(\d+)/i)
  if (mzwMatch) { p.mezz_width = +mzwMatch[1]; p.mezzanine_required = true; changes.push(`Mezzanine Width -> ${mzwMatch[1]}ft`) }

  // Increase / decrease
  const incMatch = t.match(/(?:increase|bigger|larger|expand|grow)\s*(?:the\s*)?(?:building\s*)?(?:by\s*)?(\d+)?/i)
  if (incMatch && changes.length === 0) {
    const factor = incMatch[1] ? +incMatch[1] / 100 : 0.2
    p.building_length = Math.round(p.building_length * (1 + factor))
    p.building_width = Math.round(p.building_width * (1 + factor))
    changes.push(`Scaled up by ${Math.round(factor * 100)}%`)
  }
  const decMatch = t.match(/(?:decrease|smaller|shrink|reduce|compact)\s*(?:the\s*)?(?:building\s*)?(?:by\s*)?(\d+)?/i)
  if (decMatch && changes.length === 0) {
    const factor = decMatch[1] ? +decMatch[1] / 100 : 0.2
    p.building_length = Math.max(20, Math.round(p.building_length * (1 - factor)))
    p.building_width = Math.max(10, Math.round(p.building_width * (1 - factor)))
    changes.push(`Scaled down by ${Math.round(factor * 100)}%`)
  }

  // Auto-calc cladding height
  p.cladding_height = Math.max(0, p.full_height - p.wall_height)

  return { params: p, changes }
}


/* ─── Scene Lighting (complements HDRI Environment) ─── */
function SceneLighting({ size = 100 }) {
  // Shadow camera bounds scale with building size
  const sb = Math.max(size, 100) * 1.5
  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight
        position={[size * 1.5, size * 2, size * 0.8]}
        intensity={1.4}
        color="#fffaf0"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={sb * 2}
        shadow-camera-left={-sb}
        shadow-camera-right={sb}
        shadow-camera-top={sb}
        shadow-camera-bottom={-sb}
        shadow-bias={-0.0003}
        shadow-normalBias={0.04}
        shadow-radius={2}
      />
      {/* Subtle fill from opposite side */}
      <directionalLight position={[-size, size, -size * 0.5]} intensity={0.25} color="#d4e7ff" />
    </>
  )
}


/* ─── Dimension Slider Row ─── */
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
          <input
            type="number"
            value={value}
            min={min} max={max} step={step}
            onChange={e => onChange(Math.max(min, Math.min(max, +e.target.value || min)))}
            className="w-16 text-center text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 tabular-nums"
          />
          <button onClick={() => onChange(Math.min(max, value + step))}
            className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors">
            <Plus className="w-3 h-3" />
          </button>
          <span className="text-[10px] text-slate-400 ml-0.5 w-4">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        className="w-full h-1.5 rounded-full appearance-none bg-slate-200 dark:bg-slate-700 accent-[var(--brand-primary)] cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--brand-primary)]
          [&::-webkit-slider-thumb]:shadow-[0_2px_6px_-1px_var(--brand-primary)]"
      />
    </div>
  )
}


/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════ */
export default function Viewer3D() {
  const location = useLocation()
  const navigate = useNavigate()
  const { quotationId: routeQuotationId } = useParams()
  const { params: passedParams, boq: passedBoq } = location.state || {}

  /* ── State ── */
  const [params, setParams] = useState(passedParams || DEFAULT_PARAMS)
  const [preset, setPreset] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [autoRotate, setAutoRotate] = useState(true)
  const [envPreset, setEnvPreset] = useState('warehouse')
  const [showSky] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [postFx, setPostFx] = useState(true)        // postprocessing effects on/off
  const [showHuman, setShowHuman] = useState(true)
  const [showGizmo, setShowGizmo] = useState(true)
  const [showLandscape, setShowLandscape] = useState(true)
  const [hoverInfo, setHoverInfo] = useState(null)  // { name, point } when hovering an element
  const [measureMode, setMeasureMode] = useState(false)
  const [measurePts, setMeasurePts] = useState([])  // up to 2 [x,y,z]

  // Layer visibility (component groups)
  const [layers, setLayers] = useState({
    foundation: true,
    structure: true,
    envelope: true,
    accessories: true,
    mezzanine: true,
    fixtures: true,
  })
  const toggleLayer = useCallback((k) => setLayers(L => ({ ...L, [k]: !L[k] })), [])

  // Three refs (no Canvas remount)
  const controlsRef = useRef(null)
  const cameraRef = useRef(null)
  const glRef = useRef(null)
  const sceneRef = useRef(null)
  const canvasContainerRef = useRef(null)

  // Project selector
  const [projects, setProjects] = useState([])
  const [projectSearch, setProjectSearch] = useState('')
  const [selectedProject, setSelectedProject] = useState(null)
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(false)

  // Prompt
  const [prompt, setPrompt] = useState('')
  const [promptHistory, setPromptHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const promptRef = useRef(null)

  // BOQ
  const [boq, setBoq] = useState(passedBoq || null)

  /* ── Load projects list ── */
  useEffect(() => {
    const load = async () => {
      setLoadingProjects(true)
      try {
        const { data } = await quotationAPI.getAll({ limit: 200 })
        const items = data?.items || data || []
        setProjects(items)
      } catch { /* silently fail */ }
      finally { setLoadingProjects(false) }
    }
    load()
  }, [])

  /* ── Load specific quotation if ID in route ── */
  useEffect(() => {
    if (!routeQuotationId) return
    const load = async () => {
      try {
        const { data } = await quotationAPI.get(routeQuotationId)
        applyProject(data)
      } catch {
        toast.error('Could not load quotation')
      }
    }
    load()
  }, [routeQuotationId])

  /* ── Apply a project's building_params ── */
  const applyProject = useCallback((project) => {
    setSelectedProject(project)
    setShowProjectPicker(false)
    const bp = project.building_params || {}
    const newParams = {
      ...DEFAULT_PARAMS,
      ...bp,
      building_length: +(bp.building_length || DEFAULT_PARAMS.building_length),
      building_width: +(bp.building_width || DEFAULT_PARAMS.building_width),
      full_height: +(bp.full_height || DEFAULT_PARAMS.full_height),
      wall_height: +(bp.wall_height || DEFAULT_PARAMS.wall_height),
      cladding_height: +(bp.cladding_height || Math.max(0, (+(bp.full_height || 30)) - (+(bp.wall_height || 20)))),
      roof_type: bp.roof_type || DEFAULT_PARAMS.roof_type,
      roof_sheet_type: bp.roof_sheet_type || DEFAULT_PARAMS.roof_sheet_type,
      side_cladding_type: bp.side_cladding_type || DEFAULT_PARAMS.side_cladding_type,
      mezzanine_required: !!bp.mezzanine_required,
      mezz_length: +(bp.mezz_length || 0),
      mezz_width: +(bp.mezz_width || 0),
      turbo_vent: bp.turbo_vent !== undefined ? !!bp.turbo_vent : DEFAULT_PARAMS.turbo_vent,
      ridge_monitor: !!bp.ridge_monitor,
      light_sheets: bp.light_sheets !== undefined ? !!bp.light_sheets : DEFAULT_PARAMS.light_sheets,
      louvers: !!bp.louvers,
      shutter_in_section: bp.shutter_in_section !== undefined ? !!bp.shutter_in_section : true,
      crane_required: !!bp.crane_required,
      crane_capacity: +(bp.crane_capacity || DEFAULT_PARAMS.crane_capacity),
      crane_height: +(bp.crane_height || DEFAULT_PARAMS.crane_height),
      x_ray_mode: bp.x_ray_mode !== undefined ? !!bp.x_ray_mode : true,
    }
    setParams(newParams)
    setPreset(0)
    if (project.boq_results) setBoq(project.boq_results)
    toast.success(`Loaded: ${project.project_name}`)
  }, [])

  /* ── Update a single param ── */
  const updateParam = useCallback((key, value) => {
    setParams(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'full_height' || key === 'wall_height') {
        next.cladding_height = Math.max(0, (next.full_height || 0) - (next.wall_height || 0))
      }
      return next
    })
  }, [])

  /* ── Recalc BOQ when params change ── */
  useEffect(() => {
    try {
      const result = calcBOQ({ building_params: params })
      if (result) setBoq(result)
    } catch { /* non-critical */ }
  }, [params])

  /* ── Handle prompt submit ── */
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

  /* ── Derived values ── */
  const L = +params.building_length || 100
  const W = +params.building_width || 60
  const H = +params.full_height || 30
  const camPos = cameraPresets[preset].pos(L, W, H)

  const dims = useMemo(() => ({
    area: Math.round(L * W),
    volume: Math.round(L * W * (+params.wall_height || 20)),
  }), [L, W, params.wall_height])

  const switchPreset = useCallback((idx) => {
    setPreset(idx)
    const newPos = cameraPresets[idx].pos(L, W, H)
    const ctrl = controlsRef.current
    if (ctrl?.object) {
      ctrl.object.position.set(newPos[0], newPos[1], newPos[2])
      ctrl.target.set(0, H / 2, 0)
      ctrl.update()
    }
  }, [L, W, H])

  /* ── Screenshot (PNG) ── */
  const handleScreenshot = useCallback(() => {
    const gl = glRef.current
    if (!gl) return toast.error('3D scene not ready')
    try {
      // Force a render so the buffer is fresh
      gl.render(gl.__r3f?.scene || null, gl.__r3f?.camera || cameraRef.current)
    } catch { /* ignore */ }
    const dataUrl = gl.domElement.toDataURL('image/png', 0.95)
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `3d-${(selectedProject?.project_name || 'building').replace(/\s+/g, '_')}-${Date.now()}.png`
    a.click()
    toast.success('Screenshot saved')
  }, [selectedProject])

  /* ── GLB export ── */
  const handleGLBExport = useCallback(() => {
    const scene = sceneRef.current
    if (!scene) return toast.error('Scene not ready')
    const exporter = new GLTFExporter()
    exporter.parse(
      scene,
      (result) => {
        const blob = new Blob([result], { type: 'model/gltf-binary' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${(selectedProject?.project_name || 'building').replace(/\s+/g, '_')}-${Date.now()}.glb`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('GLB downloaded — open in any 3D viewer')
      },
      (err) => {
        console.error(err)
        toast.error('GLB export failed')
      },
      { binary: true, embedImages: true }
    )
  }, [selectedProject])

  /* ── Measurement helpers ── */
  const clearMeasurement = useCallback(() => setMeasurePts([]), [])
  const onSceneClick = useCallback((e) => {
    if (!measureMode) return
    e.stopPropagation()
    const p = e.point
    setMeasurePts(prev => {
      if (prev.length >= 2) return [[p.x, p.y, p.z]]
      return [...prev, [p.x, p.y, p.z]]
    })
  }, [measureMode])

  /* ── Fullscreen toggle ── */
  const toggleFullscreen = useCallback(() => {
    const el = canvasContainerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  /* ── Reset view when project changes (only) ── */
  useEffect(() => {
    if (selectedProject) {
      // Wait a tick so cameraRef is current
      const t = setTimeout(() => switchPreset(0), 50)
      return () => clearTimeout(t)
    }
  }, [selectedProject?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredProjects = projects.filter(p =>
    (p.project_name || '').toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.client_name || '').toLowerCase().includes(projectSearch.toLowerCase())
  )

  const roofLabel = (params.roof_type === 'gable' || params.roof_type === 'a_type') ? 'Gable' : 'Single Slope'
  const roofIsPuf = (params.roof_sheet_type || '').includes('puf')
  const cladIsPuf = (params.side_cladding_type || '').includes('puf')

  const legendItems = [
    { color: '#dc2626', label: 'Steel Columns' },
    { color: '#f59e0b', label: 'Rafters / Ridge' },
    { color: '#6366f1', label: 'Purlins' },
    { color: roofIsPuf ? '#1d4ed8' : '#b45309', label: `Roof (${roofIsPuf ? 'PUF' : 'Galvalume'})` },
    { color: cladIsPuf ? '#2563eb' : '#64748b', label: `Cladding (${cladIsPuf ? 'PUF' : 'Galvalume'})` },
    { color: '#94a3b8', label: 'Masonry Walls' },
    ...(params.mezzanine_required ? [{ color: '#10b981', label: 'Mezzanine' }] : []),
  ]

  const canvasHeight = expanded ? '80vh' : '500px'

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <PageHeader
        title="3D Building View"
        subtitle={selectedProject
          ? `${selectedProject.project_name} — ${L}ft x ${W}ft x ${H}ft — ${roofLabel}`
          : `${L}ft x ${W}ft x ${H}ft — ${roofLabel}`
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" leftIcon={ArrowLeft} onClick={() => navigate(-1)}>Back</Button>
            <Button variant="secondary" leftIcon={FileImage} onClick={handleScreenshot}>PNG</Button>
            <Button variant="secondary" leftIcon={FileBox} onClick={handleGLBExport}>GLB</Button>
            <Button variant="secondary" leftIcon={isFullscreen ? Minimize2 : Maximize2} onClick={toggleFullscreen}>
              {isFullscreen ? 'Exit FS' : 'Fullscreen'}
            </Button>
          </div>
        }
      />

      {/* ══════════════════════════════════════════════════
          MAIN LAYOUT: Controls (left) + Canvas (right)
          ══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-4">

        {/* ── LEFT PANEL: Project Picker + Controls + Prompt ── */}
        <div className="space-y-4 order-2 xl:order-1">

          {/* Project Picker */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Select Project</span>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowProjectPicker(!showProjectPicker)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
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
                      <input
                        autoFocus
                        value={projectSearch}
                        onChange={e => setProjectSearch(e.target.value)}
                        placeholder="Search projects..."
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {loadingProjects ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      </div>
                    ) : filteredProjects.length === 0 ? (
                      <div className="text-center py-6 text-sm text-slate-400">No projects found</div>
                    ) : (
                      filteredProjects.map(p => (
                        <button
                          key={p.id}
                          onClick={() => applyProject(p)}
                          className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                            selectedProject?.id === p.id ? 'bg-slate-50 dark:bg-slate-800' : ''
                          }`}
                        >
                          <div className="text-sm font-medium text-slate-900 dark:text-white">{p.project_name}</div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>{p.client_name || 'No client'}</span>
                            {p.building_params?.building_length && (
                              <span className="text-slate-400">
                                {p.building_params.building_length}x{p.building_params.building_width}ft
                              </span>
                            )}
                            {p.total_amount > 0 && (
                              <span className="text-slate-400">Rs.{(+p.total_amount).toLocaleString('en-IN')}</span>
                            )}
                          </div>
                        </button>
                      ))
                    )}
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
              <DimSlider label="Full Height (Ridge)" icon={ArrowUp} value={H} min={10} max={100} onChange={v => updateParam('full_height', v)} />
              <DimSlider label="Wall Height (Eave)" icon={Layers} value={+params.wall_height || 20} min={5} max={80} onChange={v => updateParam('wall_height', v)} />
            </div>

            {/* Roof & Cladding */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Roof Type</label>
                <div className="flex gap-2">
                  {[
                    { val: 'gable', label: 'Gable (A-Type)' },
                    { val: 'single_slope', label: 'Single Slope' },
                  ].map(opt => (
                    <button key={opt.val}
                      onClick={() => updateParam('roof_type', opt.val)}
                      className={`flex-1 text-xs font-semibold py-2 rounded-lg border transition-all ${
                        params.roof_type === opt.val || (opt.val === 'gable' && params.roof_type === 'a_type')
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Roof Sheet</label>
                <div className="flex gap-2">
                  {[
                    { val: 'bare_galvalume_0.47mm', label: 'Galvalume' },
                    { val: 'puf_panel_50mm', label: 'PUF Panel' },
                  ].map(opt => (
                    <button key={opt.val}
                      onClick={() => updateParam('roof_sheet_type', opt.val)}
                      className={`flex-1 text-xs font-semibold py-2 rounded-lg border transition-all ${
                        (params.roof_sheet_type || '').includes(opt.val.split('_')[0])
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Side Cladding</label>
                <div className="flex gap-2">
                  {[
                    { val: 'bare_colour_galvalume', label: 'Galvalume' },
                    { val: 'puf_panel_50mm', label: 'PUF Panel' },
                  ].map(opt => (
                    <button key={opt.val}
                      onClick={() => updateParam('side_cladding_type', opt.val)}
                      className={`flex-1 text-xs font-semibold py-2 rounded-lg border transition-all ${
                        (params.side_cladding_type || '').includes(opt.val.split('_')[0])
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mezzanine Toggle */}
              <div className="pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Mezzanine Floor</label>
                  <button
                    onClick={() => {
                      const next = !params.mezzanine_required
                      updateParam('mezzanine_required', next)
                      if (next && (!params.mezz_length || +params.mezz_length <= 0)) {
                        setParams(p => ({ ...p, mezzanine_required: true, mezz_length: Math.round(L * 0.5), mezz_width: Math.round(W * 0.8) }))
                      }
                    }}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      params.mezzanine_required
                        ? 'bg-[var(--brand-primary)]'
                        : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      params.mezzanine_required ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
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

          {/* ── Components / Accessories ── */}
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

          {/* ── Display & Layers ── */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Boxes className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Layers</span>
            </div>
            <div className="space-y-2">
              {[
                { key: 'foundation', label: 'Foundation', color: '#a8a8a3' },
                { key: 'structure', label: 'Steel Structure', color: '#dc2626' },
                { key: 'envelope', label: 'Envelope (cladding/roof)', color: '#3f4a59' },
                { key: 'fixtures', label: 'Doors & Windows', color: '#0f766e' },
                { key: 'accessories', label: 'Accessories', color: '#fbbf24' },
                { key: 'mezzanine', label: 'Mezzanine', color: '#10b981' },
              ].map(opt => {
                const on = !!layers[opt.key]
                return (
                  <div key={opt.key} className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <span className="w-3 h-3 rounded-sm" style={{ background: opt.color }} />
                      {opt.label}
                    </label>
                    <button onClick={() => toggleLayer(opt.key)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${on ? 'bg-[var(--brand-primary)]' : 'bg-slate-300 dark:bg-slate-600'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Quick presets */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Presets</div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setLayers({ foundation: true, structure: true, envelope: true, accessories: true, mezzanine: true, fixtures: true })}
                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">All</button>
                <button onClick={() => setLayers({ foundation: false, structure: true, envelope: false, accessories: false, mezzanine: false, fixtures: false })}
                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">Skeleton</button>
                <button onClick={() => setLayers({ foundation: true, structure: true, envelope: false, accessories: false, mezzanine: true, fixtures: false })}
                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">Frame+Fdn</button>
                <button onClick={() => setLayers({ foundation: false, structure: false, envelope: true, accessories: true, mezzanine: false, fixtures: true })}
                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">Shell only</button>
              </div>
            </div>

            {/* View settings */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">View</div>
              <div className="space-y-2">
                {[
                  { key: 'postFx', label: 'Post-FX (SSAO + Bloom)', icon: Sparkle, val: postFx, set: setPostFx },
                  { key: 'showLandscape', label: 'Landscape (trees, bushes)', icon: Sun, val: showLandscape, set: setShowLandscape },
                  { key: 'showHuman', label: 'Human scale figure', icon: User, val: showHuman, set: setShowHuman },
                  { key: 'showGizmo', label: 'Axis gizmo', icon: Boxes, val: showGizmo, set: setShowGizmo },
                ].map(opt => {
                  const Icon = opt.icon
                  return (
                    <div key={opt.key} className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                        <Icon className="w-3.5 h-3.5" /> {opt.label}
                      </label>
                      <button onClick={() => opt.set(!opt.val)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${opt.val ? 'bg-[var(--brand-primary)]' : 'bg-slate-300 dark:bg-slate-600'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${opt.val ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Measurement tool */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Measure</div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setMeasureMode(m => !m); setMeasurePts([]) }}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg text-xs font-semibold transition-all border ${
                    measureMode
                      ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                  }`}>
                  <Crosshair className="w-3.5 h-3.5" />
                  {measureMode ? 'Pick 2 points...' : 'Measure tool'}
                </button>
                {measurePts.length > 0 && (
                  <button onClick={clearMeasurement}
                    className="h-8 px-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">
                    Clear
                  </button>
                )}
              </div>
              {measureMode && (
                <div className="mt-2 text-[10px] text-slate-500">
                  Pick 2 surface points · Click again to restart · Auto-rotate paused
                </div>
              )}
            </div>
          </Card>

          {/* ── Prompt Panel ── */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Prompt Studio</span>
              </div>
              {promptHistory.length > 0 && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <History className="w-3 h-3" />
                  {promptHistory.length}
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-400 mb-2.5 leading-relaxed">
              Describe changes in plain English. Try: <br />
              <span className="text-slate-500 font-medium">"length to 150"</span> &#183;
              <span className="text-slate-500 font-medium"> "add mezzanine"</span> &#183;
              <span className="text-slate-500 font-medium"> "gable roof"</span> &#183;
              <span className="text-slate-500 font-medium"> "make it bigger"</span>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  ref={promptRef}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handlePrompt() }}
                  placeholder="e.g. length to 200, wall height 25..."
                  className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)] outline-none transition-all"
                />
                {prompt && (
                  <button onClick={() => setPrompt('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={handlePrompt}
                disabled={!prompt.trim()}
                className="h-10 w-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all hover:-translate-y-0.5 shadow-[0_4px_14px_-4px_var(--brand-primary)]"
                style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent, var(--brand-primary)))' }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Quick prompts */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {[
                'length to 150',
                'add mezzanine',
                'gable roof',
                'single slope',
                'puf roof',
                'make it bigger',
                'wall height 25',
                'width to 80',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => runPrompt(q)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Prompt History */}
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

        {/* ── RIGHT PANEL: Canvas + Stats ── */}
        <div className="space-y-4 order-1 xl:order-2">

          {/* Camera Presets Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {cameraPresets.map((p, i) => {
              const Icon = p.icon
              const active = preset === i
              return (
                <button
                  key={p.label}
                  onClick={() => switchPreset(i)}
                  className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    active
                      ? 'text-white shadow-[0_4px_14px_-4px_var(--brand-primary)] hover:-translate-y-0.5'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  style={active ? {
                    background: 'linear-gradient(135deg, var(--brand-primary), color-mix(in oklab, var(--brand-primary) 70%, var(--brand-accent, var(--brand-primary))))',
                  } : undefined}
                >
                  <Icon className="w-4 h-4" />
                  {p.label}
                </button>
              )
            })}

            {/* Lighting / Environment dropdown */}
            <div className="relative">
              <select
                value={envPreset}
                onChange={e => setEnvPreset(e.target.value)}
                className="h-9 pl-3 pr-7 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 cursor-pointer appearance-none"
                style={{ backgroundImage: 'none' }}
              >
                {ENV_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>☼ {p.label}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="flex-1" />

            {/* X-Ray toggle */}
            <button
              onClick={() => updateParam('x_ray_mode', !params.x_ray_mode)}
              title="Toggle X-Ray (see structural steel through cladding)"
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold border transition-all ${
                params.x_ray_mode
                  ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
              }`}
            >
              {params.x_ray_mode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              X-Ray
            </button>

            {/* Auto-rotate toggle */}
            <Button variant="secondary" size="icon"
              onClick={() => setAutoRotate(r => !r)}
              aria-label={autoRotate ? 'Pause rotation' : 'Resume rotation'}>
              {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>

            <Button variant="secondary" size="icon" onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? 'Minimize' : 'Maximize'}>
              {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button variant="secondary" size="icon"
              onClick={() => switchPreset(0)}
              aria-label="Reset camera">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          {/* Three.js Canvas */}
          <Card
            className="overflow-hidden relative"
            ref={canvasContainerRef}
            style={{ height: isFullscreen ? '100vh' : canvasHeight }}
          >
            <ThreeErrorBoundary>
              <Canvas
                shadows
                dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2, 2.5)]}
                camera={{ position: camPos, fov: 50 }}
                gl={{
                  antialias: true,
                  toneMapping: THREE.ACESFilmicToneMapping,
                  toneMappingExposure: 1.05,
                  preserveDrawingBuffer: true,
                  powerPreference: 'high-performance',
                  logarithmicDepthBuffer: true,
                }}
                onCreated={({ gl, camera, scene }) => {
                  glRef.current = gl
                  cameraRef.current = camera
                  sceneRef.current = scene
                  gl.outputColorSpace = THREE.SRGBColorSpace
                }}
              >
                {/* Sky shader background */}
                {showSky && <Sky sunPosition={[L * 1.5, H * 5, L * 0.6]} turbidity={6} rayleigh={1.5} mieCoefficient={0.005} mieDirectionalG={0.7} />}
                {!showSky && <color attach="background" args={["#0a0e1a"]} />}

                <Suspense fallback={null}>
                  {/* HDRI environment for IBL — invisible (sky shows as background) */}
                  <Environment preset={envPreset} background={false} />
                </Suspense>

                <SceneLighting size={Math.max(L, W)} />

                {/* Building wrapped in event-capturing group for hover/click */}
                <group
                  onPointerOver={(e) => {
                    if (measureMode) return
                    const name = e.object?.userData?.name
                    if (name) {
                      e.stopPropagation()
                      setHoverInfo({ name, point: [e.point.x, e.point.y + 1, e.point.z] })
                    }
                  }}
                  onPointerOut={(e) => {
                    if (e.object?.userData?.name) setHoverInfo(null)
                  }}
                  onClick={onSceneClick}
                >
                  <Suspense fallback={null}>
                    <BuildingForType data={params} layers={layers} />
                  </Suspense>
                </group>

                {/* Human scale figure — standing in front of the rolling shutter (-L end) */}
                {showHuman && <HumanScale position={[-L / 2 - 8, 0, 0]} rotationY={Math.PI / 2} />}

                {/* Landscape — trees + bushes around the building */}
                {showLandscape && <Landscape L={L} W={W} />}

                {/* Hover tooltip + measurement overlay */}
                <HoverTooltip info={hoverInfo} />
                <MeasurementOverlay points={measurePts} />

                {/* Soft ground shadow under building */}
                <ContactShadows
                  position={[0, 0.02, 0]}
                  opacity={0.55}
                  scale={Math.max(L, W) * 1.6}
                  blur={1.8}
                  far={6}
                  resolution={2048}
                />

                <OrbitControls
                  ref={controlsRef}
                  enablePan enableZoom enableRotate
                  autoRotate={autoRotate && !measureMode}
                  autoRotateSpeed={0.4}
                  minDistance={15}
                  maxDistance={800}
                  maxPolarAngle={Math.PI / 2.05}
                  target={[0, H / 2, 0]}
                  enableDamping
                  dampingFactor={0.08}
                />

                {/* Navigation gizmo (axis cube in corner) */}
                {showGizmo && (
                  <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
                    <GizmoViewport
                      axisColors={['#ef4444', '#10b981', '#3b82f6']}
                      labelColor="white"
                    />
                  </GizmoHelper>
                )}

                {/* Postprocessing — SSAO + Bloom + Vignette (multisampling restores AA crispness) */}
                {postFx && (
                  <EffectComposer multisampling={4} disableNormalPass={false}>
                    <SSAO
                      blendFunction={BlendFunction.MULTIPLY}
                      samples={14}
                      radius={0.5}
                      intensity={18}
                      luminanceInfluence={0.5}
                      worldDistanceThreshold={1}
                      worldDistanceFalloff={0.1}
                      worldProximityThreshold={1}
                      worldProximityFalloff={0.1}
                    />
                    <Bloom
                      luminanceThreshold={0.92}
                      luminanceSmoothing={0.6}
                      intensity={0.28}
                      mipmapBlur
                    />
                    <BrightnessContrast brightness={0.0} contrast={0.08} />
                    <Vignette eskil={false} offset={0.2} darkness={0.28} />
                    <ToneMapping />
                  </EffectComposer>
                )}
              </Canvas>
            </ThreeErrorBoundary>

            {/* Dimension overlay */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <div className="px-3 py-1.5 rounded-lg bg-black/65 backdrop-blur-sm text-white text-xs font-mono space-x-3">
                <span>L: {L}ft</span>
                <span>W: {W}ft</span>
                <span>H: {H}ft</span>
                <span>Eave: {params.wall_height}ft</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-black/65 backdrop-blur-sm text-white text-xs font-mono">
                {dims.area.toLocaleString('en-IN')} sqft
              </div>
            </div>
          </Card>

          {/* drei Loader (HTML overlay, auto-shows during HDRI load) */}
          <Loader
            containerStyles={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)' }}
            innerStyles={{ background: 'transparent' }}
            barStyles={{ background: 'var(--brand-primary)' }}
            dataStyles={{ color: '#cbd5e1', fontFamily: 'monospace', fontSize: '12px' }}
          />

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat
              label="Floor Area"
              value={`${dims.area.toLocaleString('en-IN')} sqft`}
              accent="#6366f1" accentTo="#0ea5e9"
            />
            <Stat
              label="Building Volume"
              value={`${dims.volume.toLocaleString('en-IN')} cuft`}
              accent="#10b981" accentTo="#14b8a6"
            />
            <Stat
              label="Steel Tonnage"
              value={`${boq?.steel_summary?.total_steel_ton?.toFixed(1) || '—'} MT`}
              accent="#f43f5e" accentTo="#ec4899"
            />
            <Stat
              label="Est. Cost"
              value={`Rs.${boq?.total_amount?.toLocaleString('en-IN') || '—'}`}
              accent="var(--brand-primary)" accentTo="var(--brand-accent)"
            />
          </div>

          {/* Legend */}
          <Card className="px-5 py-3">
            <div className="flex flex-wrap gap-4 text-xs">
              {legendItems.map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="w-4 h-3 rounded" style={{ background: item.color }} />
                  <span className="text-slate-600 dark:text-slate-400 font-medium">{item.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <p className="text-xs text-slate-400 text-center">Click and drag to rotate. Scroll to zoom. Auto-rotates slowly.</p>
        </div>
      </div>
    </div>
  )
}
