import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { CalendarDays, CheckCircle2, AlertCircle, Clock, ClipboardCheck } from 'lucide-react';
import PageSkeleton from '../components/PageSkeleton';
import { EmptyState, ErrorNote, PageHead, Stat } from '../ui/Bits';

interface AttendanceRecord {
  staffId: number;
  status: string;
  date: string;
}

function initialsOf(name: string) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();
}

const STATUS_CHIP: Record<string, string> = {
  PRESENT: 'chip-ok',
  ABSENT: 'chip-bad',
  LATE: 'chip-warn',
};

function prettyStatus(status: string) {
  if (!status) return 'Unknown';
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function humanDate(iso: string) {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
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

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="page">
      <PageHead
        title="Staff attendance"
        subtitle={`${humanDate(dateStr)}${dateStr === today ? ' · today' : ''}. Records appear here as soon as they are marked on any campus.`}
      >
        <label className="field" style={{ minWidth: 0 }}>
          <input
            type="date"
            className="input"
            value={dateStr}
            max={today}
            onChange={(e) => setDateStr(e.target.value)}
            aria-label="Attendance date"
          />
        </label>
        {dateStr !== today && (
          <button type="button" className="btn btn-quiet" onClick={() => setDateStr(today)}>
            <CalendarDays />
            Back to today
          </button>
        )}
      </PageHead>

      {error && <ErrorNote message={error} />}

      {loading ? (
        <PageSkeleton cards={3} rows={5} />
      ) : (
        <>
          <section className="metrics">
            <Stat label="Present" value={totalPresent} icon={<CheckCircle2 />} tone="ok" foot="Marked in on time" />
            <Stat label="Absent" value={totalAbsent} icon={<AlertCircle />} tone="brand" foot="No attendance recorded" />
            <Stat label="Late" value={totalLate} icon={<Clock />} tone="accent" foot="Arrived after the bell" />
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-head-copy">
                <h2 className="card-title">
                  <ClipboardCheck aria-hidden="true" />
                  Register
                </h2>
                <p className="card-sub">
                  {attendanceData.length} {attendanceData.length === 1 ? 'entry' : 'entries'} for {dateStr}
                </p>
              </div>
            </div>

            {attendanceData.length === 0 ? (
              <EmptyState
                icon={<CalendarDays />}
                title="Nothing marked for this day"
                text={
                  dateStr === today
                    ? 'Attendance for today has not been submitted yet. It usually lands shortly after the first period.'
                    : 'No one recorded attendance on this date. Pick another day to compare.'
                }
                action={
                  dateStr !== today ? (
                    <button type="button" className="btn btn-quiet" onClick={() => setDateStr(today)}>
                      Jump to today
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">Staff member</th>
                      <th scope="col">Date</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.map((record, i) => {
                      const name = staffMap[record.staffId] || `Staff #${record.staffId}`;
                      return (
                        <tr key={i}>
                          <td>
                            <div className="row">
                              <span className="initials" aria-hidden="true">{initialsOf(name)}</span>
                              <b className="tbl-strong">{name}</b>
                            </div>
                          </td>
                          <td className="tbl-num">{record.date || dateStr}</td>
                          <td>
                            <span className={`chip ${STATUS_CHIP[record.status] || 'chip-mute'}`}>
                              {prettyStatus(record.status)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
