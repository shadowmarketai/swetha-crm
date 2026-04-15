/**
 * Template Studio — list/create/toggle quotation templates.
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Plus, Copy, Edit3, Trash2, Building2, Package, ArrowRight, Settings, Power,
} from 'lucide-react';
import {
  Card, CardHeader, Button, Modal, Input, Field, Select, PageHeader, Badge, EmptyState, Skeleton,
} from '../../components/ui/primitives';
import { quotationTemplateAPI } from '../../services/api';

const ENGINE_OPTIONS = [
  { value: 'generic', label: 'Generic (arithmetic)' },
  { value: 'peb', label: 'PEB Building (3D + drawings + AI render)' },
];

export default function TemplateStudio() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', slug: '', description: '', engine: 'generic',
    negotiation_enabled: false, max_discount_pct: 10,
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await quotationTemplateAPI.list();
      setTemplates(res.data || []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.slug) { toast.error('Name and slug required'); return; }
    try {
      const { data } = await quotationTemplateAPI.create({
        ...form,
        fields_schema: [],
        rate_items: [],
        is_active: true,
      });
      toast.success(`Created "${data.name}"`);
      setShowCreate(false);
      setForm({ name: '', slug: '', description: '', engine: 'generic', negotiation_enabled: false, max_discount_pct: 10 });
      navigate(`/quotation/templates/${data.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Create failed');
    }
  };

  const handleToggle = async (tpl) => {
    try {
      await quotationTemplateAPI.update(tpl.id, { is_active: !tpl.is_active });
      toast.success(`${tpl.name} ${tpl.is_active ? 'deactivated' : 'activated'}`);
      load();
    } catch {
      toast.error('Update failed');
    }
  };

  const handleDelete = async (tpl) => {
    if (!confirm(`Delete template "${tpl.name}"?`)) return;
    try {
      await quotationTemplateAPI.delete(tpl.id);
      toast.success('Deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  const copyIntakeUrl = (tpl) => {
    const url = `${window.location.origin}/intake/${tpl.tenant_slug || 'tenant'}/${tpl.slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Intake URL copied');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Template Studio"
        subtitle="Design the quotation experience for every product or service you offer"
        actions={
          <Button leftIcon={Plus} onClick={() => setShowCreate(true)}>
            New Template
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <Card key={i} className="p-6"><Skeleton className="w-24 h-6 mb-4" /><Skeleton className="w-48 h-4 mb-2" /><Skeleton className="w-32 h-4" /></Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="No templates yet"
            description="Create your first quotation template. Each template defines the fields, rates, and calculation engine for one of your products or services."
            action={<Button leftIcon={Plus} onClick={() => setShowCreate(true)}>Create first template</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(tpl => (
            <Card key={tpl.id} hover className="p-5 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg"
                  style={{
                    background: tpl.engine === 'peb'
                      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                      : 'linear-gradient(135deg, #10b981, #06b6d4)',
                  }}
                >
                  <Building2 className="w-5 h-5" strokeWidth={2.6} />
                </div>
                {tpl.is_active ? <Badge tone="success" dot>Active</Badge> : <Badge>Inactive</Badge>}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 dark:text-white">{tpl.name}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{tpl.description || 'No description'}</p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Badge tone={tpl.engine === 'peb' ? 'purple' : 'info'}>{tpl.engine}</Badge>
                  {tpl.negotiation_enabled && (
                    <Badge tone="warning">{tpl.max_discount_pct}% max discount</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" size="sm" leftIcon={Edit3} onClick={() => navigate(`/quotation/templates/${tpl.id}`)}>Edit</Button>
                <Button variant="ghost" size="sm" leftIcon={Copy} onClick={() => copyIntakeUrl(tpl)}>Copy URL</Button>
                <Button variant="ghost" size="sm" leftIcon={Power} onClick={() => handleToggle(tpl)}>{tpl.is_active ? 'Off' : 'On'}</Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(tpl)}><Trash2 className="w-4 h-4 text-rose-500" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Template"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" required>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') })}
              placeholder="e.g. Modular Kitchen"
            />
          </Field>
          <Field label="Slug" required hint="Used in public intake URL: /intake/{tenant}/{slug}">
            <Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="modular-kitchen" />
          </Field>
          <Field label="Description">
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Short description" />
          </Field>
          <Field label="Engine">
            <Select className="w-full" value={form.engine} onChange={e => setForm({ ...form, engine: e.target.value })}>
              {ENGINE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div>
              <div className="text-sm font-semibold">Enable negotiation</div>
              <div className="text-xs text-slate-500">Clients can propose a counter-price within your cap</div>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, negotiation_enabled: !form.negotiation_enabled })}
              className={`relative w-11 h-6 rounded-full transition-all ${form.negotiation_enabled ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-slate-300 dark:bg-slate-700'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${form.negotiation_enabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          {form.negotiation_enabled && (
            <Field label="Max discount %" hint="Clients cannot propose below this cap">
              <Input type="number" min="0" max="100" value={form.max_discount_pct} onChange={e => setForm({ ...form, max_discount_pct: parseFloat(e.target.value) || 0 })} />
            </Field>
          )}
        </div>
      </Modal>
    </div>
  );
}
