import React, { useEffect, useMemo, useState } from 'react';
import { Megaphone, Plus, Trash2, Globe, Users, BookOpen, MapPin, Search } from 'lucide-react';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';
import Modal from '../ui/Modal';
import { EmptyState, PageHead } from '../ui/Bits';
import { useConfirm, useToast } from '../ui/Feedback';

interface Announcement {
  id: number;
  title: string;
  content: string;
  targetType: 'ALL' | 'CAMPUS' | 'CLASS' | 'SECTION' | 'ROLE';
  targetCampusId?: number;
  targetClassId?: number;
  targetSectionId?: number;
  targetUserRole?: string;
  createdAt: string;
}

const EMPTY_FORM = {
  title: '',
  content: '',
  targetType: 'ALL',
  targetCampusId: '',
  targetClassId: '',
  targetSectionId: '',
  targetUserRole: '',
};

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Announcements() {
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  async function fetchAnnouncements() {
    setLoading(true);
    try {
      const res = await api.get('/institution/announcements');
      setAnnouncements(res.announcements || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number, title?: string) {
    const ok = await confirmDialog({
      title: 'Delete this announcement?',
      body: `“${title || 'This announcement'}” disappears from every inbox that received it. This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/institution/announcements?id=${id}`);
      setAnnouncements(announcements.filter(a => a.id !== id));
      toast.info('Announcement deleted');
    } catch (err: any) {
      toast.error('Could not delete', err.message || 'Failed to delete');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData };
      if (payload.targetType === 'ROLE') {
        payload.targetType = 'ALL';
      }
      await api.post('/institution/announcements', payload);
      setShowAdd(false);
      setFormData(EMPTY_FORM);
      fetchAnnouncements();
      toast.success('Announcement published', 'It is on its way to everyone you targeted.');
    } catch (err: any) {
      toast.error('Could not publish', err.message || 'Failed to create announcement');
    } finally {
      setSaving(false);
    }
  }

  const getTargetIcon = (type: string) => {
    switch(type) {
      case 'ALL': return <Globe aria-hidden="true" />;
      case 'CAMPUS': return <MapPin aria-hidden="true" />;
      case 'CLASS': case 'SECTION': return <BookOpen aria-hidden="true" />;
      case 'ROLE': return <Users aria-hidden="true" />;
      default: return <Megaphone aria-hidden="true" />;
    }
  };

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return announcements;
    return announcements.filter(
      (a) =>
        a.title?.toLowerCase().includes(term) || a.content?.toLowerCase().includes(term),
    );
  }, [announcements, query]);

  return (
    <div className="page">
      <PageHead
        title="Announcements"
        subtitle="Broadcasts reach the app of everyone you target, straight away. Keep them short — people read them on a phone."
      >
        {announcements.length > 0 && (
          <label className="search-field">
            <Search aria-hidden="true" />
            <input
              type="search"
              className="input"
              placeholder="Search announcements…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search announcements"
            />
          </label>
        )}
        <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus />
          New announcement
        </button>
      </PageHead>

      {loading ? (
        <PageSkeleton rows={5} />
      ) : announcements.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Megaphone />}
            title="Nothing broadcast yet"
            text="Announcements are the fastest way to reach every phone at once — a closure, a reminder, an exam date."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
                <Plus />
                Write your first announcement
              </button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Search />}
            title="No announcement matches that"
            text="Try a different word, or clear the search."
            action={
              <button type="button" className="btn btn-quiet" onClick={() => setQuery('')}>
                Clear search
              </button>
            }
          />
        </div>
      ) : (
        <div className="stack">
          <p className="section-rule">
            {visible.length} {visible.length === 1 ? 'announcement' : 'announcements'}
          </p>
          {visible.map(ann => (
            <article className="card card-hover" key={ann.id}>
              <div className="card-pad">
                <div className="row-between" style={{ alignItems: 'flex-start', gap: 16 }}>
                  <div className="stack" style={{ gap: 8, minWidth: 0 }}>
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 650 }}>{ann.title}</h3>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <span className="chip chip-brand">
                        {getTargetIcon(ann.targetType)}
                        {ann.targetType === 'ALL' ? 'Everyone' : ann.targetType}
                      </span>
                      <span
                        style={{ color: 'var(--ink-3)', fontSize: '0.75rem' }}
                        title={new Date(ann.createdAt).toLocaleString()}
                      >
                        {relativeTime(ann.createdAt)}
                      </span>
                    </div>
                    <p
                      style={{
                        color: 'var(--ink-2)',
                        fontSize: '0.8125rem',
                        lineHeight: 1.65,
                        whiteSpace: 'pre-wrap',
                        maxWidth: '70ch',
                      }}
                    >
                      {ann.content}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(ann.id, ann.title)}
                    aria-label={`Delete ${ann.title}`}
                    title="Delete announcement"
                    className="icon-btn icon-btn-danger"
                    style={{ flexShrink: 0 }}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="New announcement"
        description="Published immediately. Everyone you target sees it the next time they open the app."
        size="md"
        onSubmit={handleSubmit}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Publishing…' : 'Publish'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <label className="field">
            <span className="label">Title</span>
            <input
              required
              type="text"
              className="input"
              placeholder="e.g. Campus closed on Friday"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
            />
          </label>

          <label className="field">
            <span className="label">Message</span>
            <textarea
              required
              rows={5}
              className="textarea"
              placeholder="Write it the way you'd say it out loud."
              value={formData.content}
              onChange={e => setFormData({...formData, content: e.target.value})}
            />
            <span className="field-hint">{formData.content.length} characters</span>
          </label>

          <label className="field">
            <span className="label">Who should see it</span>
            <select
              className="select"
              value={formData.targetType}
              onChange={e => setFormData({...formData, targetType: e.target.value})}
            >
              <option value="ALL">Everyone in the institution</option>
              <option value="ROLE">A specific role (staff or students)</option>
              <option value="CAMPUS">A specific campus</option>
              <option value="CLASS">A specific class</option>
            </select>
          </label>

          {formData.targetType === 'ROLE' && (
            <label className="field">
              <span className="label">Role</span>
              <select
                className="select"
                value={formData.targetUserRole}
                onChange={e => setFormData({...formData, targetUserRole: e.target.value})}
              >
                <option value="">Choose a role…</option>
                <option value="STAFF">All staff</option>
                <option value="STUDENT">All students</option>
              </select>
            </label>
          )}
        </div>
      </Modal>
    </div>
  );
}
