import { useCallback, useEffect, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import { CalendarDays, Pencil, Plus, RefreshCw, School, Trash2 } from 'lucide-react';
import { api } from '../utils/api';
import { PageHead } from '../ui/Bits';
import Modal from '../ui/Modal';
import PageSkeleton from '../components/PageSkeleton';
import { useConfirm, useToast } from '../ui/Feedback';
import AdmissionApplications from './AdmissionApplications';
import { IMAGE_FILE_ACCEPT, prepareImageUpload } from '../utils/upload-file';

type RequiredDocument = { name: string; instructions: string | null };
type PaymentMethod = { id: string; providerName: string; accountTitle: string; accountNumber: string; qrUrl: string | null };
type PaymentMethodDraft = PaymentMethod & { qrFile?: File | null };
type Cycle = {
  id: number; name: string; academicYear: string; status: 'DRAFT' | 'OPEN' | 'CLOSED';
  opensOn: string | null; closesOn: string | null; instructions: string | null; requiredDocuments: RequiredDocument[];
  requiresTest: boolean; testScheduledAt: string | null; testLocation: string | null; testInstructions: string | null;
  requiresInterview: boolean; interviewScheduledAt: string | null; interviewLocation: string | null; interviewInstructions: string | null;
  admissionFeeAmount: number | null; admissionFeeDueDays: number; admissionFeeInstructions: string | null;
  paymentMethods: PaymentMethod[] | null; paymentBankName?: string | null; paymentAccountNumber?: string | null; paymentQrUrl?: string | null;
};
type Offering = { id: number; cycleId: number; title: string; description: string | null; capacity: number | null; gender?: string | null; isActive: boolean };
type AdmissionSection = 'setup' | 'status' | 'review' | 'offline';

export default function Admissions() {
  const toast = useToast();
  const confirm = useConfirm();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [showCycle, setShowCycle] = useState(false);
  const [showOffering, setShowOffering] = useState(false);
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null);
  const [editingOffering, setEditingOffering] = useState<Offering | null>(null);
  const [createPaymentMethods, setCreatePaymentMethods] = useState<PaymentMethodDraft[]>([emptyPaymentMethod()]);
  const [editPaymentMethods, setEditPaymentMethods] = useState<PaymentMethodDraft[]>([]);
  const [section, setSection] = useState<AdmissionSection>('setup');
  const [walkInCredentials, setWalkInCredentials] = useState<{ loginId: string; temporaryPassword: string } | null>(null);
  const mutationInFlight = useRef(false);
  const refreshInFlight = useRef(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await api.get('/institution/admissions', { signal });
    setCycles(response.cycles || []);
    setOfferings(response.offerings || []);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .catch((error) => { if (error.name !== 'AbortError') toast.error('Admissions unavailable', error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, toast]);

  async function refreshAll() {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      await load();
      setRefreshRevision((current) => current + 1);
    } catch (error: any) {
      toast.error('Could not refresh admissions', error.message);
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }

  async function send(body: Record<string, unknown>, success: string) {
    if (mutationInFlight.current) return false;
    mutationInFlight.current = true;
    setBusy(true);
    try {
      const result = await api.post('/institution/admissions', body);
      if (body.action === 'createCycle' && result.cycle) {
        setCycles((current) => [result.cycle, ...current]);
      } else if (body.action === 'createOffering' && result.offering) {
        setOfferings((current) => [result.offering, ...current]);
      } else if (body.action === 'setCycleStatus') {
        const cycleId = Number(body.cycleId);
        const nextStatus = String(result.status || body.status) as Cycle['status'];
        setCycles((current) => current.map((cycle) => ({
          ...cycle,
          status: cycle.id === cycleId ? nextStatus : nextStatus === 'OPEN' && cycle.status === 'OPEN' ? 'CLOSED' : cycle.status,
        })));
      } else if (body.action === 'updateCycle' && result.cycle) {
        setCycles((current) => current.map((cycle) => cycle.id === result.cycle.id ? result.cycle : cycle));
      } else if (body.action === 'updateOffering' && result.offering) {
        setOfferings((current) => current.map((offering) => offering.id === result.offering.id ? result.offering : offering));
      } else if (body.action === 'deleteOffering') {
        setOfferings((current) => current.filter((offering) => offering.id !== Number(body.offeringId)));
      } else if (body.action === 'deleteCycle') {
        const cycleId = Number(body.cycleId);
        setCycles((current) => current.filter((cycle) => cycle.id !== cycleId));
        setOfferings((current) => current.filter((offering) => offering.cycleId !== cycleId));
      }
      toast.success(success);
      return true;
    } catch (error: any) {
      toast.error('Could not update admissions', error.message);
      return false;
    } finally { mutationInFlight.current = false; setBusy(false); }
  }

  async function completePaymentMethods(methods: PaymentMethodDraft[]) {
    const completed: PaymentMethod[] = [];
    for (const method of methods) {
      let qrUrl = method.qrUrl;
      if (method.qrFile) {
        const prepared = await prepareImageUpload(method.qrFile, 2 * 1024 * 1024);
        const signature = await api.post('/institution/public-site/images', { action: 'signature' });
        const upload = new FormData();
        upload.append('file', prepared); upload.append('api_key', signature.apiKey); upload.append('timestamp', String(signature.timestamp)); upload.append('signature', signature.signature); upload.append('folder', signature.folder); upload.append('allowed_formats', signature.allowedFormats); upload.append('type', signature.type);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, { method: 'POST', body: upload });
        const uploaded = await response.json();
        if (!response.ok) throw new Error(uploaded.error?.message || 'QR upload failed');
        const verified = await api.post('/institution/public-site/images', { action: 'complete', publicId: uploaded.public_id, format: uploaded.format, resourceType: uploaded.resource_type });
        qrUrl = verified.url;
      }
      completed.push({ id: method.id, providerName: method.providerName.trim(), accountTitle: method.accountTitle.trim(), accountNumber: method.accountNumber.trim(), qrUrl: qrUrl || null });
    }
    return completed;
  }

  async function cycleBody(data: FormData, methods: PaymentMethodDraft[]) {
    const toIso = (name: string) => { const value = String(data.get(name) || ''); return value ? new Date(value).toISOString() : ''; };
    const documentInstructions = String(data.get('documentInstructions') || '').trim();
    return {
      name: data.get('name'), academicYear: data.get('academicYear'), opensOn: data.get('opensOn'), closesOn: data.get('closesOn'), instructions: data.get('instructions'),
      requiredDocuments: String(data.get('requiredDocuments') || '').split('\n').map((name) => name.trim()).filter(Boolean).map((name) => ({ name, instructions: documentInstructions || null })),
      requiresTest: data.get('requiresTest') === 'on', testScheduledAt: toIso('testScheduledAt'), testLocation: data.get('testLocation'), testInstructions: data.get('testInstructions'),
      requiresInterview: data.get('requiresInterview') === 'on', interviewScheduledAt: toIso('interviewScheduledAt'), interviewLocation: data.get('interviewLocation'), interviewInstructions: data.get('interviewInstructions'),
      admissionFeeAmount: Number(data.get('admissionFeeAmount')), admissionFeeDueDays: Number(data.get('admissionFeeDueDays') || 7), admissionFeeInstructions: data.get('admissionFeeInstructions'),
      paymentMethods: await completePaymentMethods(methods),
    };
  }

  async function createCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget; const data = new FormData(form);
    try {
      const saved = await send({ action: 'createCycle', ...(await cycleBody(data, createPaymentMethods)) }, 'Admission cycle created');
      if (saved) { form.reset(); setCreatePaymentMethods([emptyPaymentMethod()]); setShowCycle(false); }
    } catch (error: any) {
      toast.error('Could not upload payment QR', error.message);
    }
  }

  async function updateCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCycle || editingCycle.status === 'OPEN') return;
    try {
      if (await send({ action: 'updateCycle', cycleId: editingCycle.id, ...(await cycleBody(new FormData(event.currentTarget), editPaymentMethods)) }, 'Admission cycle updated')) setEditingCycle(null);
    } catch (error) { toast.error('Could not update cycle', error instanceof Error ? error.message : 'Please try again.'); }
  }

  async function createOffering(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const rawCapacity = String(data.get('capacity') || '').trim();
    const saved = await send({ action: 'createOffering', cycleId: Number(data.get('cycleId')), title: data.get('title'), description: data.get('description'), capacity: rawCapacity ? Number(rawCapacity) : null }, 'Program added');
    if (saved) { form.reset(); setShowOffering(false); }
  }

  async function updateOffering(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingOffering) return;
    const data = new FormData(event.currentTarget); const capacity = String(data.get('capacity') || '').trim();
    if (await send({ action: 'updateOffering', offeringId: editingOffering.id, title: data.get('title'), description: data.get('description'), capacity: capacity ? Number(capacity) : null }, 'Program updated')) setEditingOffering(null);
  }

  function beginEditCycle(cycle: Cycle) {
    setEditingCycle(cycle);
    setEditPaymentMethods(cycle.paymentMethods?.length ? cycle.paymentMethods : [{ id: crypto.randomUUID(), providerName: cycle.paymentBankName || '', accountTitle: '', accountNumber: cycle.paymentAccountNumber || '', qrUrl: cycle.paymentQrUrl || null }]);
  }

  async function removeCycle(cycle: Cycle) {
    if (!await confirm({ title: 'Remove admission cycle?', body: `${cycle.name} will be permanently removed. Cycles with application history cannot be deleted.`, confirmLabel: 'Remove cycle', tone: 'danger' })) return;
    await send({ action: 'deleteCycle', cycleId: cycle.id }, 'Admission cycle removed');
  }

  async function removeOffering(offering: Offering) {
    if (!await confirm({ title: 'Remove program or class?', body: `${offering.title} will be permanently removed. Programs with applications cannot be deleted.`, confirmLabel: 'Remove program', tone: 'danger' })) return;
    await send({ action: 'deleteOffering', offeringId: offering.id }, 'Program removed');
  }

  async function createWalkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationInFlight.current) return;
    const form = event.currentTarget;
    const value = new FormData(form);
    mutationInFlight.current = true; setBusy(true); setWalkInCredentials(null);
    try {
      const result = await api.post('/institution/admissions/applications', {
        offeringId: Number(value.get('offeringId')), studentName: value.get('studentName'), dateOfBirth: value.get('dateOfBirth'), gender: value.get('gender'),
        guardianName: value.get('guardianName'), guardianEmail: value.get('guardianEmail'), guardianPhone: value.get('guardianPhone'),
        previousInstitution: value.get('previousInstitution'), previousClassMarks: value.get('previousClassMarks'), medicalInformation: value.get('medicalInformation'), notes: value.get('notes'),
      });
      setWalkInCredentials(result.applicantCredentials); form.reset(); toast.success('Walk-in application recorded');
      window.dispatchEvent(new Event('admissions:updated'));
    } catch (error: any) { toast.error('Could not record application', error.message); }
    finally { mutationInFlight.current = false; setBusy(false); }
  }

  if (loading) return <div className="page"><PageSkeleton cards={3} rows={6} /></div>;

  return <div className="page">
    <PageHead title="Admissions" subtitle="Open only the admission workspace you need.">
      {section === 'setup' && <>
      <button className="btn btn-quiet" onClick={refreshAll} disabled={refreshing}><RefreshCw />{refreshing ? 'Refreshing…' : 'Refresh'}</button>
      <button className="btn btn-quiet" onClick={() => setShowOffering(true)} disabled={cycles.length === 0}><School />Add program</button>
      <button className="btn btn-primary" onClick={() => setShowCycle(true)}><Plus />New cycle</button>
      </>}
    </PageHead>

    <nav className="workspace-switcher" aria-label="Admission sections">
      {([
        ['setup', 'Admissions setup', 'New cycle and program or class'],
        ['status', 'Open / close', 'Publish or close an admission cycle'],
        ['review', 'Review applications', 'Process submitted applications'],
        ['offline', 'Offline applications', 'Record walk-in applicants'],
      ] as const).map(([key, label, description]) => <button key={key} type="button" className={section === key ? 'is-active' : ''} onClick={() => setSection(key)}><b>{label}</b><span>{description}</span></button>)}
    </nav>

    {(section === 'setup' || section === 'status') &&
    <section className="card">
      <div className="card-head"><div className="card-head-copy"><h2 className="card-title"><CalendarDays />{section === 'setup' ? 'Admission rounds' : 'Admission availability'}</h2><p className="card-sub">{section === 'setup' ? 'Documents, physical test, interview, and admission fee can be preset once for the whole cycle.' : 'Open one prepared cycle for families, or close applications immediately.'}</p></div></div>
      {cycles.length === 0 ? <div className="empty"><p className="empty-title">No admission cycle yet</p><p className="empty-text">Create a cycle, then add at least one program before opening it.</p></div> : cycles.map((cycle) => {
        const cycleOfferings = offerings.filter((item) => item.cycleId === cycle.id);
        return <div className="list-row" key={cycle.id} style={{ alignItems: 'flex-start', gap: 18 }}>
          <span className="cell-stack" style={{ flex: 1 }}>
            <b>{cycle.name}</b>
            <span>{cycle.academicYear} · {cycleOfferings.length} programs · {[cycle.opensOn, cycle.closesOn].filter(Boolean).join(' to ') || 'No date limit'}</span>
            <span className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 7 }}><i className="chip chip-mute">{cycle.requiredDocuments?.length || 0} documents</i>{cycle.requiresTest && <i className="chip chip-info">Test</i>}{cycle.requiresInterview && <i className="chip chip-info">Interview</i>}{cycle.admissionFeeAmount && <i className="chip chip-ok">PKR {cycle.admissionFeeAmount.toLocaleString('en-PK')}</i>}</span>
            {section === 'setup' && cycleOfferings.length > 0 && <div className="stack" style={{ marginTop: 10, gap: 6 }}>{cycleOfferings.map((offering) => <div key={offering.id} className="row-between" style={{ maxWidth: 640, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 'var(--r)', background: 'var(--sunken)' }}><span><b>{offering.title}</b>{offering.capacity ? ` · ${offering.capacity} seats` : ''}</span>{cycle.status !== 'OPEN' && <span className="row"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingOffering(offering)}><Pencil />Edit</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => removeOffering(offering)}><Trash2 />Remove</button></span>}</div>)}</div>}
          </span>
          <span className={`chip ${cycle.status === 'OPEN' ? 'chip-ok' : cycle.status === 'DRAFT' ? 'chip-warn' : 'chip-mute'}`}>{cycle.status}</span>
          {section === 'setup' && cycle.status !== 'OPEN' && <span className="row"><button type="button" className="btn btn-quiet btn-sm" onClick={() => beginEditCycle(cycle)}><Pencil />Edit</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => removeCycle(cycle)}><Trash2 />Remove</button></span>}
          {section === 'status' && (cycle.status === 'OPEN' ? <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => send({ action: 'setCycleStatus', cycleId: cycle.id, status: 'CLOSED' }, 'Admissions closed')}>Close</button> : <button className="btn btn-primary btn-sm" disabled={busy || cycleOfferings.length === 0} onClick={() => send({ action: 'setCycleStatus', cycleId: cycle.id, status: 'OPEN' }, 'Admissions opened')}>Open</button>)}
        </div>;
      })}
    </section>}

    {section === 'review' && <AdmissionApplications cycles={cycles} offerings={offerings} refreshRevision={refreshRevision} />}

    {section === 'offline' && <section className="card"><div className="card-head"><div className="card-head-copy"><h2 className="card-title"><Plus />Record a walk-in application</h2><p className="card-sub">Use this only when a parent applies at the institution office.</p></div></div><form className="card-pad form-grid form-grid-2" onSubmit={createWalkIn}><select required name="offeringId" className="select"><option value="">Select program</option>{offerings.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{cycles.find((cycle) => cycle.id === item.cycleId)?.name} / {item.title}</option>)}</select><input required name="studentName" className="input" placeholder="Student full name" /><input required name="dateOfBirth" type="date" max={new Date().toISOString().slice(0, 10)} className="input" /><select required name="gender" className="select"><option value="">Gender</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select><input required name="guardianName" className="input" placeholder="Guardian name" /><input required name="guardianEmail" type="email" className="input" placeholder="Guardian email" /><input required name="guardianPhone" className="input" placeholder="Guardian phone" /><input name="previousInstitution" className="input" placeholder="Previous institution (optional)" /><input name="previousClassMarks" className="input" placeholder="Recent marks: obtained / total" /><textarea name="medicalInformation" className="textarea" placeholder="Health, allergies, medicines, disabilities, or emergency instructions" /><textarea name="notes" className="textarea" placeholder="Other notes" /><button className="btn btn-primary" disabled={busy || offerings.length === 0}>Record application</button>{walkInCredentials && <div className="alert alert-ok" style={{ gridColumn: '1 / -1' }}><div><b>Applicant login — copy now</b><p className="mono">Login: {walkInCredentials.loginId}</p><p className="mono">Temporary password: {walkInCredentials.temporaryPassword}</p></div></div>}</form></section>}

    <Modal open={showCycle} onClose={() => setShowCycle(false)} title="Create admission cycle" description="Preset the common steps so staff do not enter the same information for every applicant." size="lg" scrollBody onSubmit={createCycle} footer={<><button type="button" className="btn btn-ghost" onClick={() => setShowCycle(false)}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create cycle'}</button></>}>
      <CycleFields paymentMethods={createPaymentMethods} setPaymentMethods={setCreatePaymentMethods} />
    </Modal>

    <Modal open={showOffering} onClose={() => setShowOffering(false)} title="Add program or class" description="This is what families choose on the public application form." onSubmit={createOffering} footer={<><button type="button" className="btn btn-ghost" onClick={() => setShowOffering(false)}>Cancel</button><button className="btn btn-primary" disabled={busy}>Add program</button></>}><div className="form-grid"><Field label="Admission cycle"><select name="cycleId" required className="select"><option value="">Select cycle</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</select></Field><Field label="Program or class"><input name="title" required minLength={2} maxLength={120} className="input" placeholder="Grade 9 or FSc Pre-Medical" /></Field><Field label="Description"><textarea name="description" maxLength={500} rows={3} className="textarea" /></Field><Field label="Available seats (optional)"><input name="capacity" type="number" min="1" max="100000" className="input" /></Field></div></Modal>

    <Modal open={Boolean(editingCycle)} onClose={() => !busy && setEditingCycle(null)} title="Edit admission cycle" description="The cycle remains closed while its admission information is changed." size="lg" scrollBody onSubmit={updateCycle} footer={<><button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setEditingCycle(null)}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></>}>
      {editingCycle && <CycleFields cycle={editingCycle} paymentMethods={editPaymentMethods} setPaymentMethods={setEditPaymentMethods} />}
    </Modal>

    <Modal open={Boolean(editingOffering)} onClose={() => !busy && setEditingOffering(null)} title="Edit program or class" description="The admission cycle must remain closed while this information is changed." onSubmit={updateOffering} footer={<><button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setEditingOffering(null)}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></>}>
      {editingOffering && <div className="form-grid"><Field label="Program or class"><input name="title" required minLength={1} maxLength={120} defaultValue={editingOffering.title} className="input" /></Field><Field label="Description"><textarea name="description" maxLength={500} rows={3} defaultValue={editingOffering.description || ''} className="textarea" /></Field><Field label="Available seats (optional)"><input name="capacity" type="number" min="1" max="100000" defaultValue={editingOffering.capacity || ''} className="input" /></Field></div>}
    </Modal>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span className="label">{label}</span>{children}</label>; }

function emptyPaymentMethod(): PaymentMethodDraft {
  return { id: crypto.randomUUID(), providerName: '', accountTitle: '', accountNumber: '', qrUrl: null, qrFile: null };
}

function localDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function CycleFields({ cycle, paymentMethods, setPaymentMethods }: { cycle?: Cycle; paymentMethods: PaymentMethodDraft[]; setPaymentMethods: Dispatch<SetStateAction<PaymentMethodDraft[]>> }) {
  const updateMethod = (id: string, values: Partial<PaymentMethodDraft>) => setPaymentMethods((current) => current.map((method) => method.id === id ? { ...method, ...values } : method));
  return <div className="form-grid form-grid-2">
    <Field label="Cycle name"><input name="name" required minLength={2} maxLength={120} defaultValue={cycle?.name || ''} className="input" placeholder="Fall admissions 2027" /></Field>
    <Field label="Academic year"><input name="academicYear" required minLength={4} maxLength={20} defaultValue={cycle?.academicYear || ''} className="input" placeholder="2027-2028" /></Field>
    <Field label="Opening date"><input name="opensOn" type="date" defaultValue={cycle?.opensOn || ''} className="input" /></Field>
    <Field label="Closing date"><input name="closesOn" type="date" defaultValue={cycle?.closesOn || ''} className="input" /></Field>
    <div className="form-span-2"><Field label="Applicant instructions"><textarea name="instructions" maxLength={3000} rows={3} defaultValue={cycle?.instructions || ''} className="textarea" placeholder="What families should know before applying" /></Field></div>
    <section className="card"><div className="card-pad form-grid"><b>Required documents</b><span className="field-hint">One document name per line. Requested automatically after acceptance.</span><textarea required name="requiredDocuments" rows={5} defaultValue={cycle?.requiredDocuments?.map((item) => item.name).join('\n') || ''} className="textarea" placeholder={'B-Form\nPrevious result card\nPassport-size photographs'} /><textarea name="documentInstructions" maxLength={500} rows={3} defaultValue={cycle?.requiredDocuments?.[0]?.instructions || ''} className="textarea" placeholder="Upload instructions (optional)" /></div></section>
    <section className="card"><div className="card-pad form-grid"><label className="row"><input name="requiresTest" type="checkbox" defaultChecked={cycle?.requiresTest} /><b>Physical admission test required</b></label><input name="testScheduledAt" type="datetime-local" defaultValue={localDateTime(cycle?.testScheduledAt)} className="input" /><input name="testLocation" maxLength={300} defaultValue={cycle?.testLocation || ''} className="input" placeholder="Campus, room, or address" /><textarea name="testInstructions" maxLength={1000} rows={2} defaultValue={cycle?.testInstructions || ''} className="textarea" placeholder="Test instructions" /></div></section>
    <section className="card"><div className="card-pad form-grid"><label className="row"><input name="requiresInterview" type="checkbox" defaultChecked={cycle?.requiresInterview} /><b>Interview required</b></label><input name="interviewScheduledAt" type="datetime-local" defaultValue={localDateTime(cycle?.interviewScheduledAt)} className="input" /><input name="interviewLocation" maxLength={300} defaultValue={cycle?.interviewLocation || ''} className="input" placeholder="Campus, room, or address" /><textarea name="interviewInstructions" maxLength={1000} rows={2} defaultValue={cycle?.interviewInstructions || ''} className="textarea" placeholder="Interview instructions" /></div></section>
    <section className="card form-span-2"><div className="card-pad form-grid"><b>Admission fee and payment methods</b><div className="form-grid form-grid-2"><input required name="admissionFeeAmount" type="number" min="1" max="100000000" defaultValue={cycle?.admissionFeeAmount || ''} className="input" placeholder="Amount in PKR" /><input required name="admissionFeeDueDays" type="number" min="1" max="90" defaultValue={cycle?.admissionFeeDueDays || 7} className="input" placeholder="Payment deadline in days" /></div>
      {paymentMethods.map((method, index) => <div key={method.id} className="card"><div className="card-pad form-grid"><div className="row-between"><b>Payment method {index + 1}</b>{paymentMethods.length > 1 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPaymentMethods((current) => current.filter((item) => item.id !== method.id))}><Trash2 />Remove</button>}</div><div className="form-grid form-grid-2"><input required value={method.providerName} onChange={(event) => updateMethod(method.id, { providerName: event.target.value })} className="input" placeholder="Bank / wallet name" /><input required value={method.accountTitle} onChange={(event) => updateMethod(method.id, { accountTitle: event.target.value })} className="input" placeholder="Account title / username" /><input required value={method.accountNumber} onChange={(event) => updateMethod(method.id, { accountNumber: event.target.value })} className="input" placeholder="Account / IBAN / mobile number" /><label className="field"><span className="label">QR image · optional</span><input type="file" accept={IMAGE_FILE_ACCEPT} className="input" onChange={(event) => updateMethod(method.id, { qrFile: event.target.files?.[0] || null })} />{method.qrUrl && <span className="field-hint">Existing QR is retained unless replaced.</span>}</label></div></div></div>)}
      <button type="button" className="btn btn-quiet" disabled={paymentMethods.length >= 8} onClick={() => setPaymentMethods((current) => [...current, emptyPaymentMethod()])}><Plus />Add payment method</button><textarea name="admissionFeeInstructions" maxLength={1000} rows={2} defaultValue={cycle?.admissionFeeInstructions || ''} className="textarea" placeholder="Additional payment note (optional)" /></div></section>
  </div>;
}
