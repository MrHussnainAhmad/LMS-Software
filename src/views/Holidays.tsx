import React, { useEffect, useState } from 'react';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';
import Modal from '../ui/Modal';
import { EmptyState, PageHead } from '../ui/Bits';
import { useConfirm, useToast } from '../ui/Feedback';

interface Holiday {
  date: string;
  name: string | null;
}

export default function Holidays() {
  const toast = useToast();
  const confirm = useConfirm();
  
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: '', name: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchHolidays();
  }, []);

  async function fetchHolidays() {
    setLoading(true);
    try {
      const res = await api.get('/institution/holidays');
      setHolidays(res.holidays || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!form.date) return;
    setSaving(true);
    try {
      await api.post('/institution/holidays', {
        date: form.date,
        name: form.name.trim() || undefined,
      });
      setForm({ date: '', name: '' });
      setShowModal(false);
      fetchHolidays();
      toast.success('Holiday added', `Saved ${form.date}`);
    } catch (err: any) {
      toast.error('Could not save holiday', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(date: string) {
    const ok = await confirm({
      title: 'Remove holiday?',
      body: `The institution will no longer observe ${date}.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete('/institution/holidays', { date });
      fetchHolidays();
      toast.info('Holiday removed', `Removed ${date}`);
    } catch (err: any) {
      toast.error('Could not remove holiday', err.message || 'Failed to remove');
    }
  }

  return (
    <div className="page">
      <PageHead
        title="Holidays"
        subtitle="Manage institution-wide holidays. These dates will not be counted as absent days for attendance."
      >
        <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus /> Add holiday
        </button>
      </PageHead>

      <section className="card">
        <div className="card-head">
          <div className="card-head-copy">
            <h2 className="card-title">
              <Calendar aria-hidden="true" /> Observed Holidays
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="card-pad"><PageSkeleton rows={3} /></div>
        ) : holidays.length === 0 ? (
          <EmptyState
            icon={<Calendar />}
            title="No holidays configured"
            text="Add your institution's holidays so attendance and timetables can skip them."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>
                <Plus /> Add holiday
              </button>
            }
          />
        ) : (
          <div>
            {holidays.map(h => (
              <div className="list-row" key={h.date}>
                <span className="cell-stack" style={{ flex: '1 1 auto' }}>
                  <b>{h.date}</b>
                  <span className="row" style={{ color: 'var(--ink-2)' }}>{h.name || 'Unnamed Holiday'}</span>
                </span>
                <button type="button" className="icon-btn icon-btn-danger" onClick={() => handleDelete(h.date)}>
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
        title="Add Holiday"
        description="Select a date for the holiday. Optionally give it a name."
        size="sm"
        onSubmit={handleSave}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.date}>
              {saving ? 'Saving…' : 'Save holiday'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <label className="field">
            <span className="label">Date</span>
            <input
              type="date"
              required
              className="input"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="label">Name (Optional)</span>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Eid-ul-Fitr"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
