import { useEffect, useState } from 'react';
import { CalendarOff, Check, X, Inbox } from 'lucide-react';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';
import { EmptyState, ErrorNote, PageHead } from '../ui/Bits';
import { useToast } from '../ui/Feedback';

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function initialsOf(name: string) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();
}

function spanOf(start?: string, end?: string) {
  if (!start) return '—';
  if (!end || end === start) return start;
  return `${start} → ${end}`;
}

function daysOf(start?: string, end?: string) {
  if (!start || !end) return null;
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${end}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 86400000) + 1;
}

export default function Leaves() {
  const toast = useToast();
  const [filter, setFilter] = useState('pending'); // pending, approved, rejected
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deciding, setDeciding] = useState<number | null>(null);

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

  async function handleDecision(leaveId: number, status: 'APPROVED' | 'REJECTED', who?: string) {
    setDeciding(leaveId);
    try {
      await api.patch(`/institution/leaves/${leaveId}`, { status });
      await fetchLeaves();
      if (status === 'APPROVED') {
        toast.success('Leave approved', who ? `${who} has been notified.` : undefined);
      } else {
        toast.info('Leave rejected', who ? `${who} has been notified.` : undefined);
      }
    } catch (err: any) {
      toast.error('Could not update the request', err.message || 'Failed to update leave request');
    } finally {
      setDeciding(null);
    }
  }

  const heading =
    filter === 'pending' ? 'Awaiting your decision' : filter === 'approved' ? 'Approved' : 'Rejected';

  return (
    <div className="page">
      <PageHead
        title="Leave requests"
        subtitle="Staff time off, in one queue. Approving a request notifies the person immediately."
      >
        <div className="seg" role="group" aria-label="Filter leave requests">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={filter === tab.key}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </PageHead>

      {error && <ErrorNote message={error} />}

      {loading ? (
        <PageSkeleton rows={4} />
      ) : leaves.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={filter === 'pending' ? <Inbox /> : <CalendarOff />}
            title={
              filter === 'pending'
                ? 'Nothing waiting on you'
                : filter === 'approved'
                  ? 'No approved requests'
                  : 'No rejected requests'
            }
            text={
              filter === 'pending'
                ? 'Every leave request has been dealt with. New ones will land here the moment staff submit them.'
                : `Requests you ${filter === 'approved' ? 'approve' : 'reject'} are kept here as a record.`
            }
            action={
              filter !== 'pending' ? (
                <button type="button" className="btn btn-quiet" onClick={() => setFilter('pending')}>
                  Back to pending
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <section className="card">
          <div className="card-head">
            <div className="card-head-copy">
              <h2 className="card-title">{heading}</h2>
              <p className="card-sub">
                {leaves.length} {leaves.length === 1 ? 'request' : 'requests'}
              </p>
            </div>
          </div>

          <div>
            {leaves.map((l) => {
              const days = daysOf(l.startDate, l.endDate);
              const busy = deciding === l.id;
              return (
                <div className="list-row" key={l.id} style={{ alignItems: 'flex-start' }}>
                  <span className="initials" aria-hidden="true">{initialsOf(l.staffName)}</span>

                  <div className="stack" style={{ gap: 5, flex: '1 1 auto', minWidth: 0 }}>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <b style={{ fontSize: '0.875rem', fontWeight: 650 }}>{l.staffName}</b>
                      <span
                        className={`chip ${
                          l.status === 'APPROVED' ? 'chip-ok' : l.status === 'REJECTED' ? 'chip-bad' : 'chip-warn'
                        }`}
                      >
                        {l.status}
                      </span>
                    </div>
                    <p style={{ color: 'var(--ink-2)', fontSize: '0.8125rem' }}>
                      {spanOf(l.startDate, l.endDate)}
                      {days ? ` · ${days} ${days === 1 ? 'day' : 'days'}` : ''}
                    </p>
                    {l.reason && <p className="prose-note">{l.reason}</p>}
                  </div>

                  {filter === 'pending' && (
                    <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn btn-ok btn-sm"
                        disabled={busy}
                        onClick={() => handleDecision(l.id, 'APPROVED', l.staffName)}
                      >
                        <Check />
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={busy}
                        onClick={() => handleDecision(l.id, 'REJECTED', l.staffName)}
                      >
                        <X />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
