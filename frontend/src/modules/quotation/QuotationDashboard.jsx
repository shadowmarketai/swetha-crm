/**
 * Quotation Dashboard — Stats + Recent Quotations
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  IndianRupee,
  Layers,
  Inbox as InboxIcon,
  ArrowRight,
} from 'lucide-react'
import { quotationAPI, quotationTemplateAPI } from '../../services/api'
import { usePermissions } from '../../hooks/usePermissions'
import {
  Card,
  CardHeader,
  Stat,
  Button,
  StatusBadge,
  PageHeader,
  EmptyState,
  Skeleton,
} from '../../components/ui/primitives'

const mockStats = { total: 0, draft: 0, sent: 0, accepted: 0, rejected: 0, revised: 0, total_amount: 0, monthly_amount: 0 }

export default function QuotationDashboard() {
  const [stats, setStats] = useState(mockStats)
  const [quotations, setQuotations] = useState([])
  const [templateCount, setTemplateCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const { can } = usePermissions()

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, listRes, templatesRes] = await Promise.all([
          quotationAPI.getStats(),
          quotationAPI.getAll({ page_size: 10 }),
          quotationTemplateAPI.list().catch(() => ({ data: [] })),
        ])
        setStats(statsRes.data)
        setQuotations(listRes.data?.items || [])
        const tData = templatesRes?.data
        const templates = Array.isArray(tData) ? tData : (tData?.items || [])
        setTemplateCount(
          templates.filter((t) => t.is_active === undefined || t.is_active).length
        )
      } catch {
        // fallback to mock
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const statCards = [
    {
      label: 'Total Quotes',
      value: stats.total,
      icon: FileText,
      accent: '#6366f1',
      accentTo: '#8b5cf6',
    },
    {
      label: 'Draft',
      value: stats.draft,
      icon: Clock,
      accent: '#64748b',
      accentTo: '#475569',
    },
    {
      label: 'Sent',
      value: stats.sent,
      icon: Send,
      accent: '#f59e0b',
      accentTo: '#f43f5e',
    },
    {
      label: 'Accepted',
      value: stats.accepted,
      icon: CheckCircle,
      accent: '#10b981',
      accentTo: '#06b6d4',
    },
    {
      label: 'Rejected',
      value: stats.rejected,
      icon: XCircle,
      accent: '#ef4444',
      accentTo: '#f43f5e',
    },
    {
      label: 'Monthly Revenue',
      value: `Rs. ${(stats.monthly_amount || 0).toLocaleString('en-IN')}`,
      icon: IndianRupee,
      accent: '#ec4899',
      accentTo: '#8b5cf6',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Premium hero header with gradient blob background */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 sm:px-8 py-7">
        <div
          className="pointer-events-none absolute -top-24 -right-16 w-[420px] h-[420px] rounded-full opacity-30 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, var(--brand-primary), transparent 65%)',
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-24 w-[380px] h-[380px] rounded-full opacity-25 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, var(--brand-accent, var(--brand-primary)), transparent 65%)',
          }}
        />
        <div className="relative">
          <PageHeader
            title="PEB Quotations"
            subtitle="Manage pre-engineered building quotations"
            actions={
              <>
                <Link to="/quotation/inbox">
                  <Button variant="secondary" leftIcon={InboxIcon}>
                    Review Inbox
                  </Button>
                </Link>
                <Link to="/quotation/templates">
                  <Button variant="secondary" leftIcon={Layers}>
                    Manage Templates
                  </Button>
                </Link>
                {can('quotation', 'create') && (
                  <Link to="/quotation/new">
                    <Button leftIcon={Plus}>New Quotation</Button>
                  </Link>
                )}
              </>
            }
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <Stat
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            accent={card.accent}
            accentTo={card.accentTo}
          />
        ))}
      </div>

      {/* Template Studio tile */}
      <Link to="/quotation/templates" className="block group">
        <Card hover className="p-5">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0"
              style={{
                background:
                  'linear-gradient(135deg, var(--brand-primary), var(--brand-accent, var(--brand-primary)))',
              }}
            >
              <Layers className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Template Studio
                </h3>
                <span className="text-xs text-slate-500">
                  {templateCount} active{' '}
                  {templateCount === 1 ? 'template' : 'templates'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Create, edit and manage reusable quotation templates.
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </div>
        </Card>
      </Link>

      {/* Recent Quotations */}
      <Card>
        <CardHeader
          title="Recent Quotations"
          subtitle="Latest 10 quotations across projects"
          action={
            <Link to="/quotation/history">
              <Button variant="ghost" size="sm" rightIcon={ArrowRight}>
                View All
              </Button>
            </Link>
          }
        />
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : quotations.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No quotations yet"
            description="Create your first quotation to see it here."
            action={
              can('quotation', 'create') && (
                <Link to="/quotation/new">
                  <Button leftIcon={Plus}>New Quotation</Button>
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">
                    ID
                  </th>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">
                    Project
                  </th>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">
                    Client
                  </th>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">
                    Amount
                  </th>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">
                    Status
                  </th>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">
                    Rev
                  </th>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-white/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-6 py-3.5 font-mono text-slate-600 dark:text-slate-400">
                      Q-{q.id}
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-900 dark:text-white">
                      {q.project_name}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400">
                      {q.client_name || '—'}
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-900 dark:text-white tabular-nums">
                      Rs. {(q.total_amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={q.status} />
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">
                      v{q.revision}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">
                      {q.created_at
                        ? new Date(q.created_at).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
