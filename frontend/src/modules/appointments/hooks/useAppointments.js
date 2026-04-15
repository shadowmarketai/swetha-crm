/**
 * useAppointments — TanStack Query hooks + WebSocket-driven cache sync.
 *
 * The realtime hook listens to `appointment.*` events on the existing
 * RealtimeContext WebSocket and surgically updates the React Query cache
 * (no refetch round-trip), then raises a toast notification.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { appointmentsApi } from '../../../services/appointmentsApi';
import { useRealtime } from '../../../contexts/RealtimeContext';

const KEYS = {
  kpis: ['appointments', 'kpis'],
  bookings: (params = {}) => ['appointments', 'bookings', params],
  services: ['appointments', 'services'],
  availability: ['appointments', 'availability'],
  overrides: ['appointments', 'overrides'],
  pages: ['appointments', 'pages'],
};

// ── Queries ─────────────────────────────────────────────────

export function useKpis() {
  return useQuery({
    queryKey: KEYS.kpis,
    queryFn: appointmentsApi.getKpis,
    staleTime: 30_000,
  });
}

export function useBookings(params = {}) {
  return useQuery({
    queryKey: KEYS.bookings(params),
    queryFn: () => appointmentsApi.listBookings(params),
    keepPreviousData: true,
    staleTime: 15_000,
  });
}

export function useServices() {
  return useQuery({
    queryKey: KEYS.services,
    queryFn: appointmentsApi.listServices,
    staleTime: 60_000,
  });
}

export function useAvailability() {
  return useQuery({
    queryKey: KEYS.availability,
    queryFn: appointmentsApi.getAvailability,
    staleTime: 60_000,
  });
}

export function useBookingPages() {
  return useQuery({
    queryKey: KEYS.pages,
    queryFn: appointmentsApi.listPages,
    staleTime: 60_000,
  });
}

// ── Mutations ───────────────────────────────────────────────

function invalidateBookingViews(qc) {
  qc.invalidateQueries({ queryKey: ['appointments', 'bookings'] });
  qc.invalidateQueries({ queryKey: KEYS.kpis });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: appointmentsApi.createBooking,
    onSuccess: () => {
      invalidateBookingViews(qc);
      toast.success('Booking created');
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Failed to create booking'),
  });
}

export function useUpdateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => appointmentsApi.updateBooking(id, body),
    onSuccess: () => {
      invalidateBookingViews(qc);
      toast.success('Booking updated');
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Failed to update'),
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => appointmentsApi.cancelBooking(id, reason),
    onSuccess: () => {
      invalidateBookingViews(qc);
      toast.success('Booking cancelled');
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Failed to cancel'),
  });
}

export function useConfirmBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: appointmentsApi.confirmBooking,
    onSuccess: () => {
      invalidateBookingViews(qc);
      toast.success('Booking confirmed');
    },
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: appointmentsApi.createService,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.services });
      toast.success('Service created');
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Failed'),
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => appointmentsApi.updateService(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.services });
      toast.success('Service updated');
    },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: appointmentsApi.deleteService,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.services });
      toast.success('Service deleted');
    },
  });
}

export function useSetAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: appointmentsApi.setAvailability,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.availability });
      toast.success('Availability saved');
    },
  });
}

export function useCreatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: appointmentsApi.createPage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.pages });
      toast.success('Booking page created');
    },
  });
}

export function useUpdatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => appointmentsApi.updatePage(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.pages });
      toast.success('Booking page updated');
    },
  });
}

export function useDeletePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: appointmentsApi.deletePage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.pages });
      toast.success('Booking page deleted');
    },
  });
}

// ── Realtime sync ───────────────────────────────────────────

const REALTIME_EVENTS = [
  'appointment.created',
  'appointment.updated',
  'appointment.confirmed',
  'appointment.cancelled',
  'appointment.completed',
  'appointment.no_show',
  'appointment.service.created',
  'appointment.service.updated',
  'appointment.service.deleted',
  'appointment.availability.updated',
  'appointment.override.created',
  'appointment.override.deleted',
  'appointment.page.created',
  'appointment.page.updated',
  'appointment.page.deleted',
];

const TOAST_FOR = {
  'appointment.created': (p) => `New booking: ${p?.client_name || ''}`,
  'appointment.confirmed': (p) => `Booking confirmed: ${p?.client_name || ''}`,
  'appointment.cancelled': (p) => `Booking cancelled: ${p?.client_name || ''}`,
  'appointment.no_show': (p) => `No-show: ${p?.client_name || ''}`,
};

/**
 * Mount this hook once in the Appointments module so it lives only while
 * the user is in the appointments area. It piggybacks on the singleton
 * RealtimeContext WebSocket — no extra connection.
 */
export function useAppointmentRealtime() {
  const qc = useQueryClient();
  const { subscribe, connected } = useRealtime();

  useEffect(() => {
    const unsubs = REALTIME_EVENTS.map((evt) =>
      subscribe(evt, (payload) => {
        // Cache invalidation by event family
        if (evt.startsWith('appointment.service.')) {
          qc.invalidateQueries({ queryKey: KEYS.services });
        } else if (evt.startsWith('appointment.page.')) {
          qc.invalidateQueries({ queryKey: KEYS.pages });
        } else if (evt.startsWith('appointment.availability.') || evt.startsWith('appointment.override.')) {
          qc.invalidateQueries({ queryKey: KEYS.availability });
          qc.invalidateQueries({ queryKey: KEYS.overrides });
        } else {
          // Booking events
          qc.invalidateQueries({ queryKey: ['appointments', 'bookings'] });
          qc.invalidateQueries({ queryKey: KEYS.kpis });
        }

        const toastFn = TOAST_FOR[evt];
        if (toastFn) {
          toast(toastFn(payload), { icon: '🔔', duration: 4000 });
        }
      }),
    );
    return () => unsubs.forEach((u) => u && u());
  }, [subscribe, qc]);

  return { connected };
}
