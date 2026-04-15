/**
 * Super Admin Dashboard — Platform Overview
 * Upgraded to use design system primitives consistently.
 * All state, effects, and API calls are preserved exactly.
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Building2, Users, Plus, Ticket, AlertCircle, ChevronRight,
  CreditCard, TrendingUp, Activity, ArrowUpRight, Sparkles,
} from 'lucide-react'
import { superAdminAPI } from '../../services/api'
import {
  Card, CardHeader, CardBody,
  Stat,
  Button,
  PageHeader,
  Badge, StatusBadge,
  EmptyState,
  Skeleton,
  Spinner,
} from '../../components/ui/primitives'

// Priority tone mapping for Badge
const PRIORITY_TONE = {
  urgent: 'danger',
  high: 'warning',
  medium: 'warning',
  low: 'default',
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [tenants, setTenants] = useState([])
  const [tickets, setTickets] = useState({ total: 0, counts_by_status: {}, tickets: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [statsRes, tenantsRes, ticketsRes] = await Promise.all([
          superAdminAPI.getStats(),
          superAdminAPI.listTenants(),
          superAdminAPI.listTickets(),
        ])
        if (cancelled) return
        setStats(statsRes.data)
        setTenants(tenantsRes.data || [])
        setTickets(ticketsRes.data || { total: 0, counts_by_status: {}, tickets: [] })
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.detail || e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        {/* Body skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="lg:col-span-2 h-80 rounded-2xl" />
          <div className="space-y-5">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-rose-200 dark:border-rose-500/30">
          <CardBody>
            <div className="flex items-center gap-2 font-semibold text-rose-600 dark:text-rose-400 mb-2">
              <AlertCircle className="w-5 h-5" />
              Failed to load dashboard
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">{error}</p>
          </CardBody>
        </Card>
      </div>
    )
  }

  const openTickets = tickets.counts_by_status?.open || 0
  const inProgressTickets = tickets.counts_by_status?.in_progress || 0
  const urgentTickets = (tickets.tickets || []).filter(
    (t) => t.priority === 'urgent' && t.status !== 'resolved'
  ).length

  const recentTickets = (tickets.tickets || []).slice(0, 5)

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Page header */}
      <PageHeader
        breadcrumbs={[{ label: 'Platform Overview' }]}
        title="Welcome back"
        subtitle="Here's what's happening across your platform today."
        actions={
          <Button
            variant="primary"
            leftIcon={Plus}
            onClick={() => navigate('/admin/tenants')}
          >
            New Tenant
          </Button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Stat
          label="Total Tenants"
          value={Number(stats?.total_tenants || 0).toLocaleString()}
          icon={Building2}
          accent="#7c3aed"
          accentTo="#4f46e5"
        />
        <Stat
          label="Active Tenants"
          value={Number(stats?.active_tenants || 0).toLocaleString()}
          icon={Activity}
          accent="#10b981"
          accentTo="#0891b2"
        />
        <Stat
          label="Total Users"
          value={Number(stats?.total_users || 0).toLocaleString()}
          icon={Users}
          accent="#3b82f6"
          accentTo="#7c3aed"
        />
        <Stat
          label="Open Tickets"
          value={Number(openTickets).toLocaleString()}
          icon={Ticket}
          accent="#f59e0b"
          accentTo="#ef4444"
        />
        <Stat
          label="Urgent"
          value={Number(urgentTickets).toLocaleString()}
          icon={AlertCircle}
          accent="#f43f5e"
          accentTo="#a855f7"
        />
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent Tickets — main column */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader
            title="Recent Support Tickets"
            subtitle="Latest issues raised by tenants"
            action={
              <Link
                to="/admin/tickets"
                className="text-xs font-medium flex items-center gap-1 group text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                View all
                <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            }
          />
          <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
            {recentTickets.length === 0 && (
              <EmptyState
                icon={Ticket}
                title="No support tickets yet"
                description="New tickets raised by tenants will appear here."
              />
            )}
            {recentTickets.map((t) => (
              <Link
                key={t.id}
                to={`/admin/tickets/${t.id}`}
                className="block px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge tone={PRIORITY_TONE[t.priority] || 'default'}>
                        {t.priority}
                      </Badge>
                      <StatusBadge status={t.status} />
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {t.tenant_name || t.tenant_id}
                      </span>
                    </div>
                    <p className="font-medium text-slate-900 dark:text-white truncate group-hover:text-[color:var(--brand-primary)] transition-colors">
                      {t.subject}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      Raised by {t.raised_by_name || t.raised_by_email || 'unknown'}
                      {t.reply_count > 0 &&
                        ` · ${t.reply_count} ${t.reply_count === 1 ? 'reply' : 'replies'}`}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 mt-1 transition-all group-hover:text-[color:var(--brand-primary)] group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {/* Right column */}
        <div className="space-y-5">

          {/* Tenants quick list */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Tenants"
              action={
                <Link
                  to="/admin/tenants"
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Manage →
                </Link>
              }
            />
            <div className="divide-y divide-slate-50 dark:divide-slate-800/60 max-h-72 overflow-y-auto">
              {tenants.slice(0, 6).map((tenant) => (
                <Link
                  key={tenant.id}
                  to={`/admin/tenants/${tenant.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                    style={{ background: tenant.primary_color || 'var(--brand-primary)' }}
                  >
                    {tenant.name?.[0] || 'T'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate text-xs">
                      {tenant.name}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      {tenant.user_count || 0} users · {tenant.plan_id}
                    </p>
                  </div>
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      tenant.is_active
                        ? 'bg-emerald-400'
                        : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  />
                </Link>
              ))}
              {tenants.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs">No tenants yet</div>
              )}
            </div>
          </Card>

          {/* Ticket status breakdown */}
          <Card className="overflow-hidden">
            <CardHeader title="Ticket Status" />
            <CardBody className="space-y-2.5">
              {[
                { label: 'Open', count: openTickets, tone: 'warning' },
                { label: 'In Progress', count: inProgressTickets, tone: 'info' },
                { label: 'Waiting Tenant', count: tickets.counts_by_status?.waiting_tenant || 0, tone: 'purple' },
                { label: 'Resolved', count: tickets.counts_by_status?.resolved || 0, tone: 'success' },
              ].map(({ label, count, tone }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <Badge tone={tone} dot>{label}</Badge>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {count}
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>

        </div>
      </div>
    </div>
  )
}
