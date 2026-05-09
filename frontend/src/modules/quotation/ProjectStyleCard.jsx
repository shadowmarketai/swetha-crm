/**
 * ProjectStyleCard — controls the building's visual identity for AI rendering.
 *
 * Captures: building_type, 4 colours (wall/accent/roof/trim), cladding pattern,
 * glazing, front door, site context. All optional — sensible defaults match
 * Swetha's standard look (teal-green warehouse).
 *
 * One-click presets fill all fields at once for the most common Swetha jobs.
 */

import { useState } from 'react'
import { Card, CardHeader, Button, Field, Select, Segmented } from '../../components/ui/primitives'
import { Wand2, Building2, Factory, Store, Briefcase, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'

// ── Style presets ────────────────────────────────────────────────
// Each preset fills every styling field. "custom" keeps whatever is there.
export const STYLE_PRESETS = [
  {
    id: 'standard_green_warehouse',
    label: 'Standard Green Warehouse',
    description: "Swetha's signature look — teal accent, white walls",
    values: {
      building_type: 'warehouse',
      wall_color_hex:   '#FFFFFF',
      accent_color_hex: '#1FBBA0',
      roof_color_hex:   '#1FBBA0',
      trim_color_hex:   '#1FBBA0',
      cladding_pattern: 'vertical_stripe',
      glazing_type:     'punched_windows',
      front_door_type:  'roller_shutter',
      site_context:     'industrial_estate',
      parking_visible:  true,
    },
  },
  {
    id: 'red_grey_industrial',
    label: 'Red & Steel-Grey Industrial',
    description: 'Bold red accent on steel-grey shed',
    values: {
      building_type: 'warehouse',
      wall_color_hex:   '#FFFFFF',
      accent_color_hex: '#A40E26',
      roof_color_hex:   '#5B6770',
      trim_color_hex:   '#5B6770',
      cladding_pattern: 'vertical_stripe',
      glazing_type:     'ribbon_window',
      front_door_type:  'sectional',
      site_context:     'industrial_estate',
      parking_visible:  true,
    },
  },
  {
    id: 'modern_commercial',
    label: 'Modern Commercial 2-Storey',
    description: 'White masonry + blue glass curtain wall + red trim',
    values: {
      building_type: 'commercial',
      wall_color_hex:   '#FFFFFF',
      accent_color_hex: '#1F4E79',
      roof_color_hex:   '#FFFFFF',
      trim_color_hex:   '#E63946',
      cladding_pattern: 'flat_panel',
      glazing_type:     'curtain_wall',
      front_door_type:  'glazed_entrance',
      site_context:     'highway_frontage',
      parking_visible:  true,
    },
  },
  {
    id: 'showroom',
    label: 'Premium Showroom',
    description: 'White + charcoal accents, large glazing',
    values: {
      building_type: 'showroom',
      wall_color_hex:   '#FFFFFF',
      accent_color_hex: '#1F2937',
      roof_color_hex:   '#1F2937',
      trim_color_hex:   '#1F2937',
      cladding_pattern: 'flat_panel',
      glazing_type:     'curtain_wall',
      front_door_type:  'glazed_entrance',
      site_context:     'highway_frontage',
      parking_visible:  true,
    },
  },
]

const BUILDING_TYPES = [
  { value: 'warehouse',  label: 'Warehouse',  icon: Factory },
  { value: 'factory',    label: 'Factory',    icon: Building2 },
  { value: 'showroom',   label: 'Showroom',   icon: Store },
  { value: 'commercial', label: 'Commercial', icon: Briefcase },
]

const CLADDING_OPTIONS = [
  { value: 'vertical_stripe', label: 'Vertical stripes (alternating)' },
  { value: 'horizontal_rib',  label: 'Horizontal ribbed' },
  { value: 'flat_panel',      label: 'Flat smooth panels' },
]

const GLAZING_OPTIONS = [
  { value: 'punched_windows', label: 'Small punched windows' },
  { value: 'ribbon_window',   label: 'Continuous ribbon windows' },
  { value: 'curtain_wall',    label: 'Full glass curtain wall' },
]

const DOOR_OPTIONS = [
  { value: 'roller_shutter',  label: 'Roller shutter (industrial)' },
  { value: 'sectional',       label: 'Sectional overhead door' },
  { value: 'glazed_entrance', label: 'Glazed entrance door' },
]

const SITE_OPTIONS = [
  { value: 'industrial_estate', label: 'Industrial estate' },
  { value: 'highway_frontage',  label: 'Highway frontage' },
  { value: 'green_belt',        label: 'Green-belt outskirts' },
]

// ── Default values when nothing has been picked yet ──
export const DEFAULT_STYLE = STYLE_PRESETS[0].values

// ── Colour picker primitive ──
function ColorField({ label, value, onChange }) {
  const v = (value || '#FFFFFF').toUpperCase()
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <label className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 cursor-pointer hover:border-slate-400 transition flex-shrink-0">
          <input
            type="color"
            value={v}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="w-full h-full" style={{ background: v }} />
        </label>
        <input
          type="text"
          value={v}
          onChange={(e) => {
            let next = e.target.value.trim().toUpperCase()
            if (next && !next.startsWith('#')) next = '#' + next
            onChange(next)
          }}
          maxLength={7}
          className="flex-1 px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          placeholder="#1FBBA0"
        />
      </div>
    </Field>
  )
}


export default function ProjectStyleCard({ value = {}, onChange }) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Merge incoming `value` with defaults so all fields are defined.
  const v = { ...DEFAULT_STYLE, ...value }

  const set = (patch) => onChange?.({ ...v, ...patch })

  const applyPreset = (presetId) => {
    const preset = STYLE_PRESETS.find(p => p.id === presetId)
    if (preset) onChange?.({ ...v, ...preset.values, _preset: presetId })
  }

  const resetToDefault = () => {
    onChange?.({ ...DEFAULT_STYLE, _preset: STYLE_PRESETS[0].id })
  }

  return (
    <Card>
      <CardHeader
        title="Project Style"
        subtitle="Drives the AI photoreal renders — colours, materials, building type"
        action={
          <Button variant="ghost" size="sm" leftIcon={RotateCcw} onClick={resetToDefault}>
            Reset
          </Button>
        }
      />
      <div className="px-6 py-5 space-y-5">

        {/* Quick presets */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5 text-purple-500" />
            Quick presets
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STYLE_PRESETS.map(p => {
              const active = v._preset === p.id
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={`text-left p-3 rounded-xl border transition flex items-center gap-3 ${
                    active
                      ? 'border-purple-400 bg-purple-50/60 dark:bg-purple-500/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* mini palette swatch */}
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <div className="flex gap-0.5">
                      <span className="w-3 h-3 rounded-sm border border-black/10" style={{ background: p.values.wall_color_hex }} />
                      <span className="w-3 h-3 rounded-sm border border-black/10" style={{ background: p.values.accent_color_hex }} />
                    </div>
                    <div className="flex gap-0.5">
                      <span className="w-3 h-3 rounded-sm border border-black/10" style={{ background: p.values.roof_color_hex }} />
                      <span className="w-3 h-3 rounded-sm border border-black/10" style={{ background: p.values.trim_color_hex }} />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{p.label}</div>
                    <div className="text-[10px] text-slate-500 truncate">{p.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Building type */}
        <Field label="Building type">
          <div className="grid grid-cols-4 gap-2">
            {BUILDING_TYPES.map(t => {
              const Icon = t.icon
              const active = v.building_type === t.value
              return (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => set({ building_type: t.value, _preset: undefined })}
                  className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition ${
                    active
                      ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </Field>

        {/* Colours */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
            Colours
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ColorField label="Wall / dado" value={v.wall_color_hex}   onChange={(c) => set({ wall_color_hex: c, _preset: undefined })} />
            <ColorField label="Accent"      value={v.accent_color_hex} onChange={(c) => set({ accent_color_hex: c, _preset: undefined })} />
            <ColorField label="Roof"        value={v.roof_color_hex}   onChange={(c) => set({ roof_color_hex: c, _preset: undefined })} />
            <ColorField label="Trim"        value={v.trim_color_hex}   onChange={(c) => set({ trim_color_hex: c, _preset: undefined })} />
          </div>
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setAdvancedOpen(o => !o)}
          className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
        >
          {advancedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Advanced details (cladding, glazing, doors, site)
        </button>

        {advancedOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Field label="Cladding pattern">
              <Select value={v.cladding_pattern} onChange={(e) => set({ cladding_pattern: e.target.value, _preset: undefined })}>
                {CLADDING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Glazing">
              <Select value={v.glazing_type} onChange={(e) => set({ glazing_type: e.target.value, _preset: undefined })}>
                {GLAZING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Front door">
              <Select value={v.front_door_type} onChange={(e) => set({ front_door_type: e.target.value, _preset: undefined })}>
                {DOOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Site context">
              <Select value={v.site_context} onChange={(e) => set({ site_context: e.target.value, _preset: undefined })}>
                {SITE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Parking visible in renders" className="sm:col-span-2">
              <Segmented
                options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
                value={v.parking_visible ? 'yes' : 'no'}
                onChange={(val) => set({ parking_visible: val === 'yes', _preset: undefined })}
              />
            </Field>
          </div>
        )}
      </div>
    </Card>
  )
}
