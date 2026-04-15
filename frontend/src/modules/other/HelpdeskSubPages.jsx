/**
 * Helpdesk pages — TicketsPage (list), TicketDetailPage (thread),
 * TicketsKanbanPage (drag-drop), HelpdeskAgentsPage, KnowledgeBasePage.
 *
 * Backend: /api/v1/helpdesk/tickets/* (helpdesk.py router)
 * Real-time: ws events helpdesk.ticket.created / .updated / .reply / .resolved
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Search, Plus, Clock, CheckCircle, AlertTriangle, Headphones, BookOpen,
  Star, User, X, Mail, Phone, ArrowLeft, Send, MessageSquare, Lock,
  Filter, ChevronRight, Wifi, WifiOff, LayoutGrid, List as ListIcon,
  Tag, Activity, Building2, AlertCircle,
} from 'lucide-react'
import {
  DndContext, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { ticketsAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { useRealtime, useRealtimeEvent } from '../../contexts/RealtimeContext'
import { usePermissions } from '../../hooks/usePermissions'
import {
  Card, CardHeader, CardBody,
  Button,
  PageHeader,
  Badge,
  Input, Select, Textarea, Field,
  Modal,
  Avatar,
  EmptyState,
  Segmented,
  Spinner,
  Skeleton,
} from '../../components/ui/primitives'

// ═══════════════════════════════════════════════════════════════════
// Shared UI helpers
// ═══════════════════════════════════════════════════════════════════

const STATUS_OPTIONS = [
  { value: 'open',                    label: 'Open',           color: 'amber'   },
  { value: 'in_progress',             label: 'In Progress',    color: 'blue'    },
  { value: 'waiting_on_customer',     label: 'Waiting',        color: 'purple'  },
  { value: 'waiting_on_third_party',  label: 'Blocked',        color: 'slate'   },
  { value: 'resolved',                label: 'Resolved',       color: 'emerald' },
  { value: 'closed',                  label: 'Closed',         color: 'slate'   },
  { value: 'reopened',                label: 'Reopened',       color: 'rose'    },
]

const PRIORITY_OPTIONS = [
  { value: 'low',      label: 'Low',      color: 'slate'  },
  { value: 'medium',   label: 'Medium',   color: 'amber'  },
  { value: 'high',     label: 'High',     color: 'orange' },
  { value: 'urgent',   label: 'Urgent',   color: 'red'    },
  { value: 'critical', label: 'Critical', color: 'rose'   },
]

const CATEGORY_OPTIONS = [
  { value: 'technical',       label: 'Technical' },
  { value: 'billing',         label: 'Billing' },
  { value: 'sales',           label: 'Sales' },
  { value: 'general',         label: 'General' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'bug_report',      label: 'Bug Report' },
  { value: 'voice_ai',        label: 'Voice AI' },
  { value: 'crm',             label: 'CRM' },
  { value: 'integration',     label: 'Integration' },
  { value: 'other',           label: 'Other' },
]

// Map ticket statuses to Badge tones
const STATUS_TONE = {
  open:                   'warning',
  in_progress:            'info',
  waiting_on_customer:    'purple',
  waiting_on_third_party: 'default',
  resolved:               'success',
  closed:                 'default',
  reopened:               'danger',
}

// Map ticket priorities to Badge tones
const PRIORITY_TONE = {
  low:      'default',
  medium:   'warning',
  high:     'warning',
  urgent:   'danger',
  critical: 'danger',
}

const PRIORITY_BAR_COLORS = {
  low: 'bg-slate-300', medium: 'bg-amber-400', high: 'bg-orange-500',
  urgent: 'bg-red-500', critical: 'bg-rose-600',
}

function StatusChip({ value }) {
  if (!value) return null
  const tone = STATUS_TONE[value] || 'default'
  return (
    <Badge tone={tone} dot>
      {value.replace(/_/g, ' ')}
    </Badge>
  )
}

function PriorityChip({ value }) {
  if (!value) return null
  const tone = PRIORITY_TONE[value] || 'default'
  return (
    <Badge tone={tone}>
      {value}
    </Badge>
  )
}

function formatTimeAgo(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const h = Math.floor(diffMin / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  } catch { return '' }
}

function formatFull(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString() } catch { return iso }
}


// ═══════════════════════════════════════════════════════════════════
// Kanban column definitions (used by TicketsPage kanban view)
// ═══════════════════════════════════════════════════════════════════

const KANBAN_COLUMNS = [
  { id: 'open',                label: 'Open',           color: 'amber'   },
  { id: 'in_progress',         label: 'In Progress',    color: 'blue'    },
  { id: 'waiting_on_customer', label: 'Waiting',        color: 'purple'  },
  { id: 'resolved',            label: 'Resolved',       color: 'emerald' },
]

// ═══════════════════════════════════════════════════════════════════
// TicketsPage — unified list + kanban view with real data + real-time
// ═══════════════════════════════════════════════════════════════════

export function TicketsPage({ initialView = 'list' } = {}) {
  const { can } = usePermissions()
  const navigate = useNavigate()
  const canCreate = can('helpdesk', 'create')

  const [searchParams, setSearchParams] = useSearchParams()
  const urlView = searchParams.get('view')
  const viewMode = urlView === 'kanban' || urlView === 'list' ? urlView : initialView
  const setViewMode = (v) => {
    const next = new URLSearchParams(searchParams)
    if (v === 'list') next.delete('view')
    else next.set('view', v)
    setSearchParams(next, { replace: true })
  }

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const { connected } = useRealtime()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page: 1, page_size: 100 }
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      const res = await ticketsAPI.getAll(params)
      setTickets(res.data?.items || res.data || [])
      setError(null)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, priorityFilter])

  useEffect(() => { load() }, [load])

  // ── Real-time: prepend new tickets ──
  useRealtimeEvent('helpdesk.ticket.created', (payload) => {
    setTickets((prev) => {
      if (prev.some((t) => t.id === payload.id)) return prev
      return [payload, ...prev]
    })
    toast.success(`New ticket: ${payload.subject}`, { icon: '🎫' })
  })

  useRealtimeEvent('helpdesk.ticket.updated', (payload) => {
    setTickets((prev) => prev.map((t) => (t.id === payload.id ? { ...t, ...payload } : t)))
  })

  useRealtimeEvent('helpdesk.ticket.resolved', (payload) => {
    setTickets((prev) => prev.map((t) => (t.id === payload.id ? { ...t, ...payload } : t)))
  })

  // ── Client-side search filter ──
  const filtered = useMemo(() => {
    if (!query.trim()) return tickets
    const q = query.toLowerCase()
    return tickets.filter((t) =>
      t.subject?.toLowerCase().includes(q) ||
      t.ticket_number?.toLowerCase().includes(q) ||
      t.customer_name?.toLowerCase().includes(q) ||
      t.customer_email?.toLowerCase().includes(q)
    )
  }, [tickets, query])

  // ── Counts by status (across all tickets, ignoring filter) ──
  const counts = useMemo(() => {
    const c = {}
    for (const t of tickets) {
      const s = t.status || 'open'
      c[s] = (c[s] || 0) + 1
    }
    return c
  }, [tickets])

  // ── Kanban: group filtered tickets by column ──
  const ticketsByColumn = useMemo(() => {
    const groups = {}
    for (const col of KANBAN_COLUMNS) groups[col.id] = []
    for (const t of filtered) {
      const status = t.status || 'open'
      if (groups[status]) groups[status].push(t)
    }
    return groups
  }, [filtered])

  const handleDragEnd = async (event) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const ticketId = active.id
    const newStatus = over.id
    const ticket = tickets.find((t) => String(t.id) === String(ticketId))
    if (!ticket || ticket.status === newStatus) return

    // Optimistic update
    setTickets((prev) =>
      prev.map((t) => (String(t.id) === String(ticketId) ? { ...t, status: newStatus } : t))
    )

    try {
      await ticketsAPI.updateStatus(ticketId, newStatus)
      toast.success(`Moved to ${newStatus.replace(/_/g, ' ')}`, { duration: 1500 })
    } catch (e) {
      toast.error('Failed to move ticket')
      load() // revert
    }
  }

  const activeTicket = tickets.find((t) => String(t.id) === String(activeId))

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            Support Tickets
            <Badge tone={connected ? 'success' : 'default'} dot>
              {connected ? 'Live' : 'Offline'}
            </Badge>
          </span>
        }
        subtitle="Manage customer issues and support requests"
        actions={
          <>
            <Segmented
              options={[
                { value: 'list', label: <span className="inline-flex items-center gap-1.5"><ListIcon className="w-3.5 h-3.5" />List</span> },
                { value: 'kanban', label: <span className="inline-flex items-center gap-1.5"><LayoutGrid className="w-3.5 h-3.5" />Kanban</span> },
              ]}
              value={viewMode}
              onChange={setViewMode}
            />
            {canCreate && (
              <Button
                variant="primary"
                size="md"
                leftIcon={Plus}
                onClick={() => setShowCreate(true)}
              >
                New Ticket
              </Button>
            )}
          </>
        }
      />

      {/* ── Status filter chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <StatusFilterCard
          active={statusFilter === ''}
          label="All"
          count={tickets.length}
          color="slate"
          onClick={() => setStatusFilter('')}
        />
        {STATUS_OPTIONS.slice(0, 6).map((s) => (
          <StatusFilterCard
            key={s.value}
            active={statusFilter === s.value}
            label={s.label}
            count={counts[s.value] || 0}
            color={s.color}
            onClick={() => setStatusFilter(statusFilter === s.value ? '' : s.value)}
          />
        ))}
      </div>

      {/* ── Search + priority filter ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-md">
          <Input
            leftIcon={Search}
            type="text"
            placeholder="Search by subject, number, or customer…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <Select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* ── Body: list or kanban ── */}
      {viewMode === 'list' ? (
        <Card>
          {loading && (
            <CardBody>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardBody>
          )}
          {error && (
            <CardBody>
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5" /> {error}
              </div>
            </CardBody>
          )}
          {!loading && !error && filtered.length === 0 && (
            <EmptyState
              icon={Headphones}
              title="No tickets match your filters"
              description="Try adjusting your filters or search query."
              action={
                canCreate && (
                  <Button variant="secondary" size="sm" onClick={() => setShowCreate(true)}>
                    Create the first ticket
                  </Button>
                )
              }
            />
          )}
          {!loading && !error && filtered.length > 0 && (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filtered.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => navigate(`/helpdesk/tickets/${t.id}`)}
                    className="group w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-1 self-stretch rounded-full ${PRIORITY_BAR_COLORS[t.priority] || 'bg-slate-300'}`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-mono text-slate-400">{t.ticket_number || `#${t.id}`}</span>
                          <StatusChip value={t.status} />
                          <PriorityChip value={t.priority} />
                          {t.category && (
                            <span className="text-[10px] text-slate-500 capitalize">{t.category.replace(/_/g, ' ')}</span>
                          )}
                        </div>
                        <p className="font-medium text-slate-900 dark:text-white truncate group-hover:text-slate-700">{t.subject}</p>
                        {t.description && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">{t.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 flex-wrap">
                          {t.customer_name && (
                            <span className="inline-flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {t.customer_name}
                            </span>
                          )}
                          {t.customer_email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {t.customer_email}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(t.created_at)}
                          </span>
                          {t.assigned_to && (
                            <span className="inline-flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Assigned
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-slate-300 mt-1 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        // ── Kanban view ──
        <div>
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardBody className="space-y-3">
                    <Skeleton className="h-5 w-1/2" />
                    {[...Array(3)].map((_, j) => (
                      <Skeleton key={j} className="h-20 w-full" />
                    ))}
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
          {error && (
            <Card>
              <CardBody>
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5" /> {error}
                </div>
              </CardBody>
            </Card>
          )}
          {!loading && !error && (
            <DndContext
              sensors={sensors}
              onDragStart={(e) => setActiveId(e.active.id)}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveId(null)}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {KANBAN_COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.id}
                    column={col}
                    tickets={ticketsByColumn[col.id] || []}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeTicket && <KanbanCard ticket={activeTicket} dragging />}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      )}

      {showCreate && (
        <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />
      )}
    </div>
  )
}

function StatusFilterCard({ active, label, count, color, onClick }) {
  const ringColors = {
    slate: 'ring-slate-900', amber: 'ring-amber-500', blue: 'ring-blue-500',
    purple: 'ring-purple-500', emerald: 'ring-emerald-500', rose: 'ring-rose-500',
  }
  const dotColors = {
    slate: 'bg-slate-400', amber: 'bg-amber-500', blue: 'bg-blue-500',
    purple: 'bg-purple-500', emerald: 'bg-emerald-500', rose: 'bg-rose-500',
  }
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl p-3 transition-all ${
        active
          ? `bg-white dark:bg-slate-900 border-2 ${ringColors[color] || ringColors.slate} shadow-sm`
          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.04)]'
      }`}
    >
      <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{count}</p>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[color]}`} />
        <span className="text-[11px] text-slate-600 dark:text-slate-400">{label}</span>
      </div>
    </button>
  )
}


// ═══════════════════════════════════════════════════════════════════
// Create Ticket Modal
// ═══════════════════════════════════════════════════════════════════

function CreateTicketModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    subject: '', description: '', priority: 'medium', category: 'general',
    customer_name: '', customer_email: '', customer_phone: '', channel: 'web',
  })
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!form.subject.trim()) return toast.error('Subject is required')
    setSubmitting(true)
    try {
      await ticketsAPI.create(form)
      toast.success('Ticket created')
      onCreated()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create ticket')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New Support Ticket"
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={Plus}
            loading={submitting}
            onClick={submit}
          >
            Create Ticket
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Subject" required>
          <Input
            type="text"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Brief summary of the issue"
            autoFocus
          />
        </Field>
        <Field label="Description">
          <Textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the issue in detail…"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <Select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Customer Name">
            <Input
              type="text"
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              placeholder="John Doe"
            />
          </Field>
          <Field label="Customer Email">
            <Input
              type="email"
              value={form.customer_email}
              onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
              placeholder="customer@example.com"
            />
          </Field>
        </div>
        <Field label="Customer Phone">
          <Input
            type="tel"
            value={form.customer_phone}
            onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
            placeholder="+91 98765 43210"
          />
        </Field>
      </form>
    </Modal>
  )
}


// ═══════════════════════════════════════════════════════════════════
// TicketDetailPage — thread + reply composer + side panel
// ═══════════════════════════════════════════════════════════════════

export function TicketDetailPage() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ticketsAPI.getById(ticketId)
      setTicket(res.data)
      setError(null)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => { load() }, [load])

  // ── Real-time: append replies ──
  useRealtimeEvent('helpdesk.ticket.reply', (payload) => {
    if (String(payload.ticket_id) !== String(ticketId)) return
    setTicket((prev) => {
      if (!prev) return prev
      if ((prev.replies || []).some((r) => r.id === payload.id)) return prev
      return { ...prev, replies: [...(prev.replies || []), payload] }
    })
  })

  useRealtimeEvent('helpdesk.ticket.updated', (payload) => {
    if (String(payload.id) !== String(ticketId)) return
    setTicket((prev) => (prev ? { ...prev, ...payload } : prev))
  })

  useRealtimeEvent('helpdesk.ticket.resolved', (payload) => {
    if (String(payload.id) !== String(ticketId)) return
    setTicket((prev) => (prev ? { ...prev, ...payload } : prev))
  })

  const handleStatusChange = async (newStatus) => {
    try {
      await ticketsAPI.updateStatus(ticketId, newStatus)
      toast.success(`Status: ${newStatus.replace(/_/g, ' ')}`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update status')
    }
  }

  const handlePriorityChange = async (newPriority) => {
    try {
      await ticketsAPI.updatePriority(ticketId, newPriority)
      toast.success(`Priority: ${newPriority}`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed')
    }
  }

  const handleResolve = async () => {
    if (!confirm('Mark this ticket as resolved?')) return
    try {
      await ticketsAPI.resolve(ticketId)
      toast.success('Ticket resolved')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to resolve')
    }
  }

  const handleReply = async (e) => {
    e.preventDefault()
    if (!replyText.trim()) return
    setSubmitting(true)
    try {
      await ticketsAPI.addReply(ticketId, {
        body: replyText.trim(),
        is_internal: isInternal,
        sender_type: 'agent',
        sender_name: user?.name,
        sender_email: user?.email,
      })
      setReplyText('')
      setIsInternal(false)
      toast.success(isInternal ? 'Internal note added' : 'Reply sent')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send reply')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-5">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }
  if (error || !ticket) {
    return (
      <EmptyState
        icon={AlertCircle}
        title={error || 'Ticket not found'}
        description="This ticket may have been deleted or you may not have permission to view it."
        action={
          <Button variant="secondary" size="sm" leftIcon={ArrowLeft} onClick={() => navigate('/helpdesk/tickets')}>
            Back to tickets
          </Button>
        }
      />
    )
  }

  const replies = ticket.replies || []
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed'

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <Button
        variant="ghost"
        size="sm"
        leftIcon={ArrowLeft}
        onClick={() => navigate('/helpdesk/tickets')}
      >
        Back to tickets
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Main column ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Ticket header card */}
          <Card>
            <CardBody>
              <div className="flex items-start gap-3 mb-3 flex-wrap">
                <span className="text-xs font-mono text-slate-500">{ticket.ticket_number || `#${ticket.id}`}</span>
                <StatusChip value={ticket.status} />
                <PriorityChip value={ticket.priority} />
                {ticket.category && (
                  <Badge tone="default">{ticket.category.replace(/_/g, ' ')}</Badge>
                )}
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{ticket.subject}</h1>
              {ticket.description && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {ticket.description}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Replies thread */}
          {replies.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-1">
                Conversation ({replies.length})
              </h3>
              {replies.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-2xl border p-5 ${
                    r.is_internal
                      ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
                      : r.sender_type === 'customer'
                      ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar
                      name={r.sender_name || r.sender_email || '?'}
                      size={28}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        {r.sender_name || r.sender_email || 'Unknown'}
                        <span className="text-[10px] text-slate-400 font-normal capitalize">· {r.sender_type}</span>
                        {r.is_internal && (
                          <Badge tone="warning">
                            <Lock className="w-2.5 h-2.5 inline mr-0.5" />
                            Internal Note
                          </Badge>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400">{formatTimeAgo(r.created_at)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed pl-9">{r.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* Reply composer */}
          {!isResolved && (
            <Card>
              <CardBody>
                <form onSubmit={handleReply} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {isInternal ? 'Internal note (not visible to customer)' : 'Reply to customer'}
                    </p>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500"
                      />
                      Internal note
                    </label>
                  </div>
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={4}
                    placeholder={isInternal ? 'Add an internal note for your team…' : 'Type your reply…'}
                    className={isInternal ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' : ''}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      leftIcon={Send}
                      loading={submitting}
                      disabled={!replyText.trim()}
                    >
                      {isInternal ? 'Add Note' : 'Send Reply'}
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          )}
        </div>

        {/* ── Side panel ── */}
        <aside className="space-y-4">
          {/* Actions */}
          <Card>
            <CardHeader title="Actions" />
            <CardBody className="space-y-3">
              <Field label="Status">
                <Select
                  value={ticket.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-full"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Priority">
                <Select
                  value={ticket.priority}
                  onChange={(e) => handlePriorityChange(e.target.value)}
                  className="w-full"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </Select>
              </Field>

              {!isResolved && (
                <Button
                  variant="success"
                  size="md"
                  leftIcon={CheckCircle}
                  onClick={handleResolve}
                  className="w-full justify-center"
                >
                  Mark Resolved
                </Button>
              )}
            </CardBody>
          </Card>

          {/* Customer */}
          {(ticket.customer_name || ticket.customer_email) && (
            <Card>
              <CardHeader title="Customer" />
              <CardBody>
                <dl className="space-y-2 text-sm">
                  {ticket.customer_name && (
                    <Detail icon={User} label="Name" value={ticket.customer_name} />
                  )}
                  {ticket.customer_email && (
                    <Detail icon={Mail} label="Email" value={ticket.customer_email} />
                  )}
                  {ticket.customer_phone && (
                    <Detail icon={Phone} label="Phone" value={ticket.customer_phone} />
                  )}
                </dl>
              </CardBody>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <dl className="space-y-2 text-xs">
                <Detail icon={Tag} label="Number" value={ticket.ticket_number} />
                <Detail icon={Activity} label="Channel" value={ticket.channel} />
                <Detail icon={Clock} label="Created" value={formatFull(ticket.created_at)} />
                {ticket.resolved_at && (
                  <Detail icon={CheckCircle} label="Resolved" value={formatFull(ticket.resolved_at)} />
                )}
                {ticket.sla_due_at && (
                  <Detail icon={AlertTriangle} label="SLA Due" value={formatFull(ticket.sla_due_at)} />
                )}
              </dl>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function Detail({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <span className="text-slate-500">{label}</span>
        <p className="text-slate-900 dark:text-white font-medium truncate">{value}</p>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════
// TicketsKanbanPage — thin wrapper that mounts TicketsPage in kanban
// view, kept for backwards compatibility with the /helpdesk/kanban route.
// ═══════════════════════════════════════════════════════════════════

export function TicketsKanbanPage() {
  return <TicketsPage initialView="kanban" />
}

function KanbanColumn({ column, tickets }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const colorMap = {
    amber: 'bg-amber-500', blue: 'bg-blue-500',
    purple: 'bg-purple-500', emerald: 'bg-emerald-500',
  }

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-2 transition-colors ${
        isOver
          ? 'border-slate-400 bg-slate-100 dark:bg-slate-800'
          : 'border-transparent bg-slate-50 dark:bg-slate-900/50'
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${colorMap[column.color]}`} />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{column.label}</h3>
          <Badge tone="default">{tickets.length}</Badge>
        </div>
      </div>

      {/* Cards */}
      <div className="p-3 space-y-2 min-h-[300px]">
        {tickets.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400">No tickets</div>
        )}
        {tickets.map((t) => (
          <KanbanCard key={t.id} ticket={t} />
        ))}
      </div>
    </div>
  )
}

function KanbanCard({ ticket, dragging }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ticket.id })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onDoubleClick={() => navigate(`/helpdesk/tickets/${ticket.id}`)}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${
        isDragging || dragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className={`w-1 self-stretch rounded-full ${PRIORITY_BAR_COLORS[ticket.priority] || 'bg-slate-300'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-slate-400 mb-0.5">{ticket.ticket_number || `#${ticket.id}`}</p>
          <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug">{ticket.subject}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <PriorityChip value={ticket.priority} />
        {ticket.customer_name && (
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
            <User className="w-2.5 h-2.5" />
            {ticket.customer_name.split(' ')[0]}
          </span>
        )}
      </div>
      <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
        <Clock className="w-2.5 h-2.5" />
        {formatTimeAgo(ticket.created_at)}
      </div>
    </div>
  )
}
