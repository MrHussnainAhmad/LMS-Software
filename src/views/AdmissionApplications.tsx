import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Download, Search, UserPlus } from 'lucide-react';
import { api } from '../utils/api';
import Modal from '../ui/Modal';
import { useConfirm, useToast } from '../ui/Feedback';

type Summary = { id: number; cycleId: number; offeringId: number; applicationNumber: string; studentName: string; guardianName: string; guardianEmail: string; guardianPhone: string; status: string; submittedAt: string; offeringTitle: string; cycleName: string };
type Operations = {
  stats: Record<string, number>;
  capacity: Array<{ offeringId: number; title: string; capacity: number | null; activeApplications: number; enrolled: number }>;
  cycles: Array<{ id: number; name: string; academicYear: string; status: string }>;
  offerings: Array<{ id: number; cycleId: number; title: string; isActive: boolean }>;
};
type Detail = {
  application: Summary & { dateOfBirth: string; gender: string; previousInstitution: string | null; previousClassMarks: string | null; medicalInformation: string | null; notes: string | null; requiresTest: boolean; requiresInterview: boolean };
  documents: Array<{ id: number; documentName: string; instructions: string | null; status: string; submittedFileKey: string | null; reviewerNote: string | null }>;
  appointments: Array<{ id: number; type: 'TEST' | 'INTERVIEW'; scheduledAt: string; location: string; instructions: string | null; outcome: string; outcomeNote: string | null }>;
  events: Array<{ id: number; title: string; description: string | null; createdAt: string }>;
  feePayment: { id: number; amount: number; dueDate: string | null; instructions: string; bankName: string | null; accountNumber: string | null; qrUrl: string | null; payerSourceBank: string | null; payerReference: string | null; proofFileKey: string | null; status: string; reviewerNote: string | null } | null;
  enrollment: { id: number; studentId: number; loginRollNumber: string; createdAt: string } | null;
  options: { campuses: Array<{ id: number; name: string }>; classes: Array<{ id: number; name: string }>; sections: Array<{ id: number; classId: number; name: string }> };
};

const LABELS: Record<string, string> = { SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under review', DOCUMENTS_REQUIRED: 'Documents required', TEST_SCHEDULED: 'Test scheduled', INTERVIEW_SCHEDULED: 'Interview scheduled', DECISION_PENDING: 'Decision pending', OFFERED: 'Offered', REJECTED: 'Not accepted', FEE_PENDING: 'Fee pending', FEE_VERIFICATION: 'Fee verification', FEE_VERIFIED: 'Fee verified', REFUND_REQUIRED: 'Refund required', ENROLLED: 'Enrolled', WITHDRAWN: 'Withdrawn' };
const EMPTY_OPS: Operations = { stats: {}, capacity: [], cycles: [], offerings: [] };

export default function AdmissionApplications({ cycles, offerings, refreshRevision }: {
  cycles: Array<{ id: number; name: string; academicYear: string; status: string }>;
  offerings: Array<{ id: number; cycleId: number; title: string; capacity: number | null; isActive: boolean }>;
  refreshRevision: number;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [applications, setApplications] = useState<Summary[]>([]);
  const [operations, setOperations] = useState<Operations>(EMPTY_OPS);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 30, total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [cycle, setCycle] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [credentials, setCredentials] = useState<{ loginRollNumber: string; temporaryPassword: string } | null>(null);
  const [enrollmentClassId, setEnrollmentClassId] = useState('');
  const metadataLoaded = useRef(false);
  const mutationInFlight = useRef(false);
  const lastRefreshRevision = useRef(refreshRevision);

  useEffect(() => {
    setOperations((current) => ({
      ...current,
      cycles: cycles.map(({ id, name, academicYear, status }) => ({ id, name, academicYear, status })),
      offerings: offerings.map(({ id, cycleId, title, isActive }) => ({ id, cycleId, title, isActive })),
      capacity: offerings.map((offering) => current.capacity.find((item) => item.offeringId === offering.id) || {
        offeringId: offering.id, title: offering.title, capacity: offering.capacity, activeApplications: 0, enrolled: 0,
      }),
    }));
  }, [cycles, offerings]);

  const loadList = useCallback(async (signal?: AbortSignal, forceMeta = false) => {
    const params = new URLSearchParams({ page: String(page), pageSize: '30', meta: forceMeta || !metadataLoaded.current ? '1' : '0' });
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (status) params.set('status', status);
    if (cycle) params.set('cycle', cycle);
    const result = await api.get(`/institution/admissions/applications?${params}`, { signal });
    setApplications(result.applications || []);
    setPagination(result.pagination || { page, pageSize: 30, total: 0, pages: 1 });
    if (result.stats) {
      setOperations({ stats: result.stats, capacity: result.capacity || [], cycles: result.cycles || [], offerings: result.offerings || [] });
      metadataLoaded.current = true;
    }
    return result;
  }, [cycle, debouncedSearch, page, status]);

  const loadDetail = useCallback(async (id: number, signal?: AbortSignal) => {
    const result = await api.get(`/institution/admissions/applications/${id}`, { signal });
    setDetail(result); return result;
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { setPage(1); setDebouncedSearch(search.trim()); }, 350); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    loadList(controller.signal).catch((error) => { if (error.name !== 'AbortError') toast.error('Applications unavailable', error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [loadList, toast]);
  useEffect(() => {
    if (lastRefreshRevision.current === refreshRevision) return;
    lastRefreshRevision.current = refreshRevision;
    const controller = new AbortController();
    setLoading(true);
    loadList(controller.signal, true)
      .catch((error) => { if (error.name !== 'AbortError') toast.error('Applications unavailable', error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [loadList, refreshRevision, toast]);
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    const controller = new AbortController(); setDetail(null); setCredentials(null); setEnrollmentClassId('');
    loadDetail(selectedId, controller.signal).catch((error) => { if (error.name !== 'AbortError') toast.error('Application unavailable', error.message); });
    return () => controller.abort();
  }, [loadDetail, selectedId, toast]);

  async function act(body: Record<string, unknown>, success = 'Application updated and applicant notified') {
    if (!selectedId || mutationInFlight.current) return null;
    mutationInFlight.current = true;
    setBusy(true);
    try {
      const result = await api.patch(`/institution/admissions/applications/${selectedId}`, body);
      const previous = applications.find((application) => application.id === selectedId);
      if (result.status && previous && previous.status !== result.status) {
        const enrolled = result.status === 'ENROLLED';
        const leavesCurrentFilter = enrolled || Boolean(status && status !== result.status);
        setApplications((current) => leavesCurrentFilter
          ? current.filter((application) => application.id !== selectedId)
          : current.map((application) => application.id === selectedId ? { ...application, status: result.status } : application));
        if (leavesCurrentFilter) setPagination((current) => ({
          ...current,
          total: Math.max(0, current.total - 1),
          pages: Math.max(1, Math.ceil(Math.max(0, current.total - 1) / current.pageSize)),
        }));
        setOperations((current) => ({
          ...current,
          stats: {
            ...current.stats,
            [previous.status]: Math.max(0, (current.stats[previous.status] || 0) - 1),
            ...(enrolled ? {} : { [result.status]: (current.stats[result.status] || 0) + 1 }),
          },
          capacity: current.capacity.map((item) => item.offeringId !== previous.offeringId ? item : {
            ...item,
            activeApplications: Math.max(0, item.activeApplications
              + Number(!['REJECTED', 'WITHDRAWN', 'ENROLLED'].includes(result.status))
              - Number(!['REJECTED', 'WITHDRAWN', 'ENROLLED'].includes(previous.status))),
            enrolled: Math.max(0, item.enrolled + Number(result.status === 'ENROLLED') - Number(previous.status === 'ENROLLED')),
          }),
        }));
      }
      const credentialOnly = body.action === 'resetApplicantPassword' || body.action === 'resetStudentPassword';
      if (!credentialOnly) await loadDetail(selectedId);
      toast.success(success);
      if (result.credentials) setCredentials(result.credentials);
      window.dispatchEvent(new Event('admissions:updated'));
      return result;
    } catch (error: any) { toast.error('Could not update application', error.message); return null; }
    finally { mutationInFlight.current = false; setBusy(false); }
  }

  async function formAction(event: FormEvent<HTMLFormElement>, action: string, extra: Record<string, unknown> = {}) {
    event.preventDefault(); const form = event.currentTarget; const value = new FormData(form);
    const body: Record<string, unknown> = { action, ...extra };
    value.forEach((entry, key) => { body[key] = entry; });
    if (body.scheduledAt) body.scheduledAt = new Date(String(body.scheduledAt)).toISOString();
    if (body.amount) body.amount = Number(body.amount);
    if (body.campusId) body.campusId = Number(body.campusId); else if ('campusId' in body) body.campusId = null;
    if (body.classId) body.classId = Number(body.classId);
    if (body.sectionId) body.sectionId = Number(body.sectionId); else if ('sectionId' in body) body.sectionId = null;
    if (body.yearOfJoining) body.yearOfJoining = Number(body.yearOfJoining);
    const result = await act(body); if (result) form.reset();
  }

  async function openFile(kind: 'document' | 'fee', id: number) {
    try { const blob = await api.get(`/institution/admissions/files/${kind}/${id}`, { responseType: 'blob' }); const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener'); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    catch (error: any) { toast.error('Could not open file', error.message); }
  }

  function exportCsv() {
    const escape = (value: unknown) => { const raw = String(value ?? ''); const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; };
    const rows = [['Application', 'Student', 'Guardian', 'Email', 'Phone', 'Cycle', 'Program', 'Status', 'Submitted'], ...applications.map((item) => [item.applicationNumber, item.studentName, item.guardianName, item.guardianEmail, item.guardianPhone, item.cycleName, item.offeringTitle, LABELS[item.status] || item.status, item.submittedAt])];
    const url = URL.createObjectURL(new Blob([rows.map((row) => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `admission-applications-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  async function acceptAllNew() {
    if (status !== 'SUBMITTED' || debouncedSearch || pagination.total < 1) return;
    const okay = await confirm({ title: `Accept ${pagination.total} new application${pagination.total === 1 ? '' : 's'}?`, body: 'Each application will enter its configured next step. Documents, tests, interviews, and fee requests are created automatically.', confirmLabel: `Accept all (${pagination.total})` });
    if (!okay) return;
    setBusy(true);
    try {
      const result = await api.post('/institution/admissions/applications/bulk-accept', { confirm: true, cycleId: cycle ? Number(cycle) : null });
      toast.success(`${result.accepted || 0} applications accepted`, result.failed ? `${result.failed} could not be processed.` : undefined);
      setPage(1);
      await loadList(undefined, true);
      window.dispatchEvent(new Event('admissions:updated'));
    } catch (error) { toast.error('Could not accept applications', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  const total = Object.values(operations.stats).reduce((sum, value) => sum + Number(value || 0), 0);
  const queues = [{ value: '', label: 'All', count: total }, { value: 'SUBMITTED', label: 'New', count: operations.stats.SUBMITTED || 0 }, { value: 'DOCUMENTS_REQUIRED', label: 'Documents', count: operations.stats.DOCUMENTS_REQUIRED || 0 }, { value: 'DECISION_PENDING', label: 'Decision', count: operations.stats.DECISION_PENDING || 0 }, { value: 'FEE_VERIFICATION', label: 'Verify fee', count: operations.stats.FEE_VERIFICATION || 0 }, { value: 'REFUND_REQUIRED', label: 'Refund required', count: operations.stats.REFUND_REQUIRED || 0 }];

  return <section className="card">
    <div className="card-head"><div className="card-head-copy"><h2 className="card-title"><UserPlus />Review applications</h2><p className="card-sub">Small work queues, server-side search, and 30 records per page keep large admission rounds manageable.</p></div><div className="card-tools"><button className="btn btn-quiet btn-sm" onClick={exportCsv} disabled={!applications.length}><Download />Export page</button></div></div>
    <div className="card-pad stack" style={{ gap: 18 }}>
      <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}><div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>{queues.map((queue) => <button key={queue.value || 'all'} className={`btn btn-sm ${status === queue.value ? 'btn-primary' : 'btn-quiet'}`} onClick={() => { setStatus(queue.value); setPage(1); }}>{queue.label}<span className="chip chip-mute">{queue.count}</span></button>)}</div>{status === 'SUBMITTED' && !debouncedSearch && pagination.total > 0 && <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={acceptAllNew}>Accept all ({pagination.total})</button>}</div>
      {operations.capacity.length > 0 && <div className="form-grid form-grid-2">{operations.capacity.map((item) => <div className="list-row" key={item.offeringId}><span className="cell-stack"><b>{item.title}</b><span>{item.activeApplications} active · {item.enrolled}{item.capacity ? ` of ${item.capacity}` : ''} enrolled</span></span>{item.capacity && item.enrolled >= item.capacity ? <span className="chip chip-bad">Full</span> : null}</div>)}</div>}
      <div className="form-grid" style={{ gridTemplateColumns: 'minmax(240px,1fr) 190px 190px' }}><label className="search-field"><Search /><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, phone, email, or application number" /></label><select className="select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{Object.entries(LABELS).filter(([key]) => key !== 'ENROLLED').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select className="select" value={cycle} onChange={(event) => { setCycle(event.target.value); setPage(1); }}><option value="">All cycles</option>{operations.cycles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
    </div>
    {loading ? <div className="empty"><p className="empty-text">Loading a small application batch…</p></div> : applications.length === 0 ? <div className="empty"><p className="empty-title">No applications found</p><p className="empty-text">Try another queue or search.</p></div> : <><div className="table-wrap"><table className="tbl"><thead><tr><th>Application</th><th>Student</th><th>Program</th><th>Guardian</th><th>Status</th><th>Submitted</th><th></th></tr></thead><tbody>{applications.map((item) => <tr key={item.id}><td className="mono">{item.applicationNumber}</td><td><b>{item.studentName}</b></td><td>{item.offeringTitle}<small>{item.cycleName}</small></td><td>{item.guardianName}<small>{item.guardianPhone}</small></td><td><span className="chip chip-mute">{LABELS[item.status] || item.status}</span></td><td>{new Date(item.submittedAt).toLocaleDateString('en-PK')}</td><td><button className="btn btn-quiet btn-sm" onClick={() => setSelectedId(item.id)}>Open</button></td></tr>)}</tbody></table></div><div className="card-pad row-between"><span className="field-hint">Showing {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}</span><div className="row"><button className="btn btn-quiet btn-sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft />Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button className="btn btn-quiet btn-sm" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)}>Next<ChevronRight /></button></div></div></>}

    <Modal open={Boolean(selectedId)} onClose={() => setSelectedId(null)} title={detail?.application.studentName || 'Application'} description={detail ? `${detail.application.applicationNumber} · ${LABELS[detail.application.status] || detail.application.status}` : 'Loading application…'} size="lg" scrollBody>
      {detail ? <DetailPanel detail={detail} busy={busy} credentials={credentials} enrollmentClassId={enrollmentClassId} setEnrollmentClassId={setEnrollmentClassId} act={act} formAction={formAction} openFile={openFile} /> : <p className="field-hint">Loading application details…</p>}
    </Modal>
  </section>;
}

function DetailPanel({ detail, busy, credentials, enrollmentClassId, setEnrollmentClassId, act, formAction, openFile }: { detail: Detail; busy: boolean; credentials: { loginRollNumber: string; temporaryPassword: string } | null; enrollmentClassId: string; setEnrollmentClassId: (value: string) => void; act: (body: Record<string, unknown>, success?: string) => Promise<any>; formAction: (event: FormEvent<HTMLFormElement>, action: string, extra?: Record<string, unknown>) => Promise<void>; openFile: (kind: 'document' | 'fee', id: number) => Promise<void> }) {
  const application = detail.application;
  const decide = async (decision: 'OFFERED' | 'REJECTED') => { const note = window.prompt(decision === 'OFFERED' ? 'Offer instructions or next steps:' : 'Short decision note:'); if (note?.trim()) await act({ action: 'decision', decision, note }); };
  const outcome = async (type: 'TEST' | 'INTERVIEW', value: string) => { const note = window.prompt(`Optional note for ${value.toLowerCase()}:`) || ''; await act({ action: 'recordOutcome', type, outcome: value, note }); };
  const reset = async (action: string) => { if (window.confirm('Issue a new temporary password and invalidate the previous one?')) await act({ action }); };
  const withdraw = async () => { const reason = window.prompt('Why is this application being withdrawn?'); if (reason?.trim()) await act({ action: 'withdrawApplication', reason }); };
  const canWithdraw = !['FEE_VERIFICATION', 'FEE_VERIFIED', 'WITHDRAWN', 'ENROLLED'].includes(application.status);
  return <div className="stack" style={{ gap: 16 }}>
    <section className="card" style={{ boxShadow: 'none' }}><div className="card-pad"><div className="row-between"><div className="cell-stack"><b style={{ fontSize: 18 }}>{application.studentName}</b><span>{application.offeringTitle} · {application.cycleName}</span></div><span className="chip chip-brand">{LABELS[application.status] || application.status}</span></div><div className="form-grid form-grid-2" style={{ marginTop: 16 }}><Info label="Guardian" value={application.guardianName} /><Info label="Contact" value={`${application.guardianEmail} · ${application.guardianPhone}`} /><Info label="Date of birth" value={application.dateOfBirth} /><Info label="Previous institution" value={application.previousInstitution || 'Not provided'} /><Info label="Recent marks" value={application.previousClassMarks || 'Not provided'} /><Info label="Health and support" value={application.medicalInformation || 'Nothing reported'} /></div>{application.notes && <p className="prose-note">{application.notes}</p>}<div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 16 }}>{application.status === 'SUBMITTED' && <><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act({ action: 'startReview' })}>Accept and begin</button><button className="btn btn-quiet btn-sm" onClick={() => decide('REJECTED')}>Do not accept</button></>}<button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => reset('resetApplicantPassword')}>Reset applicant password</button>{application.status === 'ENROLLED' && <button className="btn btn-quiet btn-sm" onClick={() => reset('resetStudentPassword')}>Reset student password</button>}{canWithdraw && <button className="btn btn-danger btn-sm" onClick={withdraw}>Withdraw</button>}</div></div></section>

    <div className="form-grid form-grid-2">
      <form className="card" style={{ boxShadow: 'none' }} onSubmit={(event) => { const form = event.currentTarget; const value = new FormData(form); const documents = String(value.get('documents') || '').split('\n').map((name) => name.trim()).filter(Boolean).map((name) => ({ name, instructions: String(value.get('documentInstructions') || '') })); event.preventDefault(); void act({ action: 'requestDocuments', documents }).then((result) => { if (result) form.reset(); }); }}><div className="card-pad form-grid"><b>Documents</b><span className="field-hint">Cycle documents are automatic. Add only extra requests here.</span><textarea required name="documents" rows={2} className="textarea" placeholder="Extra document name" /><textarea name="documentInstructions" rows={2} className="textarea" placeholder="Instructions" /><button className="btn btn-quiet btn-sm" disabled={busy}>Request document</button>{detail.documents.map((document) => <div className="list-row" key={document.id}><span className="cell-stack"><b>{document.documentName}</b><span>{document.status}{document.reviewerNote ? ` · ${document.reviewerNote}` : ''}</span></span>{document.submittedFileKey && <div className="row"><button type="button" className="btn btn-quiet btn-sm" onClick={() => openFile('document', document.id)}>Open</button>{document.status === 'SUBMITTED' && <><button type="button" className="btn btn-primary btn-sm" onClick={() => act({ action: 'reviewDocument', documentId: document.id, status: 'VERIFIED', note: '' })}>Verify</button><button type="button" className="btn btn-quiet btn-sm" onClick={() => { const note = window.prompt('What must be corrected?'); if (note?.trim()) void act({ action: 'reviewDocument', documentId: document.id, status: 'REJECTED', note }); }}>Request again</button></>}</div>}</div>)}</div></form>
      <section className="card" style={{ boxShadow: 'none' }}><div className="card-pad"><b>Decision</b><p className="field-hint">Offer unlocks when required test and interview results have passed.</p>{['UNDER_REVIEW', 'DECISION_PENDING'].includes(application.status) ? <div className="row" style={{ marginTop: 12 }}><button className="btn btn-primary btn-sm" onClick={() => decide('OFFERED')}>Offer admission</button><button className="btn btn-quiet btn-sm" onClick={() => decide('REJECTED')}>Do not accept</button></div> : <p className="prose-note">Current result: {LABELS[application.status] || application.status}</p>}</div></section>
    </div>

    {(['TEST', 'INTERVIEW'] as const).filter((type) => type === 'TEST' ? application.requiresTest : application.requiresInterview).map((type) => { const appointment = detail.appointments.find((item) => item.type === type); return <form key={type} className="card" style={{ boxShadow: 'none' }} onSubmit={(event) => formAction(event, 'scheduleAppointment', { type })}><div className="card-pad form-grid"><b>{type === 'TEST' ? 'Physical admission test' : 'Interview'}</b>{appointment && <p className="prose-note">{new Date(appointment.scheduledAt).toLocaleString()} · {appointment.location} · Result: <b>{appointment.outcome}</b></p>}<div className="form-grid form-grid-2"><input required name="scheduledAt" type="datetime-local" className="input" /><input required name="location" className="input" placeholder="Campus / room / address" /></div><textarea name="instructions" className="textarea" placeholder="Instructions" /><div className="row"><button className="btn btn-primary btn-sm" disabled={busy}>{appointment ? 'Reschedule' : 'Schedule'}</button>{appointment?.outcome === 'PENDING' && ['PASSED', 'FAILED', 'ABSENT'].map((value) => <button key={value} type="button" className="btn btn-quiet btn-sm" onClick={() => outcome(type, value)}>{value}</button>)}</div></div></form>; })}

    {['OFFERED', 'FEE_PENDING', 'FEE_VERIFICATION', 'FEE_VERIFIED', 'REFUND_REQUIRED'].includes(application.status) && <section className="card" style={{ boxShadow: 'none' }}><div className="card-pad form-grid"><b>{application.status === 'REFUND_REQUIRED' ? 'Refund required' : 'Admission fee'}</b>{detail.feePayment && <div className="prose-note"><b>PKR {detail.feePayment.amount.toLocaleString('en-PK')}</b> · {detail.feePayment.status}{detail.feePayment.dueDate && ` · Due ${detail.feePayment.dueDate}`}<p>{detail.feePayment.instructions}</p>{detail.feePayment.payerSourceBank && <p>Source bank: {detail.feePayment.payerSourceBank}</p>}{detail.feePayment.payerReference && <p>Transaction ID: {detail.feePayment.payerReference}</p>}{detail.feePayment.proofFileKey && <button className="btn btn-quiet btn-sm" onClick={() => openFile('fee', detail.feePayment!.id)}>Open payment proof</button>}{detail.feePayment.status === 'SUBMITTED' && application.status !== 'REFUND_REQUIRED' && <span className="row" style={{ marginTop: 8 }}><button className="btn btn-primary btn-sm" onClick={() => act({ action: 'reviewFee', status: 'VERIFIED', note: '' })}>Verify payment</button><button className="btn btn-quiet btn-sm" onClick={() => { const note = window.prompt('Why must this proof be submitted again?'); if (note?.trim()) void act({ action: 'reviewFee', status: 'REJECTED', note }); }}>Reject proof</button></span>}</div>}{['OFFERED', 'FEE_PENDING'].includes(application.status) && detail.feePayment?.status !== 'SUBMITTED' && <form className="form-grid form-grid-2" onSubmit={(event) => formAction(event, 'initiateFee')}><input required name="amount" type="number" min="1" defaultValue={detail.feePayment?.amount} className="input" placeholder="Amount in PKR" /><input name="dueDate" type="date" defaultValue={detail.feePayment?.dueDate || ''} className="input" /><textarea required name="instructions" rows={3} defaultValue={detail.feePayment?.instructions} className="textarea" style={{ gridColumn: '1 / -1' }} placeholder="Payment instructions" /><button className="btn btn-primary btn-sm" disabled={busy}>Request fee payment</button></form>}</div></section>}

    {application.status === 'FEE_VERIFIED' && !detail.enrollment && <form className="card" style={{ boxShadow: 'none' }} onSubmit={(event) => formAction(event, 'enrollStudent')}><div className="card-pad form-grid"><b>Complete student enrollment</b><span className="field-hint">Verify placement carefully. This creates the permanent student record and login.</span><div className="form-grid form-grid-2"><select name="campusId" className="select"><option value="">No campus</option>{detail.options.campuses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select required name="classId" value={enrollmentClassId} onChange={(event) => setEnrollmentClassId(event.target.value)} className="select"><option value="">Select class</option>{detail.options.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select name="sectionId" className="select" disabled={!enrollmentClassId}><option value="">Whole class / create default</option>{detail.options.sections.filter((item) => String(item.classId) === enrollmentClassId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input required name="classRollNumber" className="input" placeholder="Class roll number" /><input required name="yearOfJoining" type="number" min="2000" max="2100" defaultValue={new Date().getFullYear()} className="input" /></div><button className="btn btn-primary" disabled={busy || !detail.options.classes.length}>Create permanent student account</button></div></form>}
    {(credentials || detail.enrollment) && <div className="alert alert-ok"><div><b>Permanent student account</b><p className="mono">Login: {credentials?.loginRollNumber || detail.enrollment?.loginRollNumber}</p>{credentials && <p className="mono">Temporary password: {credentials.temporaryPassword}</p>}</div></div>}
  </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="cell-stack"><span>{label}</span><b>{value}</b></div>; }
