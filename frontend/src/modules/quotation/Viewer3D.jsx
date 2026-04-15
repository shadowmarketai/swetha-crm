/**
 * Viewer3D — Interactive 3D PEB Building Visualization
 * Uses Three.js via @react-three/fiber for proper 3D rendering.
 */

import { useState, useCallback, Suspense, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ArrowLeft, RotateCcw, Eye, ArrowUp, ArrowRight, Camera } from 'lucide-react'
import PEBBuilding from './PEBBuilding'
import { Card, CardHeader, Stat, Button, PageHeader } from '../../components/ui/primitives'

const cameraPresets = [
  { label: 'Perspective', icon: Eye, pos: (L, W, H) => [L * 0.8, H * 3, W * 1.2] },
  { label: 'Front', icon: ArrowUp, pos: (L, W, H) => [0, H * 1.5, W * 2] },
  { label: 'Side', icon: ArrowRight, pos: (L, W, H) => [L * 1.5, H * 1.5, 0] },
  { label: 'Top', icon: Camera, pos: (L, W, H) => [0, Math.max(L, W) * 1.5, 0.01] },
]

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[100, 120, 60]} intensity={1.5} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-far={500} shadow-camera-left={-200} shadow-camera-right={200}
        shadow-camera-top={200} shadow-camera-bottom={-200}
      />
      <directionalLight position={[-60, 80, -40]} intensity={0.4} color="#8b9cf7" />
      <pointLight position={[0, 50, 0]} intensity={0.3} color="#60a5fa" />
      <fog attach="fog" args={["#080e1c", 300, 1000]} />
    </>
  )
}

export default function Viewer3D() {
  const location = useLocation()
  const navigate = useNavigate()
  const { params: passedParams, boq } = location.state || {}

  const [cameraKey, setCameraKey] = useState(0)
  const [preset, setPreset] = useState(0)

  const params = passedParams || {
    building_length: 100, building_width: 60, full_height: 30,
    wall_height: 20, cladding_height: 18, roof_type: 'gable',
    roof_sheet_type: 'bare', side_cladding_type: 'bare', mezzanine_required: false,
  }

  const L = +params.building_length || 100
  const W = +params.building_width || 60
  const H = +params.full_height || 30
  const camPos = cameraPresets[preset].pos(L, W, H)

  const switchPreset = useCallback((idx) => {
    setPreset(idx)
    setCameraKey(k => k + 1)
  }, [])

  const dims = useMemo(() => ({
    area: params.building_length * params.building_width,
    volume: params.building_length * params.building_width * params.wall_height,
  }), [params])

  const legendItems = [
    { color: '#dc2626', label: 'Steel Columns' },
    { color: '#f59e0b', label: 'Rafters / Ridge' },
    { color: '#6366f1', label: 'Purlins' },
    { color: params.roof_sheet_type === 'puf' ? '#1d4ed8' : '#b45309', label: `Roof (${params.roof_sheet_type === 'puf' ? 'PUF' : 'Galvalume'})` },
    { color: params.side_cladding_type === 'puf' ? '#2563eb' : '#64748b', label: `Cladding (${params.side_cladding_type === 'puf' ? 'PUF' : 'Galvalume'})` },
    { color: '#94a3b8', label: 'Masonry Walls' },
    ...(params.mezzanine_required ? [{ color: '#10b981', label: 'Mezzanine' }] : []),
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="3D Building View"
        subtitle={`${params.building_length}ft x ${params.building_width}ft x ${params.full_height}ft — ${params.roof_type === 'gable' ? 'Gable Roof' : 'Single Slope'}`}
        actions={
          <Button variant="secondary" leftIcon={ArrowLeft} onClick={() => navigate(-1)}>
            Back to BOQ
          </Button>
        }
      />

      {/* Camera Presets */}
      <div className="flex items-center gap-2 flex-wrap">
        {cameraPresets.map((p, i) => {
          const Icon = p.icon
          const active = preset === i
          return (
            <button
              key={p.label}
              onClick={() => switchPreset(i)}
              className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
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
              <Icon className="w-4 h-4" />
              {p.label}
            </button>
          )
        })}
        <div className="flex-1" />
        <Button
          variant="secondary"
          size="icon"
          onClick={() => { setPreset(0); setCameraKey(k => k + 1) }}
          aria-label="Reset camera"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Three.js Canvas */}
      <Card className="overflow-hidden" style={{ height: '500px' }}>
        <Canvas
          key={cameraKey}
          shadows
          camera={{ position: camPos, fov: 50 }}
          gl={{ antialias: true, toneMapping: 3 }}
        >
          <color attach="background" args={["#050816"]} />
          <SceneLighting />
          <Suspense fallback={null}>
            <PEBBuilding data={params} />
          </Suspense>
          <OrbitControls
            enablePan enableZoom enableRotate
            autoRotate autoRotateSpeed={0.3}
            minDistance={15} maxDistance={800}
            maxPolarAngle={Math.PI / 2.05}
          />
        </Canvas>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          label="Floor Area"
          value={`${dims.area.toLocaleString('en-IN')} sqft`}
          accent="#6366f1"
          accentTo="#0ea5e9"
        />
        <Stat
          label="Building Volume"
          value={`${dims.volume.toLocaleString('en-IN')} cuft`}
          accent="#10b981"
          accentTo="#14b8a6"
        />
        <Stat
          label="Steel Tonnage"
          value={`${boq?.steel_summary?.total_steel_ton || '—'} MT`}
          accent="#f43f5e"
          accentTo="#ec4899"
        />
        <Stat
          label="Total Cost"
          value={`Rs. ${boq?.total_amount?.toLocaleString('en-IN') || '—'}`}
          accent="var(--brand-primary)"
          accentTo="var(--brand-accent)"
        />
      </div>

      {/* Legend */}
      <Card>
        <CardHeader title="Legend" subtitle="Color-coded building components" />
        <div className="px-6 py-5">
          <div className="flex flex-wrap gap-4 text-xs">
            {legendItems.map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <div className="w-4 h-3 rounded" style={{ background: item.color }} />
                <span className="text-slate-600 dark:text-slate-400 font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <p className="text-xs text-slate-400 text-center">Click and drag to rotate. Scroll to zoom. Auto-rotates slowly.</p>
    </div>
  )
}
