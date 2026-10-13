import React, { useEffect, useState } from 'react';
import { Ticket, Plus, Trash2, Globe } from 'lucide-react';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';
import Modal from '../ui/Modal';
import { EmptyState, PageHead } from '../ui/Bits';
import { useConfirm, useToast } from '../ui/Feedback';

interface PublicEvent {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  eventDate: string | null;
  venue: string | null;
  status: string;
}

export default function PublicEvents() {
  const toast = useToast();
  const confirm = useConfirm();
  
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', slug: '', summary: '', eventDate: '', venue: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    setLoading(true);
    try {
      const res = await api.get('/institution/public-events');
      setEvents(res.events || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!form.title || !form.slug) return;
    setSaving(true);
    try {
      await api.post('/institution/public-events', {
        action: 'PUBLISH',
        title: form.title,
        slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        summary: form.summary || undefined,
        eventDate: form.eventDate || undefined,
        venue: form.venue || undefined,
        visibilityDuration: 'ONE_MONTH',
        blocks: [{ type: 'paragraph', content: form.summary || 'Details coming soon.' }],
      });
      setForm({ title: '', slug: '', summary: '', eventDate: '', venue: '' });
      setShowModal(false);
      fetchEvents();
      toast.success('Event published', `Published ${form.title}`);
    } catch (err: any) {
      toast.error('Could not publish event', err.message || 'Failed to publish. Note: Public website must be enabled.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, title: string) {
    const ok = await confirm({
      title: 'Delete event?',
      body: `Are you sure you want to delete ${title}?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/institution/public-events/${id}`);
      fetchEvents();
      toast.info('Event deleted', `Deleted ${title}`);
    } catch (err: any) {
      toast.error('Could not delete event', err.message || 'Failed to delete');
    }
  }

  return (
    <div className="page">
      <PageHead
        title="Public Events"
        subtitle="Publish events to your institution's public website."
      >
        <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus /> Publish Event
        </button>
      </PageHead>

      <section className="card">
        <div className="card-head">
          <div className="card-head-copy">
            <h2 className="card-title">
              <Ticket aria-hidden="true" /> Recent Events
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="card-pad"><PageSkeleton rows={3} /></div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={<Ticket />}
            title="No events published"
            text="Events you publish here will appear on your public website."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>
                <Plus /> Publish Event
              </button>
            }
          />
        ) : (
          <div>
            {events.map(ev => (
              <div className="list-row" key={ev.id}>
                <span className="cell-stack" style={{ flex: '1 1 auto' }}>
                  <b>{ev.title}</b>
                  <span className="row" style={{ color: 'var(--ink-2)' }}>
                    {ev.eventDate && <span>{ev.eventDate}</span>}
                    {ev.venue && <span>• {ev.venue}</span>}
                    <span className="chip chip-mute">{ev.status}</span>
                  </span>
                </span>
                <button type="button" className="icon-btn icon-btn-danger" onClick={() => handleDelete(ev.id, ev.title)}>
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Publish Event"
        description="Create a new event. It will be visible on your public website."
        size="md"
        onSubmit={handleSave}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.title || !form.slug}>
              {saving ? 'Publishing…' : 'Publish'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <label className="field">
            <span className="label">Title</span>
            <input
              type="text"
              required
              className="input"
              value={form.title}
              onChange={e => {
                const title = e.target.value;
                setForm(f => ({ ...f, title, slug: f.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-') }));
              }}
              placeholder="e.g. Annual Sports Day"
            />
          </label>
          <label className="field">
            <span className="label">URL Slug</span>
            <input
              type="text"
              required
              className="input"
              value={form.slug}
              onChange={e => setForm({ ...form, slug: e.target.value })}
              placeholder="e.g. annual-sports-day"
            />
          </label>
          <label className="field">
            <span className="label">Date (Text)</span>
            <input
              type="text"
              className="input"
              value={form.eventDate}
              onChange={e => setForm({ ...form, eventDate: e.target.value })}
              placeholder="e.g. October 15, 2024"
            />
          </label>
          <label className="field">
            <span className="label">Venue</span>
            <input
              type="text"
              className="input"
              value={form.venue}
              onChange={e => setForm({ ...form, venue: e.target.value })}
              placeholder="e.g. Main Campus Ground"
            />
          </label>
          <label className="field">
            <span className="label">Summary</span>
            <textarea
              className="input"
              value={form.summary}
              onChange={e => setForm({ ...form, summary: e.target.value })}
              placeholder="Short description..."
              rows={3}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
