import React, { useState } from 'react';
import { Download, Printer, Search, IdCard as IdCardIcon } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';
import { EmptyState, ErrorNote, PageHead } from '../ui/Bits';
import { useToast } from '../ui/Feedback';

type PickerStudent = { id: number; name: string; classRollNumber: string; className: string; sectionName: string };
type CardStudent = PickerStudent & {
  fatherName: string | null;
  phone: string | null;
  emergencyContact: string | null;
  profilePictureUrl: string | null;
  loginRollNumber: string;
};

function normalizeImageUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) return value;
  if (value.startsWith('/')) return `https://nisaab360.app${value}`;
  return `https://nisaab360.app/${value}`;
}

const W = 380;
const H = 240;
const NAVY = '#0E1E3D';
const GOLD = '#B8963E';
const CREAM = '#F5F0E8';
const LIGHT = '#FAFAF9';
const RULE = '#E4DDD1';
const MUTED = '#8A8070';
const DARK = '#1C1612';
const FONT = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif";
const TEXTURE = `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 20L20 0' stroke='rgba(255,255,255,0.025)' stroke-width='1'/%3E%3C/svg%3E")`;

function PhoneIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.7 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.37a16 16 0 0 0 5.72 5.72l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
}
function ShieldIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
}
function N360Mark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: NAVY, color: 'white', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center' }}>N</div>
      <div>
        <div style={{ fontSize: 7.5, fontWeight: 700, color: NAVY, letterSpacing: '0.04em', lineHeight: 1 }}>Nisaab360</div>
        <div style={{ fontSize: 6, color: MUTED, letterSpacing: '0.06em', lineHeight: 1.2 }}>Student Platform</div>
      </div>
    </div>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return <div><div style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 1.5 }}>{label}</div><div style={{ fontSize: 10, fontWeight: 600, color: CREAM }}>{value}</div></div>;
}
function ContactRow({ Icon, label, value }: { Icon: () => React.ReactNode; label: string; value: string }) {
  return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}><div style={{ paddingTop: 2, flexShrink: 0 }}><Icon /></div><div><div style={{ fontSize: 7, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>{label}</div><div style={{ fontSize: 11, fontWeight: 600, color: DARK }}>{value}</div></div></div>;
}

function CardFaces({ student, institution }: { student: CardStudent; institution: any }) {
  const universalId = student.loginRollNumber?.split('@')[0] || student.loginRollNumber;
  const front = (
      <div key="front" data-card-face="front" style={{ background: NAVY, backgroundImage: TEXTURE, fontFamily: FONT, color: '#fff', display: 'flex', flexDirection: 'column', width: W, height: H, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: GOLD, zIndex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 10px 17px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {institution?.logoKey && <img src={normalizeImageUrl(institution.logoKey)!} alt="" style={{ height: 22, width: 22, objectFit: 'contain', borderRadius: 3, flexShrink: 0, display: 'block' }} />}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: CREAM, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{institution?.name}</div>
          </div>
          <div style={{ fontSize: 6.5, fontWeight: 600, color: GOLD, letterSpacing: '0.14em', textTransform: 'uppercase', flexShrink: 0 }}>Student ID</div>
        </div>
        <div style={{ flex: 1, display: 'flex', padding: '12px 14px 12px 17px' }}>
          <div style={{ width: 68, height: 85, borderRadius: 6, overflow: 'hidden', flexShrink: 0, marginRight: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {normalizeImageUrl(student.profilePictureUrl) ? <img src={normalizeImageUrl(student.profilePictureUrl)!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block', opacity: 1 }} /> : <div style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>PHOTO</div>}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: 3 }}>{student.name}</div>
              {student.fatherName && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>{student.fatherName}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 7, columnGap: 12 }}>
                <Field label="Class" value={student.className} />
                <Field label="Section" value={student.sectionName} />
                <Field label="Roll No." value={student.classRollNumber} />
                <Field label="Universal ID" value={universalId} />
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: '7px 14px 7px 17px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            {institution?.signatureKey ? (
              <>
                <img src={normalizeImageUrl(institution.signatureKey)!} alt="Principal Signature" style={{ height: 22, maxWidth: 80, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 1, display: 'block' }} />
                <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Principal</div>
              </>
            ) : (
              <>
                <div style={{ width: 72, borderBottom: '1px solid rgba(255,255,255,0.2)', marginBottom: 2 }} />
                <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Principal</div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', opacity: 0.2 }}>
            {[10, 16, 10, 20, 12, 18, 10, 14, 20, 10, 16, 12].map((h, i) => <div key={i} style={{ width: 2, height: h, background: '#fff', borderRadius: 1 }} />)}
          </div>
        </div>
      </div>
  );
  const back = (
      <div key="back" data-card-face="back" style={{ background: LIGHT, fontFamily: FONT, border: `1px solid ${RULE}`, display: 'flex', flexDirection: 'column', width: W, height: H, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ height: 3, background: GOLD, flexShrink: 0 }} />
        <div style={{ background: NAVY, padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 7.5, fontWeight: 700, color: CREAM, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{student.name}</span>
          <span style={{ fontSize: 7, color: GOLD, letterSpacing: '0.06em' }}>{universalId}</span>
        </div>
        <div style={{ flex: 1, padding: '14px 16px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ContactRow Icon={PhoneIcon} label="Student Contact" value={student.phone || 'Not provided'} />
            <ContactRow Icon={ShieldIcon} label="Emergency Contact" value={student.emergencyContact || 'Not provided'} />
          </div>
          <div style={{ height: 1, background: RULE, margin: '4px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <N360Mark />
            <div style={{ fontSize: 14, color: RULE }}>·</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {institution?.logoKey && <img src={normalizeImageUrl(institution.logoKey)!} alt="" style={{ height: 20, maxWidth: 50, objectFit: 'contain', display: 'block' }} />}
              <div style={{ fontSize: 7.5, fontWeight: 700, color: DARK, maxWidth: 90, textAlign: 'right', lineHeight: 1.3 }}>{institution?.name}</div>
            </div>
          </div>
        </div>
        <div style={{ padding: '5px 16px', background: CREAM, borderTop: `1px solid ${RULE}`, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          <span style={{ fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Verified Student — Nisaab360</span>
        </div>
      </div>
  );
  return [front, back];
}

function IdCardPreview({ student, institution }: { student: CardStudent; institution: any }) {
  const [flipped, setFlipped] = useState(false);
  const faces = CardFaces({ student, institution });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ perspective: 1200, cursor: 'pointer', width: W, height: H }} onClick={() => setFlipped((f) => !f)} title={flipped ? 'Click to see front' : 'Click to see back'}>
        <div style={{ position: 'relative', width: W, height: H, transformStyle: 'preserve-3d', transition: 'transform .55s cubic-bezier(.4,0,.2,1)', transform: flipped ? 'rotateY(180deg)' : 'none' }}>
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}>{faces[0]}</div>
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>{faces[1]}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.03em' }}>{flipped ? 'Back' : 'Front'} · click to flip</div>
    </div>
  );
}

export default function IdCard() {
  const toast = useToast();
  const [students, setStudents] = useState<CardStudent[]>([]);
  const [institution, setInstitution] = useState<any>(null);
  const [filtering, setFiltering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  async function loadCards(search: string) {
    const query = search.trim();
    if (!query) {
      setHasSearched(false);
      setStudents([]);
      setInstitution(null);
      setError('');
      return;
    }

    setFiltering(true);
    setError('');
    setHasSearched(true);
    setStudents([]);
    setInstitution(null);
    try {
      const pickerRes = await api.get(`/institution/students/picker?limit=100&q=${encodeURIComponent(query)}`);
      const ids: number[] = (pickerRes?.students || []).map((s: any) => Number(s.id)).filter((n: number) => Number.isInteger(n));
      const idCardsRes = ids.length > 0
        ? await api.get(`/institution/students/id-cards?studentIds=${ids.join(',')}&q=${encodeURIComponent(query)}`)
        : await api.get(`/institution/students/id-cards?q=${encodeURIComponent(query)}`);
      setInstitution(idCardsRes?.institution || null);
      setStudents(idCardsRes?.students || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load ID cards');
    } finally {
      setFiltering(false);
    }
  }

  async function exportPdf(targetStudents: CardStudent[], fileName: string) {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [W, H] });
    let firstPage = true;
    for (const student of targetStudents) {
      const wrap = document.createElement('div');
      wrap.style.position = 'fixed';
      wrap.style.left = '-99999px';
      wrap.style.top = '0';
      wrap.style.background = 'white';
      wrap.style.padding = '0';
      document.body.appendChild(wrap);

      const front = document.createElement('div');
      const back = document.createElement('div');
      wrap.appendChild(front);
      wrap.appendChild(back);

      const reactRoot = await import('react-dom/client');
      const rootFront = reactRoot.createRoot(front);
      const rootBack = reactRoot.createRoot(back);
      const faces = CardFaces({ student, institution });
      rootFront.render(<div style={{ width: W, height: H }}>{faces[0]}</div>);
      rootBack.render(<div style={{ width: W, height: H }}>{faces[1]}</div>);
      await new Promise((r) => setTimeout(r, 120));
      const frontEl = wrap.querySelector('[data-card-face="front"]') as HTMLElement;
      const backEl = wrap.querySelector('[data-card-face="back"]') as HTMLElement;
      const frontCanvas = await html2canvas(frontEl, { scale: 2, backgroundColor: null, useCORS: true });
      const backCanvas = await html2canvas(backEl, { scale: 2, backgroundColor: null, useCORS: true });

      const frontImg = frontCanvas.toDataURL('image/png');
      const backImg = backCanvas.toDataURL('image/png');

      if (!firstPage) pdf.addPage([W, H], 'landscape');
      pdf.addImage(frontImg, 'PNG', 0, 0, W, H);
      pdf.addPage([W, H], 'landscape');
      pdf.addImage(backImg, 'PNG', 0, 0, W, H);
      firstPage = false;

      rootFront.unmount();
      rootBack.unmount();
      document.body.removeChild(wrap);
    }
    pdf.save(fileName);
  }

  async function handleDownloadStudent(student: CardStudent) {
    setExporting(true);
    try {
      await exportPdf([student], `id-card-${student.loginRollNumber.split('@')[0]}.pdf`);
    } catch (err: any) {
      toast.error('Could not build the PDF', err.message || 'Try again in a moment.');
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadAll() {
    setExporting(true);
    try {
      await exportPdf(students, 'id-cards.pdf');
      toast.success('PDF ready', `${students.length} ${students.length === 1 ? 'card' : 'cards'}, front and back.`);
    } catch (err: any) {
      toast.error('Could not build the PDF', err.message || 'Try again in a moment.');
    } finally {
      setExporting(false);
    }
  }

  function handlePrintStudent(student: CardStudent) {
    const wrap = document.createElement('div');
    wrap.style.position = 'fixed';
    wrap.style.left = '-99999px';
    wrap.style.top = '0';
    wrap.style.background = 'white';
    document.body.appendChild(wrap);
    import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(wrap);
      const faces = CardFaces({ student, institution });
      root.render(
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {faces[0]}
          {faces[1]}
        </div>
      );
      setTimeout(() => {
        const win = window.open('', '_blank', 'width=980,height=720');
        if (!win) {
          root.unmount();
          document.body.removeChild(wrap);
          return;
        }
        win.document.write(`<html><head><title>ID Card</title></head><body style="margin:0;padding:24px;background:#fff;">${wrap.innerHTML}</body></html>`);
        win.document.close();
        setTimeout(() => {
          win.print();
          root.unmount();
          document.body.removeChild(wrap);
        }, 250);
      }, 150);
    });
  }

  function handlePrintAll() {
    window.print();
  }

  return (
    <div className="page">
      <style>{`@media print { body * { visibility: hidden !important; } #print-cards, #print-cards * { visibility: visible !important; } #print-cards { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; padding: 20px !important; display: flex !important; flex-direction: column !important; gap: 32px !important; } }`}</style>

      <PageHead
        title="ID cards"
        subtitle="Look up a student by universal ID, check both faces, then print or export a press-ready PDF."
      >
        <button
          type="button"
          className="btn btn-quiet"
          disabled={students.length === 0 || exporting}
          onClick={handleDownloadAll}
        >
          <Download />
          {exporting ? 'Preparing…' : 'Download PDF'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={students.length === 0}
          onClick={handlePrintAll}
        >
          <Printer />
          Print all
        </button>
      </PageHead>

      <section className="card">
        <div className="card-pad">
          <form
            className="row"
            style={{ gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}
            onSubmit={(e) => {
              e.preventDefault();
              loadCards(q);
            }}
          >
            <label className="field" style={{ flex: '1 1 320px' }}>
              <span className="label">Student universal ID</span>
              <input
                id="id-card-search"
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. I24-00001234"
                className="input"
                autoComplete="off"
              />
              <span className="field-hint">A name works too — anything the student picker can match.</span>
            </label>
            <button type="submit" className="btn btn-primary" disabled={filtering}>
              <Search />
              {filtering ? 'Looking up…' : 'Load card'}
            </button>
          </form>
        </div>
      </section>

      {error && <ErrorNote message={error} />}

      {filtering ? (
        <PageSkeleton cards={2} rows={0} />
      ) : students.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IdCardIcon />}
            title={hasSearched ? 'No card for that ID' : 'Nothing loaded yet'}
            text={
              hasSearched
                ? 'No student matched this universal ID. Check the ID on their profile and try again.'
                : 'Enter a universal ID above and load the card. You will see the front and the back before anything is printed.'
            }
          />
        </div>
      ) : (
        <section className="card">
          <div className="card-head">
            <div className="card-head-copy">
              <h2 className="card-title">Preview</h2>
              <p className="card-sub">
                {students.length} {students.length === 1 ? 'card' : 'cards'} · click a card to flip it
              </p>
            </div>
          </div>
          <div className="card-pad" style={{ display: 'flex', flexWrap: 'wrap', gap: 32, justifyContent: 'center' }}>
            {students.map((student) => (
              <div key={student.id} className="stack" style={{ gap: 10, alignItems: 'center' }}>
                <IdCardPreview student={student} institution={institution} />
                <div className="row" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    disabled={exporting}
                    onClick={() => handleDownloadStudent(student)}
                  >
                    <Download />
                    PDF
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    onClick={() => handlePrintStudent(student)}
                  >
                    <Printer />
                    Print
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div id="print-cards" style={{ display: 'none' }}>
        {students.map((student) => {
          const faces = CardFaces({ student, institution });
          return (
            <div key={student.id} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {faces[0]}
              {faces[1]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
