import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { FileText, FileX } from 'lucide-react';
import PageSkeleton from '../components/PageSkeleton';

export default function Results() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/institution/batch-exams');
        setBatches(res?.batches || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load results');
        setBatches([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Exam Results</h1>
          <p className="text-slate-400 mt-1">View batch-exam result status.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <PageSkeleton rows={6} />
      ) : batches.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center">
          <FileX className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white">No Results Found</h3>
          <p className="text-slate-400 mt-2">There are no batch exams yet.</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/30">
                  <th className="p-4 text-sm font-semibold text-slate-300">Exam</th>
                  <th className="p-4 text-sm font-semibold text-slate-300">Class</th>
                  <th className="p-4 text-sm font-semibold text-slate-300">Type</th>
                  <th className="p-4 text-sm font-semibold text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {batches.map((b) => {
                  const status = b.officialPublishedAt
                    ? 'Published (Official)'
                    : b.allSubjectsPublished
                      ? 'Published (Effective)'
                      : 'Draft / Waiting';

                  return (
                    <tr key={b.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="p-4 text-slate-200 font-medium flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        {b.title}
                      </td>
                      <td className="p-4 text-slate-400 text-sm">
                        {b.className}
                        {b.sectionName ? ` • ${b.sectionName}` : ''}
                      </td>
                      <td className="p-4 text-slate-400 text-sm">{b.type}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                            b.officialPublishedAt
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : b.allSubjectsPublished
                                ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                                : 'bg-slate-500/10 text-slate-300 border border-slate-500/20'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
