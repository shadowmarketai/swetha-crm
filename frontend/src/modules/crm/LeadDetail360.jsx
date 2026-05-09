/**
 * Lead 360° View — Unified entity page
 *
 * Shows EVERYTHING linked to a lead in one view:
 *   - Lead info (name, email, phone, company, status, score)
 *   - Company details (if linked)
 *   - Contacts at that company
 *   - Deals in pipeline
 *   - Quotations generated
 *   - Activities (calls, emails, meetings, notes)
 *   - Helpdesk tickets
 *   - Real-time updates via WebSocket
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Phone, Mail, Building2, User, IndianRupee, FileText,
  Calendar, MessageSquare, CheckCircle, Clock, Target, TrendingUp,
  Edit, Trash2, Plus, Send, Activity, Headphones, ChevronRight,
} from 'lucide-react'
import {
  Card, CardHeader, CardBody, Stat, Button, PageHeader, Badge,
  StatusBadge, Avatar, EmptyState, Skeleton, Tabs,
} from '../../components/ui/primitives'
import api, { leadsAPI, quotationAPI } from '../../services/api'
import { useRealtimeEvent } from '../../contexts/RealtimeContext'

const fmtINR = (n) => n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function LeadDetail360() {
  const { leadId } = useParams()
  const navigate = useNavigate()
  const [lead, setLead] = useState(null)
  const [deals, setDeals] = useState([])
  const [quotations, setQuotations] = useState([])
  const [activities, setActivities] = useState([])
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  const loadAll = async () => {
    setLoading(true)
    try {
      // Fetch lead
      const leadRes = await api.get(`/api/v1/crm-leads/${leadId}`)
      const leadData = leadRes.data
      setLead(leadData)

      // Fetch linked data in parallel
      const [dealsRes, activitiesRes, quotationsRes, ticketsRes] = await Promise.allSettled([
        api.get('/api/v1/crm-deals', { params: { limit: 50, lead_id: String(leadId) } }),
        api.get('/api/v1/crm-activities', { params: { limit: 50, lead_id: leadId } }),
        quotationAPI.getAll({ lead_id: leadId, page_size: 20 }).catch(() => ({ data: { items: [] } })),
        api.get('/api/v1/helpdesk/tickets', { params: { limit: 20, search: leadData.email || leadData.phone } }).catch(() => ({ data: { items: [] } })),
      ])

      if (dealsRes.status === 'fulfilled') {
        const d = dealsRes.value?.data
        setDeals(Array.isArray(d) ? d : d?.items || [])
      }
      if (activitiesRes.status === 'fulfilled') {
        const a = activitiesRes.value?.data
        setActivities(Array.isArray(a) ? a : a?.items || [])
      }
      if (quotationsRes.status === 'fulfilled') {
        const q = quotationsRes.value?.data
        setQuotations(Array.isArray(q) ? q : q?.items || [])
      }
      if (ticketsRes.status === 'fulfilled') {
        const t = ticketsRes.value?.data
        setTickets(Array.isArray(t) ? t : t?.items || [])
      }

    } catch (err) {
      toast.error('Failed to load lead details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (leadId) loadAll() }, [leadId])

  // Real-time updates
  useRealtimeEvent('lead.updated', (payload) => {
    if (String(payload?.id) === String(leadId)) loadAll()
  })
  useRealtimeEvent('deal.created', () => loadAll())
  useRealtimeEvent('deal.updated', () => loadAll())
  useRealtimeEvent('activity.created', () => loadAll())

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (!lead) {
    return <EmptyState icon={User} title="Lead not found" action={<Button variant="secondary" onClick={() => navigate('/crm/leads')}>Back to Leads</Button>} />
  }

  const leadName = lead.name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown'
  const dealTotal = deals.reduce((s, d) => s + (d.value || 0), 0)
  const quoteTotal = quotations.reduce((s, q) => s + (q.total_amount || 0), 0)

  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'deals', label: 'Deals', count: deals.length },
    { value: 'quotes', label: 'Quotations', count: quotations.length },
    { value: 'activities', label: 'Activities', count: activities.length },
    { value: 'tickets', label: 'Tickets', count: tickets.length },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={leadName}
        subtitle={`${lead.company || lead.company_name || ''} · ${lead.source || ''}`}
        breadcrumbs={[{ label: 'CRM', href: '/crm' }, { label: 'Leads', href: '/crm/leads' }, { label: leadName }]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={lead.status} />
            <Button variant="secondary" size="sm" leftIcon={Edit}>Edit</Button>
            <Button size="sm" leftIcon={Plus} onClick={() => navigate(`/quotation/new?leadId=${leadId}`)}>New Quote</Button>
          </div>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Lead Score" value={`${lead.lead_score || lead.score || 0}/100`} icon={Target} accent="#6366f1" />
        <Stat label="Deals" value={deals.length} icon={IndianRupee} accent="#10b981" />
        <Stat label="Pipeline Value" value={fmtINR(dealTotal)} icon={TrendingUp} accent="#f59e0b" />
        <Stat label="Quotations" value={quotations.length} icon={FileText} accent="#8b5cf6" />
        <Stat label="Quote Value" value={fmtINR(quoteTotal)} icon={IndianRupee} accent="#ec4899" />
      </div>

      {/* Contact Info + Company */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader title="Contact Information" />
          <CardBody>
            <div className="space-y-3">
              <InfoRow icon={User} label="Name" value={leadName} />
              <InfoRow icon={Mail} label="Email" value={lead.email} link={`mailto:${lead.email}`} />
              <InfoRow icon={Phone} label="Phone" value={lead.phone || lead.phone_number} link={`tel:${lead.phone}`} />
              <InfoRow icon={Building2} label="Company" value={lead.company || lead.company_name} />
              <InfoRow icon={Target} label="Source" value={lead.source} />
              <InfoRow icon={Calendar} label="Created" value={lead.created_at?.split('T')[0]} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Quick Actions" />
          <CardBody>
            <div className="space-y-2">
              <Button variant="secondary" className="w-full justify-start" leftIcon={Phone} onClick={() => toast('Call feature coming soon')}>Call {leadName}</Button>
              <Button variant="secondary" className="w-full justify-start" leftIcon={Mail} onClick={() => window.open(`mailto:${lead.email}`)}>Send Email</Button>
              <Button variant="secondary" className="w-full justify-start" leftIcon={MessageSquare} onClick={() => toast('WhatsApp integration coming soon')}>WhatsApp</Button>
              <Button variant="secondary" className="w-full justify-start" leftIcon={Calendar} onClick={() => navigate('/appointments')}>Book Meeting</Button>
              <Button variant="secondary" className="w-full justify-start" leftIcon={FileText} onClick={() => navigate(`/quotation/new?leadId=${leadId}`)}>Create Quote</Button>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <Card>
            <CardHeader title="Recent Activities" action={<span className="text-xs text-slate-500">{activities.length} total</span>} />
            <CardBody>
              {activities.length === 0 ? (
                <EmptyState icon={Activity} title="No activities yet" description="Log a call, email, or meeting" />
              ) : (
                <div className="space-y-3">
                  {activities.slice(0, 5).map((a, i) => (
                    <div key={a.id || i} className="flex items-start gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        a.activity_type === 'call' ? 'bg-green-100 text-green-600' :
                        a.activity_type === 'email' ? 'bg-blue-100 text-blue-600' :
                        a.activity_type === 'meeting' ? 'bg-purple-100 text-purple-600' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {a.activity_type === 'call' ? <Phone className="w-4 h-4" /> :
                         a.activity_type === 'email' ? <Mail className="w-4 h-4" /> :
                         a.activity_type === 'meeting' ? <Calendar className="w-4 h-4" /> :
                         <MessageSquare className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{a.subject || a.title}</p>
                        <p className="text-xs text-slate-500 truncate">{a.description}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{a.created_at?.split('T')[0]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Deals */}
          <Card>
            <CardHeader title="Deals" subtitle={`Pipeline: ${fmtINR(dealTotal)}`} />
            <CardBody>
              {deals.length === 0 ? (
                <EmptyState icon={IndianRupee} title="No deals yet" description="Create a deal from a quotation" />
              ) : (
                <div className="space-y-3">
                  {deals.map((d, i) => (
                    <div key={d.id || i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{d.title || d.name}</p>
                        <Badge tone={d.stage === 'closed_won' ? 'success' : d.stage === 'closed_lost' ? 'danger' : 'warning'}>
                          {d.stage?.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-white">{fmtINR(d.value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'deals' && (
        <Card>
          <CardBody>
            {deals.length === 0 ? (
              <EmptyState icon={IndianRupee} title="No deals" action={<Button leftIcon={Plus} onClick={() => navigate('/crm/deals')}>Create Deal</Button>} />
            ) : (
              <div className="space-y-3">
                {deals.map((d, i) => (
                  <div key={d.id || i} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 transition-colors">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{d.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge tone={d.stage === 'closed_won' ? 'success' : d.stage === 'closed_lost' ? 'danger' : d.stage === 'negotiation' ? 'warning' : 'info'}>
                          {d.stage?.replace('_', ' ')}
                        </Badge>
                        {d.probability > 0 && <span className="text-xs text-slate-500">{d.probability}% probability</span>}
                      </div>
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{fmtINR(d.value)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'quotes' && (
        <Card>
          <CardHeader action={<Button size="sm" leftIcon={Plus} onClick={() => navigate(`/quotation/new?leadId=${leadId}`)}>New Quote</Button>} />
          <CardBody>
            {quotations.length === 0 ? (
              <EmptyState icon={FileText} title="No quotations" action={<Button leftIcon={Plus} onClick={() => navigate(`/quotation/new?leadId=${leadId}`)}>Generate Quote</Button>} />
            ) : (
              <div className="space-y-3">
                {quotations.map((q, i) => (
                  <Link key={q.id || i} to={`/quotation/${q.id}`} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-amber-200 transition-colors">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{q.project_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={q.status} />
                        <span className="text-xs text-slate-500">Rev {q.revision} · {q.created_at?.split('T')[0]}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{fmtINR(q.total_amount)}</p>
                      <p className="text-xs text-slate-500">₹{q.rate_per_sqft?.toFixed(0)}/sqft</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'activities' && (
        <Card>
          <CardBody>
            {activities.length === 0 ? (
              <EmptyState icon={Activity} title="No activities logged" description="Log calls, emails, meetings, and notes" />
            ) : (
              <div className="space-y-2">
                {activities.map((a, i) => (
                  <div key={a.id || i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      a.activity_type === 'call' ? 'bg-green-100 text-green-600' :
                      a.activity_type === 'email' ? 'bg-blue-100 text-blue-600' :
                      a.activity_type === 'meeting' ? 'bg-purple-100 text-purple-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {a.activity_type === 'call' ? <Phone className="w-4 h-4" /> :
                       a.activity_type === 'email' ? <Mail className="w-4 h-4" /> :
                       a.activity_type === 'meeting' ? <Calendar className="w-4 h-4" /> :
                       <MessageSquare className="w-4 h-4" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{a.subject}</p>
                      {a.description && <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>}
                      <p className="text-[10px] text-slate-400 mt-1">{a.created_at}</p>
                    </div>
                    <Badge tone="default">{a.activity_type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'tickets' && (
        <Card>
          <CardBody>
            {tickets.length === 0 ? (
              <EmptyState icon={Headphones} title="No support tickets" description="Tickets linked to this lead's email/phone will appear here" />
            ) : (
              <div className="space-y-2">
                {tickets.map((t, i) => (
                  <Link key={t.id || i} to={`/helpdesk/tickets/${t.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{t.subject}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={t.status} />
                        <Badge tone={t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'default'}>{t.priority}</Badge>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, link }) {
  if (!value || value === '-') return null
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <span className="text-xs text-slate-500 w-16">{label}</span>
      {link ? (
        <a href={link} className="text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline truncate">{value}</a>
      ) : (
        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{value}</span>
      )}
    </div>
  )
}
