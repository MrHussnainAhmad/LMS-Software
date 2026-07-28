import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Calendar, Search } from 'lucide-react';
import { api } from '../utils/api';

export default function DailyDiary() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [classId, setClassId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadMeta() {
      setError('');
      try {
        const meta = await api.get('/institution/timetable?metadata=true');
        const allClasses = meta?.allClasses || meta?.classes || [];
        setClasses(allClasses);
        if (!classId && allClasses.length > 0) {
          setClassId(String(allClasses[0].id));
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load classes');
      }
    }
    loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadDiary() {
      if (!classId) return;
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/institution/diary?classId=${classId}&date=${date}`);
        setEntries(Array.isArray(res) ? res : (res?.entries || []));
      } catch (err: any) {
        setEntries([]);
        setError(err.message || 'Failed to load diary entries');
      } finally {
        setLoading(false);
      }
    }
    loadDiary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date]);

  const filteredEntries = useMemo(() => {
    const rows = Array.isArray(entries) ? entries : [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((e: any) => {
      const haystack = `${e.subjectName || ''} ${e.staffName || ''} ${e.content || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, query]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Daily Diary</h1>
          <p className="text-slate-400 mt-1">View daily diary entries (by class and date).</p>
        </div>

      </div>

      <div className="flex gap-4">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search by subject/staff/content..." 
            className="bg-slate-800/50 border border-slate-700/50 text-slate-200 text-sm rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="bg-slate-800/50 border border-slate-700/50 text-slate-200 text-sm rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          disabled={classes.length === 0}
        >
          {classes.length === 0 ? <option value="">Loading classes...</option> : null}
          {classes.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
        <input 
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-slate-800/50 border border-slate-700/50 text-slate-200 text-sm rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-start gap-3">
          <Calendar className="w-5 h-5 mt-0.5 text-red-400" />
          <div className="text-sm">{error}</div>
        </div>
      )}

      {loading ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center shadow-xl text-slate-300">
          Loading diary entries...
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center shadow-xl">
          <BookOpen className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white">No Diaries Found</h3>
          <p className="text-slate-400 mt-2">
            There are no diary entries for this class on {date}.
          </p>
        </div>
      ) : (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
          <div className="border-b border-slate-700/50 p-4 bg-slate-800/30">
            <h2 className="text-lg font-bold text-white">
              Diary Entries • {date}
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {filteredEntries.map((e: any) => (
              <div key={e.id} className="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="text-white font-semibold">
                    {e.subjectName || 'Subject'} <span className="text-slate-400 font-normal">• {e.staffName || 'Unknown staff'}</span>
                  </div>
                  <div className="text-slate-400 text-sm">{e.date || date}</div>
                </div>
                <div className="text-slate-300 text-sm mt-2 whitespace-pre-wrap leading-relaxed">
                  {e.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
