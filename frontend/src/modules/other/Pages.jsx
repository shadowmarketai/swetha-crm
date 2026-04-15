/**
 * Module Dashboard Pages — Automation, Reports
 * Only AutomationDashboard and ReportsDashboard are used by App.jsx routes.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Plus, Zap, Play, Pause, Edit, CheckCircle, AlertTriangle,
  Download, BarChart3, TrendingUp, DollarSign, Phone, Users, Target, Bot,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { usePermissions } from '../../hooks/usePermissions';
import {
  Card, CardHeader, CardBody, Stat, Button, PageHeader, Badge,
  Modal, Field, Input, Select,
} from '../../components/ui/primitives';

// ==================== AUTOMATION DASHBOARD ====================
export function AutomationDashboard() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canCreate = can('campaigns', 'create');
  const canUpdate = can('campaigns', 'update');

  const [showModal, setShowModal] = useState(false);
  const [workflowForm, setWorkflowForm] = useState({ name: '', trigger: 'new-lead', action: 'voice-call' });
  const [workflows, setWorkflows] = useState([
    { id: 1, name: 'New Lead → Voice AI Call', description: 'Auto-call new leads within 5 minutes', status: 'active', executions: '2,847', success: 94 },
    { id: 2, name: 'Meeting Booked → Confirmation', description: 'Send WhatsApp + Email after booking', status: 'active', executions: '892', success: 99 },
    { id: 3, name: 'Deal Won → Onboarding', description: 'Trigger onboarding workflow', status: 'paused', executions: '156', success: 87 },
  ]);

  const handleCreateWorkflow = () => {
    if (!workflowForm.name.trim()) {
      toast.error('Workflow name is required');
      return;
    }
    toast.success(`Workflow "${workflowForm.name}" created`);
    setWorkflowForm({ name: '', trigger: 'new-lead', action: 'voice-call' });
    setShowModal(false);
  };

  const toggleWorkflow = (id) => {
    setWorkflows(prev => prev.map(wf => {
      if (wf.id === id) {
        const newStatus = wf.status === 'active' ? 'paused' : 'active';
        toast.success(`"${wf.name}" ${newStatus === 'active' ? 'activated' : 'paused'}`);
        return { ...wf, status: newStatus };
      }
      return wf;
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation"
        subtitle="Build workflows to automate your business"
        actions={
          canCreate && (
            <Button leftIcon={Plus} onClick={() => navigate('/automation/builder')}>New Workflow</Button>
          )
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Active Workflows" value="12" icon={Zap} accent="#6366f1" />
        <Stat label="Executions Today" value="1,284" icon={Play} accent="#10b981" />
        <Stat label="Success Rate" value="98.2%" icon={CheckCircle} accent="#3b82f6" />
        <Stat label="Failed Today" value="23" icon={AlertTriangle} accent="#ef4444" />
      </div>

      <div className="space-y-4">
        {workflows.map(wf => (
          <Card key={wf.id} hover>
            <CardBody>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{wf.name}</h3>
                    <p className="text-sm text-slate-500">{wf.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="text-right">
                    <p className="font-medium text-slate-900 dark:text-white">{wf.executions}</p>
                    <p className="text-xs text-slate-500">executions</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-emerald-600">{wf.success}%</p>
                    <p className="text-xs text-slate-500">success</p>
                  </div>
                  <Badge tone={wf.status === 'active' ? 'success' : 'warning'} dot>{wf.status}</Badge>
                  <div className="flex items-center gap-1">
                    {canUpdate && (
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/automation/builder/${wf.id}`)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {canUpdate && (wf.status === 'active' ? (
                      <Button variant="ghost" size="icon" onClick={() => toggleWorkflow(wf.id)}>
                        <Pause className="w-4 h-4 text-amber-500" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => toggleWorkflow(wf.id)}>
                        <Play className="w-4 h-4 text-emerald-500" />
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="New Workflow"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleCreateWorkflow}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Workflow Name" required>
            <Input value={workflowForm.name} onChange={e => setWorkflowForm({ ...workflowForm, name: e.target.value })} placeholder="e.g. Lead Follow-up" />
          </Field>
          <Field label="Trigger">
            <Select value={workflowForm.trigger} onChange={e => setWorkflowForm({ ...workflowForm, trigger: e.target.value })} className="w-full">
              <option value="new-lead">New Lead Created</option>
              <option value="meeting-booked">Meeting Booked</option>
              <option value="deal-won">Deal Won</option>
              <option value="form-submitted">Form Submitted</option>
            </Select>
          </Field>
          <Field label="Action">
            <Select value={workflowForm.action} onChange={e => setWorkflowForm({ ...workflowForm, action: e.target.value })} className="w-full">
              <option value="voice-call">Voice AI Call</option>
              <option value="whatsapp">Send WhatsApp</option>
              <option value="email">Send Email</option>
              <option value="sms">Send SMS</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

// ==================== REPORTS DASHBOARD ====================
export function ReportsDashboard() {
  const [period, setPeriod] = useState('30d');

  const revenueData = [
    { month: 'Sep', revenue: 1450000 }, { month: 'Oct', revenue: 1680000 },
    { month: 'Nov', revenue: 1920000 }, { month: 'Dec', revenue: 2080000 },
    { month: 'Jan', revenue: 2280000 }, { month: 'Feb', revenue: 2450000 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Cross-platform business intelligence"
        actions={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={period} onChange={e => { setPeriod(e.target.value); toast.success(`Period changed to ${e.target.value === '30d' ? 'Last 30 Days' : e.target.value === '90d' ? 'Last 90 Days' : 'This Year'}`); }}>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="year">This Year</option>
            </Select>
            <Button leftIcon={Download} onClick={() => toast.success('Report exported')}>Export</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total Revenue" value="₹24.5L" change="+18%" changeType="up" icon={DollarSign} accent="#10b981" />
        <Stat label="New Leads" value="2,847" change="+12%" changeType="up" icon={Users} accent="#6366f1" />
        <Stat label="AI Calls Made" value="8,934" change="+32%" changeType="up" icon={Phone} accent="#3b82f6" />
        <Stat label="Conversion Rate" value="24.8%" change="+3.2%" changeType="up" icon={Target} accent="#f59e0b" />
      </div>

      <Card>
        <CardHeader title="Revenue Trend" />
        <CardBody>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${v/100000}L`} />
                <Tooltip formatter={(v) => [`₹${(v/100000).toFixed(1)}L`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
