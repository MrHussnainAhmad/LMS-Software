import React, { useEffect, useState } from 'react';
import { CalendarOff, Check, X, Filter, AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';

export default function Leaves() {
  const [filter, setFilter] = useState('pending'); // pending, approved, rejected
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function fetchLeaves() {
    setLoading(true);
    setError('');
    try {
      const backendStatus =
        filter === 'approved' ? 'APPROVED' : filter === 'rejected' ? 'REJECTED' : 'PENDING';
      const res = await api.get(`/institution/leaves?status=${backendStatus}`);
      setLeaves(res?.leaves || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load leaves');
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(leaveId: number, status: 'APPROVED' | 'REJECTED') {
    try {
      await api.patch(`/institution/leaves/${leaveId}`, { status });
      await fetchLeaves();
    } catch (err: any) {
      alert(err.message || 'Failed to update leave request');
    }
  }

  const header =
    filter === 'pending'
      ? 'Pending Leaves'
      : filter === 'approved'
        ? 'Approved Leaves'
        : 'Rejected Leaves';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Leave Management</h1>
          <p className="text-slate-400 mt-1">Review and manage staff leave requests.</p>
        </div>
        <div className="flex gap-2 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
          <button 
            onClick={() => setFilter('pending')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'pending' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Pending
          </button>
          <button 
            onClick={() => setFilter('approved')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'approved' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Approved
          </button>
          <button 
            onClick={() => setFilter('rejected')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'rejected' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Rejected
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div className="text-sm">{error}</div>
        </div>
      )}

      {loading ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center shadow-xl text-slate-300">
          Loading...
        </div>
      ) : leaves.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center shadow-xl">
          <CalendarOff className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white">{header}</h3>
          <p className="text-slate-400 mt-2">There are no {filter} leave requests to show at this time.</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
          <div className="border-b border-slate-700/50 p-4 bg-slate-800/30">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-400" />
              {header}
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {leaves.map((l) => (
                <div key={l.id} className="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <div className="text-white font-semibold">
                        {l.staffName} <span className="text-slate-400 font-normal">({l.status})</span>
                      </div>
                      <div className="text-slate-400 text-sm mt-1">
                        {l.startDate} → {l.endDate}
                      </div>
                      {l.reason && (
                        <div className="text-slate-300 text-sm mt-2 whitespace-pre-wrap">
                          {l.reason}
                        </div>
                      )}
                    </div>

                    {filter === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDecision(l.id, 'APPROVED')}
                          className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/20 px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleDecision(l.id, 'REJECTED')}
                          className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/20 px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
