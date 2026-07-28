import { useEffect, useState } from 'react';
import { Ticket, Clock, CheckCircle2, AlertCircle, Send, PlayCircle } from 'lucide-react';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';
import { EmptyState, PageHead } from '../ui/Bits';
import { useToast } from '../ui/Feedback';

interface HelpdeskTicket {
  id: number;
  title: string;
  description: string;
  status: 'OPEN' | 'WORKING' | 'RESOLVED';
  creatorRole: 'STAFF' | 'STUDENT';
  creatorName: string;
  isForwarded: boolean;
  platformStatus: string | null;
  createdAt: string;
}

const FILTERS = [
  { value: 'open', label: 'Needs attention' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
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

export default function HelpDesk() {
  const toast = useToast();
  const [tickets, setTickets] = useState<HelpdeskTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    fetchTickets();
  }, [filter]);

  async function fetchTickets() {
    setLoading(true);
    try {
      const backendFilter = filter === 'open' ? 'active' : filter;
      const res = await api.get(`/institution/tickets?filter=${backendFilter}`);
      setTickets(res.tickets || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(ticketId: number, action: 'updateStatus' | 'forward', status?: 'WORKING' | 'RESOLVED') {
    setBusy(ticketId);
    try {
      await api.post('/institution/tickets', { ticketId, action, status });
      fetchTickets(); // Refresh
      if (status === 'RESOLVED') toast.success('Ticket resolved', 'The person who raised it has been notified.');
      else if (status === 'WORKING') toast.info('Marked as in progress');
    } catch (err: any) {
      toast.error('Could not update the ticket', err.message || 'Failed to perform action');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page">
      <PageHead
        title="Helpdesk"
        subtitle="Support requests raised by your staff and students. Resolve them here, or leave them open and they stay at the top of the queue."
      >
        <div className="seg" role="group" aria-label="Filter tickets">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </PageHead>

      <section className="card">
        <div className="card-head">
          <div className="card-head-copy">
            <h2 className="card-title">
              <Ticket aria-hidden="true" />
              {filter === 'resolved' ? 'Resolved tickets' : filter === 'all' ? 'Every ticket' : 'Open & in progress'}
            </h2>
            <p className="card-sub">
              {loading ? 'Loading…' : `${tickets.length} ${tickets.length === 1 ? 'ticket' : 'tickets'}`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="card-pad">
            <PageSkeleton rows={4} />
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={<Ticket />}
            title={filter === 'open' ? 'Queue is clear' : 'Nothing here'}
            text={
              filter === 'open'
                ? 'No one is waiting on you. New tickets from staff and students land here automatically.'
                : 'No tickets match this filter yet.'
            }
            action={
              filter !== 'open' ? (
                <button type="button" className="btn btn-quiet" onClick={() => setFilter('open')}>
                  Back to the queue
                </button>
              ) : undefined
            }
          />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {tickets.map((ticket) => {
              const working = busy === ticket.id;
              return (
                <li className="list-row" key={ticket.id} style={{ alignItems: 'flex-start' }}>
                  <span className="initials" aria-hidden="true">{initialsOf(ticket.creatorName)}</span>

                  <div className="stack" style={{ gap: 7, flex: '1 1 auto', minWidth: 0 }}>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <b style={{ fontSize: '0.875rem', fontWeight: 650 }}>{ticket.title}</b>
                      {ticket.status === 'OPEN' && (
                        <span className="chip chip-info">
                          <AlertCircle aria-hidden="true" />
                          Open
                        </span>
                      )}
                      {ticket.status === 'WORKING' && (
                        <span className="chip chip-warn">
                          <Clock aria-hidden="true" />
                          In progress
                        </span>
                      )}
                      {ticket.status === 'RESOLVED' && (
                        <span className="chip chip-ok">
                          <CheckCircle2 aria-hidden="true" />
                          Resolved
                        </span>
                      )}
                      {ticket.isForwarded && (
                        <span className="chip chip-brand">
                          <Send aria-hidden="true" />
                          Forwarded{ticket.platformStatus ? ` · ${ticket.platformStatus}` : ''}
                        </span>
                      )}
                    </div>

                    <p style={{ color: 'var(--ink-3)', fontSize: '0.75rem' }}>
                      {ticket.creatorName || 'Unknown user'} · {String(ticket.creatorRole || '').toLowerCase()} ·{' '}
                      {new Date(ticket.createdAt).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>

                    <p className="prose-note">{ticket.description}</p>
                  </div>

                  {ticket.status !== 'RESOLVED' && (
                    <div className="row" style={{ gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                      {ticket.status === 'OPEN' && (
                        <button
                          type="button"
                          className="btn btn-warn btn-sm"
                          disabled={working}
                          onClick={() => handleAction(ticket.id, 'updateStatus', 'WORKING')}
                        >
                          <PlayCircle />
                          Start
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-ok btn-sm"
                        disabled={working}
                        onClick={() => handleAction(ticket.id, 'updateStatus', 'RESOLVED')}
                      >
                        <CheckCircle2 />
                        Resolve
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
