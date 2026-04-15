import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { analyticsAPI } from '../../services/api';
import { Zap, RotateCcw } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import {
  Card, CardHeader, CardBody,
  Button, PageHeader, DataTable,
  Badge, Toggle, Segmented,
} from '../../components/ui/primitives';

// ==================== AUTOMATION TEMPLATES PAGE ====================
export function AutomationTemplatesPage() {
  const navigate = useNavigate();

  const templates = [
    { id: 'tpl-welcome',      name: 'Welcome Series',      description: 'Send a welcome email sequence to new leads',            category: 'Onboarding', uses: 234, color: '#6366f1' },
    { id: 'tpl-nurture',      name: 'Lead Nurture',         description: 'Drip campaign to nurture cold leads over time',          category: 'Marketing',  uses: 189, color: '#10b981' },
    { id: 'tpl-abandoned',    name: 'Abandoned Cart',       description: 'Re-engage users who left without purchasing',            category: 'E-commerce', uses: 312, color: '#f59e0b' },
    { id: 'tpl-reengagement', name: 'Re-engagement',        description: 'Win back inactive contacts with special offers',         category: 'Retention',  uses: 145, color: '#ef4444' },
    { id: 'tpl-feedback',     name: 'Feedback Collection',  description: 'Automated post-interaction feedback surveys',            category: 'Surveys',    uses: 98,  color: '#8b5cf6' },
    { id: 'tpl-onboarding',   name: 'Client Onboarding',    description: 'Step-by-step onboarding workflow for new clients',       category: 'Onboarding', uses: 176, color: '#ec4899' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow Templates"
        subtitle="Start with a pre-built automation template"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <Card key={t.id} hover>
            <CardBody>
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: t.color + '20' }}
                >
                  <Zap className="w-5 h-5" style={{ color: t.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{t.name}</h3>
                  <span className="text-xs text-slate-500">{t.category}</span>
                </div>
              </div>

              <p className="text-sm text-slate-500 mb-4">{t.description}</p>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{t.uses} uses</span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/automation/builder?template=${t.id}`)}
                >
                  Use Template
                </Button>
              </div>
            </CardBody>
          </Card>
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
    { id: 1, name: 'New Lead Created',    event: 'lead.created',          action: 'Start Welcome Series',    status: true,  lastFired: '2 min ago'   },
    { id: 2, name: 'Form Submitted',       event: 'form.submitted',         action: 'Send Confirmation Email', status: true,  lastFired: '15 min ago'  },
    { id: 3, name: 'Deal Won',             event: 'deal.won',               action: 'Start Onboarding Flow',   status: true,  lastFired: '1 hour ago'  },
    { id: 4, name: 'Call Completed',       event: 'call.completed',         action: 'Send Follow-up SMS',      status: false, lastFired: '3 hours ago' },
    { id: 5, name: 'Tag Added: Hot Lead',  event: 'tag.added',              action: 'Assign to Senior Agent',  status: true,  lastFired: '30 min ago'  },
    { id: 6, name: 'Appointment No-Show',  event: 'appointment.noshow',     action: 'Send Reschedule Link',    status: false, lastFired: '1 day ago'   },
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

  const triggerColumns = [
    {
      key: 'name',
      header: 'Trigger',
      render: (row) => (
        <span className="font-medium text-slate-900 dark:text-white">{row.name}</span>
      ),
    },
    {
      key: 'event',
      header: 'Event',
      render: (row) => (
        <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
          {row.event}
        </code>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">{row.action}</span>
      ),
    },
    {
      key: 'lastFired',
      header: 'Last Fired',
      render: (row) => (
        <span className="text-sm text-slate-500">{row.lastFired}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <div className={`flex justify-center ${!canUpdate ? 'opacity-50 pointer-events-none' : ''}`}>
          <Toggle
            checked={row.status}
            onChange={() => canUpdate && toggleTrigger(row.id)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Triggers"
        subtitle="Manage event-based automation triggers"
      />

      <Card>
        <DataTable columns={triggerColumns} rows={triggers} />
      </Card>
    </div>
  );
}

// ==================== AUTOMATION LOGS PAGE ====================
export function AutomationLogsPage() {
  const [filter, setFilter] = useState('all');

  const logs = [
    { id: 1, timestamp: '2026-02-25 14:32:18', workflow: 'Welcome Series',      trigger: 'lead.created',     status: 'success', duration: '1.2s' },
    { id: 2, timestamp: '2026-02-25 14:30:05', workflow: 'Lead Nurture',         trigger: 'tag.added',        status: 'success', duration: '0.8s' },
    { id: 3, timestamp: '2026-02-25 14:28:41', workflow: 'Abandoned Cart',       trigger: 'cart.abandoned',   status: 'failed',  duration: '3.4s' },
    { id: 4, timestamp: '2026-02-25 14:25:12', workflow: 'Welcome Series',       trigger: 'lead.created',     status: 'success', duration: '1.1s' },
    { id: 5, timestamp: '2026-02-25 14:22:09', workflow: 'Feedback Collection',  trigger: 'call.completed',   status: 'success', duration: '0.6s' },
    { id: 6, timestamp: '2026-02-25 14:18:33', workflow: 'Re-engagement',        trigger: 'contact.inactive', status: 'skipped', duration: '0.3s' },
    { id: 7, timestamp: '2026-02-25 14:15:47', workflow: 'Client Onboarding',    trigger: 'deal.won',         status: 'success', duration: '2.1s' },
    { id: 8, timestamp: '2026-02-25 14:10:22', workflow: 'Lead Nurture',         trigger: 'form.submitted',   status: 'failed',  duration: '5.0s' },
  ];

  const statusTone = {
    success: 'success',
    failed:  'danger',
    skipped: 'warning',
  };

  const filterOptions = [
    { value: 'all',     label: 'All'     },
    { value: 'success', label: 'Success' },
    { value: 'failed',  label: 'Failed'  },
    { value: 'skipped', label: 'Skipped' },
  ];

  const filtered = filter === 'all' ? logs : logs.filter(l => l.status === filter);

  const logColumns = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (row) => (
        <span className="text-sm text-slate-500 font-mono">{row.timestamp}</span>
      ),
    },
    {
      key: 'workflow',
      header: 'Workflow',
      render: (row) => (
        <span className="font-medium text-slate-900 dark:text-white">{row.workflow}</span>
      ),
    },
    {
      key: 'trigger',
      header: 'Trigger',
      render: (row) => (
        <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
          {row.trigger}
        </code>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={statusTone[row.status]} dot>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (row) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">{row.duration}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Execution Logs"
        subtitle="Monitor automation execution history"
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={RotateCcw}
            onClick={() => toast.success('Logs refreshed')}
          >
            Refresh
          </Button>
        }
      />

      <Segmented
        options={filterOptions}
        value={filter}
        onChange={setFilter}
      />

      <Card>
        <DataTable columns={logColumns} rows={filtered} />
      </Card>
    </div>
  );
}
