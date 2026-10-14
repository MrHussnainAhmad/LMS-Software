import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Clock, Trash2, Users, BookOpen, Coffee } from 'lucide-react';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';
import Modal from '../ui/Modal';
import { EmptyState, ErrorNote, PageHead } from '../ui/Bits';
import { useConfirm, useToast } from '../ui/Feedback';

interface TimetableEntry {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  sectionId: number;
  sectionName: string;
  className: string;
  subjectId: number | null;
  subjectName: string | null;
  staffId: number | null;
  staffName: string | null;
}

interface Metadata {
  allStaff: { id: number; name: string }[];
  allClasses: { id: number; name: string }[];
  allSections: { id: number; name: string; classId: number; classTeacherId: number | null }[];
  allSubjects: { id: number; name: string }[];
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDays(days: number[]) {
  if (!days || days.length === 0) return "";
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  // Mon = 1, Sat = 6, Sun = 0
  // If sorted is [1,2,3,4,5,6], it's Mon-Sat
  if (sorted.length === 6 && sorted[0] === 1 && sorted[5] === 6) return ""; 
  if (sorted.length === 7) return "";
  
  let isConsecutive = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) isConsecutive = false;
  }
  if (isConsecutive && sorted.length >= 3) {
    return `${SHORT_DAYS[sorted[0]]}-${SHORT_DAYS[sorted[sorted.length - 1]]}`;
  }
  return sorted.map(d => SHORT_DAYS[d]).join(", ");
}

export default function Timetable() {
  const toast = useToast();
  const confirm = useConfirm();

  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    sectionId: '',
    dayOfWeek: '1',
    startTime: '08:00',
    endTime: '09:00',
    isBreak: false,
    staffId: '',
    subjectId: ''
  });
  const [saving, setSaving] = useState(false);

  const [inchargeForm, setInchargeForm] = useState({
    sectionId: '',
    classTeacherId: ''
  });
  const [savingIncharge, setSavingIncharge] = useState(false);

  const [filterSectionId, setFilterSectionId] = useState('');
  const [filterDay, setFilterDay] = useState<number | 'all'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'overview'>('list');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [metaResp, timetableResp] = await Promise.all([
        api.get('/institution/timetable?metadata=true'),
        api.get('/institution/timetable')
      ]);
      setMetadata(metaResp);
      const classMap = Object.fromEntries((metaResp?.allClasses || []).map((item: { id: number; name: string }) => [item.id, item.name]));
      const sectionMap = Object.fromEntries((metaResp?.allSections || []).map((item: { id: number; name: string; classId: number }) => [item.id, item]));
      const normalizedEntries = (timetableResp?.assignments || []).map((entry: any) => {
        const section = sectionMap[entry.sectionId];
        return {
          ...entry,
          sectionName: section?.name || '',
          className: section ? classMap[section.classId] || '' : '',
          subjectName: entry.subject || null,
          staffName: entry.teacher || null,
        };
      });
      setEntries(normalizedEntries);
    } catch (err: any) {
      setError(err.message || 'Failed to load timetable data');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    const entry = entries.find((row) => row.id === id);
    const ok = await confirm({
      title: 'Delete this period?',
      body: entry
        ? `${DAYS[entry.dayOfWeek]} ${entry.startTime.substring(0, 5)} — ${entry.className} ${entry.sectionName}. It disappears from the teacher's and students' schedules.`
        : 'It disappears from the teacher’s and students’ schedules.',
      confirmLabel: 'Delete period',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/institution/timetable?id=${id}`);
      setEntries(entries.filter(e => e.id !== id));
      toast.info('Period removed');
    } catch (err: any) {
      toast.error('Could not delete the period', err.message || 'Failed to delete entry');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/institution/timetable', {
        sectionId: parseInt(formData.sectionId),
        dayOfWeek: parseInt(formData.dayOfWeek),
        startTime: formData.startTime,
        endTime: formData.endTime,
        isBreak: formData.isBreak,
        staffId: formData.staffId ? parseInt(formData.staffId) : null,
        subjectId: formData.subjectId ? parseInt(formData.subjectId) : null
      });
      setShowAddForm(false);
      fetchData(); // reload
      toast.success('Period added', `${DAYS[parseInt(formData.dayOfWeek)]}, ${formData.startTime}–${formData.endTime}.`);
    } catch (err: any) {
      toast.error('Could not save the period', err.message || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  }

  async function handleInchargeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inchargeForm.sectionId) return toast.warn('Pick a section first');
    setSavingIncharge(true);
    try {
      await api.post('/institution/timetable', {
        action: 'updateIncharge',
        sectionId: parseInt(inchargeForm.sectionId),
        classTeacherId: inchargeForm.classTeacherId ? parseInt(inchargeForm.classTeacherId) : null
      });
      toast.success(
        'Class incharge updated',
        inchargeForm.classTeacherId
          ? 'Only they can mark attendance for this section now.'
          : 'This section has no incharge assigned.',
      );
      fetchData(); // reload
    } catch (err: any) {
      toast.error('Could not update the incharge', err.message || 'Failed to update incharge');
    } finally {
      setSavingIncharge(false);
    }
  }

  function sectionLabel(section: { id: number; name: string; classId: number }) {
    const cls = metadata?.allClasses?.find(c => c.id === section.classId);
    return `${cls?.name || 'Class'} · ${section.name}`;
  }

  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
    [entries],
  );

  const visible = useMemo(
    () =>
      sorted.filter((entry) => {
        if (filterSectionId && String(entry.sectionId) !== String(filterSectionId)) return false;
        if (filterDay !== 'all' && entry.dayOfWeek !== filterDay) return false;
        return true;
      }),
    [sorted, filterSectionId, filterDay],
  );

  const byDay = useMemo(() => {
    const groups = new Map<number, TimetableEntry[]>();
    visible.forEach((entry) => {
      const list = groups.get(entry.dayOfWeek) || [];
      list.push(entry);
      groups.set(entry.dayOfWeek, list);
    });
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [visible]);

  const daysWithEntries = useMemo(() => {
    const set = new Set(sorted.map((entry) => entry.dayOfWeek));
    return [...set].sort((a, b) => a - b);
  }, [sorted]);

  const filtering = Boolean(filterSectionId) || filterDay !== 'all';
  const inchargeSection = metadata?.allSections?.find(
    (s) => s.id.toString() === inchargeForm.sectionId,
  );

  // Overview uses ALL entries now
  const overviewEntries = sorted;
  
  const timeSlots = useMemo(() => {
    const map = new Map<string, { start: string, end: string }>();
    overviewEntries.forEach(e => map.set(`${e.startTime}-${e.endTime}`, { start: e.startTime, end: e.endTime }));
    return Array.from(map.values()).sort((a, b) => a.start.localeCompare(b.start));
  }, [overviewEntries]);
  
  const classesMap = useMemo(() => {
    const map = new Map<number, any>();
    metadata?.allClasses?.forEach(c => map.set(c.id, c));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [metadata]);
  
  const cellMap = useMemo(() => {
    const map = new Map<number, Map<string, any[]>>();
    overviewEntries.forEach(row => {
      const classId = metadata?.allSections?.find(s => s.id === row.sectionId)?.classId;
      if (!classId) return;
      if (!map.has(classId)) map.set(classId, new Map());
      const classSlots = map.get(classId)!;
      const slotKey = `${row.startTime}-${row.endTime}`;
      if (!classSlots.has(slotKey)) classSlots.set(slotKey, []);
      
      const existingGroups = classSlots.get(slotKey)!;
      const secName = row.sectionName === 'Whole Class' ? null : row.sectionName;
      
      let group = existingGroups.find(g => 
        g.subjectName === row.subjectName && 
        g.staffName === row.staffName && 
        g.sectionName === secName && 
        g.isBreak === row.isBreak
      );
      
      if (group) {
        if (!group.days.includes(row.dayOfWeek)) group.days.push(row.dayOfWeek);
      } else {
        existingGroups.push({
          subjectName: row.subjectName,
          staffName: row.staffName,
          isBreak: row.isBreak,
          sectionName: secName,
          days: [row.dayOfWeek]
        });
      }
    });
    return map;
  }, [overviewEntries, metadata]);

  return (
    <div className="page">
      <PageHead
        title="Timetable"
        subtitle="The weekly routine every teacher and student sees in their app. Breaks count as periods, so add those too."
      >
        <button 
          type="button" 
          className="btn" 
          style={{ 
            background: 'var(--brand-50)', 
            borderColor: 'var(--brand-200)', 
            color: 'var(--brand-800)',
            fontWeight: 600 
          }}
          onClick={() => setViewMode(viewMode === 'list' ? 'overview' : 'list')}
        >
          {viewMode === 'list' ? 'Institution Timetable' : 'Back to timetable manager'}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setShowAddForm(true)}>
          <Plus />
          Add period
        </button>
      </PageHead>

      {error && <ErrorNote message={error} />}

      {loading ? (
        <PageSkeleton rows={7} />
      ) : (
        <div className={viewMode === 'list' ? 'split' : 'stack'}>
          <div className="stack">
            {entries.length > 0 && (
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <div className="seg" role="group" aria-label="Filter by day">
                  <button type="button" aria-pressed={filterDay === 'all'} onClick={() => setFilterDay('all')}>
                    All week
                  </button>
                  {DAYS.map((_day, i) => {
                    // Only show days with entries in list mode, show all in overview
                    if (viewMode === 'list' && !daysWithEntries.includes(i)) return null;
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={filterDay === i}
                        onClick={() => setFilterDay(i)}
                      >
                        {SHORT_DAYS[i]}
                      </button>
                    );
                  })}
                </div>
                {viewMode === 'list' && (
                  <select
                    className="select input-sm"
                    aria-label="Filter by section"
                    value={filterSectionId}
                    onChange={(e) => setFilterSectionId(e.target.value)}
                    style={{ maxWidth: 220 }}
                  >
                    <option value="">All sections</option>
                    {metadata?.allSections?.map((s) => (
                      <option key={s.id} value={s.id}>{sectionLabel(s)}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {viewMode === 'overview' ? (
              <section className="card">
                <div className="card-head">
                  <div className="card-head-copy">
                    <h2 className="card-title">Institution Timetable Overview</h2>
                    <p className="card-sub">Weekly Schedule · {classesMap.length} classes, {timeSlots.length} periods</p>
                  </div>
                </div>
                {timeSlots.length === 0 ? (
                  <div className="card-pad" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <CalendarDays style={{ opacity: 0.3, width: 48, height: 48, margin: '0 auto 16px' }} />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink-1)' }}>No periods scheduled</h3>
                    <p style={{ color: 'var(--ink-3)', marginTop: 8 }}>No timetable entries found for this institution. Assign periods in the list view.</p>
                  </div>
                ) : (
                <div className="table-wrap">
                  <table className="tbl tbl-tight">
                    <thead>
                      <tr>
                        <th scope="col" style={{ position: 'sticky', left: 0, background: 'var(--card-bg)', zIndex: 10 }}>Class</th>
                        {timeSlots.map((slot, i) => (
                          <th scope="col" key={slot.start} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div>Lecture {i + 1}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', fontWeight: 'normal' }}>
                              {slot.start.substring(0,5)}-{slot.end.substring(0,5)}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {classesMap.map(cls => (
                        <tr key={cls.id}>
                          <td style={{ position: 'sticky', left: 0, background: 'var(--card-bg)', fontWeight: 600, zIndex: 10 }}>{cls.name}</td>
                          {timeSlots.map(slot => {
                            const cells = cellMap.get(cls.id)?.get(`${slot.start}-${slot.end}`);
                            if (!cells || cells.length === 0) return <td key={slot.start} style={{ textAlign: 'center', color: 'var(--ink-4)' }}>—</td>;
                            
                            if (cells.some(c => c.isBreak)) {
                              return <td key={slot.start} style={{ textAlign: 'center', color: 'var(--ink-3)', fontStyle: 'italic', background: 'var(--stone-50)' }}>Break</td>;
                            }
                            
                            return (
                              <td key={slot.start} style={{ verticalAlign: 'top' }}>
                                <div className="stack" style={{ gap: 8 }}>
                                  {cells.map((cell, ci) => {
                                    const dayStr = formatDays(cell.days);
                                    return (
                                      <div key={ci} style={{ lineHeight: 1.2, borderLeft: '2px solid var(--brand-300)', paddingLeft: 6 }}>
                                        <div style={{ fontWeight: 600, color: 'var(--ink-1)' }}>{cell.subjectName || '—'}</div>
                                        {cell.staffName && <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>{cell.staffName}</div>}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                          {cell.sectionName && (
                                            <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', background: 'var(--stone-100)', color: 'var(--ink-3)', padding: '2px 4px', borderRadius: 4, fontWeight: 500 }}>
                                              {cell.sectionName}
                                            </span>
                                          )}
                                          {dayStr && (
                                            <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', background: 'var(--brand-50)', color: 'var(--brand-700)', padding: '2px 4px', borderRadius: 4, fontWeight: 500 }}>
                                              {dayStr}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </section>
            ) : entries.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={<CalendarDays />}
                  title="No periods scheduled yet"
                  text="Build the week one period at a time. Once a section has a routine, its teachers see it on their phones."
                  action={
                    <button type="button" className="btn btn-primary" onClick={() => setShowAddForm(true)}>
                      <Plus />
                      Add the first period
                    </button>
                  }
                />
              </div>
            ) : visible.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={<CalendarDays />}
                  title="Nothing scheduled here"
                  text="This combination of day and section has no periods yet."
                  action={
                    <button
                      type="button"
                      className="btn btn-quiet"
                      onClick={() => { setFilterDay('all'); setFilterSectionId(''); }}
                    >
                      Show the whole week
                    </button>
                  }
                />
              </div>
            ) : (
              <>
                {byDay.map(([day, rows]) => (
                  <section className="card" key={day}>
                    <div className="card-head">
                      <div className="card-head-copy">
                        <h2 className="card-title">{DAYS[day]}</h2>
                        <p className="card-sub">
                          {rows.length} {rows.length === 1 ? 'period' : 'periods'}
                          {rows[0] && ` · from ${rows[0].startTime.substring(0, 5)}`}
                        </p>
                      </div>
                    </div>
                    <div className="table-wrap">
                      <table className="tbl tbl-tight">
                        <thead>
                          <tr>
                            <th scope="col">Time</th>
                            <th scope="col">Class</th>
                            <th scope="col">Subject</th>
                            <th scope="col">Teacher</th>
                            <th scope="col" style={{ textAlign: 'right' }}>&nbsp;</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((entry) => (
                            <tr key={entry.id}>
                              <td className="tbl-num" style={{ whiteSpace: 'nowrap' }}>
                                <span className="row" style={{ gap: 6 }}>
                                  <Clock className="w-3 h-3" aria-hidden="true" style={{ color: 'var(--ink-4)' }} />
                                  {entry.startTime.substring(0, 5)}–{entry.endTime.substring(0, 5)}
                                </span>
                              </td>
                              <td>
                                <span className="cell-stack">
                                  <b>{entry.className}</b>
                                  <span>{entry.sectionName}</span>
                                </span>
                              </td>
                              <td>
                                {entry.isBreak ? (
                                  <span className="chip chip-warn">
                                    <Coffee aria-hidden="true" />
                                    Break
                                  </span>
                                ) : (
                                  <span className="row" style={{ gap: 7 }}>
                                    <BookOpen className="w-4 h-4" aria-hidden="true" style={{ color: 'var(--ink-4)' }} />
                                    <span className="tbl-strong">{entry.subjectName || '—'}</span>
                                  </span>
                                )}
                              </td>
                              <td>
                                {!entry.isBreak && entry.staffName ? (
                                  <span className="row" style={{ gap: 7 }}>
                                    <Users className="w-4 h-4" aria-hidden="true" style={{ color: 'var(--ink-4)' }} />
                                    {entry.staffName}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--ink-4)' }}>—</span>
                                )}
                              </td>
                              <td>
                                <div className="tbl-actions">
                                  <button
                                    type="button"
                                    className="icon-btn icon-btn-danger"
                                    aria-label="Delete this period"
                                    title="Delete period"
                                    onClick={() => handleDelete(entry.id)}
                                  >
                                    <Trash2 />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
                {filtering && visible.length > 0 && (
                  <p className="section-rule">
                    {visible.length} of {entries.length} periods shown
                  </p>
                )}
              </>
            )}
          </div>

          {viewMode === 'list' && (
            <aside className="card">
              <div className="card-head">
                <div className="card-head-copy">
                  <h2 className="card-title">
                    <Users aria-hidden="true" />
                    Class incharge
                  </h2>
                  <p className="card-sub">One teacher per section holds the attendance register.</p>
                </div>
              </div>
              <form onSubmit={handleInchargeSubmit} className="card-pad stack" style={{ gap: 14 }}>
                <label className="field">
                  <span className="label">Section</span>
                  <select
                    required
                    className="select"
                    value={inchargeForm.sectionId}
                    onChange={e => {
                      const secId = e.target.value;
                      const sec = metadata?.allSections.find(s => s.id.toString() === secId);
                      setInchargeForm({ sectionId: secId, classTeacherId: sec?.classTeacherId?.toString() || '' });
                    }}
                  >
                    <option value="">Select a section…</option>
                    {metadata?.allSections.map(s => (
                      <option key={s.id} value={s.id}>{sectionLabel(s)}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="label">Incharge</span>
                  <select
                    className="select"
                    value={inchargeForm.classTeacherId}
                    onChange={e => setInchargeForm({...inchargeForm, classTeacherId: e.target.value})}
                    disabled={!inchargeForm.sectionId}
                  >
                    <option value="">No incharge assigned</option>
                    {metadata?.allStaff.map(st => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                  <span className="field-hint">
                    Only this person can mark attendance for the section — everyone else sees it read-only.
                  </span>
                </label>

                {inchargeSection && inchargeSection.classTeacherId && (
                  <p style={{ color: 'var(--ink-3)', fontSize: '0.75rem' }}>
                    Currently:{' '}
                    <b style={{ color: 'var(--ink-2)' }}>
                      {metadata?.allStaff.find(st => st.id === inchargeSection.classTeacherId)?.name || 'Assigned'}
                    </b>
                  </p>
                )}

                <button type="submit" className="btn btn-primary btn-block" disabled={savingIncharge}>
                  {savingIncharge ? 'Saving…' : 'Save incharge'}
                </button>
              </form>
            </aside>
          )}
        </div>
      )}

      <Modal
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        title="Add a period"
        description="Pick the section and slot. Mark it as a break if nobody is teaching."
        size="md"
        onSubmit={handleSubmit}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save period'}
            </button>
          </>
        }
      >
        <div className="form-grid form-grid-2">
          <label className="field form-span-2">
            <span className="label">Section</span>
            <select
              required
              className="select"
              value={formData.sectionId}
              onChange={e => setFormData({...formData, sectionId: e.target.value})}
            >
              <option value="">Select a section…</option>
              {metadata?.allSections?.map(s => (
                <option key={s.id} value={s.id}>{sectionLabel(s)}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">Day</span>
            <select
              required
              className="select"
              value={formData.dayOfWeek}
              onChange={e => setFormData({...formData, dayOfWeek: e.target.value})}
            >
              {DAYS.map((day, i) => <option key={i} value={i}>{day}</option>)}
            </select>
          </label>

          <label className="field">
            <span className="label">Kind</span>
            <select
              className="select"
              value={formData.isBreak ? 'break' : 'lesson'}
              onChange={e => setFormData({...formData, isBreak: e.target.value === 'break'})}
            >
              <option value="lesson">Lesson</option>
              <option value="break">Break / recess</option>
            </select>
          </label>

          <label className="field">
            <span className="label">Starts</span>
            <input
              type="time" required
              className="input"
              value={formData.startTime}
              onChange={e => setFormData({...formData, startTime: e.target.value})}
            />
          </label>

          <label className="field">
            <span className="label">Ends</span>
            <input
              type="time" required
              className="input"
              value={formData.endTime}
              onChange={e => setFormData({...formData, endTime: e.target.value})}
            />
          </label>

          {!formData.isBreak && (
            <>
              <label className="field">
                <span className="label">Subject</span>
                <select
                  required
                  className="select"
                  value={formData.subjectId}
                  onChange={e => setFormData({...formData, subjectId: e.target.value})}
                >
                  <option value="">Select a subject…</option>
                  {metadata?.allSubjects?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="label">Teacher</span>
                <select
                  required
                  className="select"
                  value={formData.staffId}
                  onChange={e => setFormData({...formData, staffId: e.target.value})}
                >
                  <option value="">Select a teacher…</option>
                  {metadata?.allStaff?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
