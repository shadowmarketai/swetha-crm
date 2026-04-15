import React, { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { settingsAPI, integrationsAPI } from '../../services/api'
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Select,
  Textarea,
  Field,
  Badge,
  PageHeader,
  EmptyState,
  Modal,
  SearchInput,
  Segmented,
} from '../../components/ui/primitives'
import {
  Settings,
  Search,
  Plus,
  X,
  Check,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Upload,
  Download,
  Bell,
  Shield,
  Database,
  Users,
  Mail,
  Phone,
  MessageSquare,
  Zap,
  CreditCard,
  BarChart3,
  Globe,
  Link,
  Save,
  Trash2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Shared Toggle component (gradient style)
// ---------------------------------------------------------------------------
function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
      <div className="pr-4">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
        {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${
          checked
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_4px_12px_-2px_rgba(16,185,129,0.5)]'
            : 'bg-slate-300 dark:bg-slate-700'
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  )
}

// ===========================================================================
//  CRM SETTINGS PAGE
// ===========================================================================

const settingsTabs = [
  { id: 'general', name: 'General', icon: Settings },
  { id: 'leads', name: 'Lead Settings', icon: Users },
  { id: 'deals', name: 'Deal Settings', icon: BarChart3 },
  { id: 'notifications', name: 'Notifications', icon: Bell },
  { id: 'data', name: 'Data Management', icon: Database },
]

// ---- General Tab ----
function GeneralTab() {
  const [form, setForm] = useState({
    crmName: 'Sales CRM',
    currency: 'INR',
    dateFormat: 'DD/MM/YYYY',
    timezone: 'Asia/Kolkata',
    defaultOwner: 'Arun',
    autoAssign: true,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsAPI.update({ section: 'crm_general', ...form })
    } catch {}
    setSaving(false)
    setSaved(true)
    toast.success('General settings saved!')
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <Card>
      <CardHeader title="General Settings" subtitle="Core CRM preferences" />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="CRM Name">
            <Input
              type="text"
              value={form.crmName}
              onChange={e => setForm(f => ({ ...f, crmName: e.target.value }))}
            />
          </Field>
          <Field label="Default Currency">
            <Select
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
            >
              {['INR', 'USD', 'EUR', 'GBP'].map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Date Format">
            <Select
              value={form.dateFormat}
              onChange={e => setForm(f => ({ ...f, dateFormat: e.target.value }))}
            >
              {['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Time Zone">
            <Select
              value={form.timezone}
              onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
            >
              {['Asia/Kolkata', 'US/Eastern', 'US/Pacific', 'Europe/London'].map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Default Lead Owner">
            <Select
              value={form.defaultOwner}
              onChange={e => setForm(f => ({ ...f, defaultOwner: e.target.value }))}
            >
              {['Arun', 'Meera', 'Kavya'].map(n => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field>
          <div className="flex items-end">
            <div className="w-full">
              <Toggle
                checked={form.autoAssign}
                onChange={v => setForm(f => ({ ...f, autoAssign: v }))}
                label="Auto-assign leads"
                description="Automatically assign new leads to team members"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="primary"
            leftIcon={saved ? Check : Save}
          >
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ---- Lead Settings Tab ----
function LeadSettingsTab() {
  const [defaultStatus, setDefaultStatus] = useState('new')
  const [leadScoring, setLeadScoring] = useState(true)
  const [scoringRules, setScoringRules] = useState([
    { id: 1, name: 'Website visit', score: 5 },
    { id: 2, name: 'Email opened', score: 10 },
    { id: 3, name: 'Form submitted', score: 20 },
    { id: 4, name: 'Meeting scheduled', score: 30 },
    { id: 5, name: 'Demo completed', score: 40 },
  ])
  const [convertThreshold, setConvertThreshold] = useState(80)
  const [leadRotation, setLeadRotation] = useState(true)
  const [rotationMethod, setRotationMethod] = useState('Round Robin')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const updateScore = (id, newScore) => {
    setScoringRules(rules => rules.map(r => r.id === id ? { ...r, score: Number(newScore) } : r))
  }

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      toast.success('Lead settings saved!')
      setTimeout(() => setSaved(false), 2500)
    }, 600)
  }

  return (
    <Card>
      <CardHeader title="Lead Settings" subtitle="Status, scoring and assignment rules" />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Default Lead Status">
            <Select value={defaultStatus} onChange={e => setDefaultStatus(e.target.value)}>
              {['new', 'contacted', 'qualified', 'nurturing'].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Lead Scoring */}
        <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-6 mt-6">
          <Toggle
            checked={leadScoring}
            onChange={setLeadScoring}
            label="Lead Scoring"
            description="Assign scores to leads based on their engagement"
          />

          {leadScoring && (
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Scoring Rules</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-slate-500 dark:text-slate-400">Activity</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-500 dark:text-slate-400">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoringRules.map(rule => (
                      <tr key={rule.id} className="border-t border-slate-100 dark:border-slate-700/40">
                        <td className="py-2 px-3 text-slate-800 dark:text-slate-200">{rule.name}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">+</span>
                            <Input
                              type="number"
                              className="w-20 text-center"
                              value={rule.score}
                              min={0}
                              max={100}
                              onChange={e => updateScore(rule.id, e.target.value)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 max-w-xs">
                <Field label="Auto-convert to deal at score threshold">
                  <Input
                    type="number"
                    value={convertThreshold}
                    min={0}
                    max={200}
                    onChange={e => setConvertThreshold(Number(e.target.value))}
                  />
                </Field>
              </div>
            </div>
          )}
        </div>

        {/* Lead Rotation */}
        <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-6 mt-6">
          <Toggle
            checked={leadRotation}
            onChange={setLeadRotation}
            label="Lead Rotation"
            description="Automatically distribute leads among team members"
          />
          {leadRotation && (
            <div className="mt-3 max-w-xs">
              <Field label="Rotation Method">
                <Select value={rotationMethod} onChange={e => setRotationMethod(e.target.value)}>
                  {['Round Robin', 'Weighted', 'Manual'].map(m => <option key={m} value={m}>{m}</option>)}
                </Select>
              </Field>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="primary"
            leftIcon={saved ? Check : Users}
          >
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ---- Deal Settings Tab ----
const STAGE_COLORS = ['#6366f1', '#f59e0b', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

function DealSettingsTab() {
  const [stages, setStages] = useState([
    { id: 1, name: 'Qualification', color: '#6366f1', probability: 20 },
    { id: 2, name: 'Proposal', color: '#f59e0b', probability: 40 },
    { id: 3, name: 'Negotiation', color: '#3b82f6', probability: 60 },
    { id: 4, name: 'Closed Won', color: '#22c55e', probability: 100 },
    { id: 5, name: 'Closed Lost', color: '#ef4444', probability: 0 },
  ])
  const [winThreshold, setWinThreshold] = useState(80)
  const [autoCloseLost, setAutoCloseLost] = useState('90 days')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const updateStage = (id, field, value) => {
    setStages(s => s.map(st => st.id === id ? { ...st, [field]: value } : st))
  }

  const addStage = () => {
    const newId = Math.max(0, ...stages.map(s => s.id)) + 1
    const color = STAGE_COLORS[stages.length % STAGE_COLORS.length]
    setStages(s => [...s, { id: newId, name: 'New Stage', color, probability: 50 }])
  }

  const deleteStage = (id) => {
    if (stages.length <= 2) {
      toast.error('Pipeline must have at least 2 stages')
      return
    }
    setStages(s => s.filter(st => st.id !== id))
  }

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      toast.success('Deal settings saved!')
      setTimeout(() => setSaved(false), 2500)
    }, 600)
  }

  return (
    <Card>
      <CardHeader
        title="Deal Pipeline Stages"
        subtitle="Customize your sales pipeline"
        action={
          <Button onClick={addStage} variant="secondary" size="sm" leftIcon={Plus}>
            Add Stage
          </Button>
        }
      />
      <CardBody>
        <div className="space-y-2">
          {stages.map(stage => (
            <div
              key={stage.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
                style={{ backgroundColor: stage.color }}
              />
              <Input
                type="text"
                className="flex-1"
                value={stage.name}
                onChange={e => updateStage(stage.id, 'name', e.target.value)}
              />
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  className="w-20 text-center"
                  value={stage.probability}
                  min={0}
                  max={100}
                  onChange={e => updateStage(stage.id, 'probability', Number(e.target.value))}
                />
                <span className="text-xs text-slate-400">%</span>
              </div>
              <input
                type="color"
                className="w-9 h-9 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                value={stage.color}
                onChange={e => updateStage(stage.id, 'color', e.target.value)}
              />
              <Button
                onClick={() => deleteStage(stage.id)}
                variant="ghost"
                size="icon"
                aria-label="Delete stage"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-6 mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Win Probability Threshold">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                className="w-24 text-center"
                value={winThreshold}
                min={0}
                max={100}
                onChange={e => setWinThreshold(Number(e.target.value))}
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
          </Field>
          <Field label="Auto-close lost deals after">
            <Select value={autoCloseLost} onChange={e => setAutoCloseLost(e.target.value)}>
              {['30 days', '60 days', '90 days', 'Never'].map(o => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>
        </div>

        <div className="flex justify-end mt-6">
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="primary"
            leftIcon={saved ? Check : BarChart3}
          >
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ---- Notifications Tab ----
function NotificationsTab() {
  const [items, setItems] = useState([
    { id: 'new_lead', label: 'New lead assigned', enabled: true, channel: 'Email' },
    { id: 'deal_stage', label: 'Deal stage changed', enabled: true, channel: 'Both' },
    { id: 'task_overdue', label: 'Task overdue reminder', enabled: true, channel: 'Email' },
    { id: 'meeting_reminder', label: 'Meeting reminder (15 min before)', enabled: true, channel: 'Both' },
    { id: 'weekly_pipeline', label: 'Weekly pipeline summary email', enabled: false, channel: 'Email' },
    { id: 'monthly_report', label: 'Monthly report email', enabled: false, channel: 'Email' },
  ])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const toggleItem = (id) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, enabled: !it.enabled } : it))
  }

  const setChannel = (id, channel) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, channel } : it))
  }

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      toast.success('Notification settings saved!')
      setTimeout(() => setSaved(false), 2500)
    }, 600)
  }

  return (
    <Card>
      <CardHeader title="CRM Notifications" subtitle="Choose how and when you get notified" />
      <CardBody>
        <div className="space-y-1">
          {items.map(item => (
            <div
              key={item.id}
              className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700/40 last:border-0"
            >
              <div className="flex items-center gap-3 flex-1">
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${
                    item.enabled
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_4px_12px_-2px_rgba(16,185,129,0.5)]'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                      item.enabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
                <span
                  className={`text-sm font-medium ${
                    item.enabled ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'
                  }`}
                >
                  {item.label}
                </span>
              </div>
              <div className="w-32">
                <Select
                  value={item.channel}
                  onChange={e => setChannel(item.id, e.target.value)}
                  disabled={!item.enabled}
                >
                  {['Email', 'SMS', 'Both', 'None'].map(ch => <option key={ch} value={ch}>{ch}</option>)}
                </Select>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-6">
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="primary"
            leftIcon={saved ? Check : Bell}
          >
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ---- Data Management Tab ----
function DataManagementTab() {
  const [purgeAge, setPurgeAge] = useState('Older than 1 year')
  const [duplicateDetection, setDuplicateDetection] = useState(true)
  const [backupFrequency, setBackupFrequency] = useState('Weekly')
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleExport = () => {
    toast.success('Exporting CRM data...')
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,.xlsx,.json'
    input.onchange = (e) => {
      const file = e.target.files?.[0]
      if (file) {
        toast.success(`Importing ${file.name}...`)
      }
    }
    input.click()
  }

  const handlePurge = () => {
    if (!confirmPurge) {
      setConfirmPurge(true)
      return
    }
    toast.success(`Purged leads ${purgeAge.toLowerCase()}`)
    setConfirmPurge(false)
  }

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      toast.success('Data management settings saved!')
      setTimeout(() => setSaved(false), 2500)
    }, 600)
  }

  return (
    <Card>
      <CardHeader title="Data Management" subtitle="Backup, import, export and cleanup" />
      <CardBody>
        {/* Export / Import */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardBody>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style={{
                    background: `linear-gradient(135deg, var(--brand-primary), var(--brand-accent))`,
                  }}
                >
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Export CRM Data</p>
                  <p className="text-xs text-slate-500">Download all leads, deals, contacts</p>
                </div>
              </div>
              <Button onClick={handleExport} variant="primary" leftIcon={Download} className="w-full">
                Export All Data
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #14b8a6)',
                  }}
                >
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Import CRM Data</p>
                  <p className="text-xs text-slate-500">Upload CSV, XLSX, or JSON files</p>
                </div>
              </div>
              <Button onClick={handleImport} variant="success" leftIcon={Upload} className="w-full">
                Import Data
              </Button>
            </CardBody>
          </Card>
        </div>

        {/* Purge */}
        <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-6 mt-6">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Purge Old Leads</p>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="min-w-[220px]">
              <Field label="Remove leads">
                <Select
                  value={purgeAge}
                  onChange={e => { setPurgeAge(e.target.value); setConfirmPurge(false) }}
                >
                  {['Older than 6 months', 'Older than 1 year', 'Older than 2 years'].map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button
              onClick={handlePurge}
              variant="danger"
              leftIcon={Trash2}
            >
              {confirmPurge ? 'Confirm Purge' : 'Purge'}
            </Button>
            {confirmPurge && (
              <Button onClick={() => setConfirmPurge(false)} variant="secondary">
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Duplicate Detection & Backup */}
        <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-6 mt-6 space-y-4">
          <Toggle
            checked={duplicateDetection}
            onChange={setDuplicateDetection}
            label="Duplicate Detection"
            description="Automatically detect and flag duplicate contacts and leads"
          />
          <div className="max-w-xs">
            <Field label="Data Backup Frequency">
              <Select value={backupFrequency} onChange={e => setBackupFrequency(e.target.value)}>
                {['Daily', 'Weekly', 'Monthly'].map(f => <option key={f} value={f}>{f}</option>)}
              </Select>
            </Field>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="primary"
            leftIcon={saved ? Check : Database}
          >
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ---------------------------------------------------------------------------
//  CRMSettingsPage - Main Export
// ---------------------------------------------------------------------------
export function CRMSettingsPage() {
  const [activeTab, setActiveTab] = useState('general')

  const renderContent = () => {
    switch (activeTab) {
      case 'general':       return <GeneralTab />
      case 'leads':         return <LeadSettingsTab />
      case 'deals':         return <DealSettingsTab />
      case 'notifications': return <NotificationsTab />
      case 'data':          return <DataManagementTab />
      default:              return <GeneralTab />
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM Settings"
        subtitle="Configure your CRM module preferences"
      />

      {/* Tab Bar — gradient underline */}
      <div className="flex gap-1 border-b border-slate-200/60 dark:border-slate-700/60 overflow-x-auto">
        {settingsTabs.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
              {active && (
                <span
                  className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, var(--brand-primary), var(--brand-accent))`,
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  )
}


// ===========================================================================
//  CRM INTEGRATIONS PAGE
// ===========================================================================

const integrationCategories = ['All', 'CRM Tools', 'Communication', 'Marketing', 'Payments', 'Productivity']

const integrationsList = [
  // CRM Tools
  { id: 'zoho', name: 'Zoho CRM', description: 'Sync contacts, deals & leads with Zoho', category: 'CRM Tools', connected: true, color: '#e74c3c' },
  { id: 'hubspot', name: 'HubSpot', description: 'Import/export data with HubSpot CRM', category: 'CRM Tools', connected: false, color: '#ff7a59' },
  { id: 'salesforce', name: 'Salesforce', description: 'Enterprise CRM sync', category: 'CRM Tools', connected: false, color: '#00a1e0' },
  { id: 'freshsales', name: 'Freshsales', description: 'Sync contacts and deals', category: 'CRM Tools', connected: false, color: '#f26522' },
  // Communication
  { id: 'whatsapp', name: 'WhatsApp Business', description: 'Send messages & templates to leads', category: 'Communication', connected: true, color: '#25d366' },
  { id: 'gmail', name: 'Gmail / Google Workspace', description: 'Sync emails & calendar events', category: 'Communication', connected: false, color: '#ea4335' },
  { id: 'outlook', name: 'Microsoft Outlook', description: 'Email & calendar integration', category: 'Communication', connected: false, color: '#0078d4' },
  { id: 'twilio', name: 'Twilio', description: 'SMS & calling for CRM contacts', category: 'Communication', connected: false, color: '#f22f46' },
  // Marketing
  { id: 'mailchimp', name: 'Mailchimp', description: 'Sync contacts for email campaigns', category: 'Marketing', connected: false, color: '#ffe01b' },
  { id: 'meta_ads', name: 'Meta Ads', description: 'Import leads from Facebook/Instagram ads', category: 'Marketing', connected: true, color: '#1877f2' },
  { id: 'google_ads', name: 'Google Ads', description: 'Import leads from Google campaigns', category: 'Marketing', connected: false, color: '#4285f4' },
  // Payments
  { id: 'razorpay', name: 'Razorpay', description: 'Create payment links for deals', category: 'Payments', connected: true, color: '#528ff0' },
  { id: 'stripe', name: 'Stripe', description: 'Invoice and payment tracking', category: 'Payments', connected: false, color: '#635bff' },
  // Productivity
  { id: 'google_sheets', name: 'Google Sheets', description: 'Export reports to Google Sheets', category: 'Productivity', connected: false, color: '#34a853' },
  { id: 'slack', name: 'Slack', description: 'CRM notifications in Slack channels', category: 'Productivity', connected: false, color: '#4a154b' },
  { id: 'zapier', name: 'Zapier', description: 'Connect with 5000+ apps', category: 'Productivity', connected: false, color: '#ff4a00' },
]

function IntegrationConfigModal({ integration, onClose, onSave }) {
  const [config, setConfig] = useState({
    apiKey: '',
    webhookUrl: '',
    syncDirection: 'Bi-directional',
    syncFrequency: 'Hourly',
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const handleTest = () => {
    setTesting(true)
    setTestResult(null)
    setTimeout(() => {
      setTesting(false)
      setTestResult('success')
      toast.success(`Connection to ${integration.name} successful!`)
    }, 1200)
  }

  const handleSave = () => {
    onSave(config)
    toast.success(`${integration.name} settings saved!`)
    onClose()
  }

  return (
    <Modal
      open={!!integration}
      onClose={onClose}
      title={`${integration.name} Settings`}
      size="md"
      footer={
        <div className="flex items-center gap-3 w-full">
          <Button
            onClick={handleTest}
            disabled={testing}
            variant="secondary"
            leftIcon={testing ? RefreshCw : Zap}
            className="flex-1"
          >
            {testing ? 'Testing...' : testResult === 'success' ? 'Connection OK' : 'Test Connection'}
          </Button>
          <Button onClick={handleSave} variant="primary" leftIcon={Check} className="flex-1">
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ backgroundColor: integration.color }}
          >
            {integration.name[0]}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{integration.description}</p>
        </div>

        <Field label="API Key" required>
          <Input
            type="text"
            placeholder="Enter API key"
            value={config.apiKey}
            onChange={e => setConfig(c => ({ ...c, apiKey: e.target.value }))}
          />
        </Field>
        <Field label="Webhook URL">
          <Input
            type="url"
            placeholder="https://your-server.com/webhook"
            value={config.webhookUrl}
            onChange={e => setConfig(c => ({ ...c, webhookUrl: e.target.value }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Sync Direction">
            <Select
              value={config.syncDirection}
              onChange={e => setConfig(c => ({ ...c, syncDirection: e.target.value }))}
            >
              {['One-way to CRM', 'One-way from CRM', 'Bi-directional'].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
          </Field>
          <Field label="Sync Frequency">
            <Select
              value={config.syncFrequency}
              onChange={e => setConfig(c => ({ ...c, syncFrequency: e.target.value }))}
            >
              {['Real-time', 'Every 15 min', 'Hourly', 'Daily'].map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="text-xs text-slate-400">
          Last Synced: {new Date().toLocaleString()}
        </div>
      </div>
    </Modal>
  )
}

export function CRMIntegrationsPage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [connectionState, setConnectionState] = useState(
    Object.fromEntries(integrationsList.map(i => [i.id, i.connected]))
  )
  const [acting, setActing] = useState({})
  const [configModal, setConfigModal] = useState(null) // integration object or null

  const filteredIntegrations = useMemo(() => {
    return integrationsList.filter(i => {
      const matchCategory = activeCategory === 'All' || i.category === activeCategory
      const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase())
      return matchCategory && matchSearch
    })
  }, [search, activeCategory])

  const handleToggleConnect = async (integration) => {
    setActing(a => ({ ...a, [integration.id]: true }))
    const newState = !connectionState[integration.id]
    try {
      if (newState) {
        await integrationsAPI.connect(integration.id, {})
      } else {
        await integrationsAPI.disconnect(integration.id)
      }
    } catch {}
    setConnectionState(s => ({ ...s, [integration.id]: newState }))
    setActing(a => ({ ...a, [integration.id]: false }))
    toast.success(newState ? `${integration.name} connected!` : `${integration.name} disconnected`)
  }

  // Group for display
  const groupedCategories = useMemo(() => {
    if (activeCategory !== 'All') return null
    const groups = {}
    filteredIntegrations.forEach(i => {
      if (!groups[i.category]) groups[i.category] = []
      groups[i.category].push(i)
    })
    return groups
  }, [filteredIntegrations, activeCategory])

  const renderCard = (integration) => {
    const connected = connectionState[integration.id]
    const loading = acting[integration.id]

    return (
      <Card key={integration.id} hover>
        <CardBody>
          <div className="flex items-start gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-sm"
              style={{ backgroundColor: integration.color }}
            >
              {integration.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-slate-900 dark:text-white truncate">{integration.name}</h4>
                {connected ? (
                  <Badge tone="success" dot>Connected</Badge>
                ) : (
                  <Badge tone="default">Not Connected</Badge>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{integration.description}</p>
            </div>
          </div>

          <div className="mt-auto flex items-center gap-2">
            <Button
              onClick={() => handleToggleConnect(integration)}
              disabled={loading}
              variant={connected ? 'secondary' : 'primary'}
              leftIcon={loading ? RefreshCw : undefined}
              className="flex-1"
            >
              {loading
                ? (connected ? 'Disconnecting...' : 'Connecting...')
                : (connected ? 'Disconnect' : 'Connect')}
            </Button>
            {connected && (
              <Button
                onClick={() => setConfigModal(integration)}
                variant="secondary"
                leftIcon={Settings}
              >
                Settings
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM Integrations"
        subtitle="Connect your CRM with external tools and services"
      />

      {/* Search */}
      <SearchInput
        placeholder="Search integrations..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Category Tabs */}
      <Segmented
        options={integrationCategories.map(cat => ({ label: cat, value: cat }))}
        value={activeCategory}
        onChange={setActiveCategory}
      />

      {/* Integration Cards */}
      {activeCategory === 'All' && groupedCategories ? (
        Object.entries(groupedCategories).map(([category, items]) => (
          <div key={category}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{category}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              {items.map(renderCard)}
            </div>
          </div>
        ))
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredIntegrations.map(renderCard)}
        </div>
      )}

      {filteredIntegrations.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState
              icon={Search}
              title="No integrations found"
              description="No integrations match your search."
            />
          </CardBody>
        </Card>
      )}

      {/* Config Modal */}
      {configModal && (
        <IntegrationConfigModal
          integration={configModal}
          onClose={() => setConfigModal(null)}
          onSave={() => {}}
        />
      )}
    </div>
  )
}
