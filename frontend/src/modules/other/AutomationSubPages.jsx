import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Zap, Play, Pause, Clock, CheckCircle, XCircle, AlertTriangle,
  ArrowRight, Filter, Search, RotateCcw
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

// ==================== AUTOMATION TEMPLATES PAGE ====================
export function AutomationTemplatesPage() {
  const navigate = useNavigate();

  const templates = [
    { id: 'tpl-welcome', name: 'Welcome Series', description: 'Send a welcome email sequence to new leads', category: 'Onboarding', uses: 234, color: '#6366f1' },
    { id: 'tpl-nurture', name: 'Lead Nurture', description: 'Drip campaign to nurture cold leads over time', category: 'Marketing', uses: 189, color: '#10b981' },
    { id: 'tpl-abandoned', name: 'Abandoned Cart', description: 'Re-engage users who left without purchasing', category: 'E-commerce', uses: 312, color: '#f59e0b' },
    { id: 'tpl-reengagement', name: 'Re-engagement', description: 'Win back inactive contacts with special offers', category: 'Retention', uses: 145, color: '#ef4444' },
    { id: 'tpl-feedback', name: 'Feedback Collection', description: 'Automated post-interaction feedback surveys', category: 'Surveys', uses: 98, color: '#8b5cf6' },
    { id: 'tpl-onboarding', name: 'Client Onboarding', description: 'Step-by-step onboarding workflow for new clients', category: 'Onboarding', uses: 176, color: '#ec4899' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Workflow Templates</h1>
        <p className="text-sm text-slate-500">Start with a pre-built automation template</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <div key={t.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: t.color + '20' }}>
                <Zap className="w-5 h-5" style={{ color: t.color }} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-white">{t.name}</h3>
                <span className="text-xs text-slate-500">{t.category}</span>
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-4">{t.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{t.uses} uses</span>
              <button
                onClick={() => navigate(`/automation/builder?template=${t.id}`)}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                Use Template <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== TRIGGERS PAGE ====================
export function TriggersPage() {
  const { can } = usePermissions();
  const canUpdate = can('campaigns', 'update');

  const [triggers, setTriggers] = useState([
    { id: 1, name: 'New Lead Created', event: 'lead.created', action: 'Start Welcome Series', status: true, lastFired: '2 min ago' },
    { id: 2, name: 'Form Submitted', event: 'form.submitted', action: 'Send Confirmation Email', status: true, lastFired: '15 min ago' },
    { id: 3, name: 'Deal Won', event: 'deal.won', action: 'Start Onboarding Flow', status: true, lastFired: '1 hour ago' },
    { id: 4, name: 'Call Completed', event: 'call.completed', action: 'Send Follow-up SMS', status: false, lastFired: '3 hours ago' },
    { id: 5, name: 'Tag Added: Hot Lead', event: 'tag.added', action: 'Assign to Senior Agent', status: true, lastFired: '30 min ago' },
    { id: 6, name: 'Appointment No-Show', event: 'appointment.noshow', action: 'Send Reschedule Link', status: false, lastFired: '1 day ago' },
  ]);

  const toggleTrigger = (id) => {
    setTriggers(prev => prev.map(t => {
      if (t.id === id) {
        toast.success(t.status ? `"${t.name}" disabled` : `"${t.name}" enabled`);
        return { ...t, status: !t.status };
      }
      return t;
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Triggers</h1>
        <p className="text-sm text-slate-500">Manage event-based automation triggers</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Trigger</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Event</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Action</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Last Fired</th>
              <th className="py-3 px-4 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {triggers.map(t => (
              <tr key={t.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{t.name}</td>
                <td className="py-3 px-4"><code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">{t.event}</code></td>
                <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{t.action}</td>
                <td className="py-3 px-4 text-sm text-slate-500">{t.lastFired}</td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => canUpdate && toggleTrigger(t.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${t.status ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'} ${!canUpdate ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${t.status ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== AUTOMATION LOGS PAGE ====================
export function AutomationLogsPage() {
  const [filter, setFilter] = useState('all');

  const logs = [
    { id: 1, timestamp: '2026-02-25 14:32:18', workflow: 'Welcome Series', trigger: 'lead.created', status: 'success', duration: '1.2s' },
    { id: 2, timestamp: '2026-02-25 14:30:05', workflow: 'Lead Nurture', trigger: 'tag.added', status: 'success', duration: '0.8s' },
    { id: 3, timestamp: '2026-02-25 14:28:41', workflow: 'Abandoned Cart', trigger: 'cart.abandoned', status: 'failed', duration: '3.4s' },
    { id: 4, timestamp: '2026-02-25 14:25:12', workflow: 'Welcome Series', trigger: 'lead.created', status: 'success', duration: '1.1s' },
    { id: 5, timestamp: '2026-02-25 14:22:09', workflow: 'Feedback Collection', trigger: 'call.completed', status: 'success', duration: '0.6s' },
    { id: 6, timestamp: '2026-02-25 14:18:33', workflow: 'Re-engagement', trigger: 'contact.inactive', status: 'skipped', duration: '0.3s' },
    { id: 7, timestamp: '2026-02-25 14:15:47', workflow: 'Client Onboarding', trigger: 'deal.won', status: 'success', duration: '2.1s' },
    { id: 8, timestamp: '2026-02-25 14:10:22', workflow: 'Lead Nurture', trigger: 'form.submitted', status: 'failed', duration: '5.0s' },
  ];

  const statusIcons = {
    success: <CheckCircle className="w-4 h-4 text-emerald-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
    skipped: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  };

  const statusColors = {
    success: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
    skipped: 'bg-amber-100 text-amber-700',
  };

  const filtered = filter === 'all' ? logs : logs.filter(l => l.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Execution Logs</h1>
          <p className="text-sm text-slate-500">Monitor automation execution history</p>
        </div>
        <button onClick={() => toast.success('Logs refreshed')} className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
          <RotateCcw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'success', 'failed', 'skipped'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${filter === f ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full min-w-[650px]">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Timestamp</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Workflow</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Trigger</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Duration</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="py-3 px-4 text-sm text-slate-500 font-mono">{l.timestamp}</td>
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{l.workflow}</td>
                <td className="py-3 px-4"><code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">{l.trigger}</code></td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusColors[l.status]}`}>
                    {statusIcons[l.status]} {l.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{l.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
