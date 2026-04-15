/**
 * Voice AI Integration Overview — Swetha Structures CRM
 *
 * Control panel for monitoring your external Voice AI platform.
 * Connects to VOICEFLOW_API_URL to show:
 *   - Platform connection status
 *   - Active agents and their status
 *   - Today's call stats
 *   - Recent calls with transcriptions
 *   - Campaign performance
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Mic, Phone, PhoneCall, PhoneOff, PhoneMissed, Users, TrendingUp,
  Clock, CheckCircle, AlertTriangle, Activity, Bot, Wifi, WifiOff,
  Play, Pause, BarChart3, MessageSquare, ChevronRight, RefreshCw,
  ExternalLink, Zap, Volume2,
} from 'lucide-react'
import {
  Card, CardHeader, CardBody, Stat, Button, PageHeader, Badge,
  DataTable, Avatar, EmptyState, Skeleton, Segmented,
} from '../../components/ui/primitives'
import api from '../../services/api'

// Persisted config in localStorage
const STORAGE_KEY = 'swetha_voice_ai_config'

function getVoiceConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return {
    apiUrl: import.meta.env.VITE_VOICEFLOW_API_URL || 'http://localhost:8001',
    apiKey: '',
    connected: false,
  }
}

function saveVoiceConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

// Mock data — replace with real API calls when voice platform is ready
const MOCK_AGENTS = [
  { id: 'agent-1', name: 'Sales Bot', language: 'English + Tamil', status: 'active', calls_today: 47, success_rate: 82, avg_duration: '3m 12s', persona: 'Professional, friendly' },
  { id: 'agent-2', name: 'Follow-up Bot', language: 'English + Hindi', status: 'active', calls_today: 23, success_rate: 76, avg_duration: '2m 45s', persona: 'Persistent, polite' },
  { id: 'agent-3', name: 'Appointment Bot', language: 'English', status: 'paused', calls_today: 0, success_rate: 91, avg_duration: '1m 30s', persona: 'Efficient, direct' },
]

const MOCK_LIVE_CALLS = [
  { id: 'call-1', agent: 'Sales Bot', contact: 'Rajesh Kumar', phone: '+91 98765 43210', duration: '2:34', status: 'in_progress', sentiment: 'positive' },
  { id: 'call-2', agent: 'Follow-up Bot', contact: 'Priya Sharma', phone: '+91 87654 32109', duration: '0:45', status: 'ringing', sentiment: null },
]

const MOCK_RECENT_CALLS = [
  { id: 'log-1', agent: 'Sales Bot', contact: 'Suresh Nair', phone: '+91 94567 12345', duration: '4:12', outcome: 'interested', time: '10 min ago', has_transcript: true,
    transcript: 'Agent: Good morning, this is Swetha Structures. We specialize in PEB industrial buildings...\nCustomer: Yes, I saw your IndiaMart listing. I need a warehouse about 100 by 60 feet.\nAgent: Perfect! For a 100x60 warehouse with gable roof, the estimated cost would be around 21 lakhs...\nCustomer: That sounds reasonable. Can you send me a detailed quotation?\nAgent: Absolutely! I will generate a quotation and send it to your WhatsApp right away.' },
  { id: 'log-2', agent: 'Sales Bot', contact: 'Lakshmi Bhat', phone: '+91 88765 43210', duration: '1:45', outcome: 'callback', time: '25 min ago', has_transcript: true,
    transcript: 'Agent: Hello, this is Swetha Structures calling about your PEB building enquiry.\nCustomer: I am in a meeting right now, can you call back in 2 hours?\nAgent: Of course! I will call you back at 3 PM. Have a good day!' },
  { id: 'log-3', agent: 'Follow-up Bot', contact: 'Karthik Iyer', phone: '+91 66543 21098', duration: '3:20', outcome: 'meeting_booked', time: '1 hour ago', has_transcript: true,
    transcript: 'Agent: Hi Karthik, following up on your PEB factory enquiry from last week.\nCustomer: Yes, I have been thinking about it. The 150x80 factory quote was good.\nAgent: Great! Would you like to schedule a site visit? We can discuss the design in detail.\nCustomer: Yes, how about Thursday at 11 AM?\nAgent: Thursday 11 AM is confirmed. I will send you the location on WhatsApp.' },
  { id: 'log-4', agent: 'Sales Bot', contact: 'Deepa Menon', phone: '+91 77654 32109', duration: '0:30', outcome: 'no_answer', time: '1.5 hours ago', has_transcript: false },
  { id: 'log-5', agent: 'Follow-up Bot', contact: 'Ananya Reddy', phone: '+91 55432 10987', duration: '5:10', outcome: 'quote_sent', time: '2 hours ago', has_transcript: true,
    transcript: 'Agent: Good afternoon Ananya! I am calling about the cold storage facility you enquired about.\nCustomer: Yes, we need a 80x60 building with full PUF insulation.\nAgent: We have prepared a quotation for Rs.33.9 lakhs for an 80x60 PUF insulated building with 30x20 mezzanine.\nCustomer: That looks good. Can you email the detailed BOQ?\nAgent: Sent! You should receive it in your inbox shortly.' },
]

const OUTCOME_TONES = {
  interested: 'success', callback: 'warning', meeting_booked: 'info',
  quote_sent: 'brand', no_answer: 'default', not_interested: 'danger',
  voicemail: 'default',
}

const STATUS_COLORS = {
  in_progress: 'text-green-500 animate-pulse', ringing: 'text-amber-500 animate-pulse',
  completed: 'text-slate-400', failed: 'text-red-500',
}

export default function VoiceAIOverview() {
  const navigate = useNavigate()
  const [config, setConfig] = useState(getVoiceConfig)
  const [connected, setConnected] = useState(false)
  const [checking, setChecking] = useState(true)
  const [showConnect, setShowConnect] = useState(false)
  const [connectForm, setConnectForm] = useState({ apiUrl: config.apiUrl, apiKey: config.apiKey })
  const [testingConnection, setTestingConnection] = useState(false)
  const [agents, setAgents] = useState([])
  const [liveCalls, setLiveCalls] = useState([])
  const [recentCalls, setRecentCalls] = useState([])
  const [expandedCall, setExpandedCall] = useState(null)
  const [stats, setStats] = useState(null)

  // Check Voice AI platform connection
  const checkConnection = useCallback(async (url) => {
    const apiUrl = url || config.apiUrl
    setChecking(true)
    try {
      const headers = config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}
      const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(3000), headers })
      if (res.ok) {
        setConnected(true)
        const newConfig = { ...config, apiUrl, connected: true }
        setConfig(newConfig)
        saveVoiceConfig(newConfig)
        // TODO: Load real data from platform API when ready
      } else {
        setConnected(false)
      }
    } catch {
      setConnected(false)
    }
    // Use mock data for now (replace with real API calls)
    setAgents(MOCK_AGENTS)
    setLiveCalls(MOCK_LIVE_CALLS)
    setRecentCalls(MOCK_RECENT_CALLS)
    setStats({
      total_calls: 156, active_now: 2, success_rate: 78,
      avg_duration: '3m 05s', meetings_booked: 12, quotes_sent: 34,
    })
    setChecking(false)
  }, [config])

  useEffect(() => { checkConnection() }, [])

  // Test & Save connection
  const handleTestConnection = async () => {
    if (!connectForm.apiUrl.trim()) { toast.error('Enter the Voice AI platform URL'); return }
    setTestingConnection(true)
    try {
      const headers = connectForm.apiKey ? { 'Authorization': `Bearer ${connectForm.apiKey}` } : {}
      const res = await fetch(`${connectForm.apiUrl.replace(/\/$/, '')}/health`, {
        signal: AbortSignal.timeout(5000), headers,
      })
      if (res.ok) {
        const newConfig = { apiUrl: connectForm.apiUrl.replace(/\/$/, ''), apiKey: connectForm.apiKey, connected: true }
        setConfig(newConfig)
        saveVoiceConfig(newConfig)
        setConnected(true)
        setShowConnect(false)
        toast.success('Voice AI platform connected!')
        checkConnection(newConfig.apiUrl)
      } else {
        toast.error(`Connection failed: HTTP ${res.status}`)
      }
    } catch (err) {
      toast.error(`Cannot reach ${connectForm.apiUrl} — check the URL and make sure the platform is running`)
    } finally {
      setTestingConnection(false)
    }
  }

  const handleDisconnect = () => {
    const newConfig = { apiUrl: '', apiKey: '', connected: false }
    setConfig(newConfig)
    saveVoiceConfig(newConfig)
    setConnected(false)
    setConnectForm({ apiUrl: '', apiKey: '' })
    toast.success('Disconnected from Voice AI platform')
  }

  // Periodic refresh for live calls
  useEffect(() => {
    const interval = setInterval(() => {
      // In production: fetch live calls from voice platform API
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  if (checking) {
    return (
      <div className="space-y-6">
        <PageHeader title="Voice AI" subtitle="Connecting to Voice AI platform..." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voice AI"
        subtitle="Monitor and control your AI voice agents"
        actions={
          <div className="flex items-center gap-3">
            <Badge tone={connected ? 'success' : 'warning'} dot>
              {connected ? 'Connected' : 'Not Connected'}
            </Badge>
            <Button variant="secondary" size="sm" leftIcon={connected ? RefreshCw : Wifi}
              onClick={() => connected ? checkConnection() : setShowConnect(true)}>
              {connected ? 'Refresh' : 'Connect Platform'}
            </Button>
            {connected && (
              <Button variant="ghost" size="sm" leftIcon={ExternalLink}
                onClick={() => window.open(config.apiUrl, '_blank')}>
                Open
              </Button>
            )}
          </div>
        }
      />

      {/* Connect Modal */}
      {showConnect && (
        <Card className="border-amber-200 dark:border-amber-500/30">
          <CardHeader
            title="Connect Voice AI Platform"
            subtitle="Enter the URL and API key of your Voice AI platform"
            action={<Button variant="ghost" size="sm" onClick={() => setShowConnect(false)}>✕</Button>}
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Platform URL *</label>
                <input
                  value={connectForm.apiUrl}
                  onChange={(e) => setConnectForm(f => ({ ...f, apiUrl: e.target.value }))}
                  placeholder="https://voice.swethastructures.com or http://localhost:8001"
                  className="w-full h-10 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 px-3 placeholder:text-slate-400 focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': 'color-mix(in oklab, var(--brand-primary) 35%, transparent)' }}
                />
                <p className="text-[10px] text-slate-400 mt-1">The base URL of your running Voice AI platform</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">API Key (optional)</label>
                <input
                  value={connectForm.apiKey}
                  onChange={(e) => setConnectForm(f => ({ ...f, apiKey: e.target.value }))}
                  placeholder="sk-voice-..."
                  type="password"
                  className="w-full h-10 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 px-3 placeholder:text-slate-400 focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': 'color-mix(in oklab, var(--brand-primary) 35%, transparent)' }}
                />
                <p className="text-[10px] text-slate-400 mt-1">Required if your platform has authentication</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setShowConnect(false)}>Cancel</Button>
              <Button onClick={handleTestConnection} loading={testingConnection} leftIcon={Zap}>
                Test & Connect
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Calls Today" value={stats?.total_calls || 0} icon={Phone} accent="#6366f1" accentTo="#8b5cf6"
          change="+23%" changeType="up" />
        <Stat label="Active Now" value={stats?.active_now || 0} icon={PhoneCall} accent="#10b981" accentTo="#06b6d4" />
        <Stat label="Success Rate" value={`${stats?.success_rate || 0}%`} icon={CheckCircle} accent="#f59e0b" accentTo="#f97316"
          change="+5%" changeType="up" />
        <Stat label="Meetings Booked" value={stats?.meetings_booked || 0} icon={Users} accent="#ec4899" accentTo="#8b5cf6"
          change="+8 today" changeType="up" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Live Calls + Agents */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Calls */}
          <Card>
            <CardHeader
              title="Live Calls"
              subtitle={`${liveCalls.length} active call${liveCalls.length !== 1 ? 's' : ''}`}
              action={
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-green-600 font-medium">Live</span>
                </span>
              }
            />
            <CardBody>
              {liveCalls.length === 0 ? (
                <EmptyState icon={PhoneOff} title="No active calls" description="Voice agents are idle right now" />
              ) : (
                <div className="space-y-3">
                  {liveCalls.map((call) => (
                    <div key={call.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                      <div className="relative">
                        <Avatar name={call.contact} size={40} />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                          call.status === 'in_progress' ? 'bg-green-500' : 'bg-amber-500'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-white text-sm">{call.contact}</p>
                          <Badge tone={call.status === 'in_progress' ? 'success' : 'warning'}>
                            {call.status === 'in_progress' ? 'Speaking' : 'Ringing'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500">{call.agent} · {call.phone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-mono font-bold text-slate-900 dark:text-white">{call.duration}</p>
                        {call.sentiment && (
                          <Badge tone={call.sentiment === 'positive' ? 'success' : call.sentiment === 'negative' ? 'danger' : 'default'} className="text-[10px]">
                            {call.sentiment}
                          </Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => toast('Live listen coming soon')}>
                        <Volume2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Recent Calls with Transcriptions */}
          <Card>
            <CardHeader
              title="Recent Calls"
              subtitle="Call history with AI transcriptions"
              action={<Button variant="ghost" size="sm" onClick={() => navigate('/voice/call-logs')}>View All <ChevronRight className="w-3 h-3" /></Button>}
            />
            <CardBody>
              <div className="space-y-2">
                {recentCalls.map((call) => (
                  <div key={call.id}>
                    <button
                      onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                        backgroundColor: call.outcome === 'no_answer' ? '#f1f5f9' :
                          call.outcome === 'meeting_booked' ? '#dbeafe' :
                          call.outcome === 'interested' ? '#dcfce7' :
                          call.outcome === 'quote_sent' ? '#fef3c7' : '#f1f5f9',
                      }}>
                        {call.outcome === 'no_answer' ? <PhoneMissed className="w-4 h-4 text-slate-400" /> :
                         call.outcome === 'meeting_booked' ? <Users className="w-4 h-4 text-blue-600" /> :
                         call.outcome === 'interested' ? <CheckCircle className="w-4 h-4 text-green-600" /> :
                         call.outcome === 'quote_sent' ? <MessageSquare className="w-4 h-4 text-amber-600" /> :
                         <Phone className="w-4 h-4 text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{call.contact}</p>
                          <Badge tone={OUTCOME_TONES[call.outcome] || 'default'} className="text-[10px]">
                            {call.outcome?.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500">{call.agent} · {call.duration} · {call.time}</p>
                      </div>
                      {call.has_transcript && (
                        <Badge tone="info" className="text-[10px]">Transcript</Badge>
                      )}
                    </button>

                    {/* Expanded Transcript */}
                    {expandedCall === call.id && call.transcript && (
                      <div className="ml-12 mr-3 mb-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Call Transcript</p>
                        <div className="space-y-2">
                          {call.transcript.split('\n').map((line, i) => {
                            const isAgent = line.startsWith('Agent:')
                            return (
                              <div key={i} className={`flex gap-2 ${isAgent ? '' : 'flex-row-reverse'}`}>
                                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                                  isAgent
                                    ? 'bg-amber-50 dark:bg-amber-500/10 text-slate-800 dark:text-slate-200 border border-amber-200/50 dark:border-amber-500/20'
                                    : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                                }`}>
                                  <span className={`text-[10px] font-bold block mb-0.5 ${isAgent ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500'}`}>
                                    {isAgent ? '🤖 AI Agent' : '👤 Customer'}
                                  </span>
                                  {line.replace(/^(Agent|Customer):\s*/, '')}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* RIGHT: Agents Panel */}
        <div className="space-y-6">
          {/* Connection Status / Connect Widget */}
          <Card>
            <CardBody>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  connected ? 'bg-green-100 dark:bg-green-500/10' : 'bg-amber-100 dark:bg-amber-500/10'
                }`}>
                  {connected ? <Wifi className="w-5 h-5 text-green-600" /> : <WifiOff className="w-5 h-5 text-amber-600" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">
                    {connected ? 'Platform Online' : 'Not Connected'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {connected ? config.apiUrl : 'Connect your Voice AI platform'}
                  </p>
                </div>
              </div>

              {connected ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 rounded-lg p-2.5">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Connected to <strong>{config.apiUrl}</strong></span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => setShowConnect(true)}>
                      Change
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 text-red-600 hover:bg-red-50" onClick={handleDisconnect}>
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Enter your Voice AI platform URL and API key to connect.</p>
                  <input
                    value={connectForm.apiUrl}
                    onChange={(e) => setConnectForm(f => ({ ...f, apiUrl: e.target.value }))}
                    placeholder="https://your-voice-ai.com or http://localhost:8001"
                    className="w-full h-9 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 px-3 placeholder:text-slate-400 focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': 'color-mix(in oklab, var(--brand-primary) 35%, transparent)' }}
                  />
                  <input
                    value={connectForm.apiKey}
                    onChange={(e) => setConnectForm(f => ({ ...f, apiKey: e.target.value }))}
                    placeholder="API Key (optional)"
                    type="password"
                    className="w-full h-9 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 px-3 placeholder:text-slate-400 focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': 'color-mix(in oklab, var(--brand-primary) 35%, transparent)' }}
                  />
                  <Button onClick={handleTestConnection} loading={testingConnection} leftIcon={Zap} className="w-full">
                    Test & Connect
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          {/* AI Agents */}
          <Card>
            <CardHeader title="AI Agents" subtitle={`${agents.filter(a => a.status === 'active').length} active`} />
            <CardBody>
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div key={agent.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-amber-600" />
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">{agent.name}</span>
                      </div>
                      <Badge tone={agent.status === 'active' ? 'success' : 'default'} dot>
                        {agent.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{agent.language} · {agent.persona}</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-1.5">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{agent.calls_today}</p>
                        <p className="text-[10px] text-slate-500">Calls</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-1.5">
                        <p className="text-sm font-bold text-green-600">{agent.success_rate}%</p>
                        <p className="text-[10px] text-slate-500">Success</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-1.5">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{agent.avg_duration}</p>
                        <p className="text-[10px] text-slate-500">Avg</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader title="Today's Summary" />
            <CardBody>
              <div className="space-y-3">
                {[
                  { label: 'Total Calls', value: stats?.total_calls || 0, icon: Phone, color: 'text-indigo-600' },
                  { label: 'Quotes Sent', value: stats?.quotes_sent || 0, icon: MessageSquare, color: 'text-amber-600' },
                  { label: 'Meetings Booked', value: stats?.meetings_booked || 0, icon: Users, color: 'text-blue-600' },
                  { label: 'Avg Duration', value: stats?.avg_duration || '-', icon: Clock, color: 'text-purple-600' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                      <span className="text-sm text-slate-600 dark:text-slate-400">{item.label}</span>
                    </div>
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
