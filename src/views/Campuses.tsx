import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Plus, Building2 } from 'lucide-react';
import PageSkeleton from '../components/PageSkeleton';

interface Campus {
  id: number;
  name: string;
  address?: string;
  studentsCount?: number;
  status?: string;
}

export default function Campuses() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', location: '', status: 'Active' });
  const [saving, setSaving] = useState(false);
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/institution/campuses', formData);
      setShowAdd(false);
      setFormData({ name: '', location: '', status: 'Active' });
      // Refresh
      const data = await api.get('/institution/campuses');
      const list = data?.campuses || [];
      setCampuses(list);
    } catch (err: any) {
      alert(err.message || 'Failed to create campus');
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Campuses</h1>
          <p className="text-slate-400 mt-1">Manage your institution's physical locations.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Campus
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl">
          {error}
        </div>
      )}

      {showAdd && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Add Campus</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Campus Name</label>
              <input required type="text" className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Location / Address</label>
              <input required type="text" className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
              <select className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="Active">Active</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
            <div className="col-span-2 flex justify-end gap-3 mt-4">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-all">{saving ? 'Saving...' : 'Add Campus'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <PageSkeleton cards={3} rows={2} />
      ) : campuses.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white">No Campuses Found</h3>
          <p className="text-slate-400 mt-2">You haven't added any campuses yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campuses.map(campus => (
            <div key={campus.id} className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl hover:border-slate-600 transition-colors">
              <div className="h-32 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 relative flex items-center justify-center">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30" />
                <Building2 className="w-16 h-16 text-indigo-400/50 relative z-10" />
                <div className="absolute bottom-4 left-4 z-10">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${campus.status === 'Maintenance' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                    {campus.status || 'Active'}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-white">{campus.name}</h3>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
