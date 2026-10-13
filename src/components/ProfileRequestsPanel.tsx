import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { api } from '../utils/api';
import Modal from '../ui/Modal';
import { useToast } from '../ui/Feedback';

type RequestRow = {
  id: number;
  requestedFields: Record<string, unknown>;
  reason: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  staffName?: string;
  studentName?: string;
  email?: string;
  phone?: string;
  campusName?: string;
  loginRollNumber?: string;
  className?: string;
  sectionName?: string;
};

function labelFor(key: string) {
  return key.replace(/Id$/, '').replace(/([A-Z])/g, ' $1').trim().replace(/^./, (letter) => letter.toUpperCase());
}

export default function ProfileRequestsPanel({ kind }: { kind: 'staff' | 'student' }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const endpoint = `/institution/${kind}-profile-requests`;

  async function load() {
    setLoading(true);
    try { const response = await api.get(endpoint); setRows(response.requests || []); }
    catch (error: any) { toast.error('Could not load requests', error.message); }
    finally { setLoading(false); }
  }

  function show() { setOpen(true); if (!open) void load(); }

  async function review(id: number, status: 'APPROVED' | 'REJECTED') {
    const promptText = status === 'REJECTED' ? 'Reason for rejecting this request:' : 'Optional note for the user:';
    const adminNote = window.prompt(promptText);
    if (adminNote === null || (status === 'REJECTED' && !adminNote.trim())) return;
    setBusyId(id);
    try { await api.patch(`${endpoint}/${id}`, { status, adminNote: adminNote.trim() || undefined }); await load(); toast.success(status === 'APPROVED' ? 'Profile request approved' : 'Profile request rejected'); }
    catch (error: any) { toast.error('Could not review request', error.message); }
    finally { setBusyId(null); }
  }

  const pending = rows.filter((row) => row.status === 'PENDING');
  return <>
    <button type="button" className="btn btn-quiet" onClick={show}><ClipboardList />Profile requests</button>
    <Modal open={open} onClose={() => setOpen(false)} title={`${kind === 'staff' ? 'Staff' : 'Student'} profile requests`} description="Loaded only when this panel is opened." size="lg">
      {loading && rows.length === 0 ? <p className="prose-note">Loading requests…</p> : pending.length === 0 ? <div className="empty"><p className="empty-title">No pending requests</p><p className="empty-text">Reviewed requests remain listed below for reference.</p></div> : null}
      <div className="stack" style={{ gap: 12 }}>
        {rows.map((row) => <article className="card" style={{ boxShadow: 'none' }} key={row.id}><div className="card-pad stack" style={{ gap: 12 }}>
          <div className="row-between"><span className="cell-stack"><b>{row.staffName || row.studentName || 'User'}</b><span>{row.email || row.loginRollNumber || ''}{row.className ? ` · ${row.className}${row.sectionName ? ` / ${row.sectionName}` : ''}` : ''}</span></span><span className={`chip ${row.status === 'PENDING' ? 'chip-warn' : row.status === 'APPROVED' ? 'chip-ok' : 'chip-bad'}`}>{row.status}</span></div>
          <div className="grid-cards">{Object.entries(row.requestedFields || {}).map(([key, value]) => <div className="secret" style={{ display: 'block' }} key={key}><span className="secret-label">{labelFor(key)}</span><b>{String(value ?? '—')}</b></div>)}</div>
          {row.reason && <p className="prose-note"><b>Reason:</b> {row.reason}</p>}
          {row.adminNote && <p className="prose-note"><b>Institution note:</b> {row.adminNote}</p>}
          <small>{new Date(row.createdAt).toLocaleString()}</small>
          {row.status === 'PENDING' && <div className="row"><button type="button" className="btn btn-primary btn-sm" disabled={busyId === row.id} onClick={() => review(row.id, 'APPROVED')}>Approve changes</button><button type="button" className="btn btn-danger btn-sm" disabled={busyId === row.id} onClick={() => review(row.id, 'REJECTED')}>Reject</button></div>}
        </div></article>)}
      </div>
    </Modal>
  </>;
}
