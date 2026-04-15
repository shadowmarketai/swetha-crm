import { X, Calendar, Clock, User, Mail, Phone, MapPin, Video, Link as LinkIcon, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useConfirmBooking, useCancelBooking, useUpdateBooking } from '../hooks/useAppointments';
import { Button, Badge } from '../../../components/ui/primitives';

const STATUS_TONE = {
  pending: 'warning',
  confirmed: 'success',
  completed: 'info',
  cancelled: 'danger',
  no_show: 'danger',
};

const LOCATION_ICON = {
  google_meet: Video,
  zoom: Video,
  phone: Phone,
  in_person: MapPin,
  custom_link: LinkIcon,
};

export default function BookingDrawer({ booking, onClose, canUpdate, canDelete }) {
  const confirm = useConfirmBooking();
  const cancel = useCancelBooking();
  const update = useUpdateBooking();

  if (!booking) return null;

  const start = booking.starts_at ? new Date(booking.starts_at) : null;
  const end = booking.ends_at ? new Date(booking.ends_at) : null;
  const LocIcon = LOCATION_ICON[booking.location_type] || Calendar;
  const statusKey = (booking.status || 'pending').toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <aside className="w-full max-w-md bg-white dark:bg-slate-900 shadow-xl flex flex-col">
        <header className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: booking.service_color || '#6366f1' }}
              />
              <p className="text-xs font-medium text-slate-500 truncate">
                {booking.service_name || 'Appointment'}
              </p>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
              {booking.client_name}
            </h2>
            <div className="mt-2">
              <Badge tone={STATUS_TONE[statusKey] || 'default'} dot>
                {statusKey.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-500" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <DrawerField icon={Calendar} label="Date">
            {start ? format(start, 'EEEE, MMM d, yyyy') : '—'}
          </DrawerField>
          <DrawerField icon={Clock} label="Time">
            {start && end
              ? `${format(start, 'p')} – ${format(end, 'p')} (${booking.timezone || 'local'})`
              : '—'}
          </DrawerField>
          <DrawerField icon={LocIcon} label="Location">
            {booking.meeting_url ? (
              <a
                href={booking.meeting_url}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline break-all"
              >
                {booking.meeting_url}
              </a>
            ) : (
              booking.location_value || booking.location_type?.replace('_', ' ') || '—'
            )}
          </DrawerField>
          {booking.client_email && (
            <DrawerField icon={Mail} label="Email">
              <a href={`mailto:${booking.client_email}`} className="text-indigo-600 hover:underline">
                {booking.client_email}
              </a>
            </DrawerField>
          )}
          {booking.client_phone && (
            <DrawerField icon={Phone} label="Phone">
              {booking.client_phone}
            </DrawerField>
          )}
          {booking.notes && (
            <DrawerField icon={AlertCircle} label="Notes">
              <p className="whitespace-pre-wrap">{booking.notes}</p>
            </DrawerField>
          )}
          {booking.source && (
            <p className="text-xs text-slate-400 pt-2">
              Booked via <span className="text-indigo-500 font-medium">{booking.source}</span>
            </p>
          )}
        </div>

        {(canUpdate || canDelete) && statusKey !== 'cancelled' && statusKey !== 'completed' && (
          <footer className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2">
            {canUpdate && statusKey === 'pending' && (
              <Button
                variant="success"
                size="md"
                leftIcon={CheckCircle}
                loading={confirm.isPending}
                onClick={() => confirm.mutate(booking.id)}
                className="flex-1 min-w-[120px]"
              >
                Confirm
              </Button>
            )}
            {canUpdate && statusKey === 'confirmed' && (
              <Button
                variant="primary"
                size="md"
                leftIcon={CheckCircle}
                onClick={() => update.mutate({ id: booking.id, body: { status: 'completed' } })}
                className="flex-1 min-w-[120px]"
              >
                Mark complete
              </Button>
            )}
            {canDelete && (
              <Button
                variant="danger"
                size="md"
                leftIcon={XCircle}
                loading={cancel.isPending}
                onClick={() => {
                  const reason = window.prompt('Cancellation reason (optional)') || '';
                  cancel.mutate({ id: booking.id, reason });
                }}
                className="flex-1 min-w-[120px]"
              >
                Cancel
              </Button>
            )}
          </footer>
        )}
      </aside>
    </div>
  );
}

function DrawerField({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3">
      <Icon className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <div className="text-sm text-slate-900 dark:text-slate-100 mt-0.5">{children}</div>
      </div>
    </div>
  );
}
