import React, { useEffect, useState } from 'react';
import { ArrowUpCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';

export default function AutoPromotion() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [promoting, setPromoting] = useState<number | null>(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchBatches();
  }, []);

  async function fetchBatches() {
    try {
      const data = await api.get('/institution/students/auto-promote');
      setBatches(data.batches || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch promotion batches');
    } finally {
      setLoading(false);
    }
  }

  async function handlePromote(batchId: number) {
    if (!window.confirm("Are you sure? This action is irreversible.")) return;
    setPromoting(batchId);
    setError('');
    setSuccess('');
    try {
      await api.post('/institution/students/auto-promote', { batchExamId: batchId });
      setSuccess('Auto-promotion executed successfully!');
      fetchBatches();
    } catch (err: any) {
      setError(err.message || 'Failed to execute auto-promotion');
    } finally {
      setPromoting(null);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-white tracking-tight">Auto Promotion</h1>
        <p className="text-slate-400">Promote students to the next academic session automatically.</p>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 shadow-xl flex items-start gap-4">
        <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0" />
        <div>
          <h3 className="text-lg font-semibold text-amber-500">Warning: Irreversible Action</h3>
          <p className="text-amber-500/80 text-sm mt-1">
            Running auto-promotion will move all active students to the next grade based on your institution's configuration. Ensure that all final results are published before running this action.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 p-4 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          {success}
        </div>
      )}

      {loading ? (
        <PageSkeleton rows={4} />
      ) : batches.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center shadow-xl">
          <ArrowUpCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white">No Promotion Batches Found</h3>
          <p className="text-slate-400 mt-2">There are no PROMOTION type batch exams available to execute.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => (
            <div key={batch.id} className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden p-6 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">{batch.title}</h3>
                <p className="text-slate-400 mt-1">Class: {batch.className} {batch.sectionName ? `(${batch.sectionName})` : ''}</p>
                <div className="mt-2 text-sm text-slate-500">
                  Subjects: {batch.subjectCount} {batch.allSubjectsPublished ? '(All Published)' : '(Not all published)'}
                </div>
              </div>
              <div>
                {batch.officialPublishedAt ? (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl font-medium">
                    Already Promoted
                  </span>
                ) : (
                  <button 
                    onClick={() => handlePromote(batch.id)}
                    disabled={promoting === batch.id || !batch.allSubjectsPublished}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white px-6 py-2 rounded-xl font-medium shadow-lg transition-all flex items-center gap-2"
                  >
                    {promoting === batch.id ? 'Executing promotion…' : 'Execute Promotion'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
