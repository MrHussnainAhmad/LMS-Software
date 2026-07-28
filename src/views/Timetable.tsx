import React, { useEffect, useState } from 'react';
import { CalendarDays, Plus, Clock, Trash2, Users, BookOpen } from 'lucide-react';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';

interface TimetableEntry {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  sectionId: number;
  sectionName: string;
  className: string;
  subjectId: number | null;
  subjectName: string | null;
  staffId: number | null;
  staffName: string | null;
}

interface Metadata {
  allStaff: { id: number; name: string }[];
  allClasses: { id: number; name: string }[];
  allSections: { id: number; name: string; classId: number; classTeacherId: number | null }[];
  allSubjects: { id: number; name: string }[];
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Timetable() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    sectionId: '',
    dayOfWeek: '1',
    startTime: '08:00',
    endTime: '09:00',
    isBreak: false,
    staffId: '',
    subjectId: ''
  });
  const [saving, setSaving] = useState(false);

  const [inchargeForm, setInchargeForm] = useState({
    sectionId: '',
    classTeacherId: ''
  });
  const [savingIncharge, setSavingIncharge] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [metaResp, timetableResp] = await Promise.all([
        api.get('/institution/timetable?metadata=true'),
        api.get('/institution/timetable')
      ]);
      setMetadata(metaResp);
      const classMap = Object.fromEntries((metaResp?.allClasses || []).map((item: { id: number; name: string }) => [item.id, item.name]));
      const sectionMap = Object.fromEntries((metaResp?.allSections || []).map((item: { id: number; name: string; classId: number }) => [item.id, item]));
      const normalizedEntries = (timetableResp?.assignments || []).map((entry: any) => {
        const section = sectionMap[entry.sectionId];
        return {
          ...entry,
          sectionName: section?.name || '',
          className: section ? classMap[section.classId] || '' : '',
          subjectName: entry.subject || null,
          staffName: entry.teacher || null,
        };
      });
      setEntries(normalizedEntries);
    } catch (err: any) {
      setError(err.message || 'Failed to load timetable data');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this timetable entry?')) return;
    try {
      await api.delete(`/institution/timetable?id=${id}`);
      setEntries(entries.filter(e => e.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete entry');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/institution/timetable', {
        sectionId: parseInt(formData.sectionId),
        dayOfWeek: parseInt(formData.dayOfWeek),
        startTime: formData.startTime,
        endTime: formData.endTime,
        isBreak: formData.isBreak,
        staffId: formData.staffId ? parseInt(formData.staffId) : null,
        subjectId: formData.subjectId ? parseInt(formData.subjectId) : null
      });
      setShowAddForm(false);
      fetchData(); // reload
    } catch (err: any) {
      alert(err.message || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  }

  async function handleInchargeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inchargeForm.sectionId) return alert('Select a section');
    setSavingIncharge(true);
    try {
      await api.post('/institution/timetable', {
        action: 'updateIncharge',
        sectionId: parseInt(inchargeForm.sectionId),
        classTeacherId: inchargeForm.classTeacherId ? parseInt(inchargeForm.classTeacherId) : null
      });
      alert('Class Incharge updated successfully');
      fetchData(); // reload
    } catch (err: any) {
      alert(err.message || 'Failed to update incharge');
    } finally {
      setSavingIncharge(false);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Timetable</h1>
          <p className="text-slate-400 mt-1">Manage class schedules and routine.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowAddForm(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Period
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl">
          {error}
        </div>
      )}

      {showAddForm && metadata && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-4">Add Timetable Entry</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Section</label>
              <select 
                required
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                value={formData.sectionId}
                onChange={e => setFormData({...formData, sectionId: e.target.value})}
              >
                <option value="">Select Section...</option>
                {metadata.allSections?.map(s => {
                  const cls = metadata.allClasses?.find(c => c.id === s.classId);
                  return <option key={s.id} value={s.id}>{cls?.name} - {s.name}</option>
                })}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Day</label>
              <select 
                required
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                value={formData.dayOfWeek}
                onChange={e => setFormData({...formData, dayOfWeek: e.target.value})}
              >
                {DAYS.map((day, i) => <option key={i} value={i}>{day}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Start Time</label>
              <input 
                type="time" required
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                value={formData.startTime}
                onChange={e => setFormData({...formData, startTime: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">End Time</label>
              <input 
                type="time" required
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                value={formData.endTime}
                onChange={e => setFormData({...formData, endTime: e.target.value})}
              />
            </div>

            <div className="col-span-2 flex items-center gap-2 mb-2 mt-2">
              <input 
                type="checkbox" 
                id="isBreak"
                checked={formData.isBreak}
                onChange={e => setFormData({...formData, isBreak: e.target.checked})}
                className="rounded border-slate-700 bg-slate-900"
              />
              <label htmlFor="isBreak" className="text-sm font-medium text-white">This is a Break/Recess</label>
            </div>

            {!formData.isBreak && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Subject</label>
                  <select 
                    required
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                    value={formData.subjectId}
                    onChange={e => setFormData({...formData, subjectId: e.target.value})}
                  >
                    <option value="">Select Subject...</option>
                    {metadata.allSubjects?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Teacher</label>
                  <select 
                    required
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                    value={formData.staffId}
                    onChange={e => setFormData({...formData, staffId: e.target.value})}
                  >
                    <option value="">Select Teacher...</option>
                    {metadata.allStaff?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </>
            )}

            <div className="col-span-2 flex justify-end gap-3 mt-4">
              <button 
                type="button" 
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-all"
              >
                {saving ? 'Saving...' : 'Save Period'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && !showAddForm ? (
        <PageSkeleton rows={7} />
      ) : entries.length === 0 && !showAddForm ? (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden p-12 text-center">
          <CalendarDays className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white">No Timetable Data Found</h3>
          <p className="text-slate-400 mt-2 max-w-lg mx-auto">
            You haven't added any timetable periods yet.
          </p>
        </div>
      ) : !showAddForm ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/30">
                    <th className="p-4 text-sm font-semibold text-slate-300">Class/Section</th>
                    <th className="p-4 text-sm font-semibold text-slate-300">Day & Time</th>
                    <th className="p-4 text-sm font-semibold text-slate-300">Subject</th>
                    <th className="p-4 text-sm font-semibold text-slate-300">Teacher</th>
                    <th className="p-4 text-sm font-semibold text-slate-300 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {entries.sort((a,b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)).map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-700/20 transition-colors group">
                      <td className="p-4">
                        <div className="font-medium text-slate-200">{entry.className}</div>
                        <div className="text-xs text-slate-500">{entry.sectionName}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-indigo-400">{DAYS[entry.dayOfWeek]}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> {entry.startTime.substring(0,5)} - {entry.endTime.substring(0,5)}
                        </div>
                      </td>
                      <td className="p-4">
                        {entry.isBreak ? (
                          <span className="inline-flex px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs font-semibold">Break</span>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-300">
                            <BookOpen className="w-4 h-4 text-slate-500" />
                            {entry.subjectName}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-slate-300">
                        {!entry.isBreak && entry.staffName && (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-500" />
                            {entry.staffName}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleDelete(entry.id)}
                          className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
              <div className="border-b border-slate-700/50 p-4 bg-slate-800/30">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" /> Class Incharge
                </h2>
              </div>
              <div className="p-6">
                <form onSubmit={handleInchargeSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Select Section</label>
                    <select 
                      required
                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                      value={inchargeForm.sectionId}
                      onChange={e => {
                        const secId = e.target.value;
                        const sec = metadata?.allSections.find(s => s.id.toString() === secId);
                        setInchargeForm({ sectionId: secId, classTeacherId: sec?.classTeacherId?.toString() || '' });
                      }}
                    >
                      <option value="">Select Section...</option>
                      {metadata?.allSections.map(s => {
                        const cls = metadata.allClasses?.find(c => c.id === s.classId);
                        return <option key={s.id} value={s.id}>{cls?.name} - {s.name}</option>
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Select Incharge</label>
                    <select 
                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                      value={inchargeForm.classTeacherId}
                      onChange={e => setInchargeForm({...inchargeForm, classTeacherId: e.target.value})}
                    >
                      <option value="">-- No Incharge Assigned --</option>
                      {metadata?.allStaff.map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-2">The selected staff member will be the ONLY person authorized to mark attendance for this class.</p>
                  </div>
                  <button 
                    type="submit" 
                    disabled={savingIncharge}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors"
                  >
                    {savingIncharge ? 'Saving...' : 'Save Incharge'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
