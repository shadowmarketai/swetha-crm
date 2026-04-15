import { useState, useEffect } from 'react';
import { useCreateBooking, useServices } from '../hooks/useAppointments';
import { Modal, Button, Input, Select, Textarea, Field } from '../../../components/ui/primitives';

const LOCATION_OPTIONS = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'phone', label: 'Phone Call' },
  { value: 'in_person', label: 'In Person' },
  { value: 'custom_link', label: 'Custom Link' },
];

function toLocalISO(d) {
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60 * 1000).toISOString().slice(0, 16);
}

export default function BookingFormModal({ open, onClose, defaultStart }) {
  const { data: services = [] } = useServices();
  const create = useCreateBooking();

  const initialStart = defaultStart || new Date(Date.now() + 60 * 60 * 1000);
  const [form, setForm] = useState(() => ({
    service_id: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    starts_at: toLocalISO(initialStart),
    duration_min: 30,
    location_type: 'google_meet',
    location_value: '',
    notes: '',
  }));

  useEffect(() => {
    if (defaultStart) {
      setForm((f) => ({ ...f, starts_at: toLocalISO(defaultStart) }));
    }
  }, [defaultStart]);

  const handleChange = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.client_name.trim()) return;
    const start = new Date(form.starts_at);
    const end = new Date(start.getTime() + Number(form.duration_min) * 60 * 1000);
    create.mutate(
      {
        service_id: form.service_id ? Number(form.service_id) : null,
        client_name: form.client_name.trim(),
        client_email: form.client_email.trim() || null,
        client_phone: form.client_phone.trim() || null,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
        location_type: form.location_type,
        location_value: form.location_value.trim() || null,
        notes: form.notes.trim() || null,
        source: 'manual',
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New booking"
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="booking-form"
            loading={create.isPending}
          >
            Create booking
          </Button>
        </>
      }
    >
      <form id="booking-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Client name" required>
          <Input
            required
            value={form.client_name}
            onChange={handleChange('client_name')}
            placeholder="Rajesh Kumar"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input type="email" value={form.client_email} onChange={handleChange('client_email')} />
          </Field>
          <Field label="Phone">
            <Input value={form.client_phone} onChange={handleChange('client_phone')} />
          </Field>
        </div>

        <Field label="Service">
          <Select value={form.service_id} onChange={handleChange('service_id')} className="w-full">
            <option value="">— None —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.duration_min}m)
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start" required>
            <Input
              type="datetime-local"
              required
              value={form.starts_at}
              onChange={handleChange('starts_at')}
            />
          </Field>
          <Field label="Duration (min)" required>
            <Input
              type="number"
              min={5}
              max={480}
              required
              value={form.duration_min}
              onChange={handleChange('duration_min')}
            />
          </Field>
        </div>

        <Field label="Location">
          <Select value={form.location_type} onChange={handleChange('location_type')} className="w-full">
            {LOCATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Location detail / link">
          <Input
            value={form.location_value}
            onChange={handleChange('location_value')}
            placeholder="https://meet.google.com/..."
          />
        </Field>

        <Field label="Notes">
          <Textarea rows={3} value={form.notes} onChange={handleChange('notes')} />
        </Field>
      </form>
    </Modal>
  );
}
