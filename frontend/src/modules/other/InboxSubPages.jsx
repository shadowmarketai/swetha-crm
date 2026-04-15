/**
 * InboxSubPages — Unified multi-channel inbox
 *
 * Three tabs (WhatsApp / SMS / Email), each a thin wrapper around
 * the same <InboxChannelView> which:
 *   - lists real conversations for the channel
 *   - opens the selected thread with live message history
 *   - listens to websocket events:
 *       inbox.message.created
 *       inbox.conversation.updated
 *       inbox.connection.updated
 *   - shows an empty state with a Connect CTA when no connection exists
 *   - renders a per-channel connection modal (WhatsApp has two modes:
 *     Business API BSP, or Baileys QR for WhatsApp Web)
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  Send, Paperclip, Smile, MoreVertical, Phone, Mail, MessageSquare,
  Plus, RefreshCw, X, AlertCircle, CheckCircle2, Link2, QrCode,
  ChevronLeft, Wifi, WifiOff, ShieldCheck, ShieldAlert,
} from 'lucide-react'

import { inboxAPI } from '../../services/api'
import { useRealtime, useRealtimeEvent } from '../../contexts/RealtimeContext'
import {
  Card,
  Button,
  Badge,
  Modal,
  Avatar,
  EmptyState,
  SearchInput,
  Field,
  Input,
  Select,
  Spinner,
} from '../../components/ui/primitives'

// ═══════════════════════════════════════════════════════════════════
// Tiny helpers
// ═══════════════════════════════════════════════════════════════════

function timeAgo(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
    if (diffMin < 1) return 'now'
    if (diffMin < 60) return `${diffMin}m`
    const h = Math.floor(diffMin / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}d`
  } catch { return '' }
}

const CHANNEL_META = {
  whatsapp: { label: 'WhatsApp', icon: MessageSquare, accent: 'emerald' },
  sms:      { label: 'SMS',      icon: Phone,          accent: 'sky'     },
  email:    { label: 'Email',    icon: Mail,           accent: 'indigo'  },
}

// Maps connection status to Badge tone
const connStatusTone = {
  connected:    'success',
  pending:      'warning',
  connecting:   'info',
  error:        'danger',
  disconnected: 'default',
}

// ═══════════════════════════════════════════════════════════════════
// Page wrappers
// ═══════════════════════════════════════════════════════════════════

export function WhatsAppInboxPage() {
  return <InboxChannelView channel="whatsapp" />
}
export function SMSInboxPage() {
  return <InboxChannelView channel="sms" />
}
export function EmailInboxPage() {
  return <InboxChannelView channel="email" />
}

// ═══════════════════════════════════════════════════════════════════
// Main channel view
// ═══════════════════════════════════════════════════════════════════

function InboxChannelView({ channel }) {
  const meta = CHANNEL_META[channel]
  const { connected: wsConnected } = useRealtime()

  const [connections, setConnections] = useState([])
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [thread, setThread] = useState({ conversation: null, messages: [] })
  const [loadingList, setLoadingList] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [query, setQuery] = useState('')
  const [showConnect, setShowConnect] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const messagesEndRef = useRef(null)

  // Channel-specific connection presence
  const channelConnections = useMemo(
    () => connections.filter((c) => c.channel === channel),
    [connections, channel],
  )
  const activeConnection = channelConnections.find(
    (c) => c.status === 'connected',
  ) || channelConnections[0] || null

  // ── Load connections + conversations ──
  const loadConnections = useCallback(async () => {
    try {
      const res = await inboxAPI.listConnections()
      setConnections(res.data || [])
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadConversations = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await inboxAPI.listConversations({ channel })
      setConversations(res.data || [])
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to load conversations')
    } finally {
      setLoadingList(false)
    }
  }, [channel])

  const loadThread = useCallback(async (convId) => {
    if (!convId) return
    setLoadingThread(true)
    try {
      const res = await inboxAPI.getMessages(convId)
      setThread(res.data || { conversation: null, messages: [] })
      // Mark read (fire-and-forget)
      inboxAPI.markRead(convId).catch(() => {})
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
      )
    } catch (e) {
      toast.error('Failed to load messages')
    } finally {
      setLoadingThread(false)
    }
  }, [])

  useEffect(() => { loadConnections() }, [loadConnections])
  useEffect(() => { loadConversations() }, [loadConversations])
  useEffect(() => { loadThread(activeConvId) }, [activeConvId, loadThread])

  // Scroll thread to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.messages.length])

  // ── Realtime ──
  useRealtimeEvent('inbox.message.created', (payload) => {
    const convId = payload?.conversation_id
    const msg = payload?.message
    if (!convId || !msg) return
    if (convId === activeConvId) {
      setThread((prev) => {
        if (prev.messages.some((m) => m.id === msg.id)) return prev
        return { ...prev, messages: [...prev.messages, msg] }
      })
    }
  })

  useRealtimeEvent('inbox.conversation.updated', (payload) => {
    if (!payload?.id) return
    if (payload.channel && payload.channel !== channel) return
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === payload.id)
      let next
      if (idx === -1) {
        next = [payload, ...prev]
      } else {
        next = [...prev]
        next[idx] = { ...next[idx], ...payload }
      }
      return next.sort((a, b) =>
        (b.last_message_at || '').localeCompare(a.last_message_at || ''),
      )
    })
  })

  useRealtimeEvent('inbox.connection.updated', () => {
    loadConnections()
  })

  useRealtimeEvent('inbox.poll.complete', (payload) => {
    if (payload?.new_messages > 0) {
      toast.success(`${payload.new_messages} new email${payload.new_messages === 1 ? '' : 's'}`)
      loadConversations()
    }
  })

  // ── Mutations ──
  const handleSend = async () => {
    const text = messageText.trim()
    if (!text) return
    if (!activeConvId) {
      toast.error('Select a conversation first')
      return
    }
    setSending(true)
    try {
      await inboxAPI.sendMessage(activeConvId, { body: text })
      setMessageText('')
      // Thread will update via realtime; fallback refresh anyway
      loadThread(activeConvId)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const handleRefreshEmail = async () => {
    if (channel !== 'email') return
    if (!activeConnection) {
      toast.error('Connect an email account first')
      return
    }
    setRefreshing(true)
    try {
      const res = await inboxAPI.pollEmail(activeConnection.id)
      const n = res.data?.new_messages || 0
      toast.success(n > 0 ? `Fetched ${n} new email${n === 1 ? '' : 's'}` : 'No new emails')
      loadConversations()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'IMAP poll failed')
    } finally {
      setRefreshing(false)
    }
  }

  const filteredConversations = useMemo(() => {
    if (!query.trim()) return conversations
    const q = query.toLowerCase()
    return conversations.filter((c) =>
      (c.remote_name || '').toLowerCase().includes(q) ||
      (c.remote_id || '').toLowerCase().includes(q) ||
      (c.last_message_preview || '').toLowerCase().includes(q) ||
      (c.subject || '').toLowerCase().includes(q)
    )
  }, [conversations, query])

  const ChannelIcon = meta.icon

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      {/* Channel header bar */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <ChannelIcon className="w-5 h-5 text-slate-700" />
          <h1 className="text-lg font-bold text-slate-900">{meta.label} Inbox</h1>

          {/* Realtime connection badge */}
          <Badge
            tone={wsConnected ? 'success' : 'default'}
            dot
            title={wsConnected ? 'Realtime connected' : 'Realtime offline'}
          >
            {wsConnected
              ? <><Wifi className="w-3 h-3 inline mr-0.5" />Live</>
              : <><WifiOff className="w-3 h-3 inline mr-0.5" />Offline</>
            }
          </Badge>

          {activeConnection && <ConnectionPill conn={activeConnection} />}
        </div>

        <div className="flex items-center gap-2">
          {channel === 'email' && activeConnection && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefreshEmail}
              disabled={refreshing}
              leftIcon={refreshing ? undefined : RefreshCw}
              loading={refreshing}
            >
              Refresh
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowConnect(true)}
            leftIcon={Plus}
          >
            {channelConnections.length === 0 ? 'Connect' : 'Add'}
          </Button>
        </div>
      </div>

      {/* Empty state when no connection configured */}
      {channelConnections.length === 0 ? (
        <EmptyConnectionState channel={channel} onConnect={() => setShowConnect(true)} />
      ) : (
        /* Main 2-pane layout */
        <Card className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 rounded-xl">
          {/* Conversation list */}
          <div
            className={`w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col ${
              activeConvId ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Search bar */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800">
              <SearchInput
                placeholder="Search conversations…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* List body */}
            <div className="flex-1 overflow-y-auto">
              {loadingList && (
                <div className="py-16 flex flex-col items-center gap-2 text-sm text-slate-500">
                  <Spinner size="sm" />
                  Loading…
                </div>
              )}

              {!loadingList && filteredConversations.length === 0 && (
                <EmptyState
                  icon={ChannelIcon}
                  title="No conversations yet"
                  description={
                    channel === 'email'
                      ? 'Pull your inbox to check for new emails.'
                      : undefined
                  }
                  action={
                    channel === 'email' ? (
                      <Button variant="ghost" size="sm" onClick={handleRefreshEmail}>
                        Check IMAP inbox now
                      </Button>
                    ) : undefined
                  }
                />
              )}

              {!loadingList &&
                filteredConversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveConvId(c.id)}
                    className={`w-full text-left p-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                      activeConvId === c.id
                        ? 'bg-slate-100 dark:bg-slate-800/60'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={c.remote_name || c.remote_id} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-medium text-slate-900 dark:text-white truncate text-sm">
                            {c.remote_name || c.remote_id}
                          </p>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {timeAgo(c.last_message_at)}
                          </span>
                        </div>
                        {c.subject && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate font-medium">
                            {c.subject}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 truncate">
                          {c.last_message_preview || '—'}
                        </p>
                      </div>
                      {c.unread_count > 0 && (
                        <Badge tone="brand" className="shrink-0 min-w-[20px] justify-center">
                          {c.unread_count}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* Thread pane */}
          <div
            className={`flex-1 flex flex-col min-h-0 ${
              activeConvId ? 'flex' : 'hidden md:flex'
            }`}
          >
            {!activeConvId ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={ChannelIcon}
                  title="No conversation selected"
                  description="Pick a conversation from the list to view messages."
                />
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setActiveConvId(null)}
                      className="md:hidden"
                      aria-label="Back"
                    >
                      <ChevronLeft className="w-5 h-5 text-slate-500" />
                    </Button>
                    <Avatar
                      name={thread.conversation?.remote_name || thread.conversation?.remote_id}
                      size={36}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate text-sm">
                        {thread.conversation?.remote_name || thread.conversation?.remote_id}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {thread.conversation?.remote_id}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Conversation options"
                  >
                    <MoreVertical className="w-4 h-4 text-slate-400" />
                  </Button>
                </div>

                {/* Messages — keep custom chat-bubble styling */}
                <div className="flex-1 p-5 overflow-y-auto bg-slate-50 dark:bg-slate-950/40 space-y-3">
                  {loadingThread && (
                    <div className="flex flex-col items-center gap-2 text-sm text-slate-400 py-8">
                      <Spinner size="sm" />
                      Loading messages…
                    </div>
                  )}
                  {!loadingThread && thread.messages.length === 0 && (
                    <div className="text-center text-sm text-slate-400 py-8">
                      No messages yet
                    </div>
                  )}
                  {!loadingThread &&
                    thread.messages.map((m) => {
                      const mine = m.direction === 'outbound'
                      return (
                        <div
                          key={m.id}
                          className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                              mine
                                ? 'bg-indigo-600 text-white rounded-br-sm'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-bl-sm'
                            }`}
                          >
                            {m.html_body ? (
                              <div
                                className="text-sm prose prose-sm max-w-none dark:prose-invert"
                                dangerouslySetInnerHTML={{ __html: sanitize(m.html_body) }}
                              />
                            ) : (
                              <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                            )}
                            <p
                              className={`text-[10px] mt-1 ${
                                mine ? 'text-indigo-200' : 'text-slate-400'
                              }`}
                            >
                              {timeAgo(m.created_at)}
                              {mine && m.status && ` · ${m.status}`}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Composer */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toast('Attachments coming soon')}
                      aria-label="Attach file"
                    >
                      <Paperclip className="w-4 h-4 text-slate-500" />
                    </Button>
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSend()
                        }
                      }}
                      placeholder="Type a message…"
                      className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toast('Emoji picker coming soon')}
                      aria-label="Insert emoji"
                    >
                      <Smile className="w-4 h-4 text-slate-500" />
                    </Button>
                    <Button
                      variant="primary"
                      size="icon"
                      onClick={handleSend}
                      disabled={sending || !messageText.trim()}
                      loading={sending}
                      aria-label="Send"
                    >
                      {!sending && <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Connect modal */}
      {showConnect && (
        <ConnectModal
          channel={channel}
          onClose={() => setShowConnect(false)}
          onCreated={() => {
            setShowConnect(false)
            loadConnections()
          }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Connection status pill
// ═══════════════════════════════════════════════════════════════════
function ConnectionPill({ conn }) {
  const tone = connStatusTone[conn.status] || 'default'
  const StatusIcon = conn.status === 'connected' ? ShieldCheck : ShieldAlert
  return (
    <Badge tone={tone} dot title={conn.last_error || conn.label}>
      <StatusIcon className="w-3 h-3" />
      <span className="capitalize">{conn.provider}</span>
      {' · '}{conn.status}
      {conn.external_id && <span className="opacity-60"> · {conn.external_id}</span>}
    </Badge>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Empty state when no connection exists
// ═══════════════════════════════════════════════════════════════════
function EmptyConnectionState({ channel, onConnect }) {
  const ChannelIcon = CHANNEL_META[channel].icon
  const label = CHANNEL_META[channel].label
  const descriptions = {
    whatsapp: 'Link a WhatsApp Business API account (WATI / Gupshup / Twilio) or scan a QR to link WhatsApp Web.',
    email:    'Add an IMAP/SMTP account to send and receive emails directly in the CRM.',
    sms:      'Connect a Twilio or MSG91 account to send SMS from the CRM.',
  }
  return (
    <Card className="flex-1 flex items-center justify-center">
      <EmptyState
        icon={ChannelIcon}
        title={`Connect your ${label}`}
        description={descriptions[channel]}
        action={
          <Button variant="primary" onClick={onConnect} leftIcon={Link2}>
            Connect {label}
          </Button>
        }
      />
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Connection modal — branches per channel
// ═══════════════════════════════════════════════════════════════════
function ConnectModal({ channel, onClose, onCreated }) {
  if (channel === 'whatsapp') return <WhatsAppConnectModal onClose={onClose} onCreated={onCreated} />
  if (channel === 'email')    return <EmailConnectModal onClose={onClose} onCreated={onCreated} />
  return <SMSConnectModal onClose={onClose} onCreated={onCreated} />
}

// ── WhatsApp: BSP or Baileys QR ──
function WhatsAppConnectModal({ onClose, onCreated }) {
  const [mode, setMode] = useState('bsp') // 'bsp' or 'baileys'
  const [provider, setProvider] = useState('wati')
  const [label, setLabel] = useState('')
  const [form, setForm] = useState({
    api_key: '', base_url: 'https://api.wati.io',
    app_name: '', source_phone: '',
    account_sid: '', auth_token: '',
    bridge_url: 'http://localhost:4001', session_id: '',
  })
  const [submitting, setSubmitting] = useState(false)

  // Baileys QR polling
  const [createdConnection, setCreatedConnection] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [qrError, setQrError] = useState(null)
  const [baileysConnected, setBaileysConnected] = useState(false)
  const pollingRef = useRef(null)

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  const buildConfig = () => {
    if (mode === 'bsp') {
      if (provider === 'wati')    return { api_key: form.api_key, base_url: form.base_url }
      if (provider === 'gupshup') return { api_key: form.api_key, app_name: form.app_name, source_phone: form.source_phone }
      if (provider === 'twilio')  return { account_sid: form.account_sid, auth_token: form.auth_token, source_phone: form.source_phone }
    }
    // baileys
    return {
      bridge_url: form.bridge_url,
      session_id: form.session_id || undefined,
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!label.trim()) return toast.error('Label is required')
    setSubmitting(true)
    try {
      const res = await inboxAPI.createConnection({
        channel: 'whatsapp',
        provider: mode === 'bsp' ? provider : 'baileys',
        label: label.trim(),
        config: buildConfig(),
      })
      const conn = res.data
      setCreatedConnection(conn)

      if (mode === 'bsp') {
        try {
          await inboxAPI.testConnection(conn.id)
          toast.success(`Connected via ${provider}`)
          onCreated()
        } catch (e) {
          toast.error(e?.response?.data?.detail || 'BSP credentials invalid')
        }
      } else {
        startQrPolling(conn.id)
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to create connection')
    } finally {
      setSubmitting(false)
    }
  }

  const startQrPolling = (connId) => {
    const tick = async () => {
      try {
        const res = await inboxAPI.getBaileysQR(connId)
        setQrError(null)
        setQrDataUrl(res.data?.qr || null)
        if (res.data?.connected) {
          setBaileysConnected(true)
          clearInterval(pollingRef.current)
          toast.success(`Linked: ${res.data.phone || 'WhatsApp Web'}`)
          setTimeout(onCreated, 1200)
        }
      } catch (e) {
        setQrError(e?.response?.data?.detail || 'Bridge unreachable')
      }
    }
    tick()
    pollingRef.current = setInterval(tick, 3000)
  }

  return (
    <Modal open title="Connect WhatsApp" onClose={onClose} size="md">
      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode('bsp')}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
            mode === 'bsp'
              ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white'
              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
          Business API
        </button>
        <button
          type="button"
          onClick={() => setMode('baileys')}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
            mode === 'baileys'
              ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400'
              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
        >
          <QrCode className="w-3.5 h-3.5 inline mr-1" />
          WhatsApp Web (QR)
        </button>
      </div>

      {mode === 'baileys' && !createdConnection && (
        <div className="mb-4 p-3 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>Unofficial:</strong> Uses WhatsApp Web protocol. Violates WhatsApp ToS. Your number can be banned.
            Requires the Baileys bridge running at the URL below. See <code>baileys-bridge/README.md</code>.
          </div>
        </div>
      )}

      {!createdConnection && (
        <form onSubmit={submit} className="space-y-3">
          <Field label="Label" required>
            <Input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My WhatsApp"
            />
          </Field>

          {mode === 'bsp' && (
            <>
              <Field label="Provider" required>
                <Select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full"
                >
                  <option value="wati">WATI</option>
                  <option value="gupshup">Gupshup</option>
                  <option value="twilio">Twilio</option>
                </Select>
              </Field>

              {provider === 'wati' && (
                <>
                  <Field label="WATI API Key" required>
                    <Input
                      type="password"
                      value={form.api_key}
                      onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                    />
                  </Field>
                  <Field label="Base URL" required>
                    <Input
                      type="text"
                      value={form.base_url}
                      onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                    />
                  </Field>
                </>
              )}

              {provider === 'gupshup' && (
                <>
                  <Field label="Gupshup API Key" required>
                    <Input
                      type="password"
                      value={form.api_key}
                      onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                    />
                  </Field>
                  <Field label="App Name" required>
                    <Input
                      type="text"
                      value={form.app_name}
                      onChange={(e) => setForm({ ...form, app_name: e.target.value })}
                    />
                  </Field>
                  <Field label="Source Phone (with country code)" required>
                    <Input
                      type="text"
                      placeholder="+919876543210"
                      value={form.source_phone}
                      onChange={(e) => setForm({ ...form, source_phone: e.target.value })}
                    />
                  </Field>
                </>
              )}

              {provider === 'twilio' && (
                <>
                  <Field label="Account SID" required>
                    <Input
                      type="text"
                      value={form.account_sid}
                      onChange={(e) => setForm({ ...form, account_sid: e.target.value })}
                    />
                  </Field>
                  <Field label="Auth Token" required>
                    <Input
                      type="password"
                      value={form.auth_token}
                      onChange={(e) => setForm({ ...form, auth_token: e.target.value })}
                    />
                  </Field>
                  <Field label="Twilio WhatsApp Number" required>
                    <Input
                      type="text"
                      placeholder="+14155238886"
                      value={form.source_phone}
                      onChange={(e) => setForm({ ...form, source_phone: e.target.value })}
                    />
                  </Field>
                </>
              )}
            </>
          )}

          {mode === 'baileys' && (
            <>
              <Field label="Bridge URL" required>
                <Input
                  type="text"
                  value={form.bridge_url}
                  onChange={(e) => setForm({ ...form, bridge_url: e.target.value })}
                  className="font-mono"
                />
              </Field>
              <Field label="Session ID (optional)">
                <Input
                  type="text"
                  value={form.session_id}
                  onChange={(e) => setForm({ ...form, session_id: e.target.value })}
                  placeholder="leave blank for default"
                />
              </Field>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submitting}>
              {mode === 'baileys' ? 'Create & get QR' : 'Connect'}
            </Button>
          </div>
        </form>
      )}

      {/* Baileys QR display */}
      {createdConnection && mode === 'baileys' && (
        <div className="text-center py-4">
          {baileysConnected ? (
            <div className="text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2" />
              <p className="font-semibold">WhatsApp Web connected!</p>
            </div>
          ) : qrDataUrl ? (
            <>
              <img
                src={qrDataUrl}
                alt="WhatsApp Web QR code"
                className="w-64 h-64 mx-auto border border-slate-200 dark:border-slate-700 rounded-lg"
              />
              <p className="text-xs text-slate-500 mt-3">
                Open WhatsApp → Settings → Linked Devices → Link a Device, then scan this QR.
              </p>
            </>
          ) : qrError ? (
            <div className="text-rose-600 dark:text-rose-400 text-sm">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              {qrError}
              <p className="text-xs text-slate-500 mt-2">
                Start the bridge with{' '}
                <code>cd baileys-bridge && npm install && npm start</code>.
              </p>
            </div>
          ) : (
            <div className="py-10 flex flex-col items-center gap-2">
              <Spinner size="lg" />
              <p className="text-sm text-slate-500">Waiting for QR from bridge…</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

// ── Email: IMAP or Gmail OAuth placeholder ──
function EmailConnectModal({ onClose, onCreated }) {
  const [mode, setMode] = useState('imap')
  const [label, setLabel] = useState('')
  const [form, setForm] = useState({
    host: 'imap.gmail.com', port: 993,
    username: '', password: '',
    smtp_host: 'smtp.gmail.com', smtp_port: 587,
  })
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!label.trim()) return toast.error('Label is required')
    setSubmitting(true)
    try {
      const res = await inboxAPI.createConnection({
        channel: 'email',
        provider: 'imap',
        label: label.trim(),
        config: { ...form, port: parseInt(form.port), smtp_port: parseInt(form.smtp_port) },
      })
      const conn = res.data
      try {
        await inboxAPI.testConnection(conn.id)
        toast.success('Email connected')
        inboxAPI.pollEmail(conn.id).catch(() => {})
        onCreated()
      } catch (e) {
        toast.error(e?.response?.data?.detail || 'IMAP login failed — check credentials')
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to create connection')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open title="Connect Email" onClose={onClose} size="md">
      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode('imap')}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
            mode === 'imap'
              ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white'
              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
        >
          IMAP / SMTP
        </button>
        <button
          type="button"
          onClick={() => setMode('oauth')}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
            mode === 'oauth'
              ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white'
              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
        >
          Gmail OAuth
        </button>
      </div>

      {mode === 'oauth' && (
        <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300">
          <strong>Setup required.</strong> Gmail OAuth needs a Google Cloud project with an OAuth 2.0
          client ID and the Gmail API enabled. Once you provide <code>GOOGLE_CLIENT_ID</code> and{' '}
          <code>GOOGLE_CLIENT_SECRET</code> in your backend <code>.env</code>, the "Sign in with
          Google" button will appear here.
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>
              Got it
            </Button>
          </div>
        </div>
      )}

      {mode === 'imap' && (
        <form onSubmit={submit} className="space-y-3">
          <Field label="Label" required>
            <Input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My Gmail"
            />
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Field label="IMAP Host" required>
                <Input
                  type="text"
                  required
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Port" required>
              <Input
                type="number"
                required
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Email / Username" required>
            <Input
              type="email"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </Field>

          <Field label="Password / App Password" required>
            <Input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>

          <div className="p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-600 dark:text-slate-400">
            <strong>Gmail:</strong> Enable 2-Step Verification and create an{' '}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
              className="underline text-indigo-600 dark:text-indigo-400"
            >
              App Password
            </a>
            {' '}(regular password won't work).
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Field label="SMTP Host" required>
                <Input
                  type="text"
                  required
                  value={form.smtp_host}
                  onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                />
              </Field>
            </div>
            <Field label="SMTP Port" required>
              <Input
                type="number"
                required
                value={form.smtp_port}
                onChange={(e) => setForm({ ...form, smtp_port: e.target.value })}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submitting}>
              Connect & test
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

// ── SMS stub modal ──
function SMSConnectModal({ onClose, onCreated }) {
  const [label, setLabel] = useState('')
  const [provider, setProvider] = useState('twilio')
  const [form, setForm] = useState({ account_sid: '', auth_token: '', source_phone: '' })
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!label.trim()) return toast.error('Label is required')
    setSubmitting(true)
    try {
      await inboxAPI.createConnection({
        channel: 'sms',
        provider,
        label: label.trim(),
        config: form,
      })
      toast.success('SMS connection saved (outbound sending to be wired in Phase 2)')
      onCreated()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to create connection')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open title="Connect SMS" onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Label" required>
          <Input
            type="text"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>

        <Field label="Provider" required>
          <Select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full"
          >
            <option value="twilio">Twilio</option>
            <option value="msg91">MSG91</option>
          </Select>
        </Field>

        <Field label="Account SID / API Key" required>
          <Input
            type="text"
            value={form.account_sid}
            onChange={(e) => setForm({ ...form, account_sid: e.target.value })}
          />
        </Field>

        <Field label="Auth Token" required>
          <Input
            type="password"
            value={form.auth_token}
            onChange={(e) => setForm({ ...form, auth_token: e.target.value })}
          />
        </Field>

        <Field label="Source Number" required>
          <Input
            type="text"
            value={form.source_phone}
            onChange={(e) => setForm({ ...form, source_phone: e.target.value })}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={submitting}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Bare-bones HTML sanitizer — strips script/style/iframe/on* handlers.
// Not a replacement for DOMPurify, but good enough for rendering
// email HTML bodies safely in the thread pane.
// ═══════════════════════════════════════════════════════════════════
function sanitize(html) {
  if (!html) return ''
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}
