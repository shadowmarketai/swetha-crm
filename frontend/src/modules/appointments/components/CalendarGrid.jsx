/**
 * CalendarGrid — lightweight week view (no extra deps).
 *
 * Shows a 7-day grid for the current visible week with bookings rendered
 * as colored blocks at their start time. Click a slot to open a new
 * booking modal; click a booking to open its drawer.
 */

import { useMemo } from 'react';
import {
  startOfWeek, addDays, format, isToday, addWeeks, startOfDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, Button } from '../../../components/ui/primitives';

const HOUR_START = 8;
const HOUR_END = 20;
const SLOT_HEIGHT = 48; // px per hour

export default function CalendarGrid({
  bookings = [],
  weekStart,
  onWeekChange,
  onSelectBooking,
  onCreateAt,
}) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i),
    [],
  );

  const bookingsByDay = useMemo(() => {
    const map = new Map();
    days.forEach((d) => map.set(d.toDateString(), []));
    bookings.forEach((b) => {
      if (!b.starts_at) return;
      const d = new Date(b.starts_at);
      const key = d.toDateString();
      if (map.has(key)) map.get(key).push(b);
    });
    return map;
  }, [bookings, days]);

  return (
    <Card className="overflow-hidden">
      {/* Week navigation header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onWeekChange(addWeeks(weekStart, -1))}
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onWeekChange(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onWeekChange(addWeeks(weekStart, 1))}
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
        </h3>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="grid min-w-[800px]" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
          {/* Header row */}
          <div className="border-b border-slate-200 dark:border-slate-700" />
          {days.map((d) => (
            <div
              key={d.toISOString()}
              className={[
                'p-2 text-center border-b border-l border-slate-200 dark:border-slate-700',
                isToday(d) ? 'bg-indigo-50 dark:bg-indigo-900/20' : '',
              ].join(' ')}
            >
              <p className="text-xs uppercase text-slate-500">{format(d, 'EEE')}</p>
              <p className={`text-lg font-semibold ${isToday(d) ? 'text-indigo-600' : 'text-slate-900 dark:text-white'}`}>
                {format(d, 'd')}
              </p>
            </div>
          ))}

          {/* Hour rows */}
          {hours.map((h) => (
            <HourRow
              key={h}
              hour={h}
              days={days}
              bookingsByDay={bookingsByDay}
              onSelectBooking={onSelectBooking}
              onCreateAt={onCreateAt}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

function HourRow({ hour, days, bookingsByDay, onSelectBooking, onCreateAt }) {
  return (
    <>
      <div
        className="text-[11px] text-slate-400 text-right pr-2 border-b border-slate-100 dark:border-slate-800"
        style={{ height: SLOT_HEIGHT }}
      >
        {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
      </div>
      {days.map((d) => {
        const dayBookings = (bookingsByDay.get(d.toDateString()) || []).filter((b) => {
          const start = new Date(b.starts_at);
          return start.getHours() === hour;
        });
        const slotDate = new Date(startOfDay(d).getTime() + hour * 3600 * 1000);
        return (
          <div
            key={d.toISOString() + hour}
            className="relative border-b border-l border-slate-100 dark:border-slate-800 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 cursor-pointer"
            style={{ height: SLOT_HEIGHT }}
            onClick={() => onCreateAt?.(slotDate)}
          >
            {dayBookings.map((b) => {
              const start = new Date(b.starts_at);
              const end = new Date(b.ends_at);
              const minutes = Math.max(15, (end - start) / 60000);
              const top = (start.getMinutes() / 60) * SLOT_HEIGHT;
              const height = (minutes / 60) * SLOT_HEIGHT;
              return (
                <button
                  key={b.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBooking?.(b);
                  }}
                  className="absolute left-1 right-1 rounded-md text-left px-2 py-1 text-[11px] font-medium text-white shadow hover:brightness-110 overflow-hidden"
                  style={{
                    top,
                    height,
                    background: b.service_color || '#6366f1',
                  }}
                >
                  <div className="truncate">{b.client_name}</div>
                  <div className="truncate opacity-90">{format(start, 'p')}</div>
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
