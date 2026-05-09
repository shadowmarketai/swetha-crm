/**
 * Pricing Configuration — Master Rate Card for PEB Quotations
 *
 * Sets default rates for all BOQ items (Material + Labour split),
 * steel weight factors, additions pricing, and raw material reference rates.
 * Persisted to localStorage → used as defaults in New Quote.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Save, RotateCcw, IndianRupee, Wrench, Package, Layers, Settings,
  TrendingUp, Check, AlertTriangle, Wind, Truck, DoorOpen,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Card, CardHeader, Button, PageHeader, Badge, Input, Field,
} from '../../components/ui/primitives'

const STORAGE_KEY = 'swetha_pricing_config'

// ─── Default Rate Card ───────────────────────────────────────────
const DEFAULT_BOQ_RATES = [
  {
    id: 'structural_steel', label: 'Structural Steel Works', unit: 'Kg',
    description: 'Supplying, fabrication & erection of MS Sections — Trusses, Base plate, Cap plate, connection plates, EN8 Anchor bolts, Cold formed Purlins, Sag rods, primer + 2 coats enamel paint',
    material: 70, labour: 35,
  },
  {
    id: 'purlin', label: 'Purlin (Cold Formed — if separate)', unit: 'Kg',
    description: 'Supplying and erecting Cold formed Purlins, Girts, Bracings separately (when not combined with structural steel)',
    material: 90, labour: 15,
  },
  {
    id: 'roof_sheet', label: 'Roof Sheet', unit: 'Sqft',
    description: 'Roofing sheet — rate varies by selected material (Bare Galvalume / PUF Panel). This is the base rate for Bare Galvalume 0.47mm',
    material: 42, labour: 18,
  },
  {
    id: 'side_cladding', label: 'Side Cladding', unit: 'Sqft',
    description: 'Side cladding sheet — rate varies by selected material. Base rate for Colour Coated Galvalume 0.47mm',
    material: 40, labour: 18,
  },
  {
    id: 'ridge_flashing', label: 'Ridge, L Flash, Gutter, Downspout', unit: 'Rft',
    description: 'Profiled colour coated galvalume 0.47mm with 550 MPA for Ridge, L Flash, Trip Flash, Gutter, Downspout',
    material: 60, labour: 50,
  },
  {
    id: 'polycarbonate', label: 'Polycarbonate Lighting Sheet', unit: 'Sqft',
    description: 'POLYCARBONATE SHEET 1.5mm thickness for natural lighting',
    material: 60, labour: 50,
  },
  {
    id: 'mezzanine_steel', label: 'Mezzanine Steel Works', unit: 'Kg',
    description: 'Structural steel for mezzanine floor — columns, beams, connection plates, bolts',
    material: 70, labour: 35,
  },
  {
    id: 'mezzanine_decking', label: 'Mezzanine Deck Sheet + Concrete', unit: 'Sqft',
    description: 'Deck sheet + M20 concrete (100mm avg) for mezzanine floor',
    material: 110, labour: 25,
  },
]

const DEFAULT_ADDITIONS_RATES = [
  { id: 'turbo_ventilator_rate', label: 'Turbo Ventilator', unit: 'Nos', material: 4500, labour: 1250 },
  { id: 'rolling_shutter', label: 'Rolling Shutter (Motor Type)', unit: 'Sqft', material: 350, labour: 150 },
  { id: 'steel_staircase', label: 'Steel Staircase', unit: 'Kg', material: 70, labour: 50 },
  { id: 'crane_bracket', label: 'Crane Bracket & Girder', unit: 'Kg', material: 75, labour: 40 },
  { id: 'ridge_monitor', label: 'Ridge Monitor', unit: 'Sqft', material: 30, labour: 16 },
  { id: 'fixed_louver', label: 'Fixed Louver', unit: 'Sqft', material: 280, labour: 120 },
  { id: 'aluminium_foil', label: 'Aluminium Foil Insulation', unit: 'Sqft', material: 18, labour: 8 },
]

const DEFAULT_STEEL_FACTORS = {
  steel_rate_main: 1.8,
  steel_rate_mezz: 3.4,
}

const DEFAULT_ROOF_SHEET_RATES = [
  { id: 'bare_galvalume_0.4mm', label: 'Bare Galvalume 0.4mm', material: 38, labour: 18 },
  { id: 'bare_galvalume_0.45mm', label: 'Bare Galvalume 0.45mm', material: 40, labour: 18 },
  { id: 'bare_galvalume_0.47mm', label: 'Bare Galvalume 0.47mm', material: 42, labour: 18 },
  { id: 'bare_galvalume_0.5mm', label: 'Bare Galvalume 0.5mm', material: 46, labour: 18 },
  { id: 'puf_panel_20mm', label: 'PUF Panel 20mm', material: 130, labour: 35 },
  { id: 'puf_panel_30mm', label: 'PUF Panel 30mm', material: 145, labour: 40 },
  { id: 'puf_panel_50mm', label: 'PUF Panel 50mm', material: 155, labour: 40 },
  { id: 'puf_panel_100mm', label: 'PUF Panel 100mm', material: 220, labour: 45 },
]

const DEFAULT_SIDE_CLADDING_RATES = [
  { id: 'bare_colour_galvalume_0.4mm', label: 'Bare Colour Galvalume 0.4mm', material: 36, labour: 18 },
  { id: 'bare_colour_galvalume_0.45mm', label: 'Bare Colour Galvalume 0.45mm', material: 38, labour: 18 },
  { id: 'bare_colour_galvalume_0.47mm', label: 'Bare Colour Galvalume 0.47mm', material: 40, labour: 18 },
  { id: 'bare_colour_galvalume_0.5mm', label: 'Bare Colour Galvalume 0.5mm', material: 44, labour: 18 },
  { id: 'puf_panel_20mm', label: 'PUF Panel 20mm', material: 130, labour: 35 },
  { id: 'puf_panel_30mm', label: 'PUF Panel 30mm', material: 145, labour: 40 },
  { id: 'puf_panel_50mm', label: 'PUF Panel 50mm', material: 155, labour: 40 },
  { id: 'puf_panel_100mm', label: 'PUF Panel 100mm', material: 220, labour: 45 },
]

const DEFAULT_RAW_MATERIALS = [
  { id: 'steel_plates_sail', label: 'Structural Steel Plates (SAIL)', unit: 'Rs/Kg', rate: 57, source: 'SAIL Ex-Works' },
  { id: 'steel_purlin_jsw', label: 'Steel Purlin (JSW)', unit: 'Rs/Kg', rate: 75, source: 'JSW Ex-Works' },
  { id: 'roofing_sheet_jsw', label: 'Roofing Sheet 0.47mm (JSW)', unit: 'Rs/Sq.Mt', rate: 325, source: 'JSW Dealer' },
  { id: 'colour_coated', label: 'Colour Coated Galvalume 0.47mm', unit: 'Rs/Sq.Mt', rate: 380, source: 'JSW / TATA' },
  { id: 'puf_panel_30', label: 'PUF Panel 30mm (Raw)', unit: 'Rs/Sqft', rate: 120, source: 'Market Rate' },
  { id: 'polycarbonate_raw', label: 'Polycarbonate Sheet 1.5mm', unit: 'Rs/Sqft', rate: 65, source: 'Market Rate' },
  { id: 'anchor_bolts', label: 'EN8 Anchor Bolts', unit: 'Rs/Kg', rate: 85, source: 'Market Rate' },
  { id: 'concrete_m20', label: 'Concrete M20 Grade', unit: 'Rs/Cuft', rate: 12, source: 'RMC Plant' },
  { id: 'paint_primer', label: 'Zinc Chromate Primer + Enamel', unit: 'Rs/Sqft', rate: 8, source: 'Asian Paints' },
]

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

// ─── Exported helper for New Quote to read master rates ──────────
export function getMasterRates() {
  const config = loadConfig()
  if (!config) return null
  return config.boqRates || null
}

export function getMasterSteelFactors() {
  const config = loadConfig()
  if (!config) return DEFAULT_STEEL_FACTORS
  return config.steelFactors || DEFAULT_STEEL_FACTORS
}

export function getMasterRoofSheetRates() {
  const config = loadConfig()
  return config?.roofSheetRates || DEFAULT_ROOF_SHEET_RATES
}

export function getMasterSideCladdingRates() {
  const config = loadConfig()
  return config?.sideCladdingRates || DEFAULT_SIDE_CLADDING_RATES
}

// ─── Rate Row Component ──────────────────────────────────────────
function RateRow({ item, onChange }) {
  const total = (item.material || 0) + (item.labour || 0)
  return (
    <div className="grid grid-cols-[1fr_70px_90px_90px_80px] gap-3 items-center py-3 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.label}</p>
        {item.description && (
          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{item.description}</p>
        )}
      </div>
      <p className="text-xs text-slate-500 text-right">{item.unit}</p>
      <Input
        type="number"
        className="text-right text-sm !py-1.5 !px-2"
        value={item.material}
        onChange={(e) => onChange({ ...item, material: parseFloat(e.target.value) || 0 })}
      />
      <Input
        type="number"
        className="text-right text-sm !py-1.5 !px-2"
        value={item.labour}
        onChange={(e) => onChange({ ...item, labour: parseFloat(e.target.value) || 0 })}
      />
      <div className="text-right">
        <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
          {total.toLocaleString('en-IN')}
        </span>
      </div>
    </div>
  )
}

function RawMaterialRow({ item, onChange }) {
  return (
    <div className="grid grid-cols-[1fr_100px_90px_120px] gap-3 items-center py-3 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.label}</p>
      </div>
      <p className="text-xs text-slate-500 text-right">{item.unit}</p>
      <Input
        type="number"
        className="text-right text-sm !py-1.5 !px-2"
        value={item.rate}
        onChange={(e) => onChange({ ...item, rate: parseFloat(e.target.value) || 0 })}
      />
      <p className="text-[10px] text-slate-400 text-right">{item.source}</p>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────
export default function PricingConfig() {
  const [boqRates, setBoqRates] = useState(DEFAULT_BOQ_RATES)
  const [additionsRates, setAdditionsRates] = useState(DEFAULT_ADDITIONS_RATES)
  const [steelFactors, setSteelFactors] = useState(DEFAULT_STEEL_FACTORS)
  const [roofSheetRates, setRoofSheetRates] = useState(DEFAULT_ROOF_SHEET_RATES)
  const [sideCladdingRates, setSideCladdingRates] = useState(DEFAULT_SIDE_CLADDING_RATES)
  const [rawMaterials, setRawMaterials] = useState(DEFAULT_RAW_MATERIALS)
  const [hasChanges, setHasChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)

  // Load from localStorage on mount
  useEffect(() => {
    const config = loadConfig()
    if (config) {
      if (config.boqRates) setBoqRates(config.boqRates)
      if (config.additionsRates) setAdditionsRates(config.additionsRates)
      if (config.steelFactors) setSteelFactors(config.steelFactors)
      if (config.roofSheetRates) setRoofSheetRates(config.roofSheetRates)
      if (config.sideCladdingRates) setSideCladdingRates(config.sideCladdingRates)
      if (config.rawMaterials) setRawMaterials(config.rawMaterials)
      if (config.savedAt) setLastSaved(config.savedAt)
    }
  }, [])

  const markChanged = useCallback(() => setHasChanges(true), [])

  const updateBoqRate = (idx, updated) => {
    const next = [...boqRates]
    next[idx] = updated
    setBoqRates(next)
    markChanged()
  }

  const updateAdditionsRate = (idx, updated) => {
    const next = [...additionsRates]
    next[idx] = updated
    setAdditionsRates(next)
    markChanged()
  }

  const updateRoofRate = (idx, updated) => {
    const next = [...roofSheetRates]
    next[idx] = updated
    setRoofSheetRates(next)
    markChanged()
  }

  const updateSideRate = (idx, updated) => {
    const next = [...sideCladdingRates]
    next[idx] = updated
    setSideCladdingRates(next)
    markChanged()
  }

  const updateRawMaterial = (idx, updated) => {
    const next = [...rawMaterials]
    next[idx] = updated
    setRawMaterials(next)
    markChanged()
  }

  const handleSave = () => {
    const now = new Date().toISOString()
    saveConfig({
      boqRates, additionsRates, steelFactors,
      roofSheetRates, sideCladdingRates, rawMaterials,
      savedAt: now,
    })
    setHasChanges(false)
    setLastSaved(now)
    toast.success('Pricing configuration saved')
  }

  const handleReset = () => {
    setBoqRates(DEFAULT_BOQ_RATES)
    setAdditionsRates(DEFAULT_ADDITIONS_RATES)
    setSteelFactors(DEFAULT_STEEL_FACTORS)
    setRoofSheetRates(DEFAULT_ROOF_SHEET_RATES)
    setSideCladdingRates(DEFAULT_SIDE_CLADDING_RATES)
    setRawMaterials(DEFAULT_RAW_MATERIALS)
    setHasChanges(true)
    toast('Reset to factory defaults', { icon: '🔄' })
  }

  return (
    <div className="max-w-5xl mx-auto pb-28">
      <PageHeader
        title="Pricing Configuration"
        subtitle="Master rate card for all PEB quotation items — these become defaults for every new quote"
        breadcrumbs={[{ label: 'Quotations', href: '/quotation' }, { label: 'Pricing' }]}
        actions={
          <div className="flex items-center gap-2">
            {lastSaved && (
              <span className="text-xs text-slate-400">
                Last saved: {new Date(lastSaved).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {hasChanges && <Badge tone="warning"><AlertTriangle className="w-3 h-3" /> Unsaved</Badge>}
          </div>
        }
      />

      {/* ═══════ 1. CORE BOQ RATES ═══════ */}
      <Card className="mb-5">
        <CardHeader
          title="Core BOQ Rates"
          subtitle="Material + Labour rates for main building items — used in Abstract Estimate"
          action={<Badge tone="brand"><IndianRupee className="w-3 h-3" /> Per Item</Badge>}
        />
        <div className="px-6 py-3">
          <div className="grid grid-cols-[1fr_70px_90px_90px_80px] gap-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
            <span>Item</span>
            <span className="text-right">Unit</span>
            <span className="text-right">Material ₹</span>
            <span className="text-right">Labour ₹</span>
            <span className="text-right">Total ₹</span>
          </div>
          {boqRates.map((item, idx) => (
            <RateRow key={item.id} item={item} onChange={(u) => updateBoqRate(idx, u)} />
          ))}
        </div>
      </Card>

      {/* ═══════ 2. STEEL WEIGHT FACTORS ═══════ */}
      <Card className="mb-5">
        <CardHeader
          title="Steel Weight Factors"
          subtitle="Kg per Sqft — used to estimate total steel tonnage from building area"
          action={<Badge tone="info"><TrendingUp className="w-3 h-3" /> Factor</Badge>}
        />
        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Main Building (Kg/Sqft)" hint="Typical: 1.5 – 2.5">
            <Input
              type="number"
              step="0.1"
              value={steelFactors.steel_rate_main}
              onChange={(e) => { setSteelFactors(s => ({ ...s, steel_rate_main: parseFloat(e.target.value) || 0 })); markChanged() }}
            />
          </Field>
          <Field label="Mezzanine Floor (Kg/Sqft)" hint="Typical: 3.0 – 4.0">
            <Input
              type="number"
              step="0.1"
              value={steelFactors.steel_rate_mezz}
              onChange={(e) => { setSteelFactors(s => ({ ...s, steel_rate_mezz: parseFloat(e.target.value) || 0 })); markChanged() }}
            />
          </Field>
        </div>
      </Card>

      {/* ═══════ 3. ROOF SHEET RATES (by thickness) ═══════ */}
      <Card className="mb-5">
        <CardHeader
          title="Roof Sheet Rates — by Type & Thickness"
          subtitle="Auto-applied when user selects a roof sheet type in New Quote"
          action={<Badge tone="brand"><Layers className="w-3 h-3" /> Per Material</Badge>}
        />
        <div className="px-6 py-3">
          <div className="grid grid-cols-[1fr_70px_90px_90px_80px] gap-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
            <span>Roof Sheet Type</span>
            <span className="text-right">Unit</span>
            <span className="text-right">Material ₹</span>
            <span className="text-right">Labour ₹</span>
            <span className="text-right">Total ₹</span>
          </div>
          {roofSheetRates.map((item, idx) => (
            <RateRow key={item.id} item={{ ...item, unit: 'Sqft' }} onChange={(u) => updateRoofRate(idx, u)} />
          ))}
        </div>
      </Card>

      {/* ═══════ 4. SIDE CLADDING RATES (by thickness) ═══════ */}
      <Card className="mb-5">
        <CardHeader
          title="Side Cladding Rates — by Type & Thickness"
          subtitle="Auto-applied when user selects a cladding type in New Quote"
          action={<Badge tone="brand"><Layers className="w-3 h-3" /> Per Material</Badge>}
        />
        <div className="px-6 py-3">
          <div className="grid grid-cols-[1fr_70px_90px_90px_80px] gap-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
            <span>Side Cladding Type</span>
            <span className="text-right">Unit</span>
            <span className="text-right">Material ₹</span>
            <span className="text-right">Labour ₹</span>
            <span className="text-right">Total ₹</span>
          </div>
          {sideCladdingRates.map((item, idx) => (
            <RateRow key={item.id} item={{ ...item, unit: 'Sqft' }} onChange={(u) => updateSideRate(idx, u)} />
          ))}
        </div>
      </Card>

      {/* ═══════ 5. ADDITIONS RATES ═══════ */}
      <Card className="mb-5">
        <CardHeader
          title="Additions Rates"
          subtitle="Pricing for optional add-ons — Turbo Ventilator, Rolling Shutter, Crane, etc."
          action={<Badge tone="info"><Package className="w-3 h-3" /> Add-ons</Badge>}
        />
        <div className="px-6 py-3">
          <div className="grid grid-cols-[1fr_70px_90px_90px_80px] gap-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
            <span>Addition Item</span>
            <span className="text-right">Unit</span>
            <span className="text-right">Material ₹</span>
            <span className="text-right">Labour ₹</span>
            <span className="text-right">Total ₹</span>
          </div>
          {additionsRates.map((item, idx) => (
            <RateRow key={item.id} item={item} onChange={(u) => updateAdditionsRate(idx, u)} />
          ))}
        </div>
      </Card>

      {/* ═══════ 6. RAW MATERIAL REFERENCE ═══════ */}
      <Card className="mb-5">
        <CardHeader
          title="Raw Material Reference Rates"
          subtitle="Market reference prices — for internal costing and margin calculation"
          action={<Badge tone="default"><Wrench className="w-3 h-3" /> Reference</Badge>}
        />
        <div className="px-6 py-3">
          <div className="grid grid-cols-[1fr_100px_90px_120px] gap-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
            <span>Material</span>
            <span className="text-right">Unit</span>
            <span className="text-right">Rate ₹</span>
            <span className="text-right">Source</span>
          </div>
          {rawMaterials.map((item, idx) => (
            <RawMaterialRow key={item.id} item={item} onChange={(u) => updateRawMaterial(idx, u)} />
          ))}
        </div>
      </Card>

      {/* ═══════ STICKY SAVE BAR ═══════ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-slate-950/85 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <Settings className="w-4 h-4" />
            {hasChanges ? (
              <span className="text-amber-600 font-medium">Unsaved changes</span>
            ) : (
              <span>All changes saved</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" leftIcon={RotateCcw} onClick={handleReset}>
              Reset to Defaults
            </Button>
            <Button variant="primary" leftIcon={Save} onClick={handleSave}>
              Save Pricing Config
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
