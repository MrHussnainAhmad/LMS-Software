import React, { useEffect, useState } from 'react';
import { Shield, Plus, Users, Mail, Trash2 } from 'lucide-react';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';
import Modal from '../ui/Modal';
import { EmptyState, PageHead } from '../ui/Bits';
import { useConfirm, useToast } from '../ui/Feedback';

interface MiniAdmin {
  id: number;
  name: string;
  email: string;
  createdAt?: string;
}

function initialsOf(name: string) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();
}

export default function Admin() {
  const toast = useToast();
  const confirm = useConfirm();

  const [admins, setAdmins] = useState<MiniAdmin[]>([]);
  const [maxAdmins, setMaxAdmins] = useState(2);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  async function fetchAdmins() {
    setLoading(true);
    try {
      const res = await api.get('/institution/admins').catch(() => ({ admins: [], maxAdmins: 2 }));
      setAdmins(res.admins || []);
      setMaxAdmins(res.maxAdmins || 2);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAdmin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) return;
    setSaving(true);
    try {
      await api.post('/institution/admins', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      const created = form.name.trim();
      setForm({ name: '', email: '', password: '' });
      setShowCreateModal(false);
      fetchAdmins();
      toast.success('Admin added', `${created} can now sign in with the password you set.`);
    } catch (err: any) {
      toast.error('Could not add admin', err.message || 'Failed to create admin');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAdmin(id: number, name?: string) {
    const ok = await confirm({
      title: 'Remove this admin?',
      body: `${name || 'This person'} loses access to the institution panel immediately. Their account can be recreated later.`,
      confirmLabel: 'Remove admin',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/institution/admins?id=${id}`);
      fetchAdmins();
      toast.info('Admin removed', name ? `${name} no longer has access.` : undefined);
    } catch (err: any) {
      toast.error('Could not remove admin', err.message || 'Failed to remove admin');
    }
  }

  const atLimit = admins.length >= maxAdmins;

  return (
    <div className="page">
      <PageHead
        title="Admins"
        subtitle="People who can run the institution panel alongside you. Mini admins can do everything except owner-level controls."
      >
        <span className="chip chip-mute">
          {admins.length} of {maxAdmins} used
        </span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
          disabled={atLimit}
          title={atLimit ? `Your plan allows ${maxAdmins} admins` : undefined}
        >
          <Plus />
          Add admin
        </button>
      </PageHead>

      {atLimit && !loading && (
        <div className="alert alert-info">
          <Shield aria-hidden="true" />
          <div>
            You&rsquo;ve used every admin seat on this plan. Remove one below to free a slot.
          </div>
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <div className="card-head-copy">
            <h2 className="card-title">
              <Shield aria-hidden="true" />
              Current admins
            </h2>
            <p className="card-sub">Each one signs in with their own email and password.</p>
          </div>
        </div>

        {loading ? (
          <div className="card-pad">
            <PageSkeleton rows={4} />
          </div>
        ) : admins.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="You're the only admin"
            text="Add a colleague so someone else can keep the panel running when you're away."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                <Plus />
                Add an admin
              </button>
            }
          />
        ) : (
          <div>
            {admins.map((admin) => (
              <div className="list-row" key={admin.id}>
                <span className="initials" aria-hidden="true">{initialsOf(admin.name)}</span>
                <span className="cell-stack" style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <b>{admin.name}</b>
                  <span className="row" style={{ gap: 5 }}>
                    <Mail className="w-3 h-3" aria-hidden="true" />
                    {admin.email}
                  </span>
                </span>
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  aria-label={`Remove ${admin.name}`}
                  onClick={() => handleDeleteAdmin(admin.id, admin.name)}
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add an admin"
        description="They will be able to manage institution operations — everything except owner-level controls."
        size="sm"
        onSubmit={handleCreateAdmin}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !form.name.trim() || !form.email.trim() || !form.password.trim()}
            >
              {saving ? 'Creating…' : 'Create admin'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <label className="field">
            <span className="label">Full name</span>
            <input
              autoFocus
              required
              type="text"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Ayesha Khan"
            />
          </label>
          <label className="field">
            <span className="label">Email</span>
            <input
              required
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="admin@example.com"
            />
          </label>
          <label className="field">
            <span className="label">Password</span>
            <input
              required
              minLength={8}
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 8 characters"
            />
            <span className="field-hint">
              Share it with them directly — we don&rsquo;t email passwords. Limit: {maxAdmins} admins per institution.
            </span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
