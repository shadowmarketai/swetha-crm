/**
 * Lead Sources Integration Page — Tendent
 * Configure IndiaMart, JustDial, and Facebook Lead Ads integrations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import {
  Settings, RefreshCw, Check, ExternalLink, Copy, AlertCircle, Loader2,
  ChevronDown, Globe,
} from 'lucide-react';
import {
  Card, Stat, Button, Input, Field, PageHeader, Badge, Skeleton, EmptyState,
} from '../../components/ui/primitives';

const SOURCES = [
  {
    provider: 'indiamart',
    name: 'IndiaMart',
    description: 'B2B marketplace lead capture via CRM API polling',
    gradient: 'from-sky-500 to-blue-600',
    tint: 'rgba(56,189,248,0.08)',
    fields: [
      { key: 'api_key', label: 'CRM API Key', placeholder: 'Your IndiaMart CRM API Key', type: 'password' },
    ],
    webhookUrl: null,
    helpText: 'Get your CRM API key from IndiaMart seller dashboard \u2192 Lead Manager \u2192 API Settings',
  },
  {
    provider: 'justdial',
    name: 'JustDial',
    description: 'Local business listing leads via webhook',
    gradient: 'from-orange-500 to-amber-600',
    tint: 'rgba(251,146,60,0.08)',
    fields: [
      { key: 'api_key', label: 'Webhook API Key', placeholder: 'Generate a key for JustDial to use', type: 'text' },
    ],
    webhookUrl: '/api/v1/lead-sources/justdial/webhook',
    helpText: 'Share the webhook URL and API key with JustDial to start receiving leads',
  },
  {
    provider: 'facebook_leads',
    name: 'Facebook Lead Ads',
    description: 'Meta lead form submissions via Graph API webhook',
    gradient: 'from-indigo-500 to-violet-600',
    tint: 'rgba(99,102,241,0.08)',
    fields: [
      { key: 'api_key', label: 'Page Access Token', placeholder: 'Meta Page Access Token', type: 'password' },
      { key: 'page_id', label: 'Facebook Page ID', placeholder: 'e.g. 123456789', type: 'text' },
      { key: 'app_secret', label: 'App Secret (for HMAC)', placeholder: 'Meta App Secret', type: 'password' },
    ],
    webhookUrl: '/api/v1/lead-sources/facebook/webhook',
    helpText: 'Configure the webhook URL in Meta Developer Console \u2192 Webhooks \u2192 Lead Ads',
  },
];

function MiniStat({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
    </div>
  );
}

function SourceCard({ source, config, stats, onSave, onSync, isSaving, isSyncing }) {
  const { can } = usePermissions();
  const canWrite = can('integrations', 'create') || can('crm', 'create');
  const [expanded, setExpanded] = useState(false);
  const [formData, setFormData] = useState(() => {
    const initial = { is_active: config?.is_active ?? true, auto_assign: false, default_tags: '' };
    source.fields.forEach((f) => { initial[f.key] = ''; });
    if (config?.page_id) initial.page_id = config.page_id;
    return initial;
  });

  const isConfigured = !!config;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleSave = () => {
    const payload = { provider: source.provider, ...formData };
    if (payload.default_tags && typeof payload.default_tags === 'string') {
      payload.default_tags = payload.default_tags.split(',').map((t) => t.trim()).filter(Boolean);
    } else {
      delete payload.default_tags;
    }
    Object.keys(payload).forEach((k) => {
      if (payload[k] === '') delete payload[k];
    });
    onSave(payload);
  };

  const copyWebhookUrl = () => {
    if (source.webhookUrl) {
      navigator.clipboard.writeText(baseUrl + source.webhookUrl);
      toast.success('Webhook URL copied!');
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* Header row */}
      <div className="p-5 flex items-center justify-between gap-4 relative">
        <div
          className="absolute inset-0 pointer-events-none opacity-80"
          style={{ background: source.tint }}
        />
        <div className="relative flex items-center gap-3 min-w-0">
          <div
            className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${source.gradient} flex items-center justify-center shadow-lg flex-shrink-0`}
            style={{ boxShadow: `0 10px 24px -8px rgba(0,0,0,0.2)` }}
          >
            <ExternalLink className="w-5 h-5 text-white" strokeWidth={2.6} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">{source.name}</h3>
            <p className="text-xs text-slate-500 truncate">{source.description}</p>
          </div>
        </div>
        <div className="relative flex items-center gap-2 flex-shrink-0">
          {isConfigured ? (
            <Badge tone="success" dot>Connected</Badge>
          ) : (
            <Badge>Not configured</Badge>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800/60 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
            aria-label="Toggle configuration"
          >
            <Settings className={`w-4 h-4 transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-4 gap-4 bg-slate-50/60 dark:bg-slate-900/40">
          <MiniStat label="Total" value={stats.total} />
          <MiniStat label="Today" value={stats.today} />
          <MiniStat label="Week" value={stats.this_week} />
          <MiniStat label="Month" value={stats.this_month} />
        </div>
      )}

      {/* Config sync info */}
      {isConfigured && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-500 flex-wrap">
          <div className="flex items-center gap-4">
            <span>Ingested <strong className="text-slate-700 dark:text-slate-300">{config.total_ingested}</strong></span>
            <span>Duplicates <strong>{config.total_duplicates}</strong></span>
            <span>Errors <strong className={config.total_errors > 0 ? 'text-rose-500' : ''}>{config.total_errors}</strong></span>
          </div>
          {config.last_sync_at && (
            <span>Last sync: {new Date(config.last_sync_at).toLocaleString()}</span>
          )}
        </div>
      )}

      {/* Sync button for IndiaMart */}
      {isConfigured && source.provider === 'indiamart' && canWrite && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
          <Button onClick={onSync} loading={isSyncing} leftIcon={RefreshCw}>
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      )}

      {/* Expanded config form */}
      {expanded && (
        <div className="px-5 py-5 border-t border-slate-100 dark:border-slate-800 space-y-4 bg-white/60 dark:bg-slate-900/40">
          {source.webhookUrl && (
            <Field label="Webhook URL" hint="Share this URL with the provider">
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 truncate font-mono">
                  {baseUrl}{source.webhookUrl}
                </code>
                <Button variant="secondary" size="icon" onClick={copyWebhookUrl}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </Field>
          )}

          {source.fields.map((field) => (
            <Field key={field.key} label={field.label}>
              <Input
                type={field.type}
                placeholder={field.placeholder}
                value={formData[field.key] || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            </Field>
          ))}

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Active</div>
              <div className="text-xs text-slate-500">Enable lead ingestion for this source</div>
            </div>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))}
              className={`relative w-11 h-6 rounded-full transition-all ${
                formData.is_active
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_4px_12px_-2px_rgba(16,185,129,0.5)]'
                  : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                  formData.is_active ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          <Field label="Default Tags" hint="Comma-separated tags applied to ingested leads">
            <Input
              type="text"
              placeholder="e.g. indiamart, hot-lead"
              value={formData.default_tags || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, default_tags: e.target.value }))}
            />
          </Field>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/60 dark:border-amber-800/40">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{source.helpText}</p>
          </div>

          {canWrite && (
            <Button onClick={handleSave} disabled={isSaving} className="w-full" size="lg">
              {isSaving ? 'Saving...' : isConfigured ? 'Update Configuration' : 'Save Configuration'}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export default function LeadSourcesPage() {
  const [configs, setConfigs] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [configsRes, statsRes] = await Promise.allSettled([
        api.get('/api/v1/lead-sources/configs'),
        api.get('/api/v1/lead-sources/stats'),
      ]);
      if (configsRes.status === 'fulfilled') {
        const data = Array.isArray(configsRes.value.data) ? configsRes.value.data : [];
        setConfigs(data);
      }
      if (statsRes.status === 'fulfilled') {
        const data = Array.isArray(statsRes.value.data) ? statsRes.value.data : [];
        setStats(data);
      }
    } catch {
      toast.error('Failed to load lead source configurations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (payload) => {
    setIsSaving(true);
    try {
      // Check if config already exists for this provider
      const existing = configs.find((c) => c.provider === payload.provider);
      if (existing) {
        await api.put(`/api/v1/lead-sources/configs/${existing.id}`, payload);
      } else {
        await api.post('/api/v1/lead-sources/configs', payload);
      }
      toast.success(`${payload.provider} configuration saved!`);
      fetchData();
    } catch {
      toast.error(`Failed to save ${payload.provider} configuration`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await api.post('/api/v1/lead-sources/indiamart/poll');
      const ingested = result.data?.ingested || result.data?.new_leads || 0;
      toast.success(`Sync complete: ${ingested} new leads`);
      fetchData();
    } catch {
      toast.error('Sync failed — check your IndiaMart API key');
    } finally {
      setIsSyncing(false);
    }
  };

  const getConfigForProvider = (provider) => configs.find((c) => c.provider === provider);
  const getStatsForProvider = (provider) => stats.find((s) => s.source === provider);

  const totalLeads = stats.reduce((sum, s) => sum + (s.total || 0), 0);
  const todayLeads = stats.reduce((sum, s) => sum + (s.today || 0), 0);
  const weekLeads = stats.reduce((sum, s) => sum + (s.this_week || 0), 0);
  const connected = configs.length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Sources"
        subtitle="Configure IndiaMart, JustDial, and Facebook Lead Ads to automatically capture leads"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Leads" value={totalLeads.toLocaleString()} icon={Globe} accent="#6366f1" accentTo="#8b5cf6" />
        <Stat label="Today" value={todayLeads} icon={RefreshCw} accent="#10b981" accentTo="#06b6d4" />
        <Stat label="This Week" value={weekLeads} icon={ExternalLink} accent="#f59e0b" accentTo="#f43f5e" />
        <Stat label="Connected Sources" value={`${connected}/${SOURCES.length}`} icon={Check} accent="#ec4899" accentTo="#8b5cf6" />
      </div>

      {configs.length === 0 && stats.length === 0 ? (
        <div className="space-y-4">
          {SOURCES.map((source) => (
            <SourceCard
              key={source.provider}
              source={source}
              config={null}
              stats={null}
              onSave={handleSave}
              onSync={handleSync}
              isSaving={isSaving}
              isSyncing={isSyncing}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {SOURCES.map((source) => (
            <SourceCard
              key={source.provider}
              source={source}
              config={getConfigForProvider(source.provider)}
              stats={getStatsForProvider(source.provider)}
              onSave={handleSave}
              onSync={handleSync}
              isSaving={isSaving}
              isSyncing={isSyncing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
