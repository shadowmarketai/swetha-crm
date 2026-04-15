/**
 * AppointmentsSetup — single-page tabbed configuration screen.
 *
 * Replaces the old separate /appointments/{services,availability,pages}
 * routes with one consolidated /appointments/setup page that has internal
 * tabs. Real-time: shares the same WebSocket subscriptions as the hub
 * via useAppointmentRealtime() so changes from other clients/tabs reflect
 * instantly.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Briefcase, Clock, Globe, Plug, Plus, Trash2, Copy, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '../../hooks/usePermissions';
import {
  useServices, useCreateService, useDeleteService,
  useAvailability, useSetAvailability,
  useBookingPages, useCreatePage, useDeletePage,
  useAppointmentRealtime,
} from './hooks/useAppointments';
import {
  Card, CardBody, Button, Tabs, Badge, StatusBadge, Input, Select, Field,
  EmptyState, Skeleton, PageHeader,
} from '../../components/ui/primitives';

const TABS = [
  { value: 'services', label: 'Services', icon: Briefcase },
  { value: 'availability', label: 'Availability', icon: Clock },
  { value: 'pages', label: 'Booking pages', icon: Globe },
  { value: 'integrations', label: 'Integrations', icon: Plug },
];

export default function AppointmentsSetup() {
  const [tab, setTab] = useState('services');
  useAppointmentRealtime();

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: 'Appointments', href: '/appointments' },
          { label: 'Setup' },
        ]}
        title="Appointment setup"
        subtitle="Services, weekly hours, public booking pages, and integrations"
        actions={
          <Button variant="ghost" size="md" as={Link} to="/appointments">
            <Link to="/appointments" className="contents inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
          </Button>
        }
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'services' && <ServicesPanel />}
      {tab === 'availability' && <AvailabilityPanel />}
      {tab === 'pages' && <BookingPagesPanel />}
      {tab === 'integrations' && <IntegrationsPanel />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Services
// ════════════════════════════════════════════════════════════

function ServicesPanel() {
  const { can } = usePermissions();
  const canCreate = can('appointments', 'create');
  const canDelete = can('appointments', 'delete');

  const { data: services = [], isLoading } = useServices();
  const createSvc = useCreateService();
  const deleteSvc = useDeleteService();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    duration_min: 30,
    price_cents: 0,
    color: '#6366f1',
    location_type: 'google_meet',
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createSvc.mutate(
      {
        name: form.name.trim(),
        duration_min: Number(form.duration_min),
        price_cents: Number(form.price_cents) * 100,
        color: form.color,
        location_type: form.location_type,
      },
      {
        onSuccess: () => {
          setForm({ name: '', duration_min: 30, price_cents: 0, color: '#6366f1', location_type: 'google_meet' });
          setShowForm(false);
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Bookable event types your clients can select</p>
        {canCreate && (
          <Button variant="primary" size="md" leftIcon={Plus} onClick={() => setShowForm((s) => !s)}>
            Add service
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardBody>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Name (e.g. Product demo)"
                  required
                />
              </div>
              <Input
                type="number"
                min={5}
                value={form.duration_min}
                onChange={(e) => setForm({ ...form, duration_min: e.target.value })}
                placeholder="Duration (min)"
                required
              />
              <Input
                type="number"
                min={0}
                value={form.price_cents}
                onChange={(e) => setForm({ ...form, price_cents: e.target.value })}
                placeholder="Price (₹)"
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={createSvc.isPending}
              >
                Save service
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {isLoading ? (
        <LoadingSkeleton />
      ) : services.length === 0 ? (
        <Card>
          <EmptyState icon={Briefcase} title="No services yet" description="Add your first bookable service above." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {services.map((s) => (
            <Card key={s.id}>
              <CardBody>
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: (s.color || '#6366f1') + '20' }}
                  >
                    <Briefcase className="w-4 h-4" style={{ color: s.color || '#6366f1' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{s.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.duration_min} min · {s.price_cents > 0 ? `₹${s.price_cents / 100}` : 'Free'}
                    </p>
                  </div>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSvc.mutate(s.id)}
                      aria-label="Delete service"
                      className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Availability
// ════════════════════════════════════════════════════════════

const DAYS = [
  { idx: 0, label: 'Mon' },
  { idx: 1, label: 'Tue' },
  { idx: 2, label: 'Wed' },
  { idx: 3, label: 'Thu' },
  { idx: 4, label: 'Fri' },
  { idx: 5, label: 'Sat' },
  { idx: 6, label: 'Sun' },
];

function AvailabilityPanel() {
  const { can } = usePermissions();
  const canUpdate = can('appointments', 'update');
  const { data: rules = [], isLoading } = useAvailability();
  const setAvail = useSetAvailability();

  const initial = DAYS.map((d) => {
    const r = rules.find((x) => x.weekday === d.idx);
    return {
      weekday: d.idx,
      is_open: r ? r.is_open : d.idx < 5,
      start_time: (r?.start_time || '09:00').slice(0, 5),
      end_time: (r?.end_time || '17:00').slice(0, 5),
      timezone: r?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    };
  });

  const [draft, setDraft] = useState(initial);

  const update = (idx, patch) => {
    setDraft((d) => d.map((row) => (row.weekday === idx ? { ...row, ...patch } : row)));
  };

  const save = () => {
    setAvail.mutate(draft);
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Weekly hours when you're available for bookings. All times in your local timezone.
      </p>
      <Card>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {draft.map((row) => {
            const day = DAYS.find((d) => d.idx === row.weekday);
            return (
              <div key={row.weekday} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="flex items-center gap-2 sm:w-32">
                  <input
                    type="checkbox"
                    checked={row.is_open}
                    onChange={(e) => update(row.weekday, { is_open: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600"
                    disabled={!canUpdate}
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{day.label}</span>
                </label>
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="time"
                    value={row.start_time}
                    onChange={(e) => update(row.weekday, { start_time: e.target.value })}
                    disabled={!row.is_open || !canUpdate}
                    className="w-32 disabled:opacity-50"
                  />
                  <span className="text-slate-400">–</span>
                  <Input
                    type="time"
                    value={row.end_time}
                    onChange={(e) => update(row.weekday, { end_time: e.target.value })}
                    disabled={!row.is_open || !canUpdate}
                    className="w-32 disabled:opacity-50"
                  />
                  {!row.is_open && (
                    <Badge tone="default" className="ml-2">Closed</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      {canUpdate && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="md"
            loading={setAvail.isPending}
            onClick={save}
          >
            Save availability
          </Button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Booking pages
// ════════════════════════════════════════════════════════════

function BookingPagesPanel() {
  const { can } = usePermissions();
  const canCreate = can('appointments', 'create');
  const canDelete = can('appointments', 'delete');

  const { data: pages = [], isLoading } = useBookingPages();
  const createPage = useCreatePage();
  const deletePage = useDeletePage();

  const [form, setForm] = useState({ name: '', slug: '' });
  const [showForm, setShowForm] = useState(false);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) return;
    createPage.mutate(
      { name: form.name.trim(), slug: form.slug.trim().toLowerCase(), status: 'draft' },
      {
        onSuccess: () => {
          setForm({ name: '', slug: '' });
          setShowForm(false);
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Public links your clients can use to self-book</p>
        {canCreate && (
          <Button variant="primary" size="md" leftIcon={Plus} onClick={() => setShowForm((s) => !s)}>
            Create page
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardBody>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Page name"
                required
              />
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase() })}
                placeholder="url-slug"
                pattern="[a-z0-9-]+"
                required
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={createPage.isPending}
              >
                Create
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {isLoading ? (
        <LoadingSkeleton />
      ) : pages.length === 0 ? (
        <Card>
          <EmptyState icon={Globe} title="No booking pages yet" description="Create a public link your clients can use to self-book." />
        </Card>
      ) : (
        <div className="space-y-3">
          {pages.map((p) => {
            const url = `${window.location.origin}/book/${p.slug}`;
            return (
              <Card key={p.id}>
                <CardBody>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 dark:text-white truncate">{p.name}</h3>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{url}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-slate-500 text-xs">{p.views} views · {p.bookings_count} booked</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(url).catch(() => {});
                          toast.success('URL copied');
                        }}
                        aria-label="Copy link"
                      >
                        <Copy className="w-4 h-4 text-slate-400" />
                      </Button>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center h-9 w-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Open page"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deletePage.mutate(p.id)}
                          aria-label="Delete page"
                          className="text-red-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Integrations (placeholder cards — real OAuth flows are a future task)
// ════════════════════════════════════════════════════════════

function IntegrationsPanel() {
  const integrations = [
    { id: 'google', name: 'Google Calendar', desc: '2-way sync. Push bookings, pull busy times.', status: 'available' },
    { id: 'outlook', name: 'Outlook / Microsoft 365', desc: 'Sync with Microsoft Graph calendar.', status: 'available' },
    { id: 'meet', name: 'Google Meet', desc: 'Auto-generate meeting links on confirm.', status: 'available' },
    { id: 'zoom', name: 'Zoom', desc: 'Auto-generate Zoom links on confirm.', status: 'available' },
    { id: 'whatsapp', name: 'WhatsApp Reminders', desc: 'T-24h and T-1h booking reminders.', status: 'connected' },
    { id: 'sms', name: 'SMS Reminders', desc: 'Fallback channel for reminders.', status: 'connected' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {integrations.map((i) => (
        <Card key={i.id}>
          <CardBody>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-white">{i.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{i.desc}</p>
              </div>
              <Badge
                tone={i.status === 'connected' ? 'success' : 'default'}
                dot
                className="shrink-0"
              >
                {i.status}
              </Badge>
            </div>
            <div className="mt-3">
              <Button
                variant="outline"
                size="md"
                className="w-full"
                onClick={() => toast(`${i.name} connector coming soon`, { icon: '🔌' })}
              >
                {i.status === 'connected' ? 'Manage' : 'Connect'}
              </Button>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

// ── Shared ──────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <Card>
      <CardBody className="flex items-center justify-center py-8">
        <Skeleton className="h-4 w-32" />
      </CardBody>
    </Card>
  );
}
