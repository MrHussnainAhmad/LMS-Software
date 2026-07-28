import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Calendar as CalendarIcon, CheckCircle, AlertCircle, Clock, ClipboardCheck } from 'lucide-react';
import PageSkeleton from '../components/PageSkeleton';

interface AttendanceRecord {
  staffId: number;
  status: string;
  date: string;
}

export default function Attendance() {
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [staffMap, setStaffMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    async function fetchAttendance() {
      setLoading(true);
      try {
        const [attendanceRes, staffRes] = await Promise.all([
          api.get(`/institution/staff-attendance?date=${dateStr}`),
          api.get('/institution/staff').catch(() => ({ staff: [] })),
        ]);
        const list = attendanceRes?.records || [];
        setAttendanceData(list);
        setStaffMap(
          Object.fromEntries((staffRes?.staff || []).map((staff: { id: number; name: string }) => [staff.id, staff.name]))
        );
      } catch (err: any) {
        setError(err.message || 'Failed to fetch attendance');
      } finally {
        setLoading(false);
      }
    }
    fetchAttendance();
  }, [dateStr]);

  const totalPresent = attendanceData.filter((record) => record.status === 'PRESENT').length;
  const totalAbsent = attendanceData.filter((record) => record.status === 'ABSENT').length;
  const totalLate = attendanceData.filter((record) => record.status === 'LATE').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Attendance</h1>
          <p className="text-slate-400 mt-1">Monitor daily attendance records.</p>
        </div>
        <div className="flex gap-3">
          <input 
            type="date" 
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="bg-slate-800/50 border border-slate-700/50 text-slate-200 text-sm rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
          <CheckCircle className="w-16 h-16 text-emerald-500/20 absolute -right-2 -bottom-2" />
          <p className="text-emerald-400 text-sm font-medium mb-1 relative z-10">Overall Present</p>
          <p className="text-3xl font-bold text-white relative z-10">{totalPresent}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 relative overflow-hidden">
          <AlertCircle className="w-16 h-16 text-red-500/20 absolute -right-2 -bottom-2" />
          <p className="text-red-400 text-sm font-medium mb-1 relative z-10">Overall Absent</p>
          <p className="text-3xl font-bold text-white relative z-10">{totalAbsent}</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 relative overflow-hidden">
          <Clock className="w-16 h-16 text-amber-500/20 absolute -right-2 -bottom-2" />
          <p className="text-amber-400 text-sm font-medium mb-1 relative z-10">Overall Late</p>
          <p className="text-3xl font-bold text-white relative z-10">{totalLate}</p>
        </div>
      </div>

      {loading ? (
        <PageSkeleton cards={3} rows={5} />
      ) : attendanceData.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center">
          <CalendarIcon className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white">No Records</h3>
          <p className="text-slate-400 mt-2">No attendance records found for {dateStr}.</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/30">
                  <th className="p-4 text-sm font-semibold text-slate-300">Staff Member</th>
                  <th className="p-4 text-sm font-semibold text-slate-300">Date</th>
                  <th className="p-4 text-sm font-semibold text-slate-300 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {attendanceData.map((record, i) => (
                  <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                    <td className="p-4 text-slate-200 font-medium">{staffMap[record.staffId] || `Staff #${record.staffId}`}</td>
                    <td className="p-4 text-slate-400 text-sm">{record.date || dateStr}</td>
                    <td className="p-4 text-center text-slate-200 font-medium">{record.status}</td>
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
