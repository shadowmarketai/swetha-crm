/**
 * Template Editor — deep config of one template: fields, rates, terms,
 * auto-gen toggles, negotiation caps, branding overrides.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Save, Plus, Trash2, Building2, Settings, ToggleRight, FileText, Sparkles,
} from 'lucide-react';
import {
  Card, CardHeader, Button, Input, Select, Textarea, Field, PageHeader, Badge, Segmented, Skeleton,
} from '../../components/ui/primitives';
import { quotationTemplateAPI } from '../../services/api';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'textarea', label: 'Textarea' },
];

const TABS = [
  { value: 'basics', label: 'Basics' },
  { value: 'fields', label: 'Form Fields' },
  { value: 'rates', label: 'Rate Items' },
  { value: 'autogen', label: 'Auto-generation' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'terms', label: 'Terms' },
];

export default function TemplateEditor() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const [tpl, setTpl] = useState(null);
  const [tab, setTab] = useState('basics');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    quotationTemplateAPI.get(templateId)
      .then(res => setTpl(res.data))
      .catch(() => { toast.error('Template not found'); navigate('/quotation/templates'); });
  }, [templateId]);

  const update = (patch) => setTpl(prev => ({ ...prev, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      await quotationTemplateAPI.update(tpl.id, {
        name: tpl.name,
        description: tpl.description,
        icon: tpl.icon,
        engine: tpl.engine,
        auto_generate_3d: tpl.auto_generate_3d,
        auto_generate_drawings: tpl.auto_generate_drawings,
        auto_generate_render: tpl.auto_generate_render,
        fields_schema: tpl.fields_schema,
        rate_items: tpl.rate_items,
        terms_conditions: tpl.terms_conditions,
        default_validity_days: tpl.default_validity_days,
        negotiation_enabled: tpl.negotiation_enabled,
        max_discount_pct: tpl.max_discount_pct,
        negotiation_reject_message: tpl.negotiation_reject_message,
      });
      toast.success('Saved');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addField = () => {
    update({
      fields_schema: [
        ...(tpl.fields_schema || []),
        { key: `field_${(tpl.fields_schema?.length || 0) + 1}`, label: 'New Field', type: 'text', required: false },
      ],
    });
  };
  const updateField = (idx, patch) => {
    const fs = [...(tpl.fields_schema || [])];
    fs[idx] = { ...fs[idx], ...patch };
    update({ fields_schema: fs });
  };
  const removeField = (idx) => {
    const fs = [...(tpl.fields_schema || [])];
    fs.splice(idx, 1);
    update({ fields_schema: fs });
  };

  const addRate = () => {
    update({
      rate_items: [
        ...(tpl.rate_items || []),
        { id: `item_${(tpl.rate_items?.length || 0) + 1}`, label: 'New Line Item', unit: 'ea', material_rate: 0, labour_rate: 0, formula: '' },
      ],
    });
  };
  const updateRate = (idx, patch) => {
    const ri = [...(tpl.rate_items || [])];
    ri[idx] = { ...ri[idx], ...patch };
    update({ rate_items: ri });
  };
  const removeRate = (idx) => {
    const ri = [...(tpl.rate_items || [])];
    ri.splice(idx, 1);
    update({ rate_items: ri });
  };

  if (!tpl) {
    return (
      <div className="space-y-4">
        <Skeleton className="w-64 h-8" />
        <Card className="p-6"><Skeleton className="w-full h-96" /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tpl.name}
        subtitle={`Template · ${tpl.engine} engine · slug: ${tpl.slug}`}
        actions={
          <>
            <Button variant="secondary" leftIcon={ArrowLeft} onClick={() => navigate('/quotation/templates')}>Back</Button>
            <Button leftIcon={Save} onClick={save} loading={saving}>Save</Button>
          </>
        }
      />

      <div className="flex items-center gap-2 overflow-x-auto">
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </div>

      {/* BASICS */}
      {tab === 'basics' && (
        <Card>
          <CardHeader title="Basic Information" />
          <div className="px-6 py-5 space-y-4">
            <Field label="Name" required>
              <Input value={tpl.name || ''} onChange={e => update({ name: e.target.value })} />
            </Field>
            <Field label="Description">
              <Textarea rows={3} value={tpl.description || ''} onChange={e => update({ description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Engine">
                <Select className="w-full" value={tpl.engine} onChange={e => update({ engine: e.target.value })}>
                  <option value="generic">Generic (arithmetic)</option>
                  <option value="peb">PEB Building</option>
                </Select>
              </Field>
              <Field label="Validity (days)">
                <Input type="number" value={tpl.default_validity_days} onChange={e => update({ default_validity_days: parseInt(e.target.value) || 30 })} />
              </Field>
            </div>
          </div>
        </Card>
      )}

      {/* FIELDS */}
      {tab === 'fields' && (
        <Card>
          <CardHeader
            title="Form Fields"
            subtitle="What the client sees on the intake form"
            action={<Button size="sm" leftIcon={Plus} onClick={addField}>Add field</Button>}
          />
          <div className="px-6 py-5 space-y-3">
            {(tpl.fields_schema || []).length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">No fields yet. Add fields for the client to fill in.</p>
            )}
            {(tpl.fields_schema || []).map((f, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <Input className="col-span-3" placeholder="key" value={f.key} onChange={e => updateField(i, { key: e.target.value })} />
                <Input className="col-span-3" placeholder="Label" value={f.label} onChange={e => updateField(i, { label: e.target.value })} />
                <Select className="col-span-2" value={f.type} onChange={e => updateField(i, { type: e.target.value })}>
                  {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
                <Input className="col-span-2" placeholder="Unit" value={f.unit || ''} onChange={e => updateField(i, { unit: e.target.value })} />
                <label className="col-span-1 flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={f.required || false} onChange={e => updateField(i, { required: e.target.checked })} />
                  Req
                </label>
                <button onClick={() => removeField(i)} className="col-span-1 p-1.5 hover:bg-rose-50 rounded text-rose-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* RATES */}
      {tab === 'rates' && (
        <Card>
          <CardHeader
            title="Rate Items"
            subtitle={tpl.engine === 'peb' ? 'BOQ line items — maps to built-in PEB engine ids' : 'Each item uses formula × (material + labour)'}
            action={<Button size="sm" leftIcon={Plus} onClick={addRate}>Add item</Button>}
          />
          <div className="px-6 py-5 space-y-3">
            {(tpl.rate_items || []).length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">No rate items yet.</p>
            )}
            {(tpl.rate_items || []).map((r, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-12 gap-2">
                  <Input className="col-span-3" placeholder="id" value={r.id} onChange={e => updateRate(i, { id: e.target.value })} />
                  <Input className="col-span-4" placeholder="Label" value={r.label} onChange={e => updateRate(i, { label: e.target.value })} />
                  <Input className="col-span-2" placeholder="Unit" value={r.unit} onChange={e => updateRate(i, { unit: e.target.value })} />
                  <Input className="col-span-1" type="number" placeholder="Mat" value={r.material_rate} onChange={e => updateRate(i, { material_rate: parseFloat(e.target.value) || 0 })} />
                  <Input className="col-span-1" type="number" placeholder="Lab" value={r.labour_rate} onChange={e => updateRate(i, { labour_rate: parseFloat(e.target.value) || 0 })} />
                  <button onClick={() => removeRate(i)} className="col-span-1 p-1.5 hover:bg-rose-50 rounded text-rose-500"><Trash2 className="w-4 h-4" /></button>
                </div>
                {tpl.engine !== 'peb' && (
                  <Input
                    className="mt-2 font-mono text-xs"
                    placeholder="Formula (e.g. length * width * 1.2)"
                    value={r.formula || ''}
                    onChange={e => updateRate(i, { formula: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* AUTO-GEN */}
      {tab === 'autogen' && (
        <Card>
          <CardHeader title="Auto-generation" subtitle="Automatically produce visual artifacts when a client submits an intake" />
          <div className="px-6 py-5 space-y-3">
            {[
              { key: 'auto_generate_3d', label: '3D Building Model', desc: 'Interactive Three.js viewer (PEB engine only)' },
              { key: 'auto_generate_drawings', label: '2D Drawings', desc: 'Plan, elevation, section (PEB engine only)' },
              { key: 'auto_generate_render', label: 'AI Render', desc: 'Realistic exterior render' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => update({ [item.key]: !tpl[item.key] })}
                  className={`relative w-11 h-6 rounded-full transition-all ${tpl[item.key] ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_4px_12px_-2px_rgba(16,185,129,0.5)]' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${tpl[item.key] ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* NEGOTIATION */}
      {tab === 'negotiation' && (
        <Card>
          <CardHeader title="Negotiation Caps" subtitle="Bounded counter-offers from the client portal" />
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div>
                <div className="text-sm font-semibold">Enable negotiation</div>
                <div className="text-xs text-slate-500">Clients can propose counter-prices within your cap</div>
              </div>
              <button
                type="button"
                onClick={() => update({ negotiation_enabled: !tpl.negotiation_enabled })}
                className={`relative w-11 h-6 rounded-full transition-all ${tpl.negotiation_enabled ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${tpl.negotiation_enabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            {tpl.negotiation_enabled && (
              <>
                <Field label="Maximum discount %" hint="Clients cannot go below this cap — system auto-rejects lower offers">
                  <Input type="number" min="0" max="100" step="0.5" value={tpl.max_discount_pct || 0} onChange={e => update({ max_discount_pct: parseFloat(e.target.value) || 0 })} />
                </Field>
                <Field label="Auto-reject message" hint="Shown when client proposes below your floor. Use {min_price} placeholder.">
                  <Textarea
                    rows={3}
                    value={tpl.negotiation_reject_message || ''}
                    onChange={e => update({ negotiation_reject_message: e.target.value })}
                    placeholder="Our best price is already tightly calculated. The minimum we can offer is {min_price}."
                  />
                </Field>
              </>
            )}
          </div>
        </Card>
      )}

      {/* TERMS */}
      {tab === 'terms' && (
        <Card>
          <CardHeader title="Terms & Conditions" subtitle="Included at the bottom of every PDF and portal page" />
          <div className="px-6 py-5">
            <Textarea rows={14} value={tpl.terms_conditions || ''} onChange={e => update({ terms_conditions: e.target.value })} />
          </div>
        </Card>
      )}
    </div>
  );
}
