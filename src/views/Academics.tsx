import { DeleteAcademic } from '../components/DeleteAcademic';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';
import { EmptyState, ErrorNote, PageHead } from '../ui/Bits';
import { useToast } from '../ui/Feedback';

type Subject = { id: number; name: string; code: string | null };
type ClassRow = { id: number; name: string; level: number; isFinalClass: boolean };
type Section = { id: number; classId: number; name: string; classTeacherName: string | null };
type StaffOption = { id: number; name: string };

export default function Academics() {
  const toast = useToast();
  const [data, setData] = useState<{ subjects: Subject[]; classes: ClassRow[]; sections: Section[] }>({ subjects: [], classes: [], sections: [] });
  const [staff, setStaff] = useState<StaffOption[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSection, setShowSection] = useState(false);

  async function load() {
    try { setError(''); setData(await api.get('/institution/academics')); }
    catch (loadError: any) { setError(loadError.message || 'Could not load academics setup'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const body: Record<string, unknown> = { action };
    values.forEach((value, key) => { body[key] = value; });
    if (action === 'createClass') { body.level = Number(body.level || 0); body.isFinalClass = values.get('isFinalClass') === 'on'; }
    if (action === 'createSection') { body.classId = Number(body.classId); body.classTeacherId = body.classTeacherId ? Number(body.classTeacherId) : null; }
    setSaving(true);
    try { await api.post('/institution/academics', body); form.reset(); await load(); toast.success(action === 'createSubject' ? 'Subject created' : action === 'createClass' ? 'Class created' : 'Section created'); }
    catch (saveError: any) { toast.error('Could not save', saveError.message); }
    finally { setSaving(false); }
  }

  async function openSectionForm() {
    setShowSection((current) => !current);
    if (staff === null) {
      try { const response = await api.get('/institution/staff'); setStaff(response.staff || []); }
      catch { setStaff([]); }
    }
  }

  const sectionsByClass = useMemo(() => data.sections.reduce<Record<number, Section[]>>((groups, section) => { (groups[section.classId] ||= []).push(section); return groups; }, {}), [data.sections]);
  if (loading) return <div className="page"><PageSkeleton cards={2} rows={6} /></div>;

  return <div className="page">
    <PageHead title="Academics setup" subtitle="Configure subjects, classes, sections, and the final graduating class." />
    {error && <ErrorNote message={error} />}
    <div className="cols-2">
      <section className="card"><div className="card-head"><div className="card-head-copy"><h2 className="card-title"><BookOpen />Curriculum subjects</h2><p className="card-sub">{data.subjects.length} configured</p></div></div>{data.subjects.length ? <div className="table-wrap"><table className="tbl"><thead><tr><th>Subject</th><th>Actions</th><th>Code</th></tr></thead><tbody>{data.subjects.map((subject) => <tr key={subject.id}><td><b>{subject.name}</b></td><td><DeleteAcademic kind="subject" id={subject.id} name={subject.name} onDeleted={load}/></td><td className="mono">{subject.code || '—'}</td></tr>)}</tbody></table></div> : <EmptyState icon={<BookOpen />} title="No subjects yet" text="Add the subjects taught by your institution." />}</section>
      <form className="card" onSubmit={(event) => submit(event, 'createSubject')}><div className="card-head"><div className="card-head-copy"><h2 className="card-title"><Plus />Add subject</h2></div></div><div className="card-pad form-grid"><label className="field"><span className="label">Subject name</span><input required maxLength={255} name="name" className="input" placeholder="Advanced Mathematics" /></label><label className="field"><span className="label">Subject code · optional</span><input maxLength={50} name="code" className="input" placeholder="MATH-401" /></label><button className="btn btn-primary" disabled={saving}>Create subject</button></div></form>
    </div>
    <div className="cols-2">
      <section className="card"><div className="card-head"><div className="card-head-copy"><h2 className="card-title"><BookOpen />Classes and sections</h2><p className="card-sub">Every class starts with a Whole Class section.</p></div></div>{data.classes.length ? <div className="table-wrap"><table className="tbl"><thead><tr><th>Class</th><th>Sections</th></tr></thead><tbody>{data.classes.map((row) => <tr key={row.id}><td><b>{row.name}</b><DeleteAcademic kind="class" id={row.id} name={row.name} onDeleted={load}/>{row.isFinalClass && <small>Final graduating class</small>}</td><td><div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>{(sectionsByClass[row.id] || []).map((section) => <span key={section.id} className="chip chip-mute" title={section.classTeacherName || 'No class teacher'}>{section.name}<DeleteAcademic kind="section" id={section.id} name={section.name} onDeleted={load}/></span>)}</div></td></tr>)}</tbody></table></div> : <EmptyState icon={<BookOpen />} title="No classes yet" />}</section>
      <div className="stack">
        <form className="card" onSubmit={(event) => submit(event, 'createClass')}><div className="card-head"><div className="card-head-copy"><h2 className="card-title"><Plus />Add class</h2></div></div><div className="card-pad form-grid"><label className="field"><span className="label">Class name</span><input required maxLength={100} name="name" className="input" placeholder="Grade 10" /></label><label className="field"><span className="label">Sorting level</span><input type="number" min={0} max={100} name="level" defaultValue={0} className="input" /></label><label className="list-row"><input type="checkbox" name="isFinalClass" /> <span className="cell-stack"><b>Final graduating class</b><span>Only one class can hold this setting.</span></span></label><button className="btn btn-primary" disabled={saving}>Create class</button></div></form>
        <button type="button" className="btn btn-quiet" onClick={openSectionForm}>{showSection ? 'Hide section form' : 'Advanced: add another section'}</button>
        {showSection && <form className="card" onSubmit={(event) => submit(event, 'createSection')}><div className="card-pad form-grid"><label className="field"><span className="label">Class</span><select required name="classId" className="select"><option value="">Select class</option>{data.classes.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="field"><span className="label">Section (one letter or number)</span><input required maxLength={1} pattern="[A-Za-z0-9]" name="name" className="input" placeholder="A" /></label><label className="field"><span className="label">Class teacher · optional</span><select name="classTeacherId" className="select" disabled={staff === null}><option value="">{staff === null ? 'Loading staff…' : 'None'}</option>{staff?.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><button className="btn btn-primary" disabled={saving}>Create section</button></div></form>}
      </div>
    </div>
  </div>;
}
