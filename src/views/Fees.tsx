import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Banknote, ExternalLink, Plus, ReceiptText, RefreshCw, Search, Settings2, Trash2, Upload, WalletCards } from 'lucide-react';
import { api } from '../utils/api';
import { PageHead } from '../ui/Bits';
import Modal from '../ui/Modal';
import PageSkeleton from '../components/PageSkeleton';
import { useToast } from '../ui/Feedback';
import { IMAGE_FILE_ACCEPT, prepareImageUpload } from '../utils/upload-file';

type SchoolClass = { id: number; name: string };
type FeeHead = { id: number; name: string; kind: 'RECURRING' | 'ONE_TIME'; isActive: boolean };
type ClassItem = { id: number; classId: number; feeHeadId: number; amount: number };
type Invoice = { id: number; studentId: number; studentName: string; loginRollNumber: string; className: string; sectionName: string; billingMonth: string; dueDate: string; status: string; totalAmount: number; paidAmount: number; balance: number };
type PaymentMethod = { id: string; providerName: string; accountTitle: string; accountNumber: string; qrUrl: string | null };
type PaymentMethodDraft = PaymentMethod & { qrFile?: File | null };
type Submission = { id: number; invoiceId: number; amount: number; sourceBankName: string; transactionId: string; status: 'SUBMITTED' | 'VERIFIED' | 'REJECTED'; reviewerNote: string | null; submittedAt: string };
type Summary = { invoiceCount: number; billed: number; collected: number; outstanding: number; defaulters: number };
type FeeData = { classes: SchoolClass[]; heads: FeeHead[]; classItems: ClassItem[]; invoices: Invoice[]; paymentMethods: PaymentMethod[]; submissions: Submission[]; summary: Summary; pageSize: number };
type StudentOption = { id: number; name: string; loginRollNumber: string; className: string; sectionName: string };
type FeeSection = 'setup' | 'billing' | 'collections' | 'paid';

const EMPTY: FeeData = { classes: [], heads: [], classItems: [], invoices: [], paymentMethods: [], submissions: [], summary: { invoiceCount: 0, billed: 0, collected: 0, outstanding: 0, defaulters: 0 }, pageSize: 50 };
const money = (amount: number) => `PKR ${Number(amount || 0).toLocaleString('en-PK')}`;

export default function Fees() {
  const toast = useToast();
  const [data, setData] = useState<FeeData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showHead, setShowHead] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [section, setSection] = useState<FeeSection>('setup');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodDraft[]>([]);
  const [reviewSubmission, setReviewSubmission] = useState<Submission | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const mutationInFlight = useRef(false);
  const refreshInFlight = useRef(false);
  const generationInFlight = useRef(false);
  const loadSequence = useRef(0);
  const classFeeQueues = useRef(new Map<string, Promise<void>>());

  const load = useCallback(async (signal?: AbortSignal) => {
    if (section === 'billing') { setLoading(false); return; }
    const requestId = ++loadSequence.current;
    const search = new URLSearchParams({ view: section });
    if (section === 'collections') {
      search.set('month', month);
      if (status) search.set('status', status);
      if (debouncedQuery) search.set('q', debouncedQuery);
    }
    const response = await api.get(`/institution/fees?${search}`, { signal }) as Partial<FeeData>;
    if (requestId !== loadSequence.current) return;
    setData((current) => ({
      ...current,
      ...response,
      classes: response.classes || current.classes,
      heads: response.heads || current.heads,
      classItems: response.classItems || current.classItems,
      invoices: response.invoices || [],
      paymentMethods: response.paymentMethods || current.paymentMethods,
      submissions: response.submissions || [],
      summary: response.summary || current.summary,
    }));
    if (response.paymentMethods) setPaymentMethods(response.paymentMethods);
  }, [debouncedQuery, month, section, status]);

  async function refresh() {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setLoading(true);
    try {
      await load();
    } catch (error: any) {
      toast.error('Could not refresh fees', error.message);
    } finally {
      refreshInFlight.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    load(controller.signal)
      .catch((error) => { if (error.name !== 'AbortError') toast.error('Fees unavailable', error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, toast]);

  useEffect(() => {
    if (!showAdjustment || selectedStudent || studentQuery.trim().length < 2) { setStudentOptions([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api.get(`/institution/students/picker?q=${encodeURIComponent(studentQuery.trim())}&limit=8`, { signal: controller.signal })
        .then((result) => setStudentOptions(result.students || []))
        .catch((error) => { if (error.name !== 'AbortError') setStudentOptions([]); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [selectedStudent, showAdjustment, studentQuery]);

  async function post(body: Record<string, unknown>, success: string, refreshList = false) {
    if (mutationInFlight.current) return null;
    mutationInFlight.current = true;
    setBusy(true);
    try {
      const result = await api.post('/institution/fees', body);
      if (refreshList && section !== 'billing') await load();
      toast.success(success);
      return result;
    } catch (error: any) {
      toast.error('Could not update fees', error.message);
      return null;
    } finally { mutationInFlight.current = false; setBusy(false); }
  }

  function saveClassFee(classId: number, feeHeadId: number, amount: number) {
    const key = `${classId}:${feeHeadId}`;
    const previous = classFeeQueues.current.get(key) || Promise.resolve();
    const request = previous.then(async () => {
      try {
        const result = await api.post('/institution/fees', { action: 'setClassFee', classId, feeHeadId, amount });
        if (!result.item) return;
        setData((current) => ({
          ...current,
          classItems: current.classItems.some((item) => item.classId === classId && item.feeHeadId === feeHeadId)
            ? current.classItems.map((item) => item.classId === classId && item.feeHeadId === feeHeadId ? result.item : item)
            : [...current.classItems, result.item],
        }));
      } catch (error: any) { toast.error('Could not save class fee', error.message); }
    }).finally(() => { if (classFeeQueues.current.get(key) === request) classFeeQueues.current.delete(key); });
    classFeeQueues.current.set(key, request);
  }

  async function createHead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    const result = await post({ action: 'createHead', name: values.get('name'), kind: values.get('kind') }, 'Fee head created');
    if (result?.head) { setData((current) => ({ ...current, heads: [...current.heads, result.head] })); form.reset(); setShowHead(false); }
  }

  async function generateMonth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (generationInFlight.current) return;
    generationInFlight.current = true;
    const values = new FormData(event.currentTarget);
    try {
      while (classFeeQueues.current.size > 0) await Promise.all([...classFeeQueues.current.values()]);
      const result = await post({ action: 'generateMonth', billingMonth: month, dueDate: values.get('dueDate') }, 'Monthly challans generated');
      if (result) setShowGenerate(false);
    } finally {
      generationInFlight.current = false;
    }
  }

  async function addAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedStudent) return;
    const form = event.currentTarget; const values = new FormData(form);
    if (await post({ action: 'addAdjustment', studentId: selectedStudent.id, label: values.get('label'), type: values.get('type'), amount: Number(values.get('amount')) }, 'Student adjustment saved')) {
      form.reset(); setSelectedStudent(null); setStudentQuery(''); setShowAdjustment(false);
    }
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedInvoice) return;
    const values = new FormData(event.currentTarget);
    const amount = Number(values.get('amount'));
    const previousInvoice = selectedInvoice;
    const result = await post({ action: 'recordPayment', invoiceId: selectedInvoice.id, amount, method: values.get('method'), reference: values.get('reference'), notes: values.get('notes') }, 'Payment recorded and receipt created');
    if (result?.invoice) {
      const leavesCurrentFilter = Boolean(status && status !== result.invoice.status);
      const today = new Date().toISOString().slice(0, 10);
      const wasDefaulter = ['DUE', 'PARTIAL'].includes(previousInvoice.status) && previousInvoice.dueDate < today;
      const isDefaulter = ['DUE', 'PARTIAL'].includes(result.invoice.status) && previousInvoice.dueDate < today;
      setData((current) => ({
        ...current,
        invoices: leavesCurrentFilter
          ? current.invoices.filter((invoice) => invoice.id !== result.invoice.id)
          : current.invoices.map((invoice) => invoice.id === result.invoice.id ? { ...invoice, ...result.invoice } : invoice),
        summary: {
          ...current.summary,
          collected: current.summary.collected + amount,
          outstanding: Math.max(0, current.summary.outstanding - amount),
          defaulters: Math.max(0, current.summary.defaulters + Number(isDefaulter) - Number(wasDefaulter)),
        },
      }));
      setSelectedInvoice(null);
    }
  }

  function addPaymentMethod() {
    setPaymentMethods((current) => [...current, { id: crypto.randomUUID(), providerName: '', accountTitle: '', accountNumber: '', qrUrl: null, qrFile: null }]);
  }

  function updatePaymentMethod(id: string, values: Partial<PaymentMethodDraft>) {
    setPaymentMethods((current) => current.map((method) => method.id === id ? { ...method, ...values } : method));
  }

  async function savePaymentMethods() {
    if (!paymentMethods.length) { toast.error('Add a payment method', 'Students need at least one verified destination.'); return; }
    setBusy(true);
    try {
      const completed: PaymentMethod[] = [];
      for (const method of paymentMethods) {
        let qrUrl = method.qrUrl;
        if (method.qrFile) {
          const file = await prepareImageUpload(method.qrFile, 2 * 1024 * 1024);
          const signature = await api.post('/institution/public-site/images', { action: 'signature' });
          const upload = new FormData();
          upload.append('file', file); upload.append('api_key', signature.apiKey); upload.append('timestamp', String(signature.timestamp)); upload.append('signature', signature.signature); upload.append('folder', signature.folder); upload.append('allowed_formats', signature.allowedFormats); upload.append('type', signature.type);
          const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, { method: 'POST', body: upload });
          const uploaded = await response.json();
          if (!response.ok) throw new Error(uploaded.error?.message || 'QR upload failed');
          const verified = await api.post('/institution/public-site/images', { action: 'complete', publicId: uploaded.public_id, format: uploaded.format, resourceType: uploaded.resource_type });
          qrUrl = verified.url;
        }
        completed.push({ id: method.id, providerName: method.providerName.trim(), accountTitle: method.accountTitle.trim(), accountNumber: method.accountNumber.trim(), qrUrl });
      }
      await api.post('/institution/fees', { action: 'savePaymentMethods', paymentMethods: completed });
      setPaymentMethods(completed);
      toast.success('Payment methods saved');
    } catch (error: any) { toast.error('Could not save payment methods', error.message); }
    finally { setBusy(false); }
  }

  async function openSubmittedReceipt() {
    if (!reviewSubmission) return;
    try {
      const blob = await api.get(`/institution/fees/files/${reviewSubmission.id}`, { responseType: 'blob' }) as Blob;
      const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error: any) { toast.error('Could not open receipt', error.message); }
  }

  async function reviewStudentPayment(statusValue: 'VERIFIED' | 'REJECTED') {
    if (!reviewSubmission || (statusValue === 'REJECTED' && reviewNote.trim().length < 2)) return;
    const result = await post({ action: 'reviewStudentPayment', submissionId: reviewSubmission.id, status: statusValue, note: reviewNote }, statusValue === 'VERIFIED' ? 'Payment verified and receipt created' : 'Payment proof rejected');
    if (result) { setReviewSubmission(null); setReviewNote(''); await load(); }
  }

  const recurringHeads = data.heads.filter((head) => head.kind === 'RECURRING' && head.isActive !== false);
  const feeAmount = (classId: number, headId: number) => data.classItems.find((item) => item.classId === classId && item.feeHeadId === headId)?.amount || 0;
  const tone = (value: string) => value === 'PAID' ? 'chip-ok' : value === 'PARTIAL' ? 'chip-warn' : value === 'VOID' ? 'chip-mute' : 'chip-bad';

  return <div className="page">
    <PageHead title="Fees & Collections" subtitle="Open only the fee workspace you need.">
      {section === 'setup' && <button className="btn btn-primary" onClick={() => setShowHead(true)}><Plus />Fee head</button>}
      {section === 'billing' && <><button className="btn btn-quiet" onClick={() => setShowAdjustment(true)}><Plus />Adjustment</button><button className="btn btn-primary" onClick={() => setShowGenerate(true)}><ReceiptText />Generate month</button></>}
      {(section === 'collections' || section === 'paid') && <button className="btn btn-quiet" onClick={refresh} disabled={loading}><RefreshCw />{loading ? 'Refreshing…' : 'Refresh'}</button>}
    </PageHead>

    <nav className="workspace-switcher" aria-label="Fee sections">
      {([
        ['setup', 'Fee structure', 'Set fee heads and class amounts'],
        ['billing', 'Monthly billing', 'Create challans and adjustments'],
        ['collections', 'Collections', 'Find dues and record payments'],
        ['paid', 'Paid fees / challans', 'Review recent completed payments'],
      ] as const).map(([key, label, description]) => <button key={key} type="button" className={section === key ? 'is-active' : ''} onClick={() => setSection(key)}><b>{label}</b><span>{description}</span></button>)}
    </nav>

    {section === 'collections' &&
    <div className="metrics">
      <Metric label="Billed" value={money(data.summary.billed)} icon={<ReceiptText />} tone="brand" />
      <Metric label="Collected" value={money(data.summary.collected)} icon={<Banknote />} tone="ok" />
      <Metric label="Outstanding" value={money(data.summary.outstanding)} icon={<WalletCards />} tone="accent" />
      <Metric label="Overdue accounts" value={data.summary.defaulters} icon={<Search />} tone="info" />
    </div>}

    {section === 'setup' &&
    <><section className="card">
      <div className="card-head"><div className="card-head-copy"><h2 className="card-title"><Settings2 />Class fee structure</h2><p className="card-sub">Amounts saved here apply to future monthly challans.</p></div></div>
      {loading ? <PageSkeleton cards={0} rows={6} /> : data.classes.length === 0 || recurringHeads.length === 0 ? <div className="empty"><p className="empty-title">Fee structure is not ready</p><p className="empty-text">Create classes and at least one recurring fee head.</p></div> : <div className="table-wrap"><table className="tbl"><thead><tr><th>Class</th>{recurringHeads.map((head) => <th key={head.id}>{head.name}</th>)}</tr></thead><tbody>{data.classes.map((schoolClass) => <tr key={schoolClass.id}><td><b>{schoolClass.name}</b></td>{recurringHeads.map((head) => <td key={head.id}><input aria-label={`${head.name} for ${schoolClass.name}`} className="input input-sm" style={{ width: 120, textAlign: 'right' }} type="number" min="0" defaultValue={feeAmount(schoolClass.id, head.id)} onBlur={(event) => { const amount = Number(event.currentTarget.value || 0); if (amount !== feeAmount(schoolClass.id, head.id)) saveClassFee(schoolClass.id, head.id, amount); }} /></td>)}</tr>)}</tbody></table></div>}
    </section>
    <section className="card" style={{ marginTop: 18 }}>
      <div className="card-head"><div className="card-head-copy"><h2 className="card-title"><Banknote />Student payment methods</h2><p className="card-sub">These verified account details appear when students pay a challan.</p></div></div>
      <div className="card-pad form-grid">
        {paymentMethods.map((method, index) => <div className="card card-pad form-grid" style={{ boxShadow: 'none' }} key={method.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}><b>Payment method {index + 1}</b>{paymentMethods.length > 1 && <button type="button" className="btn btn-quiet btn-sm" onClick={() => setPaymentMethods((current) => current.filter((item) => item.id !== method.id))}><Trash2 />Remove</button>}</div>
          <div className="form-grid form-grid-2"><input required className="input" value={method.providerName} onChange={(event) => updatePaymentMethod(method.id, { providerName: event.target.value })} placeholder="Bank / wallet name" /><input required className="input" value={method.accountTitle} onChange={(event) => updatePaymentMethod(method.id, { accountTitle: event.target.value })} placeholder="Account title / username" /><input required className="input" value={method.accountNumber} onChange={(event) => updatePaymentMethod(method.id, { accountNumber: event.target.value })} placeholder="Account / IBAN / mobile number" /><label className="btn btn-quiet" style={{ justifyContent: 'center' }}><Upload />{method.qrFile ? method.qrFile.name : method.qrUrl ? 'Replace QR image' : 'Choose QR image'}<input hidden type="file" accept={IMAGE_FILE_ACCEPT} onChange={(event) => updatePaymentMethod(method.id, { qrFile: event.target.files?.[0] || null })} /></label></div>
        </div>)}
        <div className="row" style={{ flexWrap: 'wrap' }}><button type="button" className="btn btn-quiet" disabled={paymentMethods.length >= 8} onClick={addPaymentMethod}><Plus />Add method</button><button type="button" className="btn btn-primary" disabled={busy || !paymentMethods.length} onClick={() => void savePaymentMethods()}>Save payment methods</button></div>
      </div>
    </section></>}

    {section === 'billing' && <section className="card"><div className="card-head"><div className="card-head-copy"><h2 className="card-title"><ReceiptText />Monthly billing</h2><p className="card-sub">Generate challans for active students or record an individual concession or extra charge.</p></div></div><div className="card-pad row" style={{ gap: 10, flexWrap: 'wrap' }}><button className="btn btn-primary" onClick={() => setShowGenerate(true)}><ReceiptText />Generate monthly challans</button><button className="btn btn-quiet" onClick={() => setShowAdjustment(true)}><Plus />Student concession or charge</button></div></section>}

    {(section === 'collections' || section === 'paid') &&
    <section className="card">
      <div className="card-head"><div className="card-head-copy"><h2 className="card-title"><ReceiptText />{section === 'paid' ? 'Paid fees / challans' : 'Collection register'}</h2><p className="card-sub">{section === 'paid' ? 'The 50 most recent fully paid challans are shown.' : `The first ${data.pageSize || 50} matching accounts are shown to keep this page fast.`}</p></div>{section === 'collections' && <div className="card-tools"><input className="input input-sm" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /><select className="select select-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="DUE">Due</option><option value="PARTIAL">Partial</option><option value="PAID">Paid</option></select><label className="search-field"><Search /><input className="input input-sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Student or roll number" /></label></div>}</div>
      {data.submissions.some((submission) => submission.status === 'SUBMITTED') && <div className="card-pad form-grid"><b>Payment proofs waiting for review</b>{data.submissions.filter((submission) => submission.status === 'SUBMITTED').map((submission) => { const invoice = data.invoices.find((item) => item.id === submission.invoiceId); return <div className="list-row" key={submission.id}><span className="cell-stack"><b>{invoice?.studentName || `Challan #${submission.invoiceId}`}</b><span>{money(submission.amount)} · {submission.sourceBankName} · {submission.transactionId}</span></span><button className="btn btn-primary btn-sm" onClick={() => { setReviewSubmission(submission); setReviewNote(''); }}>Review proof</button></div>; })}</div>}
      {loading ? <div className="empty"><p className="empty-text">Loading collection register…</p></div> : data.invoices.length === 0 ? <div className="empty"><p className="empty-title">No challans found</p><p className="empty-text">Generate this month after preparing the fee structure.</p></div> : <div className="table-wrap"><table className="tbl"><thead><tr><th>Student</th><th>Class</th><th>Due</th><th>Total</th><th>Balance</th><th>Status</th><th></th></tr></thead><tbody>{data.invoices.map((invoice) => <tr key={invoice.id}><td><b>{invoice.studentName}</b><small>{invoice.loginRollNumber}</small></td><td>{invoice.className}<small>{invoice.sectionName}</small></td><td>{invoice.dueDate}</td><td>{money(invoice.totalAmount)}</td><td><b>{money(invoice.balance)}</b></td><td><span className={`chip ${tone(invoice.status)}`}>{invoice.status}</span></td><td><button className="btn btn-quiet btn-sm" disabled={invoice.status === 'PAID' || invoice.status === 'VOID'} onClick={() => setSelectedInvoice(invoice)}>Collect</button></td></tr>)}</tbody></table></div>}
    </section>}

    <Modal open={showHead} onClose={() => setShowHead(false)} title="Create fee head" description="Recurring heads appear in every class fee structure." onSubmit={createHead} footer={<><button type="button" className="btn btn-ghost" onClick={() => setShowHead(false)}>Cancel</button><button className="btn btn-primary" disabled={busy}>Create</button></>}><div className="form-grid"><label className="field"><span className="label">Fee name</span><input required name="name" minLength={2} maxLength={100} className="input" placeholder="Monthly tuition fee" /></label><label className="field"><span className="label">Type</span><select name="kind" className="select"><option value="RECURRING">Recurring monthly fee</option><option value="ONE_TIME">One-time fee</option></select></label></div></Modal>
    <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title={`Generate ${month} challans`} description="Existing challans are skipped safely." onSubmit={generateMonth} footer={<><button type="button" className="btn btn-ghost" onClick={() => setShowGenerate(false)}>Cancel</button><button className="btn btn-primary" disabled={busy}>Generate</button></>}><label className="field"><span className="label">Due date inside {month}</span><input required name="dueDate" type="date" min={`${month}-01`} max={`${month}-31`} className="input" /></label></Modal>
    <Modal open={showAdjustment} onClose={() => setShowAdjustment(false)} title="Student concession or charge" description="Applies to future challans; existing challans remain unchanged." onSubmit={addAdjustment} footer={<><button type="button" className="btn btn-ghost" onClick={() => setShowAdjustment(false)}>Cancel</button><button className="btn btn-primary" disabled={busy || !selectedStudent}>Save</button></>}><div className="form-grid"><label className="field"><span className="label">Student</span><input className="input" value={studentQuery} onChange={(e) => { setStudentQuery(e.target.value); setSelectedStudent(null); }} placeholder="Search name or roll number" /></label>{studentOptions.length > 0 && !selectedStudent && <div className="card">{studentOptions.map((student) => <button type="button" className="list-row" style={{ width: '100%', textAlign: 'left' }} key={student.id} onClick={() => { setSelectedStudent(student); setStudentQuery(`${student.name} — ${student.className} ${student.sectionName}`); setStudentOptions([]); }}><span className="cell-stack"><b>{student.name}</b><span>{student.loginRollNumber} · {student.className} {student.sectionName}</span></span></button>)}</div>}<label className="field"><span className="label">Reason</span><input required name="label" className="input" placeholder="Sibling concession" /></label><div className="form-grid form-grid-2"><select name="type" className="select"><option value="DISCOUNT">Discount</option><option value="CHARGE">Extra charge</option></select><input required name="amount" type="number" min="1" className="input" placeholder="Amount" /></div></div></Modal>
    <Modal open={Boolean(selectedInvoice)} onClose={() => setSelectedInvoice(null)} title="Record payment" description={selectedInvoice ? `${selectedInvoice.studentName} · Balance ${money(selectedInvoice.balance)}` : ''} onSubmit={recordPayment} footer={<><button type="button" className="btn btn-ghost" onClick={() => setSelectedInvoice(null)}>Cancel</button><button className="btn btn-primary" disabled={busy}>Record & create receipt</button></>}><div className="form-grid"><label className="field"><span className="label">Amount received</span><input required name="amount" type="number" min="1" max={selectedInvoice?.balance} defaultValue={selectedInvoice?.balance} className="input" /></label><label className="field"><span className="label">Payment method</span><select name="method" className="select"><option value="CASH">Cash</option><option value="BANK">Bank transfer</option><option value="EASYPAISA">Easypaisa</option><option value="JAZZCASH">JazzCash</option><option value="OTHER">Other</option></select></label><input name="reference" className="input" placeholder="Transaction/reference number (optional)" /><input name="notes" className="input" placeholder="Notes (optional)" /></div></Modal>
    <Modal open={Boolean(reviewSubmission)} onClose={() => { setReviewSubmission(null); setReviewNote(''); }} title="Review student payment" description="Match the sender bank and transaction ID before verifying." footer={<><button type="button" className="btn btn-ghost" onClick={() => setReviewSubmission(null)}>Cancel</button><button type="button" className="btn btn-danger" disabled={busy || reviewNote.trim().length < 2} onClick={() => void reviewStudentPayment('REJECTED')}>Reject proof</button><button type="button" className="btn btn-primary" disabled={busy} onClick={() => void reviewStudentPayment('VERIFIED')}>Verify & create receipt</button></>}><div className="form-grid">{reviewSubmission && <div className="prose-note"><b>{money(reviewSubmission.amount)}</b><p>Source bank: {reviewSubmission.sourceBankName}</p><p>Transaction ID: {reviewSubmission.transactionId}</p><p>Submitted: {new Date(reviewSubmission.submittedAt).toLocaleString('en-PK')}</p></div>}<button type="button" className="btn btn-quiet" onClick={() => void openSubmittedReceipt()}><ExternalLink />Open submitted receipt</button><label className="field"><span className="label">Review note</span><textarea className="textarea" rows={3} maxLength={500} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Optional when verifying; required when rejecting" /></label></div></Modal>
  </div>;
}

function Metric({ label, value, icon, tone }: { label: string; value: string | number; icon: React.ReactNode; tone: string }) {
  return <article className={`metric metric-${tone}`}><div className="metric-top"><span className="metric-label">{label}</span><span className="metric-icon">{icon}</span></div><strong className="metric-value" style={{ fontSize: 'clamp(1.2rem, 2vw, 1.8rem)' }}>{value}</strong></article>;
}
