import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../utils/api';
import { Plus, Search, Edit2, Users } from 'lucide-react';
import PageSkeleton from '../components/PageSkeleton';

interface StaffMember {
  id: number;
  name: string;
  role: string;
  campus: string;
  email: string;
}

export default function Staff() {
  const { selectedCampus } = useOutletContext<any>();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [campuses, setCampuses] = useState<{ id: number; name: string }[]>([]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', campusId: '', customRoleId: '' });
  const [saving, setSaving] = useState(false);
  
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
      setShowAdd(false);
      setFormData({ name: '', phone: '', campusId: '', customRoleId: '' });
      
      const data = await api.get('/institution/staff');
      const list = data?.staff || [];
      setStaff(list);
      alert(`Staff created! Email: ${res.credentials?.email || 'Check email'} / Password: ${res.credentials?.initialPassword || '1234567890'}`);
    } catch(err: any) {
      alert(err.message || 'Failed to create staff');
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Staff Directory</h1>
          <p className="text-slate-400 mt-1">Manage personnel across all campuses.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search staff..." 
              className="bg-slate-800/50 border border-slate-700/50 text-slate-200 text-sm rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
          <button onClick={() => setShowAdd(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Staff
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl">
          {error}
        </div>
      )}

      {showAdd && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Add Staff Member</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
              <input required type="text" className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Phone Number</label>
              <input required type="text" className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Campus</label>
              <select className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white" value={formData.campusId} onChange={e => setFormData({...formData, campusId: e.target.value})}>
                <option value="">Main / No campus</option>
                {campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Role</label>
              <select required className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white" value={formData.customRoleId} onChange={e => setFormData({...formData, customRoleId: e.target.value})}>
                <option value="">Select role...</option>
                {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex justify-end gap-3 mt-4">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-all">{saving ? 'Saving...' : 'Add Staff'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <PageSkeleton rows={7} />
      ) : staff.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center">
          <Users className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white">No Staff Found</h3>
          <p className="text-slate-400 mt-2">You haven't added any staff yet.</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/30">
                  <th className="p-4 text-sm font-semibold text-slate-300">Name</th>
                  <th className="p-4 text-sm font-semibold text-slate-300">Role</th>
                  <th className="p-4 text-sm font-semibold text-slate-300">Campus</th>
                  <th className="p-4 text-sm font-semibold text-slate-300">Email</th>
                  <th className="p-4 text-sm font-semibold text-slate-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {staff.map(person => (
                  <tr key={person.id} className="hover:bg-slate-700/20 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                          {person.name ? person.name.split(' ').map(n => n[0]).join('') : '?'}
                        </div>
                        <span className="font-medium text-slate-200">{person.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-400 text-sm">{person.role}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-700/50 border border-slate-600/50 text-xs text-slate-300">
                        <div className="w-2 h-2 rounded-full bg-indigo-400" />
                        {person.campus || 'Main'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 text-sm">{person.email}</td>
                    <td className="p-4 text-right">
                      <button className="text-slate-400 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors opacity-0 group-hover:opacity-100">
                        <Edit2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
