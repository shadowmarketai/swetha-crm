/**
 * New Quotation — Premium Live Split-View Quote Builder
 *
 * LEFT: dynamic scrollable form (template picker → lead → client info → dynamic fields)
 * RIGHT: sticky live preview (total, rate/sqft, steel tonnage, BOQ summary, 3D tools)
 *
 * Live preview updates via debounced (400ms) call to quotationTemplateAPI.calc.
 * Falls back to legacy hardcoded PEB form + calcBOQ if templates are unavailable.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search, Save, Calculator, Building2, Box, PenTool, Image as ImageIcon,
  ChevronDown, ChevronUp, User, FileText, Sparkles, Send, X, Layers,
  Check, IndianRupee, Pencil,
} from 'lucide-react'
import { quotationAPI, leadsAPI, quotationTemplateAPI } from '../../services/api'
import { calcBOQ } from '../../utils/boqEngine'
import { getMasterRates, getMasterRoofSheetRates, getMasterSideCladdingRates } from './PricingConfig'
import ProjectStyleCard, { DEFAULT_STYLE } from './ProjectStyleCard'
import toast from 'react-hot-toast'
import {
  Card, CardHeader, Stat, Button, Modal, Field, Input, Select, Textarea,
  Badge, StatusBadge, PageHeader, EmptyState, Avatar, SearchInput, Skeleton, Segmented,
} from '../../components/ui/primitives'

// Legacy fallback constants (used when template API is unavailable)
const ROOF_TYPES = [
  { value: 'a_type', label: 'A Type' },
  { value: 'monoslope', label: 'Monoslope' },
]

const ROOF_SHEET_TYPES = [
  { value: 'bare_galvalume_0.4mm', label: 'Bare Galvalume 0.4mm' },
  { value: 'bare_galvalume_0.45mm', label: 'Bare Galvalume 0.45mm' },
  { value: 'bare_galvalume_0.47mm', label: 'Bare Galvalume 0.47mm' },
  { value: 'bare_galvalume_0.5mm', label: 'Bare Galvalume 0.5mm' },
  { value: 'puf_panel_20mm', label: 'PUF Panel 20mm' },
  { value: 'puf_panel_30mm', label: 'PUF Panel 30mm' },
  { value: 'puf_panel_50mm', label: 'PUF Panel 50mm' },
  { value: 'puf_panel_100mm', label: 'PUF Panel 100mm' },
]

const SIDE_CLADDING_TYPES = [
  { value: 'bare_colour_galvalume_0.4mm', label: 'Bare Colour Galvalume 0.4mm' },
  { value: 'bare_colour_galvalume_0.45mm', label: 'Bare Colour Galvalume 0.45mm' },
  { value: 'bare_colour_galvalume_0.47mm', label: 'Bare Colour Galvalume 0.47mm' },
  { value: 'bare_colour_galvalume_0.5mm', label: 'Bare Colour Galvalume 0.5mm' },
  { value: 'puf_panel_20mm', label: 'PUF Panel 20mm' },
  { value: 'puf_panel_30mm', label: 'PUF Panel 30mm' },
  { value: 'puf_panel_50mm', label: 'PUF Panel 50mm' },
  { value: 'puf_panel_100mm', label: 'PUF Panel 100mm' },
]

const ALUMINIUM_SHEET_OPTIONS = [
  { value: 'structural_sheet_250', label: 'Structural Sheet 250 Grade' },
  { value: 'structural_sheet_350', label: 'Structural Sheet 350 Grade' },
  { value: 'perlin_120_gsm', label: 'Perlin 120 GSM' },
  { value: 'perlin_275_gsm', label: 'Perlin 275 GSM' },
]

// Default BOQ rates (Material + Labour) — loads from Pricing Config if saved, else hardcoded
function loadDefaultRates() {
  const master = getMasterRates()
  const FALLBACK = [
    { id: 'structural_steel', label: 'Structural Steel', unit: 'Kg', material: 70, labour: 35 },
    { id: 'purlin', label: 'Purlin (Cold Formed)', unit: 'Kg', material: 90, labour: 15 },
    { id: 'roof_sheet', label: 'Roof Sheet', unit: 'Sqft', material: 42, labour: 18, dynamic: true },
    { id: 'side_cladding', label: 'Side Cladding', unit: 'Sqft', material: 40, labour: 18, dynamic: true },
    { id: 'ridge_flashing', label: 'Ridge, Flash, Gutter, Downspout', unit: 'Rft', material: 60, labour: 50 },
    { id: 'polycarbonate', label: 'Polycarbonate Lighting Sheet', unit: 'Sqft', material: 60, labour: 50 },
    { id: 'mezzanine_steel', label: 'Mezzanine Steel', unit: 'Kg', material: 70, labour: 35, conditional: 'mezzanine_required' },
    { id: 'mezzanine_decking', label: 'Mezzanine Deck Sheet', unit: 'Sqft', material: 110, labour: 25, conditional: 'mezzanine_required' },
    { id: 'turbo_ventilator_rate', label: 'Turbo Ventilator', unit: 'Nos', material: 4500, labour: 1250, conditional: 'turbo_ventilator' },
    { id: 'rolling_shutter', label: 'Rolling Shutter', unit: 'Sqft', material: 350, labour: 150, conditional: 'shutters' },
  ]
  // Merge master config rates into fallback (preserving conditional/dynamic flags)
  const base = master ? FALLBACK.map((f) => {
    const m = master.find((r) => r.id === f.id)
    if (m) return { ...f, material: m.material, labour: m.labour, total: m.material + m.labour }
    return { ...f, total: f.material + f.labour }
  }) : FALLBACK.map((f) => ({ ...f, total: f.material + f.labour }))
  return base
}

// Also auto-pick roof/cladding rates from master config when material changes
function getRateForRoofSheet(sheetType) {
  const rates = getMasterRoofSheetRates()
  const match = rates?.find((r) => r.id === sheetType)
  return match ? { material: match.material, labour: match.labour } : null
}

function getRateForSideCladding(sheetType) {
  const rates = getMasterSideCladdingRates()
  const match = rates?.find((r) => r.id === sheetType)
  return match ? { material: match.material, labour: match.labour } : null
}

// Additions tab items config
const ADDITIONS_TABS = [
  { key: 'turbo_ventilator', label: 'Turbo Ventilator', type: 'toggle_number', numberKey: 'turbo_ventilator_count', numberLabel: 'Total No. of Turbo Ventilators' },
  { key: 'aluminium_foil', label: 'Aluminium Foil', type: 'tick' },
  { key: 'crane', label: 'Crane', type: 'toggle_number', numberKey: 'crane_count', numberLabel: 'No. of Cranes' },
  { key: 'ridge_vent', label: 'Ridge Vent', type: 'tick' },
  { key: 'ridge_monitor', label: 'Ridge Monitor', type: 'tick' },
  { key: 'light_sheet', label: 'Light Sheet', type: 'tick' },
  { key: 'louvers', label: 'Louvers', type: 'toggle_size', sizeKey: 'louvers_size', sizeLabel: 'Louver Size' },
  { key: 'shutters', label: 'Shutters', type: 'number_size', numberKey: 'shutters_count', numberLabel: 'No. of Shutters', sizeKey: 'shutters_size', sizeLabel: 'Shutter Size' },
  { key: 'ac_sheet', label: 'AC Sheet', type: 'tick' },
  { key: 'aluminium_sheet', label: 'Aluminium Sheet', type: 'toggle_select', selectKey: 'aluminium_sheet_type', selectLabel: 'Sheet Type', options: ALUMINIUM_SHEET_OPTIONS },
]

// Legacy PEB schema used when no template is returned from the API
const LEGACY_PEB_SCHEMA = {
  id: '__legacy_peb__',
  name: 'PEB Building (Legacy)',
  engine: 'peb',
  fields_schema: [
    { key: 'building_length', label: 'Length (ft)', type: 'number', group: 'Dimensions', default: 100 },
    { key: 'building_width', label: 'Width (ft)', type: 'number', group: 'Dimensions', default: 60 },
    { key: 'full_height', label: 'Full Height (ft)', type: 'number', group: 'Dimensions', default: 30 },
    { key: 'wall_height', label: 'Wall Height (ft)', type: 'number', group: 'Dimensions', default: 20 },
    { key: 'cladding_height', label: 'Cladding Height (ft)', type: 'computed', group: 'Dimensions', formula: 'full_height - wall_height' },
    { key: 'roof_type', label: 'Roof Type', type: 'select', group: 'Materials', default: 'a_type', options: ROOF_TYPES },
    { key: 'roof_sheet_type', label: 'Roof Sheet', type: 'select', group: 'Materials', default: 'bare_galvalume_0.47mm', options: ROOF_SHEET_TYPES },
    { key: 'side_cladding_type', label: 'Side Cladding', type: 'select', group: 'Materials', default: 'bare_colour_galvalume_0.47mm', options: SIDE_CLADDING_TYPES },
    { key: 'mezzanine_required', label: 'Mezzanine Required', type: 'checkbox', group: 'Mezzanine', default: false },
    { key: 'mezz_length', label: 'Mezz Length (ft)', type: 'number', group: 'Mezzanine', default: 0 },
    { key: 'mezz_width', label: 'Mezz Width (ft)', type: 'number', group: 'Mezzanine', default: 0 },
    // Additions
    { key: 'turbo_ventilator', label: 'Turbo Ventilator', type: 'checkbox', group: '_additions', default: false },
    { key: 'turbo_ventilator_count', type: 'number', group: '_additions', default: 0 },
    { key: 'aluminium_foil', type: 'checkbox', group: '_additions', default: false },
    { key: 'crane', type: 'checkbox', group: '_additions', default: false },
    { key: 'crane_count', type: 'number', group: '_additions', default: 0 },
    { key: 'ridge_vent', type: 'checkbox', group: '_additions', default: false },
    { key: 'ridge_monitor', type: 'checkbox', group: '_additions', default: false },
    { key: 'light_sheet', type: 'checkbox', group: '_additions', default: false },
    { key: 'louvers', type: 'checkbox', group: '_additions', default: false },
    { key: 'louvers_size', type: 'text', group: '_additions', default: '' },
    { key: 'shutters', type: 'checkbox', group: '_additions', default: false },
    { key: 'shutters_count', type: 'number', group: '_additions', default: 0 },
    { key: 'shutters_size', type: 'text', group: '_additions', default: '' },
    { key: 'ac_sheet', type: 'checkbox', group: '_additions', default: false },
    { key: 'aluminium_sheet', type: 'checkbox', group: '_additions', default: false },
    { key: 'aluminium_sheet_type', type: 'text', group: '_additions', default: '' },
  ],
}

/** Build initial form_data from a template's fields_schema */
function buildInitialFormData(schema) {
  const data = {}
  ;(schema?.fields_schema || []).forEach((f) => {
    if (f.type === 'computed') {
      data[f.key] = 0 // will be calculated by useEffect
    } else {
      data[f.key] = f.default ?? (f.type === 'checkbox' ? false : f.type === 'number' ? 0 : '')
    }
  })
  // Initialize editable rates from master pricing config
  data._rates = loadDefaultRates()
  // Compute initial derived fields
  recomputeFields(schema, data)
  return data
}

/** Recompute all 'computed' fields in-place */
function recomputeFields(schema, data) {
  ;(schema?.fields_schema || []).forEach((f) => {
    if (f.type === 'computed' && f.formula === 'full_height - wall_height') {
      data[f.key] = (parseFloat(data.full_height) || 0) - (parseFloat(data.wall_height) || 0)
    }
  })
}

/** Group fields by the `group` key, preserving order. Excludes _additions (rendered separately). */
function groupFields(fields) {
  const groups = []
  const byName = {}
  ;(fields || []).forEach((f) => {
    const g = f.group || 'Details'
    if (g === '_additions') return // rendered by AdditionsCard
    if (!byName[g]) {
      byName[g] = { name: g, fields: [] }
      groups.push(byName[g])
    }
    byName[g].fields.push(f)
  })
  return groups
}

const fmtINR = (n) =>
  n == null || isNaN(n) ? '—' : `₹ ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function NewQuotation() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedLeadId = searchParams.get('leadId')

  // ── Templates ───────────────────────────────────────────
  const [templates, setTemplates] = useState([])
  const [templatesLoaded, setTemplatesLoaded] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [usingFallback, setUsingFallback] = useState(false)

  // ── Leads ───────────────────────────────────────────────
  const [leads, setLeads] = useState([])
  const [leadSearch, setLeadSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState(null)
  const [leadsOpen, setLeadsOpen] = useState(false)

  // ── Form data (dynamic per template) ────────────────────
  const [projectName, setProjectName] = useState('')
  const [clientLocation, setClientLocation] = useState('')
  const [formData, setFormData] = useState({})
  const [projectStyle, setProjectStyle] = useState({ ...DEFAULT_STYLE, _preset: 'standard_green_warehouse' })

  // ── Live preview ────────────────────────────────────────
  const [boqResult, setBoqResult] = useState(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showFullBoq, setShowFullBoq] = useState(false)
  const [mdQuotedRate, setMdQuotedRate] = useState('')
  const [mdApproved, setMdApproved] = useState(false)

  const debounceRef = useRef(null)

  // ─── Load templates on mount (falls back to legacy PEB form) ──
  useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      try {
        const res = await quotationTemplateAPI.list({ active_only: true })
        const list = res.data?.items || res.data || []
        if (cancelled) return
        if (Array.isArray(list) && list.length > 0) {
          setTemplates(list)
          const defaultTpl = list[0]
          setSelectedTemplate(defaultTpl)
          setFormData(buildInitialFormData(defaultTpl))
          setUsingFallback(false)
        } else {
          // No templates found — use legacy PEB form
          setTemplates([LEGACY_PEB_SCHEMA])
          setSelectedTemplate(LEGACY_PEB_SCHEMA)
          setFormData(buildInitialFormData(LEGACY_PEB_SCHEMA))
          setUsingFallback(true)
        }
      } catch {
        if (cancelled) return
        // API error (no tenant, etc.) — use legacy PEB form
        setTemplates([LEGACY_PEB_SCHEMA])
        setSelectedTemplate(LEGACY_PEB_SCHEMA)
        setFormData(buildInitialFormData(LEGACY_PEB_SCHEMA))
        setUsingFallback(true)
      } finally {
        if (!cancelled) setTemplatesLoaded(true)
      }
    }
    loadTemplates()
    return () => { cancelled = true }
  }, [])

  // ─── Load leads ─────────────────────────────────────────
  useEffect(() => {
    async function loadLeads() {
      try {
        const res = await leadsAPI.getAll({ search: leadSearch, page_size: 20 })
        setLeads(res.data?.items || res.data || [])
      } catch {
        setLeads([
          { id: 1, name: 'Rajesh Kumar', company: 'Kumar Industries', phone: '9876543210', email: 'rajesh@kumar.in' },
          { id: 2, name: 'Priya Sharma', company: 'Sharma Steel', phone: '9876543211', email: 'priya@sharma.in' },
          { id: 3, name: 'Venkat Raman', company: 'VR Constructions', phone: '9876543212', email: 'venkat@vr.in' },
        ])
      }
    }
    loadLeads()
  }, [leadSearch])

  // ─── Pre-select lead from URL ───────────────────────────
  useEffect(() => {
    if (preselectedLeadId && leads.length > 0 && !selectedLead) {
      const lead = leads.find((l) => l.id === parseInt(preselectedLeadId))
      if (lead) {
        setSelectedLead(lead)
        setProjectName((p) => p || `Quote for ${lead.company || lead.name}`)
      }
    }
  }, [preselectedLeadId, leads, selectedLead])

  // ─── Template switcher ──────────────────────────────────
  const switchTemplate = (tpl) => {
    setSelectedTemplate(tpl)
    setFormData(buildInitialFormData(tpl))
    setBoqResult(null)
  }

  const updateField = useCallback((key, value) => {
    setFormData((d) => {
      const updated = { ...d, [key]: value }
      // Recompute derived fields when dependencies change
      if (selectedTemplate && (key === 'full_height' || key === 'wall_height')) {
        recomputeFields(selectedTemplate, updated)
      }
      // Auto-update roof/cladding rates from master config when material type changes
      if (key === 'roof_sheet_type' && updated._rates) {
        const rateMatch = getRateForRoofSheet(value)
        if (rateMatch) {
          updated._rates = updated._rates.map((r) =>
            r.id === 'roof_sheet'
              ? { ...r, material: rateMatch.material, labour: rateMatch.labour, total: rateMatch.material + rateMatch.labour }
              : r
          )
        }
      }
      if (key === 'side_cladding_type' && updated._rates) {
        const rateMatch = getRateForSideCladding(value)
        if (rateMatch) {
          updated._rates = updated._rates.map((r) =>
            r.id === 'side_cladding'
              ? { ...r, material: rateMatch.material, labour: rateMatch.labour, total: rateMatch.material + rateMatch.labour }
              : r
          )
        }
      }
      return updated
    })
  }, [selectedTemplate])

  // ─── Debounced live calc ────────────────────────────────
  const runCalc = useCallback(async () => {
    if (!selectedTemplate) return
    // Normalize numeric fields
    const payload = {}
    ;(selectedTemplate.fields_schema || []).forEach((f) => {
      let v = formData[f.key]
      if (f.type === 'number') v = parseFloat(v) || 0
      if (f.type === 'checkbox') v = !!v
      if (f.type === 'computed') v = parseFloat(v) || 0
      payload[f.key] = v
    })
    // Pass editable rates to calc engine
    if (formData._rates) {
      payload._rates = formData._rates.reduce((acc, r) => {
        acc[r.id] = { material: r.material, labour: r.labour, total: r.total }
        return acc
      }, {})
    }

    setCalcLoading(true)
    try {
      if (usingFallback || selectedTemplate.id === '__legacy_peb__') {
        // Legacy path — prefer server calculate, fall back to local boqEngine
        try {
          const res = await quotationAPI.calculate(payload)
          setBoqResult(res.data)
        } catch {
          const result = calcBOQ(payload)
          setBoqResult(result)
        }
      } else {
        try {
          const res = await quotationTemplateAPI.calc(selectedTemplate.id, payload)
          setBoqResult(res.data)
        } catch {
          // As a last resort, try local calcBOQ if it's a PEB engine
          if ((selectedTemplate.engine || '').toLowerCase() === 'peb') {
            try {
              const result = calcBOQ(payload)
              setBoqResult(result)
            } catch {
              setBoqResult(null)
            }
          } else {
            setBoqResult(null)
          }
        }
      }
    } finally {
      setCalcLoading(false)
    }
  }, [selectedTemplate, formData, usingFallback])

  useEffect(() => {
    if (!selectedTemplate || !templatesLoaded) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { runCalc() }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [selectedTemplate, formData, templatesLoaded, runCalc])

  // ─── Save quotation ─────────────────────────────────────
  const saveQuotation = async (sendToClient = false) => {
    if (!projectName.trim()) {
      toast.error('Please enter a project name')
      return
    }
    setSaving(true)
    try {
      // Preserve the legacy building_params payload shape for PEB templates
      const isPeb = (selectedTemplate?.engine || '').toLowerCase() === 'peb' || usingFallback
      const building_params = isPeb
        ? {
            building_length: parseFloat(formData.building_length) || 0,
            building_width: parseFloat(formData.building_width) || 0,
            full_height: parseFloat(formData.full_height) || 0,
            wall_height: parseFloat(formData.wall_height) || 0,
            cladding_height: parseFloat(formData.cladding_height) || 0,
            roof_type: formData.roof_type,
            roof_sheet_type: formData.roof_sheet_type,
            side_cladding_type: formData.side_cladding_type,
            mezzanine_required: !!formData.mezzanine_required,
            mezz_length: parseFloat(formData.mezz_length) || 0,
            mezz_width: parseFloat(formData.mezz_width) || 0,
            // Additions
            turbo_ventilator: !!formData.turbo_ventilator,
            turbo_ventilator_count: parseInt(formData.turbo_ventilator_count) || 0,
            aluminium_foil: !!formData.aluminium_foil,
            crane: !!formData.crane,
            crane_count: parseInt(formData.crane_count) || 0,
            ridge_vent: !!formData.ridge_vent,
            ridge_monitor: !!formData.ridge_monitor,
            light_sheet: !!formData.light_sheet,
            louvers: !!formData.louvers,
            louvers_size: formData.louvers_size || '',
            shutters: !!formData.shutters,
            shutters_count: parseInt(formData.shutters_count) || 0,
            shutters_size: formData.shutters_size || '',
            ac_sheet: !!formData.ac_sheet,
            aluminium_sheet: !!formData.aluminium_sheet,
            aluminium_sheet_type: formData.aluminium_sheet_type || '',
            // Rates (material + labour split)
            rates: (formData._rates || []).reduce((acc, r) => {
              acc[r.id] = { material: r.material, labour: r.labour, total: r.total }
              return acc
            }, {}),
            // Project style — drives AI photoreal renders
            building_type:    projectStyle.building_type,
            wall_color_hex:   projectStyle.wall_color_hex,
            accent_color_hex: projectStyle.accent_color_hex,
            roof_color_hex:   projectStyle.roof_color_hex,
            trim_color_hex:   projectStyle.trim_color_hex,
            cladding_pattern: projectStyle.cladding_pattern,
            glazing_type:     projectStyle.glazing_type,
            front_door_type:  projectStyle.front_door_type,
            site_context:     projectStyle.site_context,
            parking_visible:  projectStyle.parking_visible,
            _style_preset:    projectStyle._preset,
          }
        : formData

      const payload = {
        lead_id: selectedLead?.id ?? null,
        template_id: usingFallback ? null : selectedTemplate?.id,
        project_name: projectName,
        client_name: selectedLead?.name || '',
        client_location: clientLocation,
        building_params,
        form_data: formData,
        status: sendToClient ? 'sent' : 'draft',
        md_quoted_rate: parseFloat(mdQuotedRate) || null,
        md_approved: mdApproved,
      }
      const res = await quotationAPI.create(payload)
      toast.success(sendToClient ? 'Quotation sent to client!' : 'Draft saved successfully')
      const qid = res.data?.id
      if (sendToClient && qid) {
        navigate(`/quotation/${qid}`)
      } else {
        navigate('/quotation')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save quotation')
    } finally {
      setSaving(false)
    }
  }

  // ─── Derived preview values ─────────────────────────────
  const preview = useMemo(() => {
    const r = boqResult || {}
    return {
      total: r.total_amount,
      ratePerSqft: r.rate_per_sqft,
      floorArea: r.floor_area,
      steelTon: r.steel_summary?.total_steel_ton ?? r.steel_tonnage,
      items: r.items || [],
    }
  }, [boqResult])

  const isPebEngine = (selectedTemplate?.engine || '').toLowerCase() === 'peb' || usingFallback
  const groupedFields = useMemo(() => groupFields(selectedTemplate?.fields_schema), [selectedTemplate])

  // MD Review computed values
  const mdReview = useMemo(() => {
    const estimated = preview.ratePerSqft || 0
    const quoted = parseFloat(mdQuotedRate) || 0
    const quotedTotal = quoted > 0 && preview.floorArea > 0 ? quoted * preview.floorArea : 0
    const margin = estimated > 0 && quoted > 0 ? ((quoted - estimated) / estimated * 100) : 0
    return { estimated, quoted, quotedTotal, margin }
  }, [preview.ratePerSqft, preview.floorArea, mdQuotedRate])

  const filteredLeads = leads

  // ─── Render a single dynamic field ──────────────────────
  const renderField = (f) => {
    const value = formData[f.key]
    if (f.type === 'textarea') {
      return (
        <Field key={f.key} label={f.label} hint={f.hint} required={f.required}>
          <Textarea
            rows={3}
            value={value ?? ''}
            onChange={(e) => updateField(f.key, e.target.value)}
            placeholder={f.placeholder}
          />
        </Field>
      )
    }
    if (f.type === 'select') {
      const opts = f.options || []
      return (
        <Field key={f.key} label={f.label} hint={f.hint} required={f.required}>
          <Select
            className="w-full"
            value={value ?? ''}
            onChange={(e) => updateField(f.key, e.target.value)}
          >
            {opts.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
      )
    }
    if (f.type === 'checkbox') {
      return (
        <div key={f.key} className="flex items-center gap-2 py-2 col-span-full">
          <input
            id={`fld-${f.key}`}
            type="checkbox"
            checked={!!value}
            onChange={(e) => updateField(f.key, e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor={`fld-${f.key}`} className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {f.label}
          </label>
        </div>
      )
    }
    // computed (read-only derived field)
    if (f.type === 'computed') {
      return (
        <Field key={f.key} label={f.label} hint={f.hint || 'Auto-calculated'}>
          <Input
            type="number"
            value={value ?? 0}
            readOnly
            className="bg-slate-50 dark:bg-slate-900/60 font-semibold"
          />
        </Field>
      )
    }
    // text, number
    return (
      <Field key={f.key} label={f.label} hint={f.hint} required={f.required}>
        <Input
          type={f.type === 'number' ? 'number' : 'text'}
          value={value ?? ''}
          onChange={(e) => updateField(f.key, f.type === 'number' ? e.target.value : e.target.value)}
          placeholder={f.placeholder}
        />
      </Field>
    )
  }

  // ─── Empty state: no templates yet → onboarding CTA ───
  if (templatesLoaded && templates.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <PageHeader
          title="New Quotation"
          subtitle="First, create a template for what you're quoting"
          breadcrumbs={[{ label: 'Quotations', href: '/quotation' }, { label: 'New' }]}
        />
        <Card className="overflow-hidden">
          <div className="relative p-10 text-center">
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 20% 20%, var(--brand-primary), transparent 50%), radial-gradient(circle at 80% 80%, var(--brand-accent), transparent 50%)',
              }}
            />
            <div className="relative">
              <div
                className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-xl"
                style={{
                  background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))',
                  boxShadow: '0 16px 32px -12px color-mix(in oklab, var(--brand-primary) 60%, transparent)',
                }}
              >
                <Sparkles className="w-10 h-10 text-white" strokeWidth={2.5} />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Let's set up your first template</h2>
              <p className="text-base text-slate-500 mt-3 max-w-lg mx-auto">
                A <strong>template</strong> defines what you're quoting — the fields your clients fill in,
                the line items you price, and your negotiation rules. Create one once and reuse it for
                every quote.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 text-left">
                {[
                  { icon: '📝', title: 'Custom fields', desc: 'Ask for exactly what you need — dimensions, quantity, materials, anything.' },
                  { icon: '💰', title: 'Your rates', desc: 'Set your material + labour costs and the formulas that compute quantities.' },
                  { icon: '🤝', title: 'Negotiation cap', desc: 'Let clients propose counter-prices, but only down to the floor you allow.' },
                ].map((b) => (
                  <div key={b.title} className="p-4 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div className="text-2xl mb-2">{b.icon}</div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">{b.title}</div>
                    <div className="text-xs text-slate-500 mt-1">{b.desc}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-center gap-3">
                <Button
                  leftIcon={Sparkles}
                  onClick={() => navigate('/quotation/templates')}
                >
                  Create my first template
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate('/quotation')}
                >
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto pb-28">
      <PageHeader
        title="New Quotation"
        subtitle="Live split-view quote builder — edit on the left, preview on the right"
        breadcrumbs={[{ label: 'Quotations', href: '/quotation' }, { label: 'New' }]}
        actions={
          <Badge tone="brand">
            <Sparkles className="w-3 h-3" /> Live Preview
          </Badge>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
        {/* ═══════════════════════════ LEFT: FORM ═══════════════════════════ */}
        <div className="space-y-5 min-w-0">
          {/* Template Picker */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Choose a Template"
              subtitle="Pick the quote engine for this project"
              action={selectedTemplate && (
                <Badge tone="info">{(selectedTemplate.engine || 'custom').toUpperCase()}</Badge>
              )}
            />
            <div className="px-6 py-5">
              {!templatesLoaded ? (
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-32" />
                </div>
              ) : templates.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => {
                    const active = selectedTemplate?.id === t.id
                    return (
                      <button
                        key={t.id}
                        onClick={() => switchTemplate(t)}
                        className={
                          'px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ' +
                          (active
                            ? 'text-white shadow-lg border-transparent scale-[1.02]'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300')
                        }
                        style={
                          active
                            ? {
                                background: 'linear-gradient(135deg, var(--brand-primary), color-mix(in oklab, var(--brand-primary) 60%, var(--brand-accent, var(--brand-primary))))',
                                boxShadow: '0 8px 24px -8px var(--brand-primary)',
                              }
                            : undefined
                        }
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4" />
                          {t.name}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Building2 className="w-4 h-4" />
                  Legacy PEB Building (fallback mode)
                </div>
              )}
            </div>
          </Card>

          {/* Lead Selector (collapsible) */}
          <Card>
            <button
              onClick={() => setLeadsOpen((o) => !o)}
              className="w-full flex items-center justify-between px-6 py-5 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent, var(--brand-primary)))' }}
                >
                  <User className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-slate-900 dark:text-white truncate">
                    {selectedLead ? selectedLead.name : 'No lead selected (optional)'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {selectedLead ? `${selectedLead.company || '—'} · ${selectedLead.phone || ''}` : 'Link this quote to a CRM lead'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {selectedLead && (
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedLead(null) }}
                    className="text-xs text-slate-500 hover:text-rose-600 px-2 py-1 rounded"
                  >
                    Clear
                  </span>
                )}
                {leadsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>
            {leadsOpen && (
              <div className="px-6 pb-5 border-t border-slate-100 dark:border-slate-800">
                <div className="pt-4">
                  <SearchInput
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    placeholder="Search leads by name, company, phone…"
                  />
                </div>
                <div className="mt-3 max-h-72 overflow-y-auto space-y-1.5">
                  {filteredLeads.length === 0 ? (
                    <EmptyState
                      icon={Search}
                      title="No leads found"
                      description="Try a different search term or leave this empty."
                    />
                  ) : (
                    filteredLeads.map((lead) => {
                      const active = selectedLead?.id === lead.id
                      return (
                        <button
                          key={lead.id}
                          onClick={() => {
                            setSelectedLead(lead)
                            setProjectName((p) => p || `Quote for ${lead.company || lead.name}`)
                            setLeadsOpen(false)
                          }}
                          className={
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ' +
                            (active
                              ? 'bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-200 dark:ring-indigo-500/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60')
                          }
                        >
                          <Avatar name={lead.name} size={32} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{lead.name}</p>
                            <p className="text-xs text-slate-500 truncate">{lead.company || '—'} · {lead.phone}</p>
                          </div>
                          {lead.status && <StatusBadge status={lead.status} />}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Client / Project Info */}
          <Card>
            <CardHeader title="Project Info" subtitle="Basic details for the quote header" />
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Field label="Project Name" required>
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. PEB Warehouse for Kumar Industries"
                  />
                </Field>
              </div>
              <Field label="Location">
                <Input
                  value={clientLocation}
                  onChange={(e) => setClientLocation(e.target.value)}
                  placeholder="City, State"
                />
              </Field>
              <Field label="Client">
                <Input
                  value={selectedLead?.name || ''}
                  readOnly
                  placeholder="— optional —"
                  className="bg-slate-50 dark:bg-slate-900/60"
                />
              </Field>
            </div>
          </Card>

          {/* Dynamic Fields (grouped) */}
          {selectedTemplate && groupedFields.map((grp) => (
            <Card key={grp.name}>
              <CardHeader
                title={grp.name}
                subtitle={`${grp.fields.length} field${grp.fields.length === 1 ? '' : 's'}`}
              />
              <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {grp.fields.map(renderField)}
              </div>
            </Card>
          ))}

          {/* ═══════ ADDITIONS BOX ═══════ */}
          {selectedTemplate && isPebEngine && (
            <Card>
              <CardHeader
                title="Additions"
                subtitle="Optional add-ons for the building"
              />
              <div className="px-6 py-5 space-y-3">
                {ADDITIONS_TABS.map((tab) => {
                  const enabled = !!formData[tab.key]
                  return (
                    <div
                      key={tab.key}
                      className={
                        'rounded-xl border transition-all ' +
                        (enabled
                          ? 'border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40')
                      }
                    >
                      {/* Toggle row */}
                      <button
                        type="button"
                        onClick={() => updateField(tab.key, !enabled)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                      >
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {tab.label}
                        </span>
                        <div
                          className={
                            'w-9 h-5 rounded-full relative transition-colors ' +
                            (enabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600')
                          }
                        >
                          <div
                            className={
                              'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ' +
                              (enabled ? 'translate-x-4' : 'translate-x-0.5')
                            }
                          />
                        </div>
                      </button>

                      {/* Expanded content when enabled */}
                      {enabled && (
                        <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                          {/* toggle_number: checkbox enables → show number input */}
                          {tab.type === 'toggle_number' && (
                            <Field label={tab.numberLabel}>
                              <Input
                                type="number"
                                min={1}
                                value={formData[tab.numberKey] || ''}
                                onChange={(e) => updateField(tab.numberKey, e.target.value)}
                                placeholder="Enter quantity"
                              />
                            </Field>
                          )}

                          {/* tick: just the toggle, no extra fields */}
                          {tab.type === 'tick' && (
                            <p className="text-xs text-slate-500 py-1">
                              <Check className="w-3.5 h-3.5 inline text-emerald-500 mr-1" />
                              {tab.label} will be included in the quotation
                            </p>
                          )}

                          {/* toggle_size: checkbox enables → show size input */}
                          {tab.type === 'toggle_size' && (
                            <Field label={tab.sizeLabel}>
                              <Input
                                type="text"
                                value={formData[tab.sizeKey] || ''}
                                onChange={(e) => updateField(tab.sizeKey, e.target.value)}
                                placeholder="e.g. 4ft x 3ft"
                              />
                            </Field>
                          )}

                          {/* number_size: always show count + size */}
                          {tab.type === 'number_size' && (
                            <div className="grid grid-cols-2 gap-3">
                              <Field label={tab.numberLabel}>
                                <Input
                                  type="number"
                                  min={1}
                                  value={formData[tab.numberKey] || ''}
                                  onChange={(e) => updateField(tab.numberKey, e.target.value)}
                                  placeholder="Qty"
                                />
                              </Field>
                              <Field label={tab.sizeLabel}>
                                <Input
                                  type="text"
                                  value={formData[tab.sizeKey] || ''}
                                  onChange={(e) => updateField(tab.sizeKey, e.target.value)}
                                  placeholder="e.g. 10ft x 10ft"
                                />
                              </Field>
                            </div>
                          )}

                          {/* toggle_select: checkbox enables → show select dropdown */}
                          {tab.type === 'toggle_select' && (
                            <Field label={tab.selectLabel}>
                              <Select
                                className="w-full"
                                value={formData[tab.selectKey] || ''}
                                onChange={(e) => updateField(tab.selectKey, e.target.value)}
                              >
                                <option value="">— Select —</option>
                                {(tab.options || []).map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </Select>
                            </Field>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* ═══════ PROJECT STYLE — drives AI photoreal renders ═══════ */}
          {selectedTemplate && isPebEngine && (
            <ProjectStyleCard value={projectStyle} onChange={setProjectStyle} />
          )}

          {/* ═══════ RATE EDITOR — Material + Labour Split ═══════ */}
          {selectedTemplate && isPebEngine && (
            <Card>
              <CardHeader
                title="Rate Editor"
                subtitle="Adjust material & labour rates per item — rates vary by location and project"
                action={<Badge tone="warning"><Pencil className="w-3 h-3" /> Editable</Badge>}
              />
              <div className="px-6 py-4">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 mb-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  <span>Item</span>
                  <span className="text-right">Unit</span>
                  <span className="text-right">Material</span>
                  <span className="text-right">Labour</span>
                  <span className="text-right">Total</span>
                </div>
                <div className="space-y-1.5">
                  {(formData._rates || []).map((rate, idx) => {
                    // Hide conditional items if their toggle is off
                    if (rate.conditional && !formData[rate.conditional]) return null
                    return (
                      <div
                        key={rate.id}
                        className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 items-center py-2 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                      >
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{rate.label}</p>
                          {rate.dynamic && (
                            <p className="text-[10px] text-slate-400">Based on selected material</p>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 text-right">{rate.unit}</p>
                        <Input
                          type="number"
                          className="text-right text-xs !py-1.5 !px-2"
                          value={rate.material}
                          onChange={(e) => {
                            const newRates = [...formData._rates]
                            const mat = parseFloat(e.target.value) || 0
                            newRates[idx] = { ...newRates[idx], material: mat, total: mat + newRates[idx].labour }
                            updateField('_rates', newRates)
                          }}
                        />
                        <Input
                          type="number"
                          className="text-right text-xs !py-1.5 !px-2"
                          value={rate.labour}
                          onChange={(e) => {
                            const newRates = [...formData._rates]
                            const lab = parseFloat(e.target.value) || 0
                            newRates[idx] = { ...newRates[idx], labour: lab, total: newRates[idx].material + lab }
                            updateField('_rates', newRates)
                          }}
                        />
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                            {rate.total?.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Reset link */}
                <div className="mt-3 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => updateField('_rates', loadDefaultRates())}
                    className="text-[11px] text-slate-400 hover:text-indigo-500 transition"
                  >
                    Reset to defaults
                  </button>
                </div>
              </div>
            </Card>
          )}

          {!selectedTemplate && templatesLoaded && (
            <Card>
              <EmptyState
                icon={FileText}
                title="No template selected"
                description="Pick a template above to start building the quote."
              />
            </Card>
          )}
        </div>

        {/* ═══════════════════════════ RIGHT: LIVE PREVIEW ═══════════════════════════ */}
        <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
          {/* Gradient hero with total */}
          <div
            className="relative overflow-hidden rounded-2xl p-6 text-white shadow-xl"
            style={{
              background:
                'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)',
              boxShadow: '0 20px 40px -12px rgba(67, 56, 202, 0.5)',
            }}
          >
            {/* Decorative glow */}
            <div
              className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-30 pointer-events-none"
              style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }}
            />
            <div
              className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-20 pointer-events-none"
              style={{ background: 'radial-gradient(circle, #ec4899, transparent 70%)' }}
            />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-200">
                  <Calculator className="w-3.5 h-3.5" /> Live Estimate
                </div>
                {calcLoading && (
                  <div className="flex items-center gap-1.5 text-xs text-indigo-200">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Calculating…
                  </div>
                )}
              </div>
              <p className="text-xs text-indigo-200 mb-1">Total Amount</p>
              {calcLoading && !preview.total ? (
                <Skeleton className="h-12 w-48 bg-white/10" />
              ) : (
                <div
                  className="text-4xl font-black tracking-tight bg-clip-text text-transparent"
                  style={{
                    backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #fde68a 50%, #fbbf24 100%)',
                  }}
                >
                  {fmtINR(preview.total)}
                </div>
              )}

              {/* 3 small stats */}
              <div className="grid grid-cols-3 gap-2 mt-6">
                <div className="rounded-xl bg-white/10 backdrop-blur-sm px-3 py-2.5 border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider text-indigo-200">Rate/sqft</p>
                  <p className="text-sm font-bold mt-0.5">
                    {preview.ratePerSqft != null ? `₹ ${Number(preview.ratePerSqft).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-sm px-3 py-2.5 border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider text-indigo-200">Floor Area</p>
                  <p className="text-sm font-bold mt-0.5">
                    {preview.floorArea != null ? `${Number(preview.floorArea).toLocaleString('en-IN')}` : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-sm px-3 py-2.5 border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider text-indigo-200">Steel (MT)</p>
                  <p className="text-sm font-bold mt-0.5">
                    {preview.steelTon != null ? Number(preview.steelTon).toFixed(2) : '—'}
                  </p>
                </div>
              </div>

              {/* Mini 3D thumbnail placeholder (for PEB engine) */}
              {isPebEngine && (
                <button
                  onClick={() => navigate('/quotation/3d', { state: { params: formData, boq: boqResult } })}
                  className="mt-4 w-full flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-sm px-3 py-2.5 border border-white/10 hover:bg-white/15 transition"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center">
                    <Box className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-xs font-semibold">3D Building Preview</p>
                    <p className="text-[10px] text-indigo-200">Click to open interactive view</p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* BOQ summary */}
          <Card>
            <CardHeader
              title="BOQ Summary"
              subtitle={preview.items.length ? `${preview.items.length} line items` : 'Waiting for input…'}
              action={
                preview.items.length > 0 && (
                  <Button size="sm" variant="secondary" onClick={() => setShowFullBoq(true)}>
                    View full
                  </Button>
                )
              }
            />
            <div className="px-6 py-4">
              {calcLoading && preview.items.length === 0 ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : preview.items.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">
                  Fill in the form to see the BOQ preview
                </p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto -mx-2 px-2">
                  {preview.items.slice(0, 5).map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                          {item.description?.split('\n')[0] || item.item_no}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {item.quantity?.toLocaleString('en-IN')} {item.unit} × {item.rate?.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white tabular-nums">
                        {fmtINR(item.amount)}
                      </p>
                    </div>
                  ))}
                  {preview.items.length > 5 && (
                    <p className="text-[11px] text-center text-slate-400 pt-2">
                      +{preview.items.length - 5} more items
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* ═══════ MD RATE REVIEW ═══════ */}
          {isPebEngine && preview.total > 0 && (
            <Card className={mdApproved ? 'ring-2 ring-emerald-400 dark:ring-emerald-500/50' : ''}>
              <CardHeader
                title="MD Rate Review"
                subtitle={mdApproved ? 'Rates locked & approved' : 'Adjust quoted rate per sqft'}
                action={
                  mdApproved
                    ? <Badge tone="success"><Check className="w-3 h-3" /> Approved</Badge>
                    : <Badge tone="warning"><Pencil className="w-3 h-3" /> Pending</Badge>
                }
              />
              <div className="px-6 py-4 space-y-4">
                {/* Estimated vs Quoted */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Estimated Rate/sqft</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                      {mdReview.estimated > 0 ? `₹ ${Math.ceil(mdReview.estimated).toLocaleString('en-IN')}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">MD Quoted Rate/sqft</p>
                    <Input
                      type="number"
                      className="text-lg font-bold !py-2"
                      value={mdQuotedRate}
                      onChange={(e) => { setMdQuotedRate(e.target.value); setMdApproved(false) }}
                      placeholder={Math.floor(mdReview.estimated).toString()}
                      disabled={mdApproved}
                    />
                  </div>
                </div>

                {/* Quoted total + margin */}
                {mdReview.quoted > 0 && (
                  <div className="rounded-xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-indigo-500">Quoted Project Cost</p>
                        <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
                          {fmtINR(mdReview.quotedTotal)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Margin</p>
                        <p className={
                          'text-sm font-bold tabular-nums ' +
                          (mdReview.margin < 0 ? 'text-rose-600' : mdReview.margin > 0 ? 'text-emerald-600' : 'text-slate-500')
                        }>
                          {mdReview.margin > 0 ? '+' : ''}{mdReview.margin.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Approve / Reset buttons */}
                <div className="flex items-center gap-2">
                  {!mdApproved ? (
                    <Button
                      size="sm"
                      variant="primary"
                      leftIcon={Check}
                      onClick={() => setMdApproved(true)}
                      disabled={!mdReview.quoted}
                      className="flex-1"
                    >
                      Approve & Lock
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={Pencil}
                      onClick={() => setMdApproved(false)}
                      className="flex-1"
                    >
                      Unlock for Editing
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* PEB visualization tools */}
          {isPebEngine && (
            <Card>
              <CardHeader title="Visualization" subtitle="Generate drawings and renders" />
              <div className="px-6 py-4 space-y-2">
                <button
                  onClick={() => navigate('/quotation/drawings', { state: { params: formData, boq: boqResult } })}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5 transition"
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                    <PenTool className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">2D Drawings</p>
                    <p className="text-[10px] text-slate-500">Plan, elevation &amp; sections</p>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/quotation/ai-image', {
                    state: {
                      params: { ...formData, ...projectStyle },
                      boq: boqResult,
                      lead: selectedLead,
                      projectStyle,
                    },
                  })}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-500/5 transition"
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-400 to-fuchsia-500 flex items-center justify-center">
                    <ImageIcon className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">AI Render</p>
                    <p className="text-[10px] text-slate-500">Photoreal building preview</p>
                  </div>
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ═══════════════════════════ STICKY ACTION BAR ═══════════════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-slate-950/85 backdrop-blur-lg">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Auto-calculating
            </div>
            <div className="text-sm min-w-0 truncate">
              <span className="text-slate-500">Total:</span>{' '}
              <span className="font-bold text-slate-900 dark:text-white">{fmtINR(preview.total)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              leftIcon={Save}
              onClick={() => saveQuotation(false)}
              loading={saving}
            >
              Save as Draft
            </Button>
            <Button
              variant="primary"
              leftIcon={Send}
              onClick={() => saveQuotation(true)}
              loading={saving}
            >
              Save &amp; Send to Client
            </Button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════ FULL BOQ MODAL ═══════════════════════════ */}
      <Modal
        open={showFullBoq}
        onClose={() => setShowFullBoq(false)}
        title="Full Bill of Quantities"
        size="xl"
        footer={
          <Button variant="secondary" onClick={() => setShowFullBoq(false)}>Close</Button>
        }
      >
        {preview.items.length === 0 ? (
          <EmptyState icon={FileText} title="No items" description="Fill the form to generate line items." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-slate-500">#</th>
                  <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-slate-500">Description</th>
                  <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-slate-500">Unit</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-slate-500">Qty</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-slate-500">Material</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-slate-500">Labour</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-slate-500">Rate</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-slate-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((item, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60">
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{item.item_no || i + 1}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {item.description?.split('\n')[0]}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{item.unit}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.quantity?.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-400">{item.material_rate?.toLocaleString('en-IN') ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-400">{item.labour_rate?.toLocaleString('en-IN') ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.rate?.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtINR(item.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 dark:bg-slate-900/50">
                  <td colSpan={7} className="px-3 py-3 text-right font-bold text-slate-700 dark:text-slate-300">
                    TOTAL ESTIMATED AMOUNT (RS.)
                  </td>
                  <td className="px-3 py-3 text-right font-black text-base text-slate-900 dark:text-white">
                    {fmtINR(preview.total)}
                  </td>
                </tr>
                {preview.floorArea > 0 && (
                  <>
                    <tr>
                      <td colSpan={7} className="px-3 py-1 text-right text-xs text-slate-500">AREA OF THE BUILDING (SQ.FT)</td>
                      <td className="px-3 py-1 text-right text-xs font-semibold">{preview.floorArea?.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="px-3 py-1 text-right text-xs text-slate-500">RATE/SQFT — ESTIMATED</td>
                      <td className="px-3 py-1 text-right text-xs font-semibold">{preview.ratePerSqft?.toLocaleString('en-IN')}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
