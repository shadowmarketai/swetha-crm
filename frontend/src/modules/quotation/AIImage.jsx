/**
 * AIImage — 3D Building Render Capture
 * Uses Three.js canvas to capture actual 3D renders as PNG images.
 * Ported from peb-saas GeminiRender — no external AI API needed.
 */

import { useState, useCallback, useRef, useEffect, Suspense } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Sky } from '@react-three/drei'
import { ArrowLeft, Camera, Download, Copy, Check, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import PEBBuilding from './PEBBuilding'
import { Card, CardHeader, Button, PageHeader, EmptyState, Segmented, Badge } from '../../components/ui/primitives'

const RENDER_STYLES = [
  { id: 'exterior', label: 'Exterior', getCam: (L, W, H) => [L * 0.7, H * 3.5, W * 1.3] },
  { id: 'aerial', label: 'Aerial', getCam: (L, W, H) => [L * 0.3, Math.max(L, W) * 1.2, W * 0.3] },
  { id: 'front', label: 'Front', getCam: (L, W, H) => [0, H * 1.8, W * 2.2] },
  { id: 'side', label: 'Side', getCam: (L, W, H) => [L * 1.4, H * 2, 0] },
]

function CaptureHelper({ captureRef }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    captureRef.current = () => {
      gl.render(scene, camera)
      return gl.domElement.toDataURL('image/png')
    }
  })
  return null
}

function RenderLighting() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[120, 150, 80]} intensity={1.8} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-far={500} shadow-camera-left={-250} shadow-camera-right={250}
        shadow-camera-top={250} shadow-camera-bottom={-250}
      />
      <directionalLight position={[-80, 100, -60]} intensity={0.5} color="#93c5fd" />
      <pointLight position={[0, 60, 0]} intensity={0.3} color="#60a5fa" />
      <hemisphereLight intensity={0.4} color="#bfdbfe" groundColor="#1e293b" />
    </>
  )
}

export default function AIImage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { params: passedParams, boq, lead } = location.state || {}

  const [renders, setRenders] = useState([])
  const [style, setStyle] = useState('exterior')
  const [cameraKey, setCameraKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const captureRef = useRef(null)

  const params = passedParams || {
    building_length: 100, building_width: 60, full_height: 30,
    wall_height: 20, cladding_height: 18, roof_type: 'gable',
    roof_sheet_type: 'bare', side_cladding_type: 'bare', mezzanine_required: false,
  }

  const L = +params.building_length || 100
  const W = +params.building_width || 60
  const H = +params.full_height || 30
  const preset = RENDER_STYLES.find(s => s.id === style) || RENDER_STYLES[0]
  const camPos = preset.getCam(L, W, H)

  const capture = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (captureRef.current) {
          const dataUrl = captureRef.current()
          setRenders(prev => [{
            id: Date.now(),
            src: dataUrl,
            style,
            timestamp: new Date().toLocaleTimeString(),
          }, ...prev])
          toast.success('Render captured!')
        }
      })
    })
  }, [style])

  const switchStyle = useCallback((id) => {
    setStyle(id)
    setCameraKey(k => k + 1)
  }, [])

  const downloadImage = useCallback((src, id) => {
    const a = document.createElement('a')
    a.href = src
    a.download = `PEB_Render_${style}_${params.building_length}x${params.building_width}_${id}.png`
    a.click()
  }, [style, params])

  const buildPrompt = useCallback(() => {
    const cladH = H - (+params.wall_height || 8)
    const roofType = params.roof_type === 'gable' ? 'gable' : 'single slope'
    const cladType = params.side_cladding_type === 'puf' ? 'blue PUF panel' : 'silver galvalume'
    const roofMat = params.roof_sheet_type === 'puf' ? 'blue PUF panel' : 'red metal sheet'
    const company = lead?.company || 'Swetha Structures'
    return `Photorealistic pre-engineered steel building PEB warehouse by ${company}, ${L}ft long ${W}ft wide ${H}ft tall, ${roofType} roof, gray concrete walls ${params.wall_height}ft, ${cladType} upper cladding ${cladH}ft, ${roofMat} roof, red steel portal frame columns, gold eave trim, industrial setting in South India`
  }, [params, L, W, H, lead])

  const copyPrompt = useCallback(() => {
    navigator.clipboard.writeText(buildPrompt())
    setCopied(true)
    toast.success('AI prompt copied!')
    setTimeout(() => setCopied(false), 2000)
  }, [buildPrompt])

  const styleOptions = RENDER_STYLES.map(s => ({ value: s.id, label: s.label }))

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <PageHeader
        title="3D Building Render"
        subtitle="Capture high-quality 3D renders — no API key needed"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="primary" leftIcon={Camera} onClick={capture}>
              Capture Render
            </Button>
            <Button variant="secondary" leftIcon={ArrowLeft} onClick={() => navigate(-1)}>
              Back
            </Button>
          </div>
        }
      />

      {/* Camera Angle Selector */}
      <Card>
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Camera Angle</p>
            <p className="text-xs text-slate-400 mt-0.5">Select a preset to reposition the camera</p>
          </div>
          <Segmented options={styleOptions} value={style} onChange={switchStyle} />
        </div>
      </Card>

      {/* Building Specs Summary */}
      <Card>
        <div className="px-6 py-4 flex flex-wrap items-center gap-2 text-xs">
          <Badge tone="brand">Size: {params.building_length}' x {params.building_width}' x {params.full_height}'</Badge>
          <Badge tone="info">Roof: {params.roof_type === 'gable' ? 'Gable' : 'Single Slope'}</Badge>
          <Badge tone="default">Roofing: {params.roof_sheet_type === 'puf' ? 'PUF Panel' : 'Galvalume'}</Badge>
          <Badge tone="default">Cladding: {params.side_cladding_type === 'puf' ? 'PUF Panel' : 'Galvalume'}</Badge>
          {params.mezzanine_required && (
            <Badge tone="success">Mezzanine: {params.mezz_length}' x {params.mezz_width}'</Badge>
          )}
          {boq?.total_amount && <Badge tone="warning">Cost: Rs. {boq.total_amount.toLocaleString('en-IN')}</Badge>}
        </div>
      </Card>

      {/* 3D Canvas with preserveDrawingBuffer for capture */}
      <Card className="overflow-hidden relative" style={{ height: '450px' }}>
        <Canvas
          key={cameraKey}
          shadows
          gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: 3 }}
          camera={{ position: camPos, fov: 50 }}
        >
          <color attach="background" args={["#0c1222"]} />
          <RenderLighting />
          <Sky sunPosition={[100, 80, 50]} turbidity={6} rayleigh={0.5} mieCoefficient={0.005} />
          <Suspense fallback={null}>
            <PEBBuilding data={params} />
          </Suspense>
          <OrbitControls
            enablePan enableZoom enableRotate
            autoRotate={false}
            minDistance={15} maxDistance={800}
            maxPolarAngle={Math.PI / 2.05}
          />
          <CaptureHelper captureRef={captureRef} />
        </Canvas>
        <div className="absolute bottom-3 left-3 text-[10px] text-white/80 bg-slate-950/60 px-2.5 py-1 rounded-md border border-white/10">
          Drag to rotate &middot; Scroll to zoom &middot; Position camera, then capture
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="primary" size="lg" leftIcon={Camera} onClick={capture} className="flex-1">
          Capture Render
        </Button>
        <Button
          variant="secondary"
          size="lg"
          leftIcon={copied ? Check : Copy}
          onClick={copyPrompt}
        >
          {copied ? 'Copied!' : 'Copy AI Prompt'}
        </Button>
      </div>

      {/* Tip */}
      <Card>
        <div className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Tip: </span>
            Use "Copy AI Prompt" and paste into ChatGPT, Ideogram, or Bing Image Creator for photorealistic AI renders.
          </span>
        </div>
      </Card>

      {/* Renders Gallery */}
      <Card>
        <CardHeader
          title="Captured Renders"
          subtitle={renders.length === 0 ? 'Position the camera, then click Capture' : `${renders.length} render${renders.length !== 1 ? 's' : ''}`}
        />
        <div className="px-6 py-5">
          {renders.length === 0 ? (
            <EmptyState
              icon={Camera}
              title="No renders yet"
              description='Position the camera above, then click "Capture Render" to save a snapshot.'
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renders.map(render => (
                <div
                  key={render.id}
                  className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.2)] hover:-translate-y-0.5"
                >
                  <div className="relative">
                    <img src={render.src} alt={`PEB Render - ${render.style}`} className="w-full aspect-video object-cover" />
                    <button
                      onClick={() => downloadImage(render.src, render.id)}
                      className="absolute bottom-3 right-3 bg-slate-950/70 border border-white/10 rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-slate-950/90"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize">{render.style} View</p>
                      <p className="text-[10px] text-slate-400">{render.timestamp}</p>
                    </div>
                    <Button variant="ghost" size="sm" leftIcon={Download} onClick={() => downloadImage(render.src, render.id)}>
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
