import React, { useEffect, useState } from 'react';
import { Shield, Plus, Users, Mail, Trash2 } from 'lucide-react';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';

interface MiniAdmin {
  id: number;
  name: string;
  email: string;
  createdAt?: string;
}

export default function Admin() {
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
      setForm({ name: '', email: '', password: '' });
      setShowCreateModal(false);
      fetchAdmins();
    } catch (err: any) {
      alert(err.message || 'Failed to create admin');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAdmin(id: number) {
    if (!window.confirm('Remove this admin?')) return;
    try {
      await api.delete(`/institution/admins?id=${id}`);
      fetchAdmins();
    } catch (err: any) {
      alert(err.message || 'Failed to remove admin');
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Institution Admins</h1>
          <p className="text-slate-400 mt-1">Create mini admins with institution-level access.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={admins.length >= maxAdmins}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Admin
        </button>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
        <div className="border-b border-slate-700/50 p-4 bg-slate-800/30">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" /> Current Admins ({admins.length}/{maxAdmins})
          </h2>
        </div>
        <div className="p-6">
          {loading ? (
            <PageSkeleton rows={4} />
          ) : admins.length === 0 ? (
            <div className="text-center py-10">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No mini admins added yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {admins.map((admin) => (
                <div key={admin.id} className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                  <div>
                    <h3 className="text-white font-medium">{admin.name}</h3>
                    <p className="text-sm text-slate-400 inline-flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {admin.email}
                    </p>
                  </div>
                  <button onClick={() => handleDeleteAdmin(admin.id)} className="p-2 text-slate-400 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white">Create Mini Admin</h2>
              <p className="text-slate-400 text-sm mt-1">This admin can manage institution operations (except owner-level controls).</p>
            </div>
            <form onSubmit={handleCreateAdmin} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
                <input
                  autoFocus
                  required
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Ayesha Khan"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                <input
                  required
                  type="email"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
                <input
                  required
                  minLength={8}
                  type="password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                />
              </div>
              <p className="text-xs text-slate-500">Limit: maximum {maxAdmins} admins per institution.</p>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button
                  type="submit"
                  disabled={saving || !form.name.trim() || !form.email.trim() || !form.password.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl font-medium"
                >
                  {saving ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
