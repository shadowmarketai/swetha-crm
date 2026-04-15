/**
 * Public Intake Page — client submits requirements.
 * No authentication. Dynamically renders form from template.fields_schema.
 * Tenant-branded.
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, ArrowRight, Send, CheckCircle2, Sparkles, Building2 } from 'lucide-react';
import { quotationPublicAPI } from '../../../services/api';

function applyBranding(tenant) {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', tenant?.primary_color || '#6366f1');
  root.style.setProperty('--brand-accent', tenant?.accent_color || '#8b5cf6');
  root.style.setProperty('--brand-font', tenant?.font_family || 'Inter');
  if (tenant?.name) document.title = `${tenant.name} · Get a Quote`;
}

function DynamicField({ field, value, onChange }) {
  const common = "w-full h-11 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 transition";
  const ringStyle = { '--tw-ring-color': 'color-mix(in oklab, var(--brand-primary) 35%, transparent)' };

  if (field.show_if) {
    // Simple single-key conditional visibility
    const [depKey, depVal] = Object.entries(field.show_if)[0] || [];
    if (depKey && value?._all?.[depKey] !== depVal) return null;
  }

  const handleChange = (v) => onChange(field.key, v);

  if (field.type === 'select') {
    return (
      <label className="block">
        <span className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
          {field.label}
          {field.required && <span className="text-rose-500">*</span>}
          {field.unit && <span className="text-xs text-slate-400 font-normal">({field.unit})</span>}
        </span>
        <select
          className={common}
          style={ringStyle}
          value={value?.[field.key] ?? field.default ?? ''}
          onChange={e => handleChange(e.target.value)}
          required={field.required}
        >
          {(field.options || []).map(o => (
            <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
          ))}
        </select>
        {field.help && <span className="text-xs text-slate-500 mt-1 block">{field.help}</span>}
      </label>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-slate-50 border border-slate-200">
        <input
          type="checkbox"
          className="w-5 h-5 rounded accent-[var(--brand-primary)]"
          checked={!!(value?.[field.key] ?? field.default)}
          onChange={e => handleChange(e.target.checked)}
        />
        <div>
          <span className="text-sm font-semibold text-slate-700">{field.label}</span>
          {field.help && <div className="text-xs text-slate-500">{field.help}</div>}
        </div>
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <label className="block">
        <span className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
          {field.label}
          {field.required && <span className="text-rose-500">*</span>}
        </span>
        <textarea
          rows={3}
          className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 resize-none"
          style={ringStyle}
          value={value?.[field.key] ?? field.default ?? ''}
          onChange={e => handleChange(e.target.value)}
          required={field.required}
        />
      </label>
    );
  }

  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-rose-500">*</span>}
        {field.unit && <span className="text-xs text-slate-400 font-normal">({field.unit})</span>}
      </span>
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        className={common}
        style={ringStyle}
        value={value?.[field.key] ?? field.default ?? ''}
        onChange={e => handleChange(field.type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value)}
        min={field.min}
        max={field.max}
        placeholder={field.label}
        required={field.required}
      />
      {field.help && <span className="text-xs text-slate-500 mt-1 block">{field.help}</span>}
    </label>
  );
}

export default function PublicIntakePage() {
  const { tenantSlug, templateSlug } = useParams();
  const [template, setTemplate] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  const [contact, setContact] = useState({
    client_name: '', client_phone: '', client_email: '', client_company: '', client_location: '',
  });
  const [formData, setFormData] = useState({});

  useEffect(() => {
    quotationPublicAPI.getIntakeTemplate(tenantSlug, templateSlug)
      .then(res => {
        setTemplate(res.data.template);
        setTenant(res.data.tenant);
        applyBranding(res.data.tenant);
        // Seed defaults
        const defaults = {};
        (res.data.template.fields_schema || []).forEach(f => {
          if (f.default !== undefined) defaults[f.key] = f.default;
        });
        setFormData(defaults);
      })
      .catch(() => toast.error('Form not found'))
      .finally(() => setLoading(false));
  }, [tenantSlug, templateSlug]);

  const groupedFields = useMemo(() => {
    const groups = {};
    (template?.fields_schema || []).forEach(f => {
      const g = f.group || 'Details';
      (groups[g] ||= []).push(f);
    });
    return groups;
  }, [template]);

  const updateField = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!contact.client_name || !contact.client_phone) {
      toast.error('Name and phone are required');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await quotationPublicAPI.submitIntake(tenantSlug, templateSlug, {
        ...contact,
        form_data: formData,
      });
      setSubmitted(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">Form not found</h1>
          <p className="text-sm text-slate-500 mt-2">This link may be invalid or the form has been removed.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}
          >
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Thank you!</h1>
          <p className="text-sm text-slate-600 mt-2">{submitted.message}</p>
          <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Reference</div>
            <div className="text-lg font-bold text-slate-900 mt-1">Q-{submitted.quotation_id}</div>
            {submitted.total_amount > 0 && (
              <div className="text-sm text-slate-600 mt-1">
                Preliminary estimate: ₹{submitted.total_amount.toLocaleString('en-IN')}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-6">
            {tenant?.name || 'The team'} will review your request and send you the final quotation via WhatsApp shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]" style={{ fontFamily: tenant?.font_family || 'Inter' }}>
      {/* Tenant Header */}
      <div
        className="border-b border-slate-200 bg-white"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklab, ${tenant?.primary_color || '#6366f1'} 6%, white), white 50%, color-mix(in oklab, ${tenant?.accent_color || '#ec4899'} 4%, white))`,
        }}
      >
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center gap-4">
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.name} className="w-12 h-12 rounded-xl object-contain bg-white shadow-sm" />
          ) : (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: `linear-gradient(135deg, ${tenant?.primary_color}, ${tenant?.accent_color})` }}
            >
              <Building2 className="w-6 h-6 text-white" strokeWidth={2.6} />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-900">{tenant?.app_name || tenant?.name}</h1>
            <p className="text-sm text-slate-500">Request a Quotation · {template.name}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Intro */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3"
            style={{ background: 'color-mix(in oklab, var(--brand-primary) 12%, white)', color: 'var(--brand-primary)' }}>
            <Sparkles className="w-3.5 h-3.5" /> Get an instant estimate
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{template.name}</h2>
          {template.description && <p className="text-sm text-slate-600 mt-1">{template.description}</p>}
        </div>

        {/* Contact details */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-900">Your Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DynamicField field={{ key: 'client_name', label: 'Full Name', type: 'text', required: true }} value={{ client_name: contact.client_name }} onChange={(_, v) => setContact({ ...contact, client_name: v })} />
            <DynamicField field={{ key: 'client_phone', label: 'Phone (WhatsApp)', type: 'text', required: true }} value={{ client_phone: contact.client_phone }} onChange={(_, v) => setContact({ ...contact, client_phone: v })} />
            <DynamicField field={{ key: 'client_email', label: 'Email', type: 'text' }} value={{ client_email: contact.client_email }} onChange={(_, v) => setContact({ ...contact, client_email: v })} />
            <DynamicField field={{ key: 'client_company', label: 'Company', type: 'text' }} value={{ client_company: contact.client_company }} onChange={(_, v) => setContact({ ...contact, client_company: v })} />
            <div className="md:col-span-2">
              <DynamicField field={{ key: 'client_location', label: 'Site Location', type: 'text' }} value={{ client_location: contact.client_location }} onChange={(_, v) => setContact({ ...contact, client_location: v })} />
            </div>
          </div>
        </div>

        {/* Dynamic groups */}
        {Object.entries(groupedFields).map(([group, fields]) => (
          <div key={group} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-900">{group}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map(f => (
                <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                  <DynamicField
                    field={f}
                    value={{ ...formData, _all: formData, [f.key]: formData[f.key] }}
                    onChange={updateField}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Submit */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl text-white font-semibold text-base flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${tenant?.primary_color || '#6366f1'}, ${tenant?.accent_color || '#8b5cf6'})`,
              boxShadow: `0 8px 24px -8px ${tenant?.primary_color || '#6366f1'}80`,
            }}
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {submitting ? 'Submitting...' : 'Send My Request'}
          </button>
          <p className="text-xs text-slate-500 text-center mt-3">
            By submitting, you'll receive a quotation on WhatsApp within 24 hours.
          </p>
        </div>
      </form>
    </div>
  );
}
