import React, { useEffect, useState } from 'react';
import { Megaphone, Plus, Trash2, Globe, Users, BookOpen, MapPin } from 'lucide-react';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';

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

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetType: 'ALL',
    targetCampusId: '',
    targetClassId: '',
    targetSectionId: '',
    targetUserRole: ''
  });
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

  async function handleDelete(id: number) {
    if (!confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/institution/announcements?id=${id}`);
      setAnnouncements(announcements.filter(a => a.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
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
      setFormData({
        title: '', content: '', targetType: 'ALL', targetCampusId: '', targetClassId: '', targetSectionId: '', targetUserRole: ''
      });
      fetchAnnouncements();
    } catch (err: any) {
      alert(err.message || 'Failed to create announcement');
    } finally {
      setSaving(false);
    }
  }

  const getTargetIcon = (type: string) => {
    switch(type) {
      case 'ALL': return <Globe className="w-4 h-4" />;
      case 'CAMPUS': return <MapPin className="w-4 h-4" />;
      case 'CLASS': case 'SECTION': return <BookOpen className="w-4 h-4" />;
      case 'ROLE': return <Users className="w-4 h-4" />;
      default: return <Megaphone className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Announcements</h1>
          <p className="text-slate-400 mt-1">Broadcast messages to your staff and students.</p>
        </div>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Announcement
        </button>
      </div>

      {showAdd && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-4">New Announcement</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Title</label>
              <input 
                required type="text"
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Message Content</label>
              <textarea 
                required rows={4}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Target Audience</label>
              <select 
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                value={formData.targetType} onChange={e => setFormData({...formData, targetType: e.target.value})}
              >
                <option value="ALL">Everyone in Institution</option>
                <option value="ROLE">Specific Role (Staff/Student)</option>
                <option value="CAMPUS">Specific Campus</option>
                <option value="CLASS">Specific Class</option>
              </select>
            </div>

            {formData.targetType === 'ROLE' && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Select Role</label>
                <select className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                  value={formData.targetUserRole} onChange={e => setFormData({...formData, targetUserRole: e.target.value})}>
                  <option value="">Select...</option>
                  <option value="STAFF">All Staff</option>
                  <option value="STUDENT">All Students</option>
                </select>
              </div>
            )}
            
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-colors">
                {saving ? 'Publishing...' : 'Publish Announcement'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && !showAdd ? (
        <PageSkeleton rows={5} />
      ) : announcements.length === 0 && !showAdd ? (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-12 text-center shadow-xl">
          <Megaphone className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white">No Announcements</h3>
          <p className="text-slate-400 mt-2">You haven't broadcasted any announcements yet.</p>
        </div>
      ) : !showAdd ? (
        <div className="space-y-4">
          {announcements.map(ann => (
            <div key={ann.id} className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl hover:bg-slate-800 transition-colors group">
              <div className="flex justify-between items-start">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{ann.title}</h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs font-medium">
                      <span className="flex items-center gap-1.5 text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md">
                        {getTargetIcon(ann.targetType)}
                        {ann.targetType === 'ALL' ? 'Everyone' : ann.targetType}
                      </span>
                      <span className="text-slate-500">
                        {new Date(ann.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-300 leading-relaxed max-w-4xl whitespace-pre-wrap">{ann.content}</p>
                </div>
                <button 
                  onClick={() => handleDelete(ann.id)}
                  aria-label={`Delete ${ann.title}`}
                  title="Delete announcement"
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
