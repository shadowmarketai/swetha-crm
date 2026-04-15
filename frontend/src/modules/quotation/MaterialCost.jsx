/**
 * MaterialCost — Material Rates & Cost Breakdown for PEB Quotation
 * Shows basic raw material rates, BOQ rate breakdown (Material + Labour),
 * and allows rate editing that feeds into BOQ calculation.
 * Reference: Excel SUMMARY sheet + ABSTRACT-PEB (2) format.
 */

import { useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, IndianRupee, TrendingUp, Package, Wrench, Save, RotateCcw, Calculator } from 'lucide-react'
import { RATES, STEEL_RATE_MAIN, STEEL_RATE_MEZZ, calcBOQ } from '../../utils/boqEngine'
import toast from 'react-hot-toast'
import { Card, CardHeader, Stat, Button, PageHeader, Badge } from '../../components/ui/primitives'

// Basic raw material rates from Excel SUMMARY sheet (market reference)
const BASIC_MATERIAL_RATES = [
  { id: 'steel_plates', label: 'Structural Steel Plates (SAIL)', unit: 'Rs/Kg', defaultRate: 57, source: 'SAIL Ex-Works' },
  { id: 'steel_purlin', label: 'Structural Steel Purlin (JSW)', unit: 'Rs/Kg', defaultRate: 75, source: 'JSW Ex-Works' },
  { id: 'roofing_sheet', label: 'Roofing Sheet 0.47mm (JSW)', unit: 'Rs/Sq.Mt', defaultRate: 325, source: 'JSW Dealer' },
  { id: 'puf_panel_30mm', label: 'PUF Panel 30mm', unit: 'Rs/Sqft', defaultRate: 120, source: 'Market Rate' },
  { id: 'polycarbonate_sheet', label: 'Polycarbonate Sheet 1.5mm', unit: 'Rs/Sqft', defaultRate: 65, source: 'Market Rate' },
  { id: 'galvalume_colour', label: 'Colour Coated Galvalume 0.47mm', unit: 'Rs/Sq.Mt', defaultRate: 380, source: 'JSW/TATA' },
  { id: 'anchor_bolts', label: 'EN8 Anchor Bolts', unit: 'Rs/Kg', defaultRate: 85, source: 'Market Rate' },
  { id: 'concrete_m20', label: 'Concrete M20 Grade', unit: 'Rs/Cuft', defaultRate: 12, source: 'RMC Plant' },
  { id: 'paint_primer', label: 'Zinc Chromate Primer + Enamel', unit: 'Rs/Sqft', defaultRate: 8, source: 'Asian Paints' },
]

// BOQ Rate breakdown — Material + Labour = Total Rate (from Excel ABSTRACT-PEB format)
const BOQ_RATE_ITEMS = [
  {
    id: 'structural_steel', label: 'Structural Steel Works', unit: 'Rs/Kg',
    description: 'Supplying, fabrication & erection of MS Sections for Trusses, Purlins, Sag rods, Base plates, Cap plates, Anchor bolts, etc.',
    defaultMaterial: 71, defaultLabour: 39, totalRate: RATES.structural_steel,
  },
  {
    id: 'bare_galvalume', label: 'Bare Galvalume Roofing & Cladding', unit: 'Rs/Sqft',
    description: 'BARE galvalume 0.47mm for roofing + profiled COLOUR coated galvalume 0.47mm for side cladding with EPDM washers, flashings, etc.',
    defaultMaterial: 43, defaultLabour: 16, totalRate: RATES.bare_galvalume,
  },
  {
    id: 'puf_panel_roof', label: 'PUF Panel 30mm — Roof', unit: 'Rs/Sqft',
    description: 'PUF insulated panel 30mm thickness for roofing with sealant, EPDM washers, bolts, flashings, etc.',
    defaultMaterial: 140, defaultLabour: 40, totalRate: RATES.puf_panel_roof,
  },
  {
    id: 'puf_panel_wall', label: 'PUF Panel 30mm — Side Cladding', unit: 'Rs/Sqft',
    description: 'PUF insulated panel 30mm thickness for side cladding with sealant, EPDM washers, bolts, flashings, etc.',
    defaultMaterial: 141, defaultLabour: 40, totalRate: RATES.puf_panel_wall,
  },
  {
    id: 'ridge_flashing', label: 'Ridge, L Flash, Gutter, Downspout', unit: 'Rs/Rft',
    description: 'Profiled colour coated galvalume 0.47mm with 550 MPA for Ridge, L Flash, Trip Flash, Gutter, Downspout, etc.',
    defaultMaterial: 60, defaultLabour: 50, totalRate: RATES.ridge_flashing,
  },
  {
    id: 'polycarbonate', label: 'Polycarbonate Lighting Sheet', unit: 'Rs/Sqft',
    description: 'POLYCARBONATE SHEET 1.5mm thickness for natural lighting, including connection, aligning, cleaning, etc.',
    defaultMaterial: 70, defaultLabour: 40, totalRate: RATES.polycarbonate,
  },
  {
    id: 'mezzanine_decking', label: 'Mezzanine Decking + Concrete', unit: 'Rs/Sqft',
    description: 'Decking sheet + M20 concrete (100mm avg) for mezzanine floor, including structural supports.',
    defaultMaterial: 120, defaultLabour: 34, totalRate: RATES.mezzanine_decking,
  },
]

// Steel weight factors
const STEEL_FACTORS = [
  { label: 'Main Building Steel Factor', key: 'steel_rate_main', defaultValue: STEEL_RATE_MAIN, unit: 'Kg/Sqft', description: 'Steel weight per sqft of main building footprint' },
  { label: 'Mezzanine Steel Factor', key: 'steel_rate_mezz', defaultValue: STEEL_RATE_MEZZ, unit: 'Kg/Sqft', description: 'Steel weight per sqft of mezzanine floor area' },
]

function RateCard({ label, value, unit, onChange, highlight }) {
  return (
    <div
      className={`rounded-xl p-3 border transition-all ${
        highlight
          ? 'border-[color:var(--brand-primary)]/30 bg-[color:color-mix(in_oklab,var(--brand-primary)_6%,transparent)]'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      <p className="text-xs text-slate-500 mb-1 font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm">Rs.</span>
        <input type="number" value={value} onChange={e => onChange(+e.target.value)}
          className="w-full text-lg font-bold bg-transparent border-none outline-none text-slate-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <p className="text-[10px] text-slate-400 mt-0.5">{unit}</p>
    </div>
  )
}

export default function MaterialCost() {
  const location = useLocation()
  const navigate = useNavigate()
  const { params: passedParams, boq: passedBoq, lead } = location.state || {}

  const params = passedParams || {
    building_length: 100, building_width: 60, full_height: 30,
    wall_height: 20, cladding_height: 18, roof_type: 'gable',
    roof_sheet_type: 'bare', side_cladding_type: 'bare',
    mezzanine_required: false, mezz_length: 0, mezz_width: 0,
  }

  // Editable BOQ rates (material + labour = total)
  const [boqRates, setBoqRates] = useState(() =>
    BOQ_RATE_ITEMS.reduce((acc, item) => ({
      ...acc,
      [item.id]: { material: item.defaultMaterial, labour: item.defaultLabour }
    }), {})
  )

  // Editable basic material rates
  const [basicRates, setBasicRates] = useState(() =>
    BASIC_MATERIAL_RATES.reduce((acc, item) => ({ ...acc, [item.id]: item.defaultRate }), {})
  )

  // Editable steel factors
  const [steelFactors, setSteelFactors] = useState({
    steel_rate_main: STEEL_RATE_MAIN,
    steel_rate_mezz: STEEL_RATE_MEZZ,
  })

  // Computed total rates
  const totalRates = useMemo(() =>
    BOQ_RATE_ITEMS.reduce((acc, item) => ({
      ...acc,
      [item.id]: (boqRates[item.id]?.material || 0) + (boqRates[item.id]?.labour || 0)
    }), {}),
    [boqRates]
  )

  // Recalculate BOQ with custom rates
  const recalculatedBoq = useMemo(() => {
    const formWithRates = {
      ...params,
      steel_rate_main: steelFactors.steel_rate_main,
      steel_rate_mezz: steelFactors.steel_rate_mezz,
      rate_structural_steel: totalRates.structural_steel,
      rate_bare_galvalume: totalRates.bare_galvalume,
      rate_puf_panel_roof: totalRates.puf_panel_roof,
      rate_puf_panel_wall: totalRates.puf_panel_wall,
      rate_ridge_flashing: totalRates.ridge_flashing,
      rate_polycarbonate: totalRates.polycarbonate,
      rate_mezzanine_decking: totalRates.mezzanine_decking,
    }
    return calcBOQ(formWithRates)
  }, [params, totalRates, steelFactors])

  const resetRates = () => {
    setBoqRates(BOQ_RATE_ITEMS.reduce((acc, item) => ({
      ...acc, [item.id]: { material: item.defaultMaterial, labour: item.defaultLabour }
    }), {}))
    setBasicRates(BASIC_MATERIAL_RATES.reduce((acc, item) => ({ ...acc, [item.id]: item.defaultRate }), {}))
    setSteelFactors({ steel_rate_main: STEEL_RATE_MAIN, steel_rate_mezz: STEEL_RATE_MEZZ })
    toast.success('Rates reset to defaults')
  }

  // Material vs Labour split
  const costSplit = useMemo(() => {
    let materialTotal = 0, labourTotal = 0
    recalculatedBoq.items.forEach(item => {
      const rateKey = Object.keys(totalRates).find(k => {
        const rateMap = {
          structural_steel: '1', bare_galvalume: '2.01', puf_panel_roof: '2.02',
          puf_panel_wall: '3.02', ridge_flashing: '2.03', polycarbonate: '2.04',
          mezzanine_decking: '3.01'
        }
        return rateMap[k] === item.item_no
      })
      if (rateKey && boqRates[rateKey]) {
        const total = boqRates[rateKey].material + boqRates[rateKey].labour
        if (total > 0) {
          materialTotal += item.amount * (boqRates[rateKey].material / total)
          labourTotal += item.amount * (boqRates[rateKey].labour / total)
        }
      }
    })
    return { material: Math.round(materialTotal), labour: Math.round(labourTotal) }
  }, [recalculatedBoq, boqRates, totalRates])

  const matPct = recalculatedBoq.total_amount > 0 ? (costSplit.material / recalculatedBoq.total_amount * 100) : 50
  const labPct = recalculatedBoq.total_amount > 0 ? (costSplit.labour / recalculatedBoq.total_amount * 100) : 50

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Material Cost & Rates"
        subtitle={`${params.building_length}ft x ${params.building_width}ft — Material + Labour rate breakdown`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" leftIcon={RotateCcw} onClick={resetRates}>
              Reset
            </Button>
            <Button variant="secondary" leftIcon={ArrowLeft} onClick={() => navigate(-1)}>
              Back
            </Button>
          </div>
        }
      />

      {/* Cost Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat
          label="Total Estimated Cost"
          value={`Rs. ${recalculatedBoq.total_amount?.toLocaleString('en-IN')}`}
          icon={IndianRupee}
          accent="#f59e0b"
          accentTo="#f43f5e"
        />
        <Stat
          label="Material Cost"
          value={`Rs. ${costSplit.material?.toLocaleString('en-IN')}`}
          icon={Package}
          accent="#6366f1"
          accentTo="#0ea5e9"
        />
        <Stat
          label="Labour Cost"
          value={`Rs. ${costSplit.labour?.toLocaleString('en-IN')}`}
          icon={Wrench}
          accent="#10b981"
          accentTo="#14b8a6"
        />
        <Stat
          label="Floor Area"
          value={`${recalculatedBoq.floor_area?.toLocaleString('en-IN')} sqft`}
          accent="#64748b"
          accentTo="#94a3b8"
        />
        <Stat
          label="Rate / Sqft"
          value={`Rs. ${recalculatedBoq.rate_per_sqft?.toLocaleString('en-IN')}`}
          icon={TrendingUp}
          accent="#ec4899"
          accentTo="#8b5cf6"
        />
      </div>

      {/* Material vs Labour Visual */}
      <Card>
        <CardHeader title="Cost Distribution" subtitle="Material vs. Labour split" />
        <div className="px-6 py-5">
          <div className="flex h-10 rounded-xl overflow-hidden shadow-sm">
            <div
              className="flex items-center justify-center text-xs text-white font-semibold"
              style={{
                width: `${matPct}%`,
                background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
              }}
            >
              Material {Math.round(matPct)}%
            </div>
            <div
              className="flex items-center justify-center text-xs text-white font-semibold"
              style={{
                width: `${labPct}%`,
                background: 'linear-gradient(135deg, #10b981, #14b8a6)',
              }}
            >
              Labour {Math.round(labPct)}%
            </div>
          </div>
        </div>
      </Card>

      {/* Steel Weight Factors */}
      <Card>
        <CardHeader
          title="Steel Weight Factors"
          subtitle="Adjust steel-per-sqft multipliers used in BOQ calculation"
          action={<Wrench className="w-5 h-5 text-rose-500" />}
        />
        <div className="px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STEEL_FACTORS.map(f => (
              <div key={f.key} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200/70 dark:border-slate-800">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{f.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{f.description}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <input type="number" step="0.1" value={steelFactors[f.key]}
                    onChange={e => setSteelFactors(prev => ({ ...prev, [f.key]: +e.target.value }))}
                    className="w-20 px-2 py-1.5 text-right font-mono font-bold text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': 'color-mix(in oklab, var(--brand-primary) 35%, transparent)' }}
                  />
                  <span className="text-xs text-slate-400 w-16">{f.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* BOQ Rate Breakdown — Material + Labour Table */}
      <Card className="overflow-hidden">
        <CardHeader
          title="BOQ Rate Breakdown — Material + Labour (Excl. GST)"
          subtitle="Adjust material and labour rates. Total rate = Material + Labour"
          action={<Calculator className="w-5 h-5" style={{ color: 'var(--brand-primary)' }} />}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Item</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Unit</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Material Rate</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Labour Rate</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-primary)' }}>Total Rate</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Default</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {BOQ_RATE_ITEMS.map((item, i) => {
                const total = (boqRates[item.id]?.material || 0) + (boqRates[item.id]?.labour || 0)
                const isChanged = total !== item.totalRate
                return (
                  <tr key={item.id} className={i % 2 === 0 ? '' : 'bg-slate-50/40 dark:bg-slate-800/20'}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white text-xs">{item.label}</p>
                      <p className="text-[10px] text-slate-400 max-w-xs truncate">{item.description}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{item.unit}</td>
                    <td className="px-4 py-3">
                      <input type="number" value={boqRates[item.id]?.material || 0}
                        onChange={e => setBoqRates(prev => ({ ...prev, [item.id]: { ...prev[item.id], material: +e.target.value } }))}
                        className="w-20 px-2 py-1 text-right font-mono text-sm border border-indigo-200 dark:border-indigo-900/50 rounded-lg bg-indigo-50/60 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ml-auto block focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" value={boqRates[item.id]?.labour || 0}
                        onChange={e => setBoqRates(prev => ({ ...prev, [item.id]: { ...prev[item.id], labour: +e.target.value } }))}
                        className="w-20 px-2 py-1 text-right font-mono text-sm border border-emerald-200 dark:border-emerald-900/50 rounded-lg bg-emerald-50/60 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ml-auto block focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className="font-bold text-sm"
                        style={isChanged ? { color: 'var(--brand-primary)' } : undefined}
                      >
                        Rs. {total}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400">
                      Rs. {item.totalRate}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Basic Material Rates (Reference from market) */}
      <Card>
        <CardHeader
          title="Basic Material Rates — Market Reference (Excl. GST)"
          subtitle="Raw material procurement rates. For reference only — not directly used in BOQ."
          action={<Package className="w-5 h-5 text-purple-500" />}
        />
        <div className="px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {BASIC_MATERIAL_RATES.map(item => (
              <div
                key={item.id}
                className="rounded-xl p-3 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{item.label}</p>
                  <Badge tone="default" className="flex-shrink-0 text-[10px]">{item.source}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-sm">Rs.</span>
                  <input type="number" value={basicRates[item.id]}
                    onChange={e => setBasicRates(prev => ({ ...prev, [item.id]: +e.target.value }))}
                    className="flex-1 text-lg font-bold bg-transparent border-none outline-none text-slate-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[10px] text-slate-400">{item.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Recalculated BOQ with Custom Rates */}
      <Card className="overflow-hidden">
        <CardHeader
          title="BOQ with Custom Rates"
          subtitle="Live recalculation using edited rates above"
          action={<TrendingUp className="w-5 h-5 text-emerald-500" />}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead
              className="text-white"
              style={{
                background:
                  'linear-gradient(135deg, var(--brand-primary), color-mix(in oklab, var(--brand-primary) 70%, var(--brand-accent, var(--brand-primary))))',
              }}
            >
              <tr>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider">Item</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider">Description</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider">Unit</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider">Qty</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider">Rate</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider">Material Amt</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider">Labour Amt</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recalculatedBoq.items.map((item, i) => {
                const rateKey = {
                  '1': 'structural_steel', '2.01': 'bare_galvalume', '2.02': 'puf_panel_roof',
                  '3.02': 'puf_panel_wall', '2.03': 'ridge_flashing', '2.04': 'polycarbonate',
                  '3.01': 'mezzanine_decking',
                }[item.item_no]
                const rates = rateKey ? boqRates[rateKey] : null
                const total = rates ? rates.material + rates.labour : item.rate
                const materialAmt = rates && total > 0 ? Math.round(item.amount * rates.material / total) : item.amount
                const labourAmt = rates && total > 0 ? Math.round(item.amount * rates.labour / total) : 0
                return (
                  <tr key={i} className={i % 2 === 0 ? '' : 'bg-slate-50/40 dark:bg-slate-800/20'}>
                    <td className="px-4 py-2 font-mono text-xs">{item.item_no}</td>
                    <td className="px-4 py-2 text-xs max-w-[200px] truncate">{item.description?.split('\n')[0]}</td>
                    <td className="px-4 py-2 text-xs">{item.unit}</td>
                    <td className="px-4 py-2 text-right text-xs">{item.quantity?.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2 text-right text-xs font-medium">{item.rate}</td>
                    <td className="px-4 py-2 text-right text-xs text-indigo-600 dark:text-indigo-400">Rs. {materialAmt?.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2 text-right text-xs text-emerald-600 dark:text-emerald-400">Rs. {labourAmt?.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2 text-right text-xs font-bold">Rs. {item.amount?.toLocaleString('en-IN')}</td>
                  </tr>
                )
              })}
              <tr className="font-bold" style={{ background: 'color-mix(in oklab, var(--brand-primary) 8%, transparent)' }}>
                <td colSpan={5} className="px-4 py-3 text-right text-sm">TOTAL</td>
                <td className="px-4 py-3 text-right text-sm text-indigo-700 dark:text-indigo-300">Rs. {costSplit.material?.toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-right text-sm text-emerald-700 dark:text-emerald-300">Rs. {costSplit.labour?.toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--brand-primary)' }}>
                  Rs. {recalculatedBoq.total_amount?.toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Notes */}
      <Card>
        <div className="px-6 py-5">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Notes</p>
          <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc list-inside">
            <li>All rates are exclusive of GST (18% applicable)</li>
            <li>Basic material rates are for reference — actual BOQ uses Material + Labour combined rates</li>
            <li>Steel plates rate (SAIL) and purlin rate (JSW) are ex-works prices</li>
            <li>Aluminium foil, fixed louvers, special elevations, foundation &amp; civil works, rolling shutters, windows, doors, electrical &amp; plumbing works are NOT included</li>
            <li>Rates are subject to change as per market conditions</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
