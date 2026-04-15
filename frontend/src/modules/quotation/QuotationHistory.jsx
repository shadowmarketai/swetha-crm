/**
 * Quotation History — Full list with filters
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Download, Plus } from 'lucide-react'
import { quotationAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  Card,
  Button,
  StatusBadge,
  PageHeader,
  EmptyState,
  SearchInput,
  Segmented,
  Skeleton,
} from '../../components/ui/primitives'

const STATUS_OPTIONS = ['all', 'draft', 'sent', 'accepted', 'rejected', 'revised']

export default function QuotationHistory() {
  const [quotations, setQuotations] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadQuotations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, search])

  async function loadQuotations() {
    setLoading(true)
    try {
      const params = { page, page_size: 20 }
      if (statusFilter !== 'all') params.status = statusFilter
      if (search) params.search = search
      const res = await quotationAPI.getAll(params)
      setQuotations(res.data?.items || [])
      setTotal(res.data?.total || 0)
    } catch {
      setQuotations([])
    } finally {
      setLoading(false)
    }
  }

  const downloadPdf = async (id) => {
    try {
      const res = await quotationAPI.generatePdf(id)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `quotation_${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    } catch {
      toast.error('PDF generation failed')
    }
  }

  const totalPages = Math.ceil(total / 20)

  const segmentOptions = STATUS_OPTIONS.map((s) => ({
    value: s,
    label: s.charAt(0).toUpperCase() + s.slice(1),
  }))

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
            title="Quotation History"
            subtitle="Browse, filter and download every quotation"
            actions={
              <Link to="/quotation/new">
                <Button leftIcon={Plus}>New Quotation</Button>
              </Link>
            }
          />
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <SearchInput
              placeholder="Search by project name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <Segmented
            options={segmentOptions}
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v)
              setPage(1)
            }}
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : quotations.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No quotations found"
            description="Try adjusting your filters or create a new quotation."
            action={
              <Link to="/quotation/new">
                <Button leftIcon={Plus}>New Quotation</Button>
              </Link>
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
                    Lead
                  </th>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-right">
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
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-6 py-3 text-left">
                    Actions
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
                    <td className="px-6 py-3.5 text-slate-500">
                      #{q.lead_id}
                    </td>
                    <td className="px-6 py-3.5 text-right font-medium text-slate-900 dark:text-white tabular-nums">
                      Rs. {(q.total_amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={q.status} />
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">
                      v{q.revision}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 text-xs">
                      {q.created_at
                        ? new Date(q.created_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-6 py-3.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => downloadPdf(q.id)}
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Prev
          </Button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
