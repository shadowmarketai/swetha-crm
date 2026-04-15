/**
 * AppointmentsHub — single-page Appointments experience.
 *
 * Replaces the old 5 separate sub-pages (dashboard, bookings, calendar,
 * services, pages) with one consolidated screen:
 *
 *   ┌─ KPI strip ──────────────────────────────────────────────┐
 *   │ Today / Week / AI-booked / Show rate / Pending           │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ View toggle (Calendar | List | Today)  + search + filter │
 *   │                                                          │
 *   │   <CalendarGrid />  or  <BookingList />                  │
 *   │                                                          │
 *   │  Click → BookingDrawer (right-side detail/edit)          │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Real-time: useAppointmentRealtime() subscribes to WS appointment.* events
 * and surgically invalidates the React Query cache + raises toast notifications.
 * A live indicator dot shows the WS connection state.
 */

import { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon, List, Clock, Plus, Filter, Bot, CheckCircle, AlertCircle,
} from 'lucide-react';
import { startOfWeek, format, isToday } from 'date-fns';
import { Link } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useBookings, useKpis, useAppointmentRealtime } from './hooks/useAppointments';
import BookingDrawer from './components/BookingDrawer';
import BookingFormModal from './components/BookingFormModal';
import CalendarGrid from './components/CalendarGrid';
import {
  Stat, Button, PageHeader, DataTable, Badge, SearchInput, Select,
  Card, EmptyState, Spinner,
} from '../../components/ui/primitives';

const VIEWS = [
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { id: 'list', label: 'List', icon: List },
  { id: 'today', label: 'Today', icon: Clock },
];

const STATUS_FILTERS = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function AppointmentsHub() {
  const { can } = usePermissions();
  const canCreate = can('appointments', 'create');
  const canUpdate = can('appointments', 'update');
  const canDelete = can('appointments', 'delete');

  const [view, setView] = useState('calendar');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [createDefaultStart, setCreateDefaultStart] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: kpis } = useKpis();
  const { data: bookingsResp, isLoading } = useBookings({
    status: statusFilter || undefined,
    search: search || undefined,
    page_size: 200,
  });
  const { connected } = useAppointmentRealtime();

  const bookings = bookingsResp?.items || [];

  const todayBookings = useMemo(
    () => bookings.filter((b) => b.starts_at && isToday(new Date(b.starts_at))),
    [bookings],
  );

  const openCreate = (start) => {
    setCreateDefaultStart(start || null);
    setShowCreate(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            Appointments
            <LiveIndicator connected={connected} />
          </span>
        }
        subtitle="Real-time bookings from Voice AI, Sales Bot, public pages and manual scheduling"
        actions={
          <>
            <Button variant="secondary" size="md" as={Link} to="/appointments/setup"
              onClick={undefined}
            >
              <Link to="/appointments/setup" className="contents">Setup</Link>
            </Button>
            {canCreate && (
              <Button variant="primary" size="md" leftIcon={Plus} onClick={() => openCreate(null)}>
                New booking
              </Button>
            )}
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat
          label="Today"
          value={kpis?.today_count ?? '–'}
          icon={CalendarIcon}
          accent="#6366f1"
        />
        <Stat
          label="This week"
          value={kpis?.week_count ?? '–'}
          icon={Clock}
          accent="#10b981"
        />
        <Stat
          label="Booked by AI"
          value={kpis?.booked_by_ai ?? '–'}
          icon={Bot}
          accent="#a855f7"
        />
        <Stat
          label="Show rate"
          value={kpis ? `${kpis.show_rate_pct}%` : '–'}
          icon={CheckCircle}
          accent="#f59e0b"
        />
        <Stat
          label="Pending"
          value={kpis?.pending_count ?? '–'}
          icon={AlertCircle}
          accent="#f43f5e"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <ViewToggle view={view} onChange={setView} />

        <div className="flex-1 max-w-xs">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client, email, phone…"
          />
        </div>

        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Body */}
      {view === 'calendar' && (
        <CalendarGrid
          bookings={bookings}
          weekStart={weekStart}
          onWeekChange={setWeekStart}
          onSelectBooking={setSelectedBooking}
          onCreateAt={canCreate ? openCreate : undefined}
        />
      )}
      {view === 'list' && (
        <BookingTable bookings={bookings} loading={isLoading} onSelect={setSelectedBooking} />
      )}
      {view === 'today' && (
        <BookingTable
          bookings={todayBookings}
          loading={isLoading}
          onSelect={setSelectedBooking}
          emptyLabel="Nothing scheduled today"
        />
      )}

      {/* Side drawer */}
      {selectedBooking && (
        <BookingDrawer
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      )}

      {/* Create modal */}
      <BookingFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        defaultStart={createDefaultStart}
      />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function LiveIndicator({ connected }) {
  return (
    <Badge
      tone={connected ? 'success' : 'default'}
      dot
      className="text-[10px] uppercase tracking-wide"
    >
      {connected ? 'LIVE' : 'OFFLINE'}
    </Badge>
  );
}

function ViewToggle({ view, onChange }) {
  return (
    <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
      {VIEWS.map((v) => {
        const Icon = v.icon;
        const active = view === v.id;
        return (
          <button
            key={v.id}
            onClick={() => onChange(v.id)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              active
                ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
            ].join(' ')}
          >
            <Icon className="w-4 h-4" /> {v.label}
          </button>
        );
      })}
    </div>
  );
}

const STATUS_TONE = {
  pending: 'warning',
  confirmed: 'success',
  completed: 'info',
  cancelled: 'danger',
  no_show: 'danger',
};

const BOOKING_COLUMNS = [
  {
    key: 'client',
    header: 'Client',
    render: (b) => (
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: b.service_color || '#6366f1' }}
        />
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-white truncate">{b.client_name}</p>
          {b.client_email && <p className="text-xs text-slate-500 truncate">{b.client_email}</p>}
        </div>
      </div>
    ),
  },
  {
    key: 'service_name',
    header: 'Service',
    render: (b) => <span className="text-slate-600 dark:text-slate-400">{b.service_name || '—'}</span>,
  },
  {
    key: 'date',
    header: 'Date',
    render: (b) => {
      const start = b.starts_at ? new Date(b.starts_at) : null;
      return <span className="text-slate-600 dark:text-slate-400">{start ? format(start, 'MMM d, yyyy') : '—'}</span>;
    },
  },
  {
    key: 'time',
    header: 'Time',
    render: (b) => {
      const start = b.starts_at ? new Date(b.starts_at) : null;
      const end = b.ends_at ? new Date(b.ends_at) : null;
      return (
        <span className="text-slate-600 dark:text-slate-400">
          {start && end ? `${format(start, 'p')} – ${format(end, 'p')}` : '—'}
        </span>
      );
    },
  },
  {
    key: 'status',
    header: 'Status',
    render: (b) => {
      const status = (b.status || 'pending').toLowerCase();
      return <Badge tone={STATUS_TONE[status] || 'default'}>{status.replace('_', ' ')}</Badge>;
    },
  },
  {
    key: 'source',
    header: 'Source',
    render: (b) => <span className="text-indigo-600 text-sm">{b.source}</span>,
  },
];

function BookingTable({ bookings, loading, onSelect, emptyLabel = 'No bookings yet' }) {
  if (loading) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <Spinner size="md" />
      </Card>
    );
  }

  return (
    <Card>
      <DataTable
        columns={BOOKING_COLUMNS}
        rows={bookings}
        onRowClick={onSelect}
        empty={
          <EmptyState
            icon={CalendarIcon}
            title={emptyLabel}
            description="Bookings will appear here once they are created."
          />
        }
      />
    </Card>
  );
}
