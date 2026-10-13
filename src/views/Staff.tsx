import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../utils/api';
import { Plus, Search, Users, Mail, Copy, KeyRound, Check, Trash2 } from 'lucide-react';
import PageSkeleton from '../components/PageSkeleton';
import Modal from '../ui/Modal';
import { EmptyState, ErrorNote, PageHead } from '../ui/Bits';
import ProfileRequestsPanel from '../components/ProfileRequestsPanel';
import { useConfirm, useToast } from '../ui/Feedback';

interface StaffMember {
  id: number;
  name: string;
  role?: string;
  roleName?: string;
  campus?: string;
  campusId?: number | string;
  email?: string;
  phone?: string;
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

export default function Staff() {
  const { selectedCampus } = useOutletContext<any>();
  const toast = useToast();
  const confirm = useConfirm();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [campuses, setCampuses] = useState<{ id: number; name: string }[]>([]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', campusId: '', customRoleId: '' });
  const [saving, setSaving] = useState(false);

  /* The first password is shown once, in a dialog the admin has to dismiss on purpose —
     never in a toast that could slide away while they reach for a pen. */
  const [credentials, setCredentials] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        name: formData.name,
        phone: formData.phone,
        subjectIds: []
      };
      if (formData.campusId) payload.campusId = parseInt(formData.campusId);
      if (formData.customRoleId) payload.customRoleId = parseInt(formData.customRoleId);

      const res = await api.post('/institution/staff', payload);
      const createdName = formData.name;
      setShowAdd(false);
      setFormData({ name: '', phone: '', campusId: '', customRoleId: '' });

      const data = await api.get('/institution/staff');
      const list = data?.staff || [];
      setStaff(list);
      setCredentials({
        name: createdName,
        email: res.credentials?.email || 'Check email',
        password: res.credentials?.initialPassword || '1234567890',
      });
    } catch(err: any) {
      toast.error('Could not add staff member', err.message || 'Failed to create staff');
    } finally {
      setSaving(false);
    }
  }


  useEffect(() => {
    async function fetchStaff() {
      try {
        const campusQuery = selectedCampus?.id !== 'all' && selectedCampus?.id ? `?campusId=${selectedCampus.id}` : '';
        const [staffData, campusData, roleData] = await Promise.all([
          api.get(`/institution/staff${campusQuery}`),
          api.get('/institution/campuses').catch(() => ({ campuses: [] })),
          api.get('/institution/roles').catch(() => ({ roles: [] })),
        ]);
        setStaff(staffData?.staff || []);
        setCampuses(campusData?.campuses || []);
        setRoles(roleData?.roles || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch staff');
      } finally {
        setLoading(false);
      }
    }
    fetchStaff();
  }, [selectedCampus]);

  const campusNames = useMemo(() => {
    const map = new Map<string, string>();
    campuses.forEach((c) => map.set(String(c.id), c.name));
    return map;
  }, [campuses]);

  const campusOf = useCallback((person: StaffMember) => {
    if (person.campus) return person.campus;
    if (person.campusId !== undefined && person.campusId !== null) {
      return campusNames.get(String(person.campusId)) || 'Main';
    }
    return 'Main';
  }, [campusNames]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return staff;
    return staff.filter((person) =>
      [person.name, person.email, person.phone, person.roleName ?? person.role, campusOf(person)].some(
        (value) => String(value || '').toLowerCase().includes(term),
      ),
    );
  }, [staff, query, campusOf]);

  async function copyValue(kind: 'email' | 'password', value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      toast.warn('Copy blocked', 'The clipboard is unavailable — select the text and copy it manually.');
    }
  }

  async function removeStaff(person: StaffMember) {
    if (!await confirm({ title: `Remove ${person.name}?`, body: 'Their staff login and role access will be revoked. This cannot be undone.', confirmLabel: 'Remove staff', tone: 'danger' })) return;
    try {
      await api.delete(`/institution/staff/${person.id}`);
      setStaff((current) => current.filter((item) => item.id !== person.id));
      toast.success('Staff member removed');
    } catch (error: any) { toast.error('Could not remove staff member', error.message); }
  }

  const scopeLabel =
    selectedCampus?.id && selectedCampus.id !== 'all' ? selectedCampus.name : 'every campus';

  return (
    <div className="page">
      <PageHead
        title="Staff"
        subtitle={`Teachers and administrators across ${scopeLabel}. A new account gets its login the moment you save it.`}
      >
        <ProfileRequestsPanel kind="staff" />
        {staff.length > 0 && (
          <label className="search-field">
            <Search aria-hidden="true" />
            <input
              type="search"
              className="input"
              placeholder="Name, email, role…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search staff"
            />
          </label>
        )}
        <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus />
          Add staff
        </button>
      </PageHead>

      {error && <ErrorNote message={error} />}

      {loading ? (
        <PageSkeleton rows={7} />
      ) : staff.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users />}
            title="No staff on record"
            text="Add your first teacher or administrator. They will be able to sign in and start marking attendance straight away."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
                <Plus />
                Add your first staff member
              </button>
            }
          />
        </div>
      ) : (
        <section className="card">
          <div className="card-head">
            <div className="card-head-copy">
              <h2 className="card-title">Directory</h2>
              <p className="card-sub">
                {query.trim()
                  ? `${visible.length} of ${staff.length} matching “${query.trim()}”`
                  : `${staff.length} ${staff.length === 1 ? 'person' : 'people'}`}
              </p>
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title="No one matches that search"
              text="Check the spelling, or try searching by role or campus instead."
              action={
                <button type="button" className="btn btn-quiet" onClick={() => setQuery('')}>
                  Clear search
                </button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Role</th>
                    <th scope="col">Campus</th>
                    <th scope="col">Email</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(person => (
                    <tr key={person.id}>
                      <td>
                        <div className="row">
                          <span className="initials" aria-hidden="true">{initialsOf(person.name)}</span>
                          <span className="cell-stack">
                            <b className="tbl-strong">{person.name}</b>
                            {person.phone && <span>{person.phone}</span>}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="chip chip-brand">{person.roleName ?? person.role ?? 'Staff'}</span>
                      </td>
                      <td>{campusOf(person)}</td>
                      <td>
                        {person.email ? (
                          <span className="row" style={{ gap: 6, color: 'var(--ink-2)' }}>
                            <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                            {person.email}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--ink-4)' }}>Not issued yet</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}><button type="button" className="icon-btn" title="Remove staff" aria-label={`Remove ${person.name}`} onClick={() => void removeStaff(person)}><Trash2 /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add a staff member"
        description="The login is generated for you. You will see the email and first password once, right after saving."
        onSubmit={handleSubmit}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create account'}
            </button>
          </>
        }
      >
        <div className="form-grid form-grid-2">
          <label className="field form-span-2">
            <span className="label">Full name</span>
            <input
              required
              type="text"
              className="input"
              placeholder="e.g. Ayesha Khan"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </label>

          <label className="field">
            <span className="label">Phone number</span>
            <input
              required
              type="text"
              className="input"
              placeholder="03xx xxxxxxx"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
            />
          </label>

          <label className="field">
            <span className="label">Campus</span>
            <select
              className="select"
              value={formData.campusId}
              onChange={e => setFormData({...formData, campusId: e.target.value})}
            >
              <option value="">Main / No campus</option>
              {campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
            </select>
          </label>

          <label className="field form-span-2">
            <span className="label">Role</span>
            <select
              required
              className="select"
              value={formData.customRoleId}
              onChange={e => setFormData({...formData, customRoleId: e.target.value})}
            >
              <option value="">Select role…</option>
              {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            <span className="field-hint">
              The role decides what this person can see and do. Roles are managed under Settings.
            </span>
          </label>
        </div>
      </Modal>

      <Modal
        open={Boolean(credentials)}
        onClose={() => setCredentials(null)}
        title="Account created"
        description={
          credentials
            ? `Hand these to ${credentials.name}. This is the only time the first password is shown.`
            : undefined
        }
        size="sm"
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setCredentials(null)}>
            I&rsquo;ve saved these
          </button>
        }
      >
        {credentials && (
          <div className="stack" style={{ gap: 10 }}>
            <div className="secret">
              <span className="secret-label">
                <Mail aria-hidden="true" />
                Email
              </span>
              <code className="mono">{credentials.email}</code>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => copyValue('email', credentials.email)}
              >
                {copied === 'email' ? <Check /> : <Copy />}
                {copied === 'email' ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="secret">
              <span className="secret-label">
                <KeyRound aria-hidden="true" />
                First password
              </span>
              <code className="mono">{credentials.password}</code>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => copyValue('password', credentials.password)}
              >
                {copied === 'password' ? <Check /> : <Copy />}
                {copied === 'password' ? 'Copied' : 'Copy'}
              </button>
            </div>

            <p className="prose-note">
              Ask them to change it after their first sign-in. Once this dialog closes the password
              cannot be retrieved — it would have to be reset.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
