import React, { useEffect, useState } from 'react';
import { Ticket, Clock, CheckCircle2, AlertCircle, Send, PlayCircle, Shield } from 'lucide-react';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';

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

export default function HelpDesk() {
  const [tickets, setTickets] = useState<HelpdeskTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');

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
    try {
      await api.post('/institution/tickets', { ticketId, action, status });
      fetchTickets(); // Refresh
    } catch (err: any) {
      alert(err.message || 'Failed to perform action');
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Helpdesk Tickets</h1>
        <p className="text-slate-400 mt-1">Manage support requests from your students and staff.</p>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
        <div className="border-b border-slate-700/50 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Ticket className="w-5 h-5 text-indigo-400" /> Recent Tickets
            </h2>
            <p className="text-sm text-slate-400 mt-1">Tickets can be resolved locally or forwarded to platform support.</p>
          </div>
          
          <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-700/50">
            {[
              { value: 'open', label: 'Open & Working' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'all', label: 'All' }
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.value 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-0">
          {loading ? (
            <div className="p-6"><PageSkeleton rows={4} /></div>
          ) : tickets.length === 0 ? (
            <div className="p-12 text-center">
              <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No tickets found for this filter.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-700/50">
              {tickets.map(ticket => (
                <li key={ticket.id} className="p-6 hover:bg-slate-700/20 transition-colors">
                  <div className="flex flex-col sm:flex-row justify-between gap-6">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-lg text-white">{ticket.title}</h3>
                        
                        {ticket.status === 'OPEN' && (
                          <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" /> Open
                          </span>
                        )}
                        {ticket.status === 'WORKING' && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> Working
                          </span>
                        )}
                        {ticket.status === 'RESOLVED' && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                          </span>
                        )}
                        {ticket.isForwarded && (
                          <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold flex items-center gap-1.5">
                            <Send className="w-3.5 h-3.5" /> Forwarded ({ticket.platformStatus})
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-slate-400">
                        By <span className="font-medium text-slate-200">{ticket.creatorName || 'Unknown user'}</span> ({ticket.creatorRole.toLowerCase()}) on {new Date(ticket.createdAt).toLocaleDateString()}
                      </p>
                      
                      <p className="text-slate-300 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-700/30 text-sm leading-relaxed">
                        {ticket.description}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0 sm:w-48">
                      {ticket.status !== 'RESOLVED' && (
                        <>
                          {ticket.status === 'OPEN' && (
                            <button 
                              onClick={() => handleAction(ticket.id, 'updateStatus', 'WORKING')}
                              className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/20 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              <PlayCircle className="w-4 h-4" /> Mark Working
                            </button>
                          )}
                          <button 
                            onClick={() => handleAction(ticket.id, 'updateStatus', 'RESOLVED')}
                            className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/20 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Mark Resolved
                          </button>
                          
                          {false && (
                            <button 
                              onClick={() => handleAction(ticket.id, 'forward')}
                              className="w-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 mt-2"
                            >
                              <Send className="w-4 h-4" /> Forward to Platform
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
