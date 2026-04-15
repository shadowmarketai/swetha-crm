/**
 * Public 3D Viewer — whitelabel branded, full-screen Three.js viewer.
 * Loads quote by signed token, pulls building_params, renders PEBBuilding.
 */
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ArrowLeft, Loader2, Eye, Camera, ArrowUp, ArrowRight as ArrowRightIcon } from 'lucide-react';
import PEBBuilding from '../PEBBuilding';
import { quotationPublicAPI } from '../../../services/api';

const PRESETS = [
  { label: 'Perspective', icon: Eye, pos: (L, W, H) => [L * 0.8, H * 3, W * 1.2] },
  { label: 'Front', icon: ArrowUp, pos: (L, W, H) => [0, H * 1.5, W * 2] },
  { label: 'Side', icon: ArrowRightIcon, pos: (L, W, H) => [L * 1.5, H * 1.5, 0] },
  { label: 'Top', icon: Camera, pos: (L, W, H) => [0, Math.max(L, W) * 1.5, 0.01] },
];

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[100, 120, 60]} intensity={1.8} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <directionalLight position={[-60, 80, -40]} intensity={0.4} color="#8b9cf7" />
      <hemisphereLight intensity={0.4} color="#bfdbfe" groundColor="#1e293b" />
    </>
  );
}

export default function PublicViewer3D() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState(0);
  const [cameraKey, setCameraKey] = useState(0);

  useEffect(() => {
    quotationPublicAPI.viewQuote(token)
      .then(res => setQuote(res.data))
      .catch(() => setQuote(null))
      .finally(() => setLoading(false));
  }, [token]);

  const switchPreset = useCallback((idx) => { setPreset(idx); setCameraKey(k => k + 1); }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  if (!quote) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">Invalid link</div>;

  const tenant = quote.tenant || {};
  const params = quote.boq_results?.params || quote.boq_results || {
    building_length: 100, building_width: 60, full_height: 30, wall_height: 20,
    cladding_height: 18, roof_type: 'gable', roof_sheet_type: 'bare',
    side_cladding_type: 'bare', mezzanine_required: false,
  };
  // Fallback — try reading from boq_results.meta or nested
  const L = +params.building_length || 100;
  const W = +params.building_width || 60;
  const H = +params.full_height || 30;
  const camPos = PRESETS[preset].pos(L, W, H);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link to={`/q/${token}`} className="p-2 rounded-lg hover:bg-slate-800">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="font-semibold text-sm">{quote.project_name}</div>
            <div className="text-xs text-slate-400">{tenant.name || 'Tendent'} · {L}ft × {W}ft × {H}ft</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {PRESETS.map((p, i) => {
            const Icon = p.icon;
            return (
              <button key={p.label} onClick={() => switchPreset(i)}
                className={`flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium transition ${preset === i ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                style={preset === i ? {
                  background: `linear-gradient(135deg, ${tenant.primary_color || '#6366f1'}, ${tenant.accent_color || '#8b5cf6'})`,
                } : undefined}
              >
                <Icon className="w-4 h-4" /> <span className="hidden sm:inline">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <Canvas key={cameraKey} shadows camera={{ position: camPos, fov: 50 }} gl={{ antialias: true }}>
          <color attach="background" args={["#050816"]} />
          <SceneLighting />
          <Suspense fallback={null}>
            <PEBBuilding data={params} />
          </Suspense>
          <OrbitControls enablePan enableZoom enableRotate autoRotate autoRotateSpeed={0.3} minDistance={15} maxDistance={800} maxPolarAngle={Math.PI / 2.05} />
        </Canvas>
      </div>

      <div className="px-4 py-2 text-center text-xs text-slate-500 border-t border-slate-800">
        Click & drag to rotate · Scroll to zoom · Auto-rotates slowly
      </div>
    </div>
  );
}
