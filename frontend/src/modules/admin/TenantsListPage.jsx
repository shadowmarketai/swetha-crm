/**
 * Tenants List — Super Admin
 * Upgraded to use design system primitives.
 * All state, effects, API calls, modal logic, and accessibility preserved exactly.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, Users, X, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { superAdminAPI } from '../../services/api'
import {
  Card, CardHeader, CardBody,
  Button,
  PageHeader,
  DataTable,
  Badge,
  Input, Select, Field, SearchInput,
  Modal,
  Avatar,
  EmptyState,
  Skeleton,
  Pagination,
} from '../../components/ui/primitives'

// Plan badge tones
const PLAN_TONE = {
  enterprise: 'purple',
  professional: 'info',
  starter: 'default',
}

// ── Mobile tenant card ────────────────────────────────────────────────
function TenantCard({ t, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800 rounded-xl p-4 hover:ring-[color:var(--brand-primary)]/40 hover:shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] focus-visible:ring-offset-2"
      aria-label={`View details for ${t.name}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={t.name} size={40} />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white tracking-tight truncate">{t.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{t.slug || t.id}</p>
          </div>
        </div>
        <X className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0 rotate-[-45deg]" aria-hidden="true" />
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Badge tone={PLAN_TONE[t.plan_id] || 'default'}>
          {t.plan_id || '—'}
        </Badge>
        <Badge tone={t.is_active ? 'success' : 'danger'} dot>
          {t.is_active ? 'Active' : 'Suspended'}
        </Badge>
        <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <Users className="w-3 h-3" aria-hidden="true" />
          {t.user_count || 0}/{t.max_users || '∞'}
        </span>
      </div>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────
export default function TenantsListPage() {
  const navigate = useNavigate()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const searchRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await superAdminAPI.listTenants()
      setTenants(res.data || [])
    } catch (e) {
      toast.error('Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = tenants.filter((t) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      t.name?.toLowerCase().includes(q) ||
      t.slug?.toLowerCase().includes(q) ||
      t.id?.toLowerCase().includes(q) ||
      t.plan_id?.toLowerCase().includes(q)
    )
  })

  // DataTable column definitions
  const columns = [
    {
      key: 'name',
      header: 'Tenant',
      render: (t) => (
        <div className="flex items-center gap-3">
          <Avatar name={t.name} size={36} />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white tracking-tight">{t.name}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t.slug || t.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'plan_id',
      header: 'Plan',
      render: (t) => (
        <Badge tone={PLAN_TONE[t.plan_id] || 'default'}>
          {t.plan_id || '—'}
        </Badge>
      ),
    },
    {
      key: 'user_count',
      header: 'Users',
      render: (t) => (
        <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 text-sm">
          <Users className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span aria-label={`${t.user_count || 0} users out of ${t.max_users || 'unlimited'}`}>
            {t.user_count || 0}
            <span className="text-slate-400 dark:text-slate-500">/{t.max_users || '∞'}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (t) => (
        <Badge tone={t.is_active ? 'success' : 'danger'} dot>
          {t.is_active ? 'Active' : 'Suspended'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (t) =>
        t.created_at
          ? new Date(t.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : '—',
    },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Page header */}
      <PageHeader
        title="Tenants"
        subtitle={
          loading
            ? 'Loading tenants…'
            : `${tenants.length} organization${tenants.length !== 1 ? 's' : ''} on the platform`
        }
        actions={
          <Button
            variant="primary"
            leftIcon={Plus}
            onClick={() => setShowCreate(true)}
            aria-label="Create new tenant"
          >
            New Tenant
          </Button>
        }
      />

      {/* Search + stats strip */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="max-w-sm w-full">
          <SearchInput
            ref={searchRef}
            id="tenant-search"
            placeholder="Search by name, slug, or plan…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search tenants by name, slug, or plan"
          />
        </div>
        {!loading && tenants.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              <span className="font-bold text-slate-700 dark:text-white tabular-nums">
                {tenants.length}
              </span>{' '}
              total
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              <span className="font-bold text-emerald-600 tabular-nums">
                {tenants.filter((t) => t.is_active).length}
              </span>{' '}
              active
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              <span className="font-bold text-rose-600 tabular-nums">
                {tenants.filter((t) => !t.is_active).length}
              </span>{' '}
              suspended
            </span>
            {query && (
              <span className="text-slate-500 dark:text-slate-400">
                <span className="font-bold text-slate-700 dark:text-white tabular-nums">
                  {filtered.length}
                </span>{' '}
                matching
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2" role="list" aria-label="Tenants list">
        {loading &&
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        {!loading && filtered.length === 0 && (
          <Card>
            <EmptyState
              icon={query ? Search : Building2}
              title={query ? 'No tenants match your search' : 'No tenants yet'}
              description={
                query
                  ? 'Try a different name, slug, or plan keyword.'
                  : 'Create your first tenant organization to get started.'
              }
              action={
                !query && (
                  <Button variant="primary" leftIcon={Plus} onClick={() => setShowCreate(true)}>
                    New Tenant
                  </Button>
                )
              }
            />
          </Card>
        )}
        {!loading &&
          filtered.map((t) => (
            <div key={t.id} role="listitem">
              <TenantCard t={t} onClick={() => navigate(`/admin/tenants/${t.id}`)} />
            </div>
          ))}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block overflow-hidden">
        {loading ? (
          <CardBody className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </CardBody>
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            onRowClick={(t) => navigate(`/admin/tenants/${t.id}`)}
            empty={
              <EmptyState
                icon={query ? Search : Building2}
                title={query ? 'No tenants match your search' : 'No tenants yet'}
                description={
                  query
                    ? 'Try a different name, slug, or plan keyword.'
                    : 'Create your first tenant organization to get started.'
                }
                action={
                  !query && (
                    <Button variant="primary" leftIcon={Plus} onClick={() => setShowCreate(true)}>
                      New Tenant
                    </Button>
                  )
                }
              />
            }
          />
        )}
      </Card>

      {/* Create tenant modal */}
      {showCreate && (
        <CreateTenantModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
        />
      )}
    </div>
  )
}

// ── Create Tenant Modal ───────────────────────────────────────────────

function CreateTenantModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', slug: '', plan_id: 'starter', max_users: 5, primary_color: '#4f46e5',
  })
  const [submitting, setSubmitting] = useState(false)
  const firstInputRef = useRef(null)
  const modalRef = useRef(null)

  // Focus trap + Escape key — preserved exactly from original
  useEffect(() => {
    firstInputRef.current?.focus()

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus() }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus() }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    setSubmitting(true)
    try {
      await superAdminAPI.createTenant({
        ...form,
        slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      })
      toast.success(`Tenant "${form.name}" created`)
      onCreated()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create tenant')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="New Tenant"
      size="md"
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
            Create Tenant
          </Button>
        </>
      }
    >
      {/* Attach ref to the form for focus-trap targeting */}
      <form ref={modalRef} onSubmit={submit} className="space-y-4">
        <Field label="Tenant Name" required>
          <Input
            ref={firstInputRef}
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Acme Corporation"
            autoComplete="organization"
            required
          />
        </Field>

        <Field
          label="Slug"
          hint="URL-safe identifier (auto-generated from name if left blank)"
        >
          <Input
            type="text"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="acme"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Plan">
            <Select
              value={form.plan_id}
              onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
              className="w-full"
            >
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </Select>
          </Field>

          <Field label="Max Users">
            <Input
              type="number"
              min="1"
              value={form.max_users}
              onChange={(e) =>
                setForm({ ...form, max_users: parseInt(e.target.value) || 1 })
              }
            />
          </Field>
        </div>
      </form>
    </Modal>
  )
}
