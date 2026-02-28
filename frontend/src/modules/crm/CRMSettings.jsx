import React, { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
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
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Shared Toggle component
// ---------------------------------------------------------------------------
function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-600'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
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

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      toast.success('General settings saved!')
      setTimeout(() => setSaved(false), 2500)
    }, 600)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">General Settings</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">CRM Name</label>
          <input type="text" className="input" value={form.crmName}
            onChange={e => setForm(f => ({ ...f, crmName: e.target.value }))} />
        </div>
        <div>
          <label className="label">Default Currency</label>
          <select className="input" value={form.currency}
            onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
            {['INR', 'USD', 'EUR', 'GBP'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date Format</label>
          <select className="input" value={form.dateFormat}
            onChange={e => setForm(f => ({ ...f, dateFormat: e.target.value }))}>
            {['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Time Zone</label>
          <select className="input" value={form.timezone}
            onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
            {['Asia/Kolkata', 'US/Eastern', 'US/Pacific', 'Europe/London'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Default Lead Owner</label>
          <select className="input" value={form.defaultOwner}
            onChange={e => setForm(f => ({ ...f, defaultOwner: e.target.value }))}>
            {['Arun', 'Meera', 'Kavya'].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <Toggle
            checked={form.autoAssign}
            onChange={v => setForm(f => ({ ...f, autoAssign: v }))}
            label="Auto-assign leads"
            description="Automatically assign new leads to team members"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          {saved ? <Check className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
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
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Lead Settings</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Default Lead Status</label>
          <select className="input" value={defaultStatus}
            onChange={e => setDefaultStatus(e.target.value)}>
            {['new', 'contacted', 'qualified', 'nurturing'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lead Scoring */}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
        <Toggle
          checked={leadScoring}
          onChange={setLeadScoring}
          label="Lead Scoring"
          description="Assign scores to leads based on their engagement"
        />

        {leadScoring && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Scoring Rules</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Activity</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {scoringRules.map(rule => (
                    <tr key={rule.id} className="border-b border-gray-50 dark:border-gray-700/50">
                      <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{rule.name}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">+</span>
                          <input
                            type="number"
                            className="input w-20 text-center"
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

            <div className="mt-4">
              <label className="label">Auto-convert to deal at score threshold</label>
              <input
                type="number"
                className="input w-32"
                value={convertThreshold}
                min={0}
                max={200}
                onChange={e => setConvertThreshold(Number(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Lead Rotation */}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
        <Toggle
          checked={leadRotation}
          onChange={setLeadRotation}
          label="Lead Rotation"
          description="Automatically distribute leads among team members"
        />
        {leadRotation && (
          <div className="mt-3">
            <label className="label">Rotation Method</label>
            <select className="input w-48" value={rotationMethod}
              onChange={e => setRotationMethod(e.target.value)}>
              {['Round Robin', 'Weighted', 'Manual'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          {saved ? <Check className="w-4 h-4" /> : <Users className="w-4 h-4" />}
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
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
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Deal Pipeline Stages</h3>

      <div className="space-y-2">
        {stages.map(stage => (
          <div key={stage.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
              style={{ backgroundColor: stage.color }}
            />
            <input
              type="text"
              className="input flex-1"
              value={stage.name}
              onChange={e => updateStage(stage.id, 'name', e.target.value)}
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                className="input w-20 text-center"
                value={stage.probability}
                min={0}
                max={100}
                onChange={e => updateStage(stage.id, 'probability', Number(e.target.value))}
              />
              <span className="text-xs text-gray-400">%</span>
            </div>
            <input
              type="color"
              className="w-8 h-8 rounded cursor-pointer border-0 p-0"
              value={stage.color}
              onChange={e => updateStage(stage.id, 'color', e.target.value)}
            />
            <button
              onClick={() => deleteStage(stage.id)}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 rounded-lg text-gray-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <button onClick={addStage} className="btn btn-secondary text-sm">
        <Plus className="w-4 h-4" />
        Add Stage
      </button>

      <div className="border-t border-gray-100 dark:border-gray-700 pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Win Probability Threshold</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="input w-24 text-center"
              value={winThreshold}
              min={0}
              max={100}
              onChange={e => setWinThreshold(Number(e.target.value))}
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
        </div>
        <div>
          <label className="label">Auto-close lost deals after</label>
          <select className="input" value={autoCloseLost}
            onChange={e => setAutoCloseLost(e.target.value)}>
            {['30 days', '60 days', '90 days', 'Never'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          {saved ? <Check className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
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
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Bell className="w-5 h-5 text-indigo-500" /> CRM Notifications
      </h3>

      <div className="space-y-1">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={() => toggleItem(item.id)}
                className={`relative w-11 h-6 rounded-full transition-colors ${item.enabled ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${item.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <span className={`text-sm font-medium ${item.enabled ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </div>
            <select
              className="input w-32 text-sm"
              value={item.channel}
              onChange={e => setChannel(item.id, e.target.value)}
              disabled={!item.enabled}
            >
              {['Email', 'SMS', 'Both', 'None'].map(ch => <option key={ch} value={ch}>{ch}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          {saved ? <Check className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
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
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Database className="w-5 h-5 text-indigo-500" /> Data Management
      </h3>

      {/* Export / Import */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Export CRM Data</p>
              <p className="text-xs text-gray-500">Download all leads, deals, contacts</p>
            </div>
          </div>
          <button onClick={handleExport} className="btn btn-primary w-full text-sm">
            <Download className="w-4 h-4" /> Export All Data
          </button>
        </div>

        <div className="card p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
              <Upload className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Import CRM Data</p>
              <p className="text-xs text-gray-500">Upload CSV, XLSX, or JSON files</p>
            </div>
          </div>
          <button onClick={handleImport} className="btn btn-primary w-full text-sm">
            <Upload className="w-4 h-4" /> Import Data
          </button>
        </div>
      </div>

      {/* Purge */}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Purge Old Leads</p>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="label">Remove leads</label>
            <select className="input" value={purgeAge} onChange={e => { setPurgeAge(e.target.value); setConfirmPurge(false) }}>
              {['Older than 6 months', 'Older than 1 year', 'Older than 2 years'].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handlePurge}
            className={`btn text-sm ${confirmPurge ? 'bg-red-600 hover:bg-red-700 text-white' : 'btn-secondary text-red-600 hover:text-red-700'}`}
          >
            <X className="w-4 h-4" />
            {confirmPurge ? 'Confirm Purge' : 'Purge'}
          </button>
          {confirmPurge && (
            <button onClick={() => setConfirmPurge(false)} className="btn btn-secondary text-sm">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Duplicate Detection & Backup */}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-6 space-y-4">
        <Toggle
          checked={duplicateDetection}
          onChange={setDuplicateDetection}
          label="Duplicate Detection"
          description="Automatically detect and flag duplicate contacts and leads"
        />
        <div>
          <label className="label">Data Backup Frequency</label>
          <select className="input w-48" value={backupFrequency}
            onChange={e => setBackupFrequency(e.target.value)}>
            {['Daily', 'Weekly', 'Monthly'].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          {saved ? <Check className="w-4 h-4" /> : <Database className="w-4 h-4" />}
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">CRM Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Configure your CRM module preferences</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 overflow-x-auto">
        {settingsTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.name}
          </button>
        ))}
      </div>

      {/* Content Card */}
      <div className="card p-6 rounded-xl border border-gray-200 dark:border-gray-700">
        {renderContent()}
      </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: integration.color }}
            >
              {integration.name[0]}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{integration.name} Settings</h3>
              <p className="text-xs text-gray-500">{integration.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">API Key</label>
            <input
              type="text"
              className="input"
              placeholder="Enter API key"
              value={config.apiKey}
              onChange={e => setConfig(c => ({ ...c, apiKey: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Webhook URL</label>
            <input
              type="url"
              className="input"
              placeholder="https://your-server.com/webhook"
              value={config.webhookUrl}
              onChange={e => setConfig(c => ({ ...c, webhookUrl: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Sync Direction</label>
              <select className="input" value={config.syncDirection}
                onChange={e => setConfig(c => ({ ...c, syncDirection: e.target.value }))}>
                {['One-way to CRM', 'One-way from CRM', 'Bi-directional'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Sync Frequency</label>
              <select className="input" value={config.syncFrequency}
                onChange={e => setConfig(c => ({ ...c, syncFrequency: e.target.value }))}>
                {['Real-time', 'Every 15 min', 'Hourly', 'Daily'].map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            Last Synced: {new Date().toLocaleString()}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleTest} disabled={testing} className="btn btn-secondary text-sm flex-1">
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {testing ? 'Testing...' : testResult === 'success' ? 'Connection OK' : 'Test Connection'}
          </button>
          <button onClick={handleSave} className="btn btn-primary text-sm flex-1">
            <Check className="w-4 h-4" /> Save
          </button>
        </div>
      </div>
    </div>
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

  const handleToggleConnect = (integration) => {
    setActing(a => ({ ...a, [integration.id]: true }))
    setTimeout(() => {
      const newState = !connectionState[integration.id]
      setConnectionState(s => ({ ...s, [integration.id]: newState }))
      setActing(a => ({ ...a, [integration.id]: false }))
      toast.success(newState ? `${integration.name} connected!` : `${integration.name} disconnected`)
    }, 600)
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
      <div key={integration.id} className="card p-5 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
            style={{ backgroundColor: integration.color }}
          >
            {integration.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900 dark:text-white truncate">{integration.name}</h4>
              {connected && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle className="w-3 h-3" /> Connected
                </span>
              )}
              {!connected && (
                <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                  Not Connected
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{integration.description}</p>
          </div>
        </div>

        <div className="mt-auto flex items-center gap-2">
          <button
            onClick={() => handleToggleConnect(integration)}
            disabled={loading}
            className={`btn text-sm flex-1 ${connected ? 'btn-secondary' : 'btn-primary'}`}
          >
            {loading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> {connected ? 'Disconnecting...' : 'Connecting...'}</>
            ) : connected ? (
              'Disconnect'
            ) : (
              'Connect'
            )}
          </button>
          {connected && (
            <button
              onClick={() => setConfigModal(integration)}
              className="btn btn-secondary text-sm"
            >
              <Settings className="w-4 h-4" /> Settings
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">CRM Integrations</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Connect your CRM with external tools and services</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          className="input pl-10 w-full"
          placeholder="Search integrations..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 overflow-x-auto">
        {integrationCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Integration Cards */}
      {activeCategory === 'All' && groupedCategories ? (
        Object.entries(groupedCategories).map(([category, items]) => (
          <div key={category}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{category}</h3>
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
        <div className="card p-12 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
          <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No integrations found matching your search.</p>
        </div>
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
