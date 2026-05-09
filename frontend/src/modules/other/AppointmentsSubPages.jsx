import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { schedulingAPI } from '../../services/api';
import {
  Calendar, Clock, Plus, Edit, Trash2, Copy, ExternalLink,
  Check, X, ChevronLeft, ChevronRight, DollarSign, Link2
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { Skeleton, EmptyState } from '../../components/ui/primitives';

// ==================== BOOKINGS PAGE ====================
export function BookingsPage() {
  const { can } = usePermissions();
  const canUpdate = can('appointments', 'update');
  const [tab, setTab] = useState('upcoming');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/appointments/bookings');
      const data = Array.isArray(res.data) ? res.data : res.data?.items || res.data?.bookings || [];
      const mapped = data.map(b => ({
        id: b.id,
        name: b.name || b.client_name || 'Unknown',
        service: b.service || b.service_name || '-',
        date: b.date || (b.scheduled_at ? b.scheduled_at.split('T')[0] : '-'),
        time: b.time || (b.scheduled_at ? new Date(b.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'),
        duration: b.duration || '30 min',
        status: b.status || 'pending',
        source: b.source || 'API',
      }));
      setBookings(mapped);
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const handleConfirm = async (booking) => {
    try {
      await api.put(`/api/v1/appointments/bookings/${booking.id}`, { status: 'confirmed' });
      toast.success(`Confirmed booking for ${booking.name}`);
      fetchBookings();
    } catch {
      toast.error('Failed to confirm booking');
    }
  };

  const handleCancel = async (booking) => {
    try {
      await api.put(`/api/v1/appointments/bookings/${booking.id}`, { status: 'cancelled' });
      toast.success(`Cancelled booking for ${booking.name}`);
      fetchBookings();
    } catch {
      toast.error('Failed to cancel booking');
    }
  };

  const filtered = tab === 'upcoming'
    ? bookings.filter(b => b.status === 'confirmed' || b.status === 'pending')
    : bookings.filter(b => b.status === 'completed' || b.status === 'no-show');

  const statusColors = {
    confirmed: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    completed: 'bg-blue-100 text-blue-700',
    'no-show': 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bookings</h1>
          <p className="text-sm text-slate-500">Manage upcoming and past appointments</p>
        </div>
      </div>

      <div className="flex gap-2">
        {['upcoming', 'past'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={`No ${tab} bookings`}
          description={tab === 'upcoming' ? 'No upcoming bookings found. New bookings will appear here.' : 'No past bookings to show.'}
        />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Client</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Service</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Time</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Duration</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase">Source</th>
                <th className="py-3 px-4 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{b.name}</td>
                  <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{b.service}</td>
                  <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{b.date}</td>
                  <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{b.time}</td>
                  <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{b.duration}</td>
                  <td className="py-3 px-4"><span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[b.status] || 'bg-slate-100 text-slate-600'}`}>{b.status}</span></td>
                  <td className="py-3 px-4 text-sm text-indigo-600">{b.source}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {canUpdate && b.status === 'pending' && (
                        <button onClick={() => handleConfirm(b)} className="p-1.5 hover:bg-emerald-50 rounded-lg"><Check className="w-4 h-4 text-emerald-500" /></button>
                      )}
                      {canUpdate && (b.status === 'confirmed' || b.status === 'pending') && (
                        <button onClick={() => handleCancel(b)} className="p-1.5 hover:bg-red-50 rounded-lg"><X className="w-4 h-4 text-red-400" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==================== AVAILABILITY PAGE ====================
export function AvailabilityPage() {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [slots, setSlots] = useState(() => {
    const initial = {};
    days.forEach(d => {
      initial[d] = {};
      hours.forEach(h => {
        initial[d][h] = false;
      });
    });
    return initial;
  });

  useEffect(() => {
    let cancelled = false;
    api.get('/api/v1/appointments/availability').then(res => {
      if (cancelled) return;
      const data = res.data;
      if (data && typeof data === 'object') {
        setSlots(prev => {
          const next = { ...prev };
          days.forEach(d => {
            if (data[d]) {
              next[d] = { ...prev[d], ...data[d] };
            }
          });
          return next;
        });
      }
    }).catch(() => {
      // If no availability endpoint, default to weekdays on
      setSlots(prev => {
        const next = {};
        days.forEach(d => {
          next[d] = {};
          hours.forEach(h => {
            next[d][h] = d !== 'Saturday' && d !== 'Sunday';
          });
        });
        return next;
      });
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const toggleSlot = (day, hour) => {
    setSlots(prev => ({
      ...prev,
      [day]: { ...prev[day], [hour]: !prev[day][hour] }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/api/v1/appointments/availability', slots);
      toast.success('Availability saved');
    } catch {
      toast.error('Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Availability</h1>
          <p className="text-sm text-slate-500">Set your weekly availability for bookings</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50">
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase w-24">Time</th>
              {days.map(d => (
                <th key={d} className="py-3 px-2 text-center text-xs font-medium text-slate-500 uppercase">{d.slice(0, 3)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map(h => (
              <tr key={h} className="border-t border-slate-100 dark:border-slate-700">
                <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400 font-medium">{h}</td>
                {days.map(d => (
                  <td key={d} className="py-2 px-2 text-center">
                    <button
                      onClick={() => toggleSlot(d, h)}
                      className={`w-10 h-10 rounded-lg transition-colors ${
                        slots[d][h]
                          ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                      }`}
                    >
                      {slots[d][h] ? <Check className="w-4 h-4 mx-auto" /> : <X className="w-4 h-4 mx-auto" />}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== SERVICES PAGE ====================
export function ServicesPage() {
  const { can } = usePermissions();
  const canCreate = can('appointments', 'create');
  const canUpdate = can('appointments', 'update');
  const canDelete = can('appointments', 'delete');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', duration: '30', price: '' });
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/appointments/services');
      const data = Array.isArray(res.data) ? res.data : res.data?.items || res.data?.services || [];
      setServices(data.map((s, i) => ({
        id: s.id,
        name: s.name || s.service_name || 'Untitled',
        duration: s.duration || '30 min',
        price: s.price || 'Free',
        bookings: s.bookings ?? s.total_bookings ?? 0,
        color: s.color || ['#6366f1', '#10b981', '#f59e0b', '#ec4899'][i % 4],
      })));
    } catch {
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Service name required'); return; }
    try {
      await api.post('/api/v1/appointments/services', {
        name: form.name,
        duration: form.duration,
        price: form.price || 'Free',
      });
      toast.success(`Service "${form.name}" created`);
      setForm({ name: '', duration: '30', price: '' });
      setShowModal(false);
      setEditingId(null);
      fetchServices();
    } catch {
      toast.error('Failed to create service');
    }
  };

  const handleEdit = (s) => {
    setEditingId(s.id);
    setForm({ name: s.name, duration: s.duration.replace(/\D+$/, '').trim() || '30', price: s.price });
    setShowModal(true);
  };

  const handleUpdate = async () => {
    if (!form.name.trim()) { toast.error('Service name required'); return; }
    try {
      await api.put(`/api/v1/appointments/services/${editingId}`, {
        name: form.name,
        duration: form.duration,
        price: form.price || 'Free',
      });
      toast.success(`Service "${form.name}" updated`);
      setForm({ name: '', duration: '30', price: '' });
      setShowModal(false);
      setEditingId(null);
      fetchServices();
    } catch {
      toast.error('Failed to update service');
    }
  };

  const handleDelete = async (s) => {
    try {
      await api.delete(`/api/v1/appointments/services/${s.id}`);
      toast.success(`Deleted "${s.name}"`);
      fetchServices();
    } catch {
      toast.error('Failed to delete service');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Services</h1>
          <p className="text-sm text-slate-500">Manage bookable services</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditingId(null); setForm({ name: '', duration: '30', price: '' }); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Service
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      ) : services.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No services yet"
          description="Create your first bookable service to get started."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(s => (
            <div key={s.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.color + '20' }}>
                  <Calendar className="w-5 h-5" style={{ color: s.color }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{s.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {s.duration}</span>
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {s.price}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-500 mb-4">{s.bookings} bookings total</p>
              <div className="flex items-center gap-2">
                {canUpdate && (
                  <button onClick={() => handleEdit(s)} className="flex-1 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200">Edit</button>
                )}
                {canDelete && (
                  <button onClick={() => handleDelete(s)} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{editingId ? 'Edit Service' : 'Add Service'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Service Name</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Product Demo" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Duration (minutes)</label>
                <select value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Price</label>
                <input type="text" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="Free or ₹999" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={editingId ? handleUpdate : handleCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== BOOKING PAGES PAGE ====================
export function BookingPagesPage() {
  const { can } = usePermissions();
  const canCreate = can('appointments', 'create');
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/appointments/booking-pages');
      const data = Array.isArray(res.data) ? res.data : res.data?.items || res.data?.pages || [];
      setPages(data);
    } catch {
      toast.error('Failed to load booking pages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const handleCreatePage = async () => {
    try {
      await api.post('/api/v1/appointments/booking-pages', { name: 'New Booking Page', status: 'draft' });
      toast.success('New booking page created');
      fetchPages();
    } catch {
      toast.error('Failed to create booking page');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Booking Pages</h1>
          <p className="text-sm text-slate-500">Embeddable booking page links</p>
        </div>
        {canCreate && (
          <button onClick={handleCreatePage} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Create Page
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : pages.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No booking pages"
          description="Create your first booking page to share with clients."
        />
      ) : (
        <div className="space-y-4">
          {pages.map(p => (
            <div key={p.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                    <Link2 className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{p.name}</h3>
                    <p className="text-sm text-slate-500">{p.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-16 sm:ml-0">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div><p className="font-semibold text-slate-900 dark:text-white">{p.services ?? 0}</p><p className="text-xs text-slate-500">Services</p></div>
                    <div><p className="font-semibold text-slate-900 dark:text-white">{p.views ?? 0}</p><p className="text-xs text-slate-500">Views</p></div>
                    <div><p className="font-semibold text-emerald-600">{p.bookings ?? 0}</p><p className="text-xs text-slate-500">Bookings</p></div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{p.status}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toast.success(`Preview: ${p.url}`)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><ExternalLink className="w-4 h-4 text-slate-400" /></button>
                    <button onClick={() => { navigator.clipboard.writeText(p.url).catch(() => {}); toast.success('URL copied'); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><Copy className="w-4 h-4 text-slate-400" /></button>
                    <button onClick={() => toast.success(`Editing "${p.name}"`)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><Edit className="w-4 h-4 text-slate-400" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
