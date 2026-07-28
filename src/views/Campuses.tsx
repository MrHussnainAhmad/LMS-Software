import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import { Plus, Building2, MapPin, Search, Wrench, CheckCircle2 } from 'lucide-react';
import PageSkeleton from '../components/PageSkeleton';
import Modal from '../ui/Modal';
import { EmptyState, ErrorNote, PageHead } from '../ui/Bits';
import { useToast } from '../ui/Feedback';

interface Campus {
  id: number;
  name: string;
  address?: string;
  studentsCount?: number;
  status?: string;
}

export default function Campuses() {
  const toast = useToast();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', location: '', status: 'Active' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/institution/campuses', formData);
      const created = formData.name;
      setShowAdd(false);
      setFormData({ name: '', location: '', status: 'Active' });
      // Refresh
      const data = await api.get('/institution/campuses');
      const list = data?.campuses || [];
      setCampuses(list);
      toast.success('Campus added', `${created} is now available in the campus selector.`);
    } catch (err: any) {
      toast.error('Could not add campus', err.message || 'Failed to create campus');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    async function fetchCampuses() {
      try {
        const data = await api.get('/institution/campuses');
        setCampuses(data?.campuses || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch campuses');
      } finally {
        setLoading(false);
      }
    }
    fetchCampuses();
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return campuses;
    return campuses.filter(
      (c) =>
        c.name?.toLowerCase().includes(term) ||
        String(c.address || '').toLowerCase().includes(term),
    );
  }, [campuses, query]);

  return (
    <div className="page">
      <PageHead
        title="Campuses"
        subtitle="Every physical location under your institution. The campus you pick in the header filters staff, students and reporting across the app."
      >
        {campuses.length > 0 && (
          <label className="search-field">
            <Search aria-hidden="true" />
            <input
              type="search"
              className="input"
              placeholder="Find a campus…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search campuses"
            />
          </label>
        )}
        <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus />
          Add campus
        </button>
      </PageHead>

      {error && <ErrorNote message={error} />}

      {loading ? (
        <PageSkeleton cards={3} rows={2} />
      ) : campuses.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Building2 />}
            title="No campuses yet"
            text="Add your first campus and the rest of the workspace — staff, students, timetables — will have somewhere to live."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
                <Plus />
                Add your first campus
              </button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Search />}
            title={`Nothing matches “${query.trim()}”`}
            text="Try a shorter term, or clear the search to see every campus."
            action={
              <button type="button" className="btn btn-quiet" onClick={() => setQuery('')}>
                Clear search
              </button>
            }
          />
        </div>
      ) : (
        <>
          <p className="section-rule">
            {visible.length} {visible.length === 1 ? 'campus' : 'campuses'}
          </p>
          <div className="grid-cards">
            {visible.map((campus) => {
              const maintenance = campus.status === 'Maintenance';
              return (
                <article className="card card-hover" key={campus.id}>
                  <div className="card-pad">
                    <div className="row-between" style={{ alignItems: 'flex-start' }}>
                      <span className="initials" aria-hidden="true">
                        <Building2 className="w-4 h-4" />
                      </span>
                      <span className={`chip ${maintenance ? 'chip-warn' : 'chip-ok'}`}>
                        {maintenance ? <Wrench aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                        {campus.status || 'Active'}
                      </span>
                    </div>
                    <h3 style={{ marginTop: 14, fontSize: '0.9375rem', fontWeight: 650 }}>
                      {campus.name}
                    </h3>
                    <p
                      className="row"
                      style={{ marginTop: 6, color: 'var(--ink-3)', fontSize: '0.75rem', gap: 6 }}
                    >
                      <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                      {campus.address || 'No address on record'}
                    </p>
                    {typeof campus.studentsCount === 'number' && (
                      <p style={{ marginTop: 10, color: 'var(--ink-2)', fontSize: '0.75rem' }}>
                        <b style={{ fontWeight: 650 }}>{campus.studentsCount}</b> students enrolled
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add a campus"
        description="Give it a name your staff will recognise. You can change the status later if the site closes for works."
        onSubmit={handleSubmit}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Add campus'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <label className="field">
            <span className="label">Campus name</span>
            <input
              required
              type="text"
              className="input"
              placeholder="e.g. Riverside Campus"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="label">Location / address</span>
            <input
              required
              type="text"
              className="input"
              placeholder="e.g. 14 Canal Road, Lahore"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="label">Status</span>
            <select
              className="select"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="Active">Active</option>
              <option value="Maintenance">Maintenance</option>
            </select>
            <span className="field-hint">
              Campuses under maintenance stay visible but are flagged everywhere they appear.
            </span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
