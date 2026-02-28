/**
 * Lead Sources Integration Page
 * Configure IndiaMart, JustDial, and Facebook Lead Ads integrations.
 */

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { usePermissions } from '../../hooks/usePermissions';
import {
  Settings, RefreshCw, Check, X, ExternalLink, Copy, Shield, Activity,
  TrendingUp, AlertCircle, Loader2
} from 'lucide-react';

// Mock fallback data for when API is unavailable
const MOCK_CONFIGS = [];
const MOCK_STATS = [
  { source: 'indiamart', total: 0, today: 0, this_week: 0, this_month: 0 },
  { source: 'justdial', total: 0, today: 0, this_week: 0, this_month: 0 },
  { source: 'facebook_leads', total: 0, today: 0, this_week: 0, this_month: 0 },
];

const SOURCES = [
  {
    provider: 'indiamart',
    name: 'IndiaMart',
    description: 'B2B marketplace lead capture via CRM API polling',
    color: 'bg-blue-500',
    textColor: 'text-blue-600',
    bgLight: 'bg-blue-50 dark:bg-blue-900/20',
    fields: [
      { key: 'api_key', label: 'CRM API Key', placeholder: 'Your IndiaMart CRM API Key', type: 'password' },
    ],
    webhookUrl: null,
    helpText: 'Get your CRM API key from IndiaMart seller dashboard → Lead Manager → API Settings',
  },
  {
    provider: 'justdial',
    name: 'JustDial',
    description: 'Local business listing leads via webhook',
    color: 'bg-orange-500',
    textColor: 'text-orange-600',
    bgLight: 'bg-orange-50 dark:bg-orange-900/20',
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
    color: 'bg-indigo-500',
    textColor: 'text-indigo-600',
    bgLight: 'bg-indigo-50 dark:bg-indigo-900/20',
    fields: [
      { key: 'api_key', label: 'Page Access Token', placeholder: 'Meta Page Access Token', type: 'password' },
      { key: 'page_id', label: 'Facebook Page ID', placeholder: 'e.g. 123456789', type: 'text' },
      { key: 'app_secret', label: 'App Secret (for HMAC)', placeholder: 'Meta App Secret', type: 'password' },
    ],
    webhookUrl: '/api/v1/lead-sources/facebook/webhook',
    helpText: 'Configure the webhook URL in Meta Developer Console → Webhooks → Lead Ads',
  },
];

function StatBadge({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function SourceCard({ source, config, stats, onSave, onSync, isSaving, isSyncing }) {
  const { can } = usePermissions();
  const canWrite = can('integrations', 'create') || can('crm', 'create');
  const [expanded, setExpanded] = useState(false);
  const [formData, setFormData] = useState(() => {
    const initial = { is_active: config?.is_active ?? true, auto_assign: false, default_tags: '' };
    source.fields.forEach(f => { initial[f.key] = ''; });
    if (config?.page_id) initial.page_id = config.page_id;
    return initial;
  });

  const isConfigured = !!config;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleSave = () => {
    const payload = { provider: source.provider, ...formData };
    if (payload.default_tags && typeof payload.default_tags === 'string') {
      payload.default_tags = payload.default_tags.split(',').map(t => t.trim()).filter(Boolean);
    } else {
      delete payload.default_tags;
    }
    // Remove empty string fields
    Object.keys(payload).forEach(k => {
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
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${source.color} flex items-center justify-center`}>
            <ExternalLink className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">{source.name}</h3>
            <p className="text-xs text-slate-500">{source.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConfigured ? (
            <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <Check className="w-3 h-3" /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
              Not configured
            </span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className={`px-5 py-3 ${source.bgLight} border-t border-slate-100 dark:border-slate-700 grid grid-cols-4 gap-4`}>
          <StatBadge label="Total" value={stats.total} />
          <StatBadge label="Today" value={stats.today} />
          <StatBadge label="This Week" value={stats.this_week} />
          <StatBadge label="This Month" value={stats.this_month} />
        </div>
      )}

      {/* Config sync info */}
      {isConfigured && (
        <div className="px-5 py-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>Ingested: <strong className="text-slate-700 dark:text-slate-300">{config.total_ingested}</strong></span>
            <span>Duplicates: <strong>{config.total_duplicates}</strong></span>
            <span>Errors: <strong className={config.total_errors > 0 ? 'text-red-500' : ''}>{config.total_errors}</strong></span>
          </div>
          {config.last_sync_at && (
            <span>Last sync: {new Date(config.last_sync_at).toLocaleString()}</span>
          )}
        </div>
      )}

      {/* Sync button for IndiaMart */}
      {isConfigured && source.provider === 'indiamart' && canWrite && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}

      {/* Expanded config form */}
      {expanded && (
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
          {/* Webhook URL display */}
          {source.webhookUrl && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Webhook URL</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 truncate">
                  {baseUrl}{source.webhookUrl}
                </code>
                <button onClick={copyWebhookUrl} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  <Copy className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
          )}

          {/* Dynamic fields */}
          {source.fields.map(field => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-slate-500 mb-1">{field.label}</label>
              <input
                type={field.type}
                placeholder={field.placeholder}
                value={formData[field.key] || ''}
                onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
              />
            </div>
          ))}

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700 dark:text-slate-300">Active</span>
            <button
              onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
              className={`w-10 h-6 rounded-full transition-colors ${formData.is_active ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform mx-1 mt-1 ${formData.is_active ? 'translate-x-4' : ''}`} />
            </button>
          </div>

          {/* Default tags */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Default Tags (comma-separated)</label>
            <input
              type="text"
              placeholder="e.g. indiamart, hot-lead"
              value={formData.default_tags || ''}
              onChange={e => setFormData(prev => ({ ...prev, default_tags: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            />
          </div>

          {/* Help text */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">{source.helpText}</p>
          </div>

          {/* Save button */}
          {canWrite && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
            >
              {isSaving ? 'Saving...' : isConfigured ? 'Update Configuration' : 'Save Configuration'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function LeadSourcesPage() {
  // Try to use real hooks, fall back to mock data
  let configs = MOCK_CONFIGS;
  let stats = MOCK_STATS;
  let createConfig = null;
  let pollIndiamart = null;
  let isSaving = false;
  let isSyncing = false;

  try {
    const { useLeadSourceConfigs, useLeadSourceStats, useCreateLeadSourceConfig, usePollIndiamart } = require('../../hooks/api');
    const configsQuery = useLeadSourceConfigs();
    const statsQuery = useLeadSourceStats();
    const createMutation = useCreateLeadSourceConfig();
    const pollMutation = usePollIndiamart();

    if (configsQuery.data) configs = configsQuery.data;
    if (statsQuery.data) stats = statsQuery.data;
    createConfig = createMutation.mutateAsync;
    pollIndiamart = pollMutation.mutateAsync;
    isSaving = createMutation.isPending;
    isSyncing = pollMutation.isPending;
  } catch {
    // Hooks not available, use mock data
  }

  const handleSave = async (payload) => {
    try {
      if (createConfig) {
        await createConfig(payload);
        toast.success(`${payload.provider} configuration saved!`);
      } else {
        toast.success(`${payload.provider} configuration saved (demo mode)`);
      }
    } catch (err) {
      toast.error('Failed to save configuration');
    }
  };

  const handleSync = async () => {
    try {
      if (pollIndiamart) {
        const result = await pollIndiamart();
        toast.success(`Sync complete: ${result.ingested} new leads, ${result.duplicates} duplicates`);
      } else {
        toast.success('Sync triggered (demo mode)');
      }
    } catch (err) {
      toast.error('Sync failed');
    }
  };

  const getConfigForProvider = (provider) => configs.find(c => c.provider === provider);
  const getStatsForProvider = (provider) => stats.find(s => s.source === provider);

  const totalLeads = stats.reduce((sum, s) => sum + s.total, 0);
  const todayLeads = stats.reduce((sum, s) => sum + s.today, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Lead Sources</h1>
          <p className="text-sm text-slate-500 mt-1">Configure IndiaMart, JustDial, and Facebook Lead Ads integrations</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalLeads}</p>
            <p className="text-xs text-slate-500">Total Leads</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-600">{todayLeads}</p>
            <p className="text-xs text-slate-500">Today</p>
          </div>
        </div>
      </div>

      {/* Source Cards */}
      <div className="space-y-4">
        {SOURCES.map(source => (
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
    </div>
  );
}
