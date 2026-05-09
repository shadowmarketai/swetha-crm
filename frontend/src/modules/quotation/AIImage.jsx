/**
 * AIImage — Photoreal AI Renders for PEB Buildings
 *
 * Two flows live on this page:
 *   1. Three.js viewport capture  (raw 3D model PNG, looks like CAD)
 *   2. Gemini photoreal render    (image-to-image: 3D capture → realistic photo)
 *
 * For (2) the user clicks "Generate Realistic Renders". We screenshot the
 * current camera, POST it with the building params to the backend, and the
 * backend calls Google Gemini 2.5 Flash Image. Three angles are returned:
 * exterior, aerial, and front. If we have a quotation_id from navigation
 * state, the URLs are persisted to quote.ai_render_urls so the public render
 * gallery picks them up.
 */

import { useState, useCallback, useRef, useEffect, Suspense } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Sky } from '@react-three/drei'
import {
  ArrowLeft, Camera, Download, Wand2, Loader2,
  ImageIcon, Building2, AlertTriangle, RefreshCw, Zap, ShieldCheck, ShieldAlert, Database,
  FolderOpen, Search, Check, FileText, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import BuildingForType from './BuildingForType'
import { Card, CardHeader, Button, PageHeader, EmptyState, Input, StatusBadge, Skeleton } from '../../components/ui/primitives'
import { quotationAPI, mediaUrl } from '../../services/api'
import ProjectStyleCard, { DEFAULT_STYLE } from './ProjectStyleCard'

const RENDER_STYLES = [
  { id: 'exterior', label: 'Exterior', getCam: (L, W, H) => [L * 0.7, H * 3.5, W * 1.3] },
  { id: 'aerial',   label: 'Aerial',   getCam: (L, W, H) => [L * 0.3, Math.max(L, W) * 1.2, W * 0.3] },
  { id: 'front',    label: 'Front',    getCam: (L, W, H) => [0, H * 1.8, W * 2.2] },
  { id: 'side',     label: 'Side',     getCam: (L, W, H) => [L * 1.4, H * 2, 0] },
]

// The three angles the backend supports for AI photoreal generation.
const AI_ANGLES = ['exterior', 'aerial', 'front']

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

// Pull only the visual-style fields out of a `params` blob so we can feed
// ProjectStyleCard without leaking dimension fields.
const STYLE_KEYS = [
  'building_type', 'wall_color_hex', 'accent_color_hex', 'roof_color_hex',
  'trim_color_hex', 'cladding_pattern', 'glazing_type', 'front_door_type',
  'site_context', 'parking_visible', '_preset',
]
function extractStyle(params) {
  const out = { ...DEFAULT_STYLE }
  if (!params) return out
  for (const k of STYLE_KEYS) {
    if (params[k] !== undefined) out[k] = params[k]
  }
  // Normalize old `_style_preset` from a saved quotation
  if (params._style_preset && !out._preset) out._preset = params._style_preset
  return out
}

export default function AIImage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const navState = location.state || {}
  const urlQuotationId = searchParams.get('quotationId')

  // Source-of-truth state: a project (a saved quotation) is selected if either
  // navigation passed one, OR the user picked one via the inline picker.
  // When nothing is selected, we show ProjectPicker instead of the renderer.
  const [project, setProject] = useState(() => {
    if (navState.quotationId) {
      return {
        quotationId: navState.quotationId,
        params: navState.params || {},
        lead: navState.lead || null,
        projectStyle: navState.projectStyle || null,
        // Display fields for the header — best-effort guess from passed data
        project_name: navState.lead?.project_name || navState.lead?.company || `Quotation #${navState.quotationId}`,
        client_name: navState.lead?.company || navState.lead?.name || '',
      }
    }
    if (navState.params) {
      // Came from the New Quotation form before the quote was saved.
      return {
        quotationId: null,
        params: navState.params,
        lead: navState.lead || null,
        projectStyle: navState.projectStyle || null,
        project_name: navState.lead?.company ? `${navState.lead.company} (unsaved)` : 'Unsaved draft',
        client_name: navState.lead?.company || navState.lead?.name || '',
      }
    }
    return null
  })

  const [renders, setRenders] = useState([])
  const [generating, setGenerating] = useState(false)
  const [showStyleEditor, setShowStyleEditor] = useState(false)
  const [style, setStyle] = useState(() =>
    project ? (project.projectStyle || extractStyle(project.params)) : DEFAULT_STYLE
  )
  const captureRef = useRef(null)

  const params = project?.params || {
    building_length: 100, building_width: 60, full_height: 30,
    wall_height: 20, cladding_height: 18, roof_type: 'gable',
    roof_sheet_type: 'bare', side_cladding_type: 'bare', mezzanine_required: false,
  }
  const lead = project?.lead || null
  const quotationId = project?.quotationId || null

  // When the user picks a different project from the inline picker, reset the
  // gallery and rehydrate style from the new quotation's stored fields.
  const selectProject = useCallback((p) => {
    setProject(p)
    setStyle(p.projectStyle || extractStyle(p.params))
    setRenders([])
  }, [])

  const clearProject = useCallback(() => {
    setProject(null)
    setStyle(DEFAULT_STYLE)
    setRenders([])
  }, [])

  // ── URL ↔ project sync (shareable deep links) ─────────────
  // 1. On mount: if URL has ?quotationId=N but no nav state populated a
  //    project, fetch and select that quotation.
  useEffect(() => {
    if (project) return                          // already have one
    if (!urlQuotationId) return                  // nothing to load
    let cancelled = false
    quotationAPI.get(urlQuotationId)
      .then(({ data }) => {
        if (cancelled || !data) return
        selectProject({
          quotationId: data.id,
          params: data.building_params || {},
          lead: { company: data.client_name, name: data.client_name },
          projectStyle: null,
          project_name: data.project_name,
          client_name: data.client_name,
        })
      })
      .catch((err) => {
        if (cancelled) return
        toast.error(err?.response?.data?.detail || `Could not load quotation #${urlQuotationId}`)
      })
    return () => { cancelled = true }
    // We intentionally watch only urlQuotationId here — selectProject is stable
    // and re-running on `project` changes would loop after the call below selects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuotationId])

  // 2. Whenever a project is set/cleared, mirror its quotationId in the URL
  //    so the link is shareable. Use replace=true to avoid stacking history.
  useEffect(() => {
    const currentParam = searchParams.get('quotationId')
    if (project?.quotationId) {
      if (String(project.quotationId) !== currentParam) {
        const next = new URLSearchParams(searchParams)
        next.set('quotationId', String(project.quotationId))
        setSearchParams(next, { replace: true })
      }
    } else if (currentParam) {
      const next = new URLSearchParams(searchParams)
      next.delete('quotationId')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project])

  const L = +params.building_length || 100
  const W = +params.building_width || 60
  const H = +params.full_height || 30
  // Single hero camera position — AI auto-generates the other angles server-side.
  const camPos = RENDER_STYLES[0].getCam(L, W, H)

  // ── Capture a single PNG of the current Three.js frame ──
  // Two rAFs ensure the next frame is rendered into the preserveDrawingBuffer
  // before we read it back as a data URL.
  const captureFrame = useCallback(() => new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (captureRef.current) resolve(captureRef.current())
        else resolve(null)
      })
    })
  }), [])

  // ── 1. Three.js raw screenshot (kept for power users) ──
  const capture3D = useCallback(async () => {
    const dataUrl = await captureFrame()
    if (!dataUrl) {
      toast.error('Capture failed — try moving the camera and try again')
      return
    }
    setRenders(prev => [{
      id: `3d_${Date.now()}`,
      kind: '3d',
      src: dataUrl,
      style: 'exterior',
      label: 'Exterior',
      timestamp: new Date().toLocaleTimeString(),
    }, ...prev])
    toast.success('3D capture saved')
  }, [captureFrame])

  // ── 2. AI photoreal generation (the new headline feature) ──
  // forceRegenerate=true bypasses the server-side render cache.
  const generateAIRenders = useCallback(async ({ force = false, brandCheck = true } = {}) => {
    if (generating) return

    const dataUrl = await captureFrame()
    if (!dataUrl) {
      toast.error('Could not capture the 3D scene. Try moving the camera, then retry.')
      return
    }

    setGenerating(true)
    const tid = toast.loading(
      force
        ? 'Force-regenerating — calling Gemini, ~30-60 seconds…'
        : 'Generating renders (cache is checked first)…'
    )

    try {
      const mergedParams = { ...params, ...style }
      const payload = {
        capture_image: dataUrl,
        building_params: mergedParams,
        angles: AI_ANGLES,
        lead_company: lead?.company || null,
        force_regenerate: !!force,
        check_brand: !!brandCheck,
      }

      const { data } = quotationId
        ? await quotationAPI.generateAIRender(quotationId, payload)
        : await quotationAPI.previewAIRender(payload)

      const items = (data?.renders || []).map(r => ({
        id: `ai_${r.style}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: 'ai',
        src: mediaUrl(r.url),
        rawUrl: r.url,
        style: r.style,
        label: r.label || r.style,
        prompt: r.prompt,
        sizeKb: r.size_kb,
        aspectRatio: r.aspect_ratio,
        width: r.width,
        height: r.height,
        buildingType: r.building_type,
        cached: !!r.cached,
        brandCheck: r.brand_check || null,
        timestamp: new Date().toLocaleTimeString(),
      }))

      if (items.length === 0) {
        toast.error(data?.message || 'AI did not return any images. Check the GEMINI_API_KEY and try again.', { id: tid })
        return
      }

      setRenders(prev => [...items, ...prev])
      const fromCache = items.every(i => i.cached)
      const savedNote = data?.saved_to_quotation ? ' • saved to quotation' : ''
      const cacheNote = fromCache ? ' (from cache, no Gemini cost)' : ''
      toast.success(
        `${fromCache ? 'Loaded' : 'Generated'} ${items.length} render${items.length !== 1 ? 's' : ''}${cacheNote}${savedNote}`,
        { id: tid }
      )
    } catch (err) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail
      if (status === 503) {
        toast.error(detail || 'GEMINI_API_KEY is not configured on the server', { id: tid, duration: 6000 })
      } else if (status === 504 || err?.code === 'ECONNABORTED') {
        toast.error('AI provider timed out. Try again with a single angle.', { id: tid })
      } else {
        toast.error(detail || 'AI render failed. See console for details.', { id: tid })
      }
      // eslint-disable-next-line no-console
      console.error('AI render error', err)
    } finally {
      setGenerating(false)
    }
  }, [captureFrame, generating, lead, params, quotationId, style])

  // 2x upscale a single existing render
  const upscaleOne = useCallback(async (render) => {
    if (!render?.rawUrl) return
    const tid = toast.loading('Enhancing to 2× resolution…')
    try {
      const { data } = await quotationAPI.upscaleAIRender(render.rawUrl, 2)
      const upscaled = {
        ...render,
        id: `${render.id}_x2`,
        src: mediaUrl(data.url),
        rawUrl: data.url,
        width: data.width,
        height: data.height,
        label: `${render.label} (2×)`,
        kind: 'ai',
        upscaled: true,
        timestamp: new Date().toLocaleTimeString(),
      }
      setRenders(prev => [upscaled, ...prev])
      toast.success(`Enhanced to ${data.width}×${data.height}`, { id: tid })
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Upscale failed', { id: tid })
    }
  }, [])

  const downloadImage = useCallback((src, id, kind) => {
    const a = document.createElement('a')
    a.href = src
    a.download = `PEB_${kind === 'ai' ? 'AI' : '3D'}_${params.building_length}x${params.building_width}_${id}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [params])

  // Until a project is chosen, show the picker — unless a URL-driven fetch is
  // about to populate it, in which case we render a small loading state so the
  // picker doesn't flash for ~300ms.
  if (!project) {
    if (urlQuotationId) {
      return (
        <div className="space-y-5 max-w-5xl mx-auto">
          <PageHeader
            title="AI Photoreal Renders"
            subtitle={`Loading quotation #${urlQuotationId}…`}
            actions={
              <Button variant="secondary" leftIcon={ArrowLeft} onClick={() => navigate(-1)}>
                Back
              </Button>
            }
          />
          <Card>
            <div className="px-6 py-12 flex flex-col items-center justify-center text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-sm">Fetching quotation #{urlQuotationId}…</p>
            </div>
          </Card>
        </div>
      )
    }
    return (
      <div className="space-y-5 max-w-5xl mx-auto">
        <PageHeader
          title="AI Photoreal Renders"
          subtitle="Pick a quotation — its dimensions, materials, and brand colours drive the AI"
          actions={
            <Button variant="secondary" leftIcon={ArrowLeft} onClick={() => navigate(-1)}>
              Back
            </Button>
          }
        />
        <ProjectPicker onSelect={selectProject} />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <PageHeader
        title="AI Photoreal Renders"
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            <span>{project.project_name || `Quotation #${quotationId}`}</span>
            {project.client_name && <span className="text-slate-400">· {project.client_name}</span>}
            <button
              onClick={clearProject}
              className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline ml-1 inline-flex items-center gap-0.5"
            >
              <FolderOpen className="w-3 h-3" />
              Change project
            </button>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              leftIcon={generating ? Loader2 : Wand2}
              onClick={() => generateAIRenders()}
              disabled={generating}
              className={generating ? '[&_svg]:animate-spin' : ''}
            >
              {generating ? 'Generating…' : 'Generate Realistic Renders'}
            </Button>
            <Button
              variant="secondary"
              leftIcon={generating ? Loader2 : RefreshCw}
              onClick={() => generateAIRenders({ force: true })}
              disabled={generating}
              className={generating ? '[&_svg]:animate-spin' : ''}
              title="Bypass cache and force a fresh Gemini call (costs tokens)"
            >
              Regenerate
            </Button>
            <Button variant="secondary" leftIcon={ArrowLeft} onClick={() => navigate(-1)}>
              Back
            </Button>
          </div>
        }
      />

      {/* Compact style summary + editor toggle */}
      <Card>
        <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <div className="flex gap-0.5">
                <span className="w-3.5 h-3.5 rounded-sm border border-black/10" style={{ background: style.wall_color_hex }} title={`Wall ${style.wall_color_hex}`} />
                <span className="w-3.5 h-3.5 rounded-sm border border-black/10" style={{ background: style.accent_color_hex }} title={`Accent ${style.accent_color_hex}`} />
              </div>
              <div className="flex gap-0.5">
                <span className="w-3.5 h-3.5 rounded-sm border border-black/10" style={{ background: style.roof_color_hex }} title={`Roof ${style.roof_color_hex}`} />
                <span className="w-3.5 h-3.5 rounded-sm border border-black/10" style={{ background: style.trim_color_hex }} title={`Trim ${style.trim_color_hex}`} />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize">
                {style.building_type}
                <span className="ml-1.5 text-[10px] font-normal text-slate-400 normal-case">
                  · {style.cladding_pattern?.replace('_', ' ')} · {style.glazing_type?.replace('_', ' ')}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {style._preset
                  ? `Preset: ${style._preset.replace(/_/g, ' ')}`
                  : 'Custom palette'} · the AI will follow these
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowStyleEditor(o => !o)}>
            {showStyleEditor ? 'Hide style editor' : 'Edit style'}
          </Button>
        </div>
      </Card>

      {showStyleEditor && (
        <ProjectStyleCard value={style} onChange={setStyle} />
      )}

      {/* 3D Canvas */}
      <Card className="overflow-hidden relative" style={{ height: '450px' }}>
        <Canvas
          shadows
          gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: 3 }}
          camera={{ position: camPos, fov: 50 }}
        >
          <color attach="background" args={["#0c1222"]} />
          <RenderLighting />
          <Sky sunPosition={[100, 80, 50]} turbidity={6} rayleigh={0.5} mieCoefficient={0.005} />
          <Suspense fallback={null}>
            {/* Pick the 3D model that matches the chosen typology, with the
                live style merged in so colours flow into the geometry too. */}
            <BuildingForType data={{ ...params, ...style }} />
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
          Drag to rotate · Scroll to zoom · Position the camera, then click Generate
        </div>
        {generating && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center text-white">
            <Loader2 className="w-10 h-10 animate-spin mb-3" />
            <p className="text-sm font-semibold">Calling Gemini 2.5 Flash Image…</p>
            <p className="text-xs text-slate-300 mt-1">Generating 3 photoreal angles · ~30-60 seconds</p>
          </div>
        )}
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        <Button
          variant="primary"
          size="lg"
          leftIcon={generating ? Loader2 : Wand2}
          onClick={() => generateAIRenders()}
          disabled={generating}
          className={`flex-1 ${generating ? '[&_svg]:animate-spin' : ''}`}
        >
          {generating ? 'Generating Photoreal Renders…' : 'Generate Realistic Renders (AI)'}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          leftIcon={generating ? Loader2 : RefreshCw}
          onClick={() => generateAIRenders({ force: true })}
          disabled={generating}
          title="Bypass cache and call Gemini fresh"
        >
          Regenerate
        </Button>
        <Button variant="secondary" size="lg" leftIcon={Camera} onClick={capture3D} disabled={generating}>
          Save 3D Snapshot
        </Button>
      </div>

      {/* Renders Gallery */}
      <Card>
        <CardHeader
          title="Renders"
          subtitle={
            renders.length === 0
              ? 'Click "Generate Realistic Renders" to start'
              : `${renders.length} image${renders.length !== 1 ? 's' : ''} · ${renders.filter(r => r.kind === 'ai').length} AI photoreal · ${renders.filter(r => r.kind === '3d').length} 3D`
          }
        />
        <div className="px-6 py-5">
          {renders.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title="No renders yet"
              description='Position the 3D camera above, then click "Generate Realistic Renders". Three photoreal images will appear here.'
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renders.map(render => (
                <RenderCard
                  key={render.id}
                  render={render}
                  onDownload={() => downloadImage(render.src, render.id, render.kind)}
                  onUpscale={render.kind === 'ai' && !render.upscaled ? () => upscaleOne(render) : null}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}


// ── Render gallery card (shared between AI and 3D) ──
// Renders the image at its natural aspect ratio so a 3:4 portrait shows tall
// and a 21:9 ultrawide shows wide — instead of forcing a 16:9 thumbnail.
function RenderCard({ render, onDownload, onUpscale }) {
  const [imgError, setImgError] = useState(false)
  const isAI = render.kind === 'ai'
  const bc = render.brandCheck
  const brandWarn = bc && bc.passed === false

  // Use real image dimensions when we have them; otherwise the aspect_ratio
  // string returned by the backend; otherwise default to 16:9.
  const aspectStyle = render.width && render.height
    ? { aspectRatio: `${render.width} / ${render.height}` }
    : render.aspectRatio
      ? { aspectRatio: render.aspectRatio.replace(':', ' / ') }
      : { aspectRatio: '16 / 9' }

  return (
    <div className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.2)] hover:-translate-y-0.5">
      <div className="relative bg-slate-50 dark:bg-slate-950" style={aspectStyle}>
        {imgError ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <AlertTriangle className="w-6 h-6" />
            <p className="text-xs">Image unavailable — check server</p>
          </div>
        ) : (
          <img
            src={render.src}
            alt={`PEB Render — ${render.label}`}
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
          />
        )}

        {/* Top-left: kind / cache / upscaled badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap max-w-[80%]">
          {isAI ? (
            <span className="bg-gradient-to-r from-purple-600 to-pink-500 text-white text-[10px] font-semibold px-2 py-1 rounded-md shadow-lg flex items-center gap-1">
              <Wand2 className="w-3 h-3" />
              AI Photoreal
            </span>
          ) : (
            <span className="bg-slate-950/80 text-white text-[10px] font-semibold px-2 py-1 rounded-md shadow-lg flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              3D Capture
            </span>
          )}
          {render.cached && (
            <span className="bg-emerald-600/90 text-white text-[10px] font-semibold px-2 py-1 rounded-md shadow-lg flex items-center gap-1" title="Loaded from cache — no Gemini cost">
              <Database className="w-3 h-3" />
              Cached
            </span>
          )}
          {render.upscaled && (
            <span className="bg-amber-500/90 text-white text-[10px] font-semibold px-2 py-1 rounded-md shadow-lg flex items-center gap-1">
              <Zap className="w-3 h-3" />
              2× Enhanced
            </span>
          )}
        </div>

        {/* Top-right: brand-check badge (only when result is present) */}
        {bc && (
          <div className="absolute top-3 right-3" title={bc.reason || ''}>
            {brandWarn ? (
              <span className="bg-rose-600/90 text-white text-[10px] font-semibold px-2 py-1 rounded-md shadow-lg flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                Brand drift {bc.score}/100
              </span>
            ) : (
              <span className="bg-emerald-600/90 text-white text-[10px] font-semibold px-2 py-1 rounded-md shadow-lg flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Brand ✓ {bc.score}/100
              </span>
            )}
          </div>
        )}

        {/* Bottom-right hover actions: enhance + download */}
        {!imgError && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {onUpscale && (
              <button
                onClick={onUpscale}
                className="bg-slate-950/70 border border-white/10 rounded-lg p-2 text-white hover:bg-slate-950/90"
                title="Enhance to 2× resolution"
              >
                <Zap className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onDownload}
              className="bg-slate-950/70 border border-white/10 rounded-lg p-2 text-white hover:bg-slate-950/90"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="p-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize truncate">
            {render.label} View
            {render.buildingType && (
              <span className="ml-1.5 text-[9px] font-medium text-slate-400 uppercase tracking-wider">
                {render.buildingType}
              </span>
            )}
          </p>
          <p className="text-[10px] text-slate-400 truncate">
            {render.timestamp}
            {render.aspectRatio ? ` · ${render.aspectRatio}` : ''}
            {render.width && render.height ? ` · ${render.width}×${render.height}` : ''}
            {render.sizeKb ? ` · ${render.sizeKb} KB` : ''}
          </p>
        </div>
        <Button variant="ghost" size="sm" leftIcon={Download} onClick={onDownload}>
          Download
        </Button>
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────
//   ProjectPicker — search + list saved quotations and select one
// ─────────────────────────────────────────────────────────────────
//
// The component fetches the most recent ~50 quotations on mount and lets the
// user filter by project name / client / status. On click, it fetches the
// full quotation (so we get building_params even if the list endpoint trims
// them) and emits the picked record via `onSelect`.
//
function ProjectPicker({ onSelect }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [search, setSearch] = useState('')
  const [picking, setPicking] = useState(null)  // id currently being hydrated

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    quotationAPI.getAll({ limit: 50 })
      .then((res) => {
        if (cancelled) return
        setQuotes(res.data?.items || [])
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.response?.data?.detail || 'Could not load quotations')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  const filtered = quotes.filter((q) => {
    if (!search.trim()) return true
    const needle = search.toLowerCase()
    return (
      (q.project_name || '').toLowerCase().includes(needle) ||
      (q.client_name || '').toLowerCase().includes(needle) ||
      (q.client_location || '').toLowerCase().includes(needle) ||
      String(q.id).includes(needle)
    )
  })

  const handlePick = useCallback(async (q) => {
    setPicking(q.id)
    try {
      // Fetch the full record — list endpoint may not include building_params
      const { data: full } = await quotationAPI.get(q.id)
      onSelect({
        quotationId: full.id,
        params: full.building_params || {},
        lead: { company: full.client_name, name: full.client_name },
        projectStyle: null,  // AIImage will derive style from building_params
        project_name: full.project_name,
        client_name: full.client_name,
      })
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not load that quotation')
      setPicking(null)
    }
  }, [onSelect])

  return (
    <Card>
      <CardHeader
        title="Choose a project"
        subtitle="Saved quotations from the CRM. Click one to render its building."
        action={
          <Button variant="secondary" size="sm" onClick={() => navigate('/quotation/new')}>
            New quotation
          </Button>
        }
      />
      <div className="px-6 py-4 space-y-3">
        <Input
          leftIcon={Search}
          placeholder="Search by project, client, location, or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        )}

        {!loading && error && (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load quotations"
            description={error}
          />
        )}

        {!loading && !error && quotes.length === 0 && (
          <EmptyState
            icon={FileText}
            title="No quotations yet"
            description="Create your first quotation, then come back here to render it."
            action={
              <Button onClick={() => navigate('/quotation/new')}>
                Create quotation
              </Button>
            }
          />
        )}

        {!loading && !error && quotes.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-slate-500 py-4 text-center">
            No quotations match "{search}"
          </p>
        )}

        {!loading && filtered.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 -mx-2">
            {filtered.map((q) => {
              const isPicking = picking === q.id
              return (
                <button
                  key={q.id}
                  type="button"
                  disabled={picking !== null}
                  onClick={() => handlePick(q)}
                  className={`w-full text-left px-3 py-3 flex items-center gap-3 rounded-lg transition ${
                    isPicking
                      ? 'bg-amber-50 dark:bg-amber-500/10'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  } disabled:opacity-50`}
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white flex-shrink-0">
                    {isPicking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate flex items-center gap-2">
                      {q.project_name || `Quotation #${q.id}`}
                      <span className="text-[10px] font-normal text-slate-400">Q-{q.id}</span>
                    </div>
                    <div className="text-xs text-slate-500 truncate flex items-center gap-2">
                      {q.client_name && <span>{q.client_name}</span>}
                      {q.client_location && <span>· {q.client_location}</span>}
                      {q.building_params?.building_length && (
                        <span>· {q.building_params.building_length}'×{q.building_params.building_width}'×{q.building_params.full_height}'</span>
                      )}
                    </div>
                  </div>
                  {q.status && <StatusBadge status={q.status} />}
                  {q.total_amount > 0 && (
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex-shrink-0">
                      ₹{(q.total_amount / 100000).toFixed(1)}L
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}
