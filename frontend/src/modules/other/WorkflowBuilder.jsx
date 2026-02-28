import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import SortableItem from '../../components/dnd/SortableItem'
import {
  Zap,
  GitBranch,
  Send,
  Clock,
  Webhook,
  BellRing,
  PenLine,
  Tag,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Play,
  Pause,
  Save,
  Rocket,
  ArrowRight,
  Settings,
  X,
  GripVertical
} from 'lucide-react'

const iconMap = {
  Zap,
  GitBranch,
  Send,
  Clock,
  Webhook,
  BellRing,
  PenLine,
  Tag
}

const nodeTypes = [
  { value: 'trigger', label: 'Trigger', icon: 'Zap', defaultColor: '#6366f1' },
  { value: 'condition', label: 'Condition', icon: 'GitBranch', defaultColor: '#f59e0b' },
  { value: 'action', label: 'Action', icon: 'Send', defaultColor: '#10b981' },
  { value: 'delay', label: 'Delay', icon: 'Clock', defaultColor: '#8b5cf6' },
  { value: 'webhook', label: 'Webhook', icon: 'Webhook', defaultColor: '#ec4899' },
  { value: 'notification', label: 'Notification', icon: 'BellRing', defaultColor: '#f97316' },
  { value: 'update_field', label: 'Update Field', icon: 'PenLine', defaultColor: '#14b8a6' },
  { value: 'add_tag', label: 'Add Tag', icon: 'Tag', defaultColor: '#6b7280' }
]

const getDefaultConfig = (type) => {
  switch (type) {
    case 'trigger': return { event: 'new_lead', source: 'any' }
    case 'condition': return { field: 'lead_score', operator: 'greater_than', value: '50' }
    case 'action': return { actionType: 'send_email', template: 'welcome' }
    case 'delay': return { duration: '24', unit: 'hours' }
    case 'webhook': return { url: '', method: 'POST', headers: '' }
    case 'notification': return { channel: 'email', message: '' }
    case 'update_field': return { field: 'status', newValue: '' }
    case 'add_tag': return { tagName: '' }
    default: return {}
  }
}

const getIconForType = (type) => {
  const nt = nodeTypes.find(n => n.value === type)
  return nt ? nt.icon : 'Zap'
}

const getColorForType = (type) => {
  const nt = nodeTypes.find(n => n.value === type)
  return nt ? nt.defaultColor : '#6366f1'
}

const initialNodes = [
  {
    id: 'node-1',
    name: 'Trigger',
    type: 'trigger',
    icon: 'Zap',
    color: '#6366f1',
    config: { event: 'new_lead', source: 'any' }
  },
  {
    id: 'node-2',
    name: 'Condition',
    type: 'condition',
    icon: 'GitBranch',
    color: '#f59e0b',
    config: { field: 'lead_score', operator: 'greater_than', value: '50' }
  },
  {
    id: 'node-3',
    name: 'Action',
    type: 'action',
    icon: 'Send',
    color: '#10b981',
    config: { actionType: 'send_email', template: 'welcome' }
  },
  {
    id: 'node-4',
    name: 'Delay',
    type: 'delay',
    icon: 'Clock',
    color: '#8b5cf6',
    config: { duration: '24', unit: 'hours' }
  }
]

function NodeConfigPanel({ node, onUpdate }) {
  const [localNode, setLocalNode] = useState({ ...node, config: { ...node.config } })

  const updateConfig = (key, value) => {
    setLocalNode(prev => ({
      ...prev,
      config: { ...prev.config, [key]: value }
    }))
  }

  const handleApply = () => {
    onUpdate(localNode)
    toast.success('Node updated')
  }

  const renderFields = () => {
    switch (localNode.type) {
      case 'trigger':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Event</label>
              <select
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={localNode.config.event || 'new_lead'}
                onChange={e => updateConfig('event', e.target.value)}
              >
                <option value="new_lead">New Lead</option>
                <option value="form_submitted">Form Submitted</option>
                <option value="call_completed">Call Completed</option>
                <option value="deal_won">Deal Won</option>
                <option value="tag_added">Tag Added</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Source</label>
              <select
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={localNode.config.source || 'any'}
                onChange={e => updateConfig('source', e.target.value)}
              >
                <option value="any">Any</option>
                <option value="voice_ai">Voice AI</option>
                <option value="marketing">Marketing</option>
                <option value="crm">CRM</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </>
        )

      case 'condition':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Field</label>
              <select
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={localNode.config.field || 'lead_score'}
                onChange={e => updateConfig('field', e.target.value)}
              >
                <option value="lead_score">Lead Score</option>
                <option value="status">Status</option>
                <option value="source">Source</option>
                <option value="tag">Tag</option>
                <option value="email_opened">Email Opened</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Operator</label>
              <select
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={localNode.config.operator || 'greater_than'}
                onChange={e => updateConfig('operator', e.target.value)}
              >
                <option value="equals">Equals</option>
                <option value="not_equals">Not Equals</option>
                <option value="greater_than">Greater Than</option>
                <option value="less_than">Less Than</option>
                <option value="contains">Contains</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Value</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={localNode.config.value || ''}
                onChange={e => updateConfig('value', e.target.value)}
                placeholder="Enter value..."
              />
            </div>
          </>
        )

      case 'action':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Action Type</label>
              <select
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={localNode.config.actionType || 'send_email'}
                onChange={e => updateConfig('actionType', e.target.value)}
              >
                <option value="send_email">Send Email</option>
                <option value="send_sms">Send SMS</option>
                <option value="send_whatsapp">Send WhatsApp</option>
                <option value="assign_to">Assign To</option>
                <option value="update_field">Update Field</option>
                <option value="add_note">Add Note</option>
                <option value="create_task">Create Task</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Template / Details</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={localNode.config.template || ''}
                onChange={e => updateConfig('template', e.target.value)}
                placeholder="e.g. welcome, follow_up..."
              />
            </div>
          </>
        )

      case 'delay':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Duration</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={localNode.config.duration || ''}
                onChange={e => updateConfig('duration', e.target.value)}
                placeholder="Enter duration..."
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unit</label>
              <select
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={localNode.config.unit || 'hours'}
                onChange={e => updateConfig('unit', e.target.value)}
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </>
        )

      case 'webhook':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">URL</label>
              <input
                type="url"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={localNode.config.url || ''}
                onChange={e => updateConfig('url', e.target.value)}
                placeholder="https://api.example.com/webhook"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Method</label>
              <select
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={localNode.config.method || 'POST'}
                onChange={e => updateConfig('method', e.target.value)}
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
                <option value="PUT">PUT</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Headers</label>
              <textarea
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                rows={4}
                value={localNode.config.headers || ''}
                onChange={e => updateConfig('headers', e.target.value)}
                placeholder='{"Content-Type": "application/json"}'
              />
            </div>
          </>
        )

      case 'notification':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Channel</label>
              <select
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={localNode.config.channel || 'email'}
                onChange={e => updateConfig('channel', e.target.value)}
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="push">Push</option>
                <option value="slack">Slack</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Message</label>
              <textarea
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                rows={4}
                value={localNode.config.message || ''}
                onChange={e => updateConfig('message', e.target.value)}
                placeholder="Enter notification message..."
              />
            </div>
          </>
        )

      case 'update_field':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Field</label>
              <select
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={localNode.config.field || 'status'}
                onChange={e => updateConfig('field', e.target.value)}
              >
                <option value="status">Status</option>
                <option value="lead_score">Lead Score</option>
                <option value="source">Source</option>
                <option value="owner">Owner</option>
                <option value="stage">Stage</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Value</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={localNode.config.newValue || ''}
                onChange={e => updateConfig('newValue', e.target.value)}
                placeholder="Enter new value..."
              />
            </div>
          </>
        )

      case 'add_tag':
        return (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tag Name</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={localNode.config.tagName || ''}
              onChange={e => updateConfig('tagName', e.target.value)}
              placeholder="e.g. hot-lead, follow-up..."
            />
          </div>
        )

      default:
        return <p className="text-sm text-slate-500 dark:text-slate-400">No configuration available for this type.</p>
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Node Name</label>
        <input
          type="text"
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={localNode.name}
          onChange={e => setLocalNode(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Node name..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
        <select
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={localNode.type}
          onChange={e => {
            const newType = e.target.value
            setLocalNode(prev => ({
              ...prev,
              type: newType,
              icon: getIconForType(newType),
              color: getColorForType(newType),
              config: getDefaultConfig(newType)
            }))
          }}
        >
          {nodeTypes.map(nt => (
            <option key={nt.value} value={nt.value}>{nt.label}</option>
          ))}
        </select>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Configuration</h4>
        <div className="space-y-3">
          {renderFields()}
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={handleApply}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
        >
          Apply Changes
        </button>
      </div>
    </div>
  )
}

const workflowTemplates = [
  { id: 'tpl-welcome', name: 'Welcome Series', description: 'Send welcome emails to new leads', color: '#6366f1', nodes: [
    { id: 'n1', name: 'New Lead', type: 'trigger', icon: 'Zap', color: '#6366f1', config: { event: 'new_lead', source: 'any' } },
    { id: 'n2', name: 'Send Welcome', type: 'action', icon: 'Send', color: '#10b981', config: { actionType: 'send_email', template: 'welcome' } },
    { id: 'n3', name: 'Wait 24h', type: 'delay', icon: 'Clock', color: '#8b5cf6', config: { duration: '24', unit: 'hours' } },
    { id: 'n4', name: 'Follow-up', type: 'action', icon: 'Send', color: '#10b981', config: { actionType: 'send_email', template: 'follow_up' } },
  ]},
  { id: 'tpl-nurture', name: 'Lead Nurture', description: 'Drip campaign for cold leads', color: '#10b981', nodes: [
    { id: 'n1', name: 'Tag Added', type: 'trigger', icon: 'Zap', color: '#6366f1', config: { event: 'tag_added', source: 'any' } },
    { id: 'n2', name: 'Check Score', type: 'condition', icon: 'GitBranch', color: '#f59e0b', config: { field: 'lead_score', operator: 'greater_than', value: '30' } },
    { id: 'n3', name: 'Send Nurture', type: 'action', icon: 'Send', color: '#10b981', config: { actionType: 'send_email', template: 'nurture_1' } },
    { id: 'n4', name: 'Wait 3 days', type: 'delay', icon: 'Clock', color: '#8b5cf6', config: { duration: '3', unit: 'days' } },
    { id: 'n5', name: 'Send Offer', type: 'action', icon: 'Send', color: '#10b981', config: { actionType: 'send_whatsapp', template: 'special_offer' } },
  ]},
  { id: 'tpl-abandoned', name: 'Abandoned Cart', description: 'Re-engage users who left', color: '#f59e0b', nodes: [
    { id: 'n1', name: 'Cart Abandoned', type: 'trigger', icon: 'Zap', color: '#6366f1', config: { event: 'form_submitted', source: 'marketing' } },
    { id: 'n2', name: 'Wait 1h', type: 'delay', icon: 'Clock', color: '#8b5cf6', config: { duration: '1', unit: 'hours' } },
    { id: 'n3', name: 'Send Reminder', type: 'action', icon: 'Send', color: '#10b981', config: { actionType: 'send_email', template: 'cart_reminder' } },
  ]},
  { id: 'tpl-reengagement', name: 'Re-engagement', description: 'Win back inactive contacts', color: '#ef4444', nodes: [
    { id: 'n1', name: 'Inactive 30d', type: 'trigger', icon: 'Zap', color: '#6366f1', config: { event: 'new_lead', source: 'crm' } },
    { id: 'n2', name: 'Send Offer', type: 'action', icon: 'Send', color: '#10b981', config: { actionType: 'send_whatsapp', template: 'reengagement' } },
    { id: 'n3', name: 'Add Tag', type: 'add_tag', icon: 'Tag', color: '#6b7280', config: { tagName: 'reengaged' } },
  ]},
  { id: 'tpl-feedback', name: 'Feedback Collection', description: 'Post-interaction surveys', color: '#8b5cf6', nodes: [
    { id: 'n1', name: 'Call Done', type: 'trigger', icon: 'Zap', color: '#6366f1', config: { event: 'call_completed', source: 'voice_ai' } },
    { id: 'n2', name: 'Wait 5m', type: 'delay', icon: 'Clock', color: '#8b5cf6', config: { duration: '5', unit: 'minutes' } },
    { id: 'n3', name: 'Send Survey', type: 'action', icon: 'Send', color: '#10b981', config: { actionType: 'send_sms', template: 'survey_link' } },
  ]},
  { id: 'tpl-onboarding', name: 'Onboarding', description: 'New client onboarding flow', color: '#ec4899', nodes: [
    { id: 'n1', name: 'Deal Won', type: 'trigger', icon: 'Zap', color: '#6366f1', config: { event: 'deal_won', source: 'crm' } },
    { id: 'n2', name: 'Welcome Email', type: 'action', icon: 'Send', color: '#10b981', config: { actionType: 'send_email', template: 'onboarding_welcome' } },
    { id: 'n3', name: 'Assign Owner', type: 'update_field', icon: 'PenLine', color: '#14b8a6', config: { field: 'owner', newValue: 'onboarding-team' } },
    { id: 'n4', name: 'Notify Team', type: 'notification', icon: 'BellRing', color: '#f97316', config: { channel: 'slack', message: 'New client onboarding started' } },
  ]},
]

const mockWorkflows = {
  1: { name: 'New Lead → Voice AI Call', nodes: [
    { id: 'n1', name: 'New Lead', type: 'trigger', icon: 'Zap', color: '#6366f1', config: { event: 'new_lead', source: 'any' } },
    { id: 'n2', name: 'Wait 5 min', type: 'delay', icon: 'Clock', color: '#8b5cf6', config: { duration: '5', unit: 'minutes' } },
    { id: 'n3', name: 'Voice AI Call', type: 'action', icon: 'Send', color: '#10b981', config: { actionType: 'send_whatsapp', template: 'voice_call' } },
  ]},
  2: { name: 'Meeting Booked → Confirmation', nodes: [
    { id: 'n1', name: 'Meeting Booked', type: 'trigger', icon: 'Zap', color: '#6366f1', config: { event: 'form_submitted', source: 'any' } },
    { id: 'n2', name: 'Send WhatsApp', type: 'action', icon: 'Send', color: '#10b981', config: { actionType: 'send_whatsapp', template: 'meeting_confirm' } },
    { id: 'n3', name: 'Send Email', type: 'action', icon: 'Send', color: '#10b981', config: { actionType: 'send_email', template: 'meeting_confirm' } },
  ]},
  3: { name: 'Deal Won → Onboarding', nodes: [
    { id: 'n1', name: 'Deal Won', type: 'trigger', icon: 'Zap', color: '#6366f1', config: { event: 'deal_won', source: 'crm' } },
    { id: 'n2', name: 'Start Onboarding', type: 'action', icon: 'Send', color: '#10b981', config: { actionType: 'send_email', template: 'onboarding' } },
  ]},
}

export default function WorkflowBuilder() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const templateId = searchParams.get('template')

  const getInitialState = () => {
    if (id && mockWorkflows[id]) {
      return { nodes: mockWorkflows[id].nodes, name: mockWorkflows[id].name }
    }
    if (templateId) {
      const tpl = workflowTemplates.find(t => t.id === templateId)
      if (tpl) return { nodes: tpl.nodes, name: tpl.name }
    }
    return { nodes: initialNodes, name: 'New Workflow' }
  }

  const [showTemplates, setShowTemplates] = useState(!id && !templateId)
  const initial = getInitialState()
  const [nodes, setNodes] = useState(initial.nodes)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [workflowName, setWorkflowName] = useState(initial.name)
  const [isActive, setIsActive] = useState(true)
  const [editingName, setEditingName] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))
  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      setNodes(prev => {
        const oldIndex = prev.findIndex(n => n.id === active.id)
        const newIndex = prev.findIndex(n => n.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const handleSelectTemplate = (tpl) => {
    setNodes(tpl.nodes)
    setWorkflowName(tpl.name)
    setShowTemplates(false)
    toast.success(`Template "${tpl.name}" loaded`)
  }

  if (showTemplates) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Choose a Template</h1>
          <p className="text-sm text-slate-500">Start with a pre-built workflow or create from scratch</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflowTemplates.map(tpl => (
            <button key={tpl.id} onClick={() => handleSelectTemplate(tpl)} className="text-left bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:shadow-md transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: tpl.color + '20' }}>
                  <Zap className="w-5 h-5" style={{ color: tpl.color }} />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{tpl.name}</h3>
              </div>
              <p className="text-sm text-slate-500 mb-3">{tpl.description}</p>
              <span className="text-xs text-slate-400">{tpl.nodes.length} nodes</span>
            </button>
          ))}
          <button onClick={() => setShowTemplates(false)} className="text-left bg-white dark:bg-slate-800 rounded-xl p-5 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-400 transition-all flex flex-col items-center justify-center">
            <Plus className="w-8 h-8 text-slate-400 mb-2" />
            <h3 className="font-semibold text-slate-900 dark:text-white">Blank Workflow</h3>
            <p className="text-sm text-slate-500">Start from scratch</p>
          </button>
        </div>
      </div>
    )
  }

  const addNode = (afterIndex) => {
    const newId = `node-${Date.now()}`
    const newNode = {
      id: newId,
      name: 'New Node',
      type: 'action',
      icon: 'Send',
      color: '#10b981',
      config: getDefaultConfig('action')
    }
    const updated = [...nodes]
    updated.splice(afterIndex + 1, 0, newNode)
    setNodes(updated)
    setSelectedNodeId(newId)
  }

  const deleteNode = (nodeId) => {
    if (nodes.length <= 1) {
      toast.error('Workflow must have at least one node')
      return
    }
    setNodes(prev => prev.filter(n => n.id !== nodeId))
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null)
    }
  }

  const moveNode = (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= nodes.length) return
    const updated = [...nodes]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    setNodes(updated)
  }

  const updateNode = (updatedNode) => {
    setNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n))
  }

  const handleSaveDraft = () => {
    toast.success('Workflow draft saved')
  }

  const handlePublish = () => {
    toast.success('Workflow published successfully')
  }

  const handleToggleActive = () => {
    setIsActive(prev => !prev)
    toast.success(isActive ? 'Workflow deactivated' : 'Workflow activated')
  }

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-8rem)]">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-4 min-w-0">
          {editingName ? (
            <input
              type="text"
              className="text-lg font-bold text-slate-900 dark:text-white bg-transparent border-b-2 border-indigo-500 focus:outline-none px-1 py-0.5"
              value={workflowName}
              onChange={e => setWorkflowName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => { if (e.key === 'Enter') setEditingName(false) }}
              autoFocus
            />
          ) : (
            <h1
              className="text-lg font-bold text-slate-900 dark:text-white cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              onClick={() => setEditingName(true)}
              title="Click to rename"
            >
              {workflowName}
            </h1>
          )}
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {nodes.length} node{nodes.length !== 1 ? 's' : ''}
          </span>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
            isActive
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleToggleActive}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30'
            }`}
          >
            {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Save Draft
          </button>
          <button
            onClick={handlePublish}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            <Rocket className="w-3.5 h-3.5" />
            Publish
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left Panel - Node List */}
        <div className="w-full md:w-80 flex-shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 overflow-y-auto max-h-[40vh] md:max-h-none">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">Workflow Nodes</h2>
              <button
                onClick={() => addNode(nodes.length - 1)}
                className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                title="Add node at end"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={nodes.map(n => n.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {nodes.map((node, index) => {
                    const IconComponent = iconMap[node.icon] || Zap
                    const isSelected = selectedNodeId === node.id
                    const typeDef = nodeTypes.find(nt => nt.value === node.type)

                    return (
                      <SortableItem key={node.id} id={node.id}>
                        {({ ref, style, attributes, listeners }) => (
                          <div ref={ref} style={style} {...attributes}>
                            {/* Node Card */}
                            <div
                              onClick={() => setSelectedNodeId(node.id)}
                              className={`relative group rounded-xl p-3 cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-white dark:bg-slate-800 border-2 border-indigo-500 shadow-sm'
                                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <button {...listeners} className="p-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="Drag to reorder">
                                  <GripVertical className="w-4 h-4" />
                                </button>
                                <div
                                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: node.color + '20' }}
                                >
                                  <IconComponent className="w-4.5 h-4.5" style={{ color: node.color }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{node.name}</p>
                                  <span
                                    className="inline-block text-xs font-medium px-1.5 py-0.5 rounded mt-0.5"
                                    style={{ backgroundColor: node.color + '15', color: node.color }}
                                  >
                                    {typeDef?.label || node.type}
                                  </span>
                                </div>
                                <button
                                  onClick={e => { e.stopPropagation(); deleteNode(node.id) }}
                                  className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-all"
                                  title="Delete node"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Insert button between nodes */}
                            {index < nodes.length - 1 && (
                              <div className="flex justify-center py-1">
                                <button
                                  onClick={() => addNode(index)}
                                  className="group/add flex items-center gap-1 text-slate-300 hover:text-indigo-500 dark:text-slate-600 dark:hover:text-indigo-400 transition-colors"
                                  title="Insert node here"
                                >
                                  <div className="w-5 border-t border-dashed border-current" />
                                  <Plus className="w-4 h-4 border border-current rounded-full p-0.5" />
                                  <div className="w-5 border-t border-dashed border-current" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </SortableItem>
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* Right Panel - Node Configuration */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-800">
          {selectedNode ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: selectedNode.color + '20' }}
                  >
                    {(() => {
                      const IC = iconMap[selectedNode.icon] || Zap
                      return <IC className="w-5 h-5" style={{ color: selectedNode.color }} />
                    })()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedNode.name}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Configure node settings</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <NodeConfigPanel
                key={selectedNode.id}
                node={selectedNode}
                onUpdate={updateNode}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Settings className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">No Node Selected</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                Click a node in the left panel to view and edit its configuration.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Flow Strip */}
      <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 sm:px-6 py-4 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max justify-center">
          {nodes.map((node, index) => {
            const IconComponent = iconMap[node.icon] || Zap
            const isSelected = selectedNodeId === node.id

            return (
              <div key={node.id} className="flex items-center">
                {/* Node circle */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-800' : ''
                    }`}
                    style={{ backgroundColor: node.color }}
                    title={node.name}
                  >
                    <IconComponent className="w-4.5 h-4.5 text-white" />
                  </button>
                  <span className={`text-xs mt-1.5 font-medium max-w-[80px] truncate text-center ${
                    isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {node.name}
                  </span>
                </div>

                {/* Arrow connector */}
                {index < nodes.length - 1 && (
                  <div className="flex items-center mx-2 mb-5">
                    <div className="w-8 h-0.5 bg-slate-300 dark:bg-slate-600" />
                    <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 -ml-1" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
