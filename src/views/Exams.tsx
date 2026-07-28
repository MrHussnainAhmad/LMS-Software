import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ClipboardList,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Download,
  Pencil,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';
import { EmptyState, PageHead } from '../ui/Bits';
import { useConfirm, useToast } from '../ui/Feedback';

type ExamType = 'MONTHLY' | 'MID' | 'FINAL' | 'PROMOTION';

const TYPE_LABEL: Record<string, string> = {
  MONTHLY: 'Monthly',
  MID: 'Mid term',
  FINAL: 'Final term',
  PROMOTION: 'Promotion',
};

function formatExamDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(value: Date) {
  return value.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatInputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function buildPreviewDates(startDate: string, subjectCount: number) {
  let current = parseDateInput(startDate);
  if (!current || subjectCount === 0) return { dates: [] as string[], skippedSundays: 0 };

  let skippedSundays = 0;
  if (current.getUTCDay() === 0) {
    current.setUTCDate(current.getUTCDate() + 1);
    skippedSundays += 1;
  }

  const dates: string[] = [];
  for (let index = 0; index < subjectCount; index++) {
    dates.push(formatInputDate(current));
    if (index < subjectCount - 1) {
      current = new Date(current);
      current.setUTCDate(current.getUTCDate() + 1);
      while (current.getUTCDay() === 0) {
        current.setUTCDate(current.getUTCDate() + 1);
        skippedSundays += 1;
      }
    }
  }

  return { dates, skippedSundays };
}

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [] as any[];

  function parseLine(line: string) {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = line[i + 1];
      if (ch === '"' && inQuotes && next === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((v) => v.trim());
  }

  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
}

export default function Exams() {
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState<'timetable' | 'publish'>('timetable');
  const [metadata, setMetadata] = useState<any>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [examGroups, setExamGroups] = useState<any[]>([]);
  const [examRows, setExamRows] = useState<any[]>([]);
  const [loadingTimetable, setLoadingTimetable] = useState(true);
  const [timetableError, setTimetableError] = useState('');

  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [savingTimetable, setSavingTimetable] = useState(false);

  const [ttClassId, setTtClassId] = useState('');
  const [ttType, setTtType] = useState<ExamType>('MONTHLY');
  const [ttTitle, setTtTitle] = useState('');
  const [ttDate, setTtDate] = useState('');
  const [ttMaxMarks, setTtMaxMarks] = useState('100');
  const [ttSubjectIds, setTtSubjectIds] = useState<number[]>([]);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ExamType>('FINAL');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [maxMarks, setMaxMarks] = useState('100');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [detectedSubjects, setDetectedSubjects] = useState<{ name: string; subjectId: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  // Stable references so the memos below don't recompute on every keystroke.
  const classes = useMemo(() => metadata?.allClasses || [], [metadata]);
  const subjects = useMemo(() => metadata?.allSubjects || [], [metadata]);
  const sections = useMemo(() => metadata?.allSections || [], [metadata]);

  const availableSections = classId ? sections.filter((s: any) => s.classId === Number(classId)) : [];
  const selectedTimetableSubjects = useMemo(
    () => subjects.filter((subject: any) => ttSubjectIds.includes(subject.id)),
    [subjects, ttSubjectIds]
  );
  const preview = useMemo(
    () => buildPreviewDates(ttDate, selectedTimetableSubjects.length),
    [ttDate, selectedTimetableSubjects.length]
  );
  const startDate = preview.dates[0] ? parseDateInput(preview.dates[0]) : null;
  const endDate = preview.dates.at(-1) ? parseDateInput(preview.dates.at(-1) as string) : null;

  useEffect(() => {
    async function loadMeta() {
      setLoadingMeta(true);
      try {
        const meta = await api.get('/institution/timetable?metadata=true');
        setMetadata(meta);
      } finally {
        setLoadingMeta(false);
      }
    }
    loadMeta();
  }, []);

  async function loadTimetable() {
    setLoadingTimetable(true);
    setTimetableError('');
    try {
      const res = await api.get('/institution/exams');
      setExamGroups(res?.examGroups || []);
      setExamRows(res?.examRows || []);
    } catch (err: any) {
      setTimetableError(err.message || 'Failed to load exam timetable');
      setExamGroups([]);
      setExamRows([]);
    } finally {
      setLoadingTimetable(false);
    }
  }

  useEffect(() => {
    loadTimetable();
  }, []);

  function resetTimetableForm() {
    setEditingGroup(null);
    setTtClassId('');
    setTtType('MONTHLY');
    setTtTitle('');
    setTtDate('');
    setTtMaxMarks('100');
    setTtSubjectIds([]);
  }

  function fillEdit(group: any) {
    setEditingGroup(group);
    setTtClassId(String(group.classId));
    setTtType(group.type);
    setTtTitle(group.title);
    setTtDate(group.startDate);
    setTtMaxMarks(String(group.maxMarks));
    setTtSubjectIds(group.subjectIds || []);
  }

  function toggleTimetableSubject(subjectId: number, checked: boolean) {
    setTtSubjectIds((current) =>
      checked ? Array.from(new Set([...current, subjectId])) : current.filter((id) => id !== subjectId)
    );
  }

  async function submitTimetable(e: React.FormEvent) {
    e.preventDefault();
    setSavingTimetable(true);
    setTimetableError('');
    try {
      const payload = {
        examIds: editingGroup?.examIds || undefined,
        classId: Number(ttClassId),
        type: ttType,
        title: ttTitle.trim(),
        maxMarks: Number(ttMaxMarks),
        date: ttDate,
        subjectIds: ttSubjectIds,
      };

      const wasEditing = Boolean(editingGroup);
      const savedTitle = ttTitle.trim();

      if (editingGroup) {
        await api.patch('/institution/exams', payload);
      } else {
        await api.post('/institution/exams', payload);
      }

      resetTimetableForm();
      await loadTimetable();
      toast.success(
        wasEditing ? 'Exam dates updated' : 'Exam scheduled',
        `${savedTitle} — every student in the class now sees the datesheet.`,
      );
    } catch (err: any) {
      setTimetableError(err.message || 'Failed to save exam timetable');
    } finally {
      setSavingTimetable(false);
    }
  }

  async function deleteGroup(group: any) {
    const ok = await confirm({
      title: `Delete “${group.title}”?`,
      body: `All ${group.subjectCount} paper dates for ${group.className} are removed from the datesheet. Marks already published are not affected.`,
      confirmLabel: 'Delete exam',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete('/institution/exams', { examIds: group.examIds });
      if (editingGroup?.key === group.key) resetTimetableForm();
      await loadTimetable();
      toast.info('Exam deleted', `${group.title} is off the datesheet.`);
    } catch (err: any) {
      toast.error('Could not delete the exam', err.message || 'Failed to delete exam');
    }
  }

  async function downloadTemplate() {
    if (!classId) return;
    setIsDownloadingTemplate(true);
    try {
      let url = `/institution/batch-exams/template?classId=${classId}`;
      if (sectionId) url += `&sectionId=${sectionId}`;
      const res = await api.get(url);
      const studentList = res?.students || [];
      const templateSubjects = res?.subjects || [];
      const rows = studentList.length
        ? studentList.map((s: any) => {
            const row: Record<string, string> = {
              'Student Name': s.name,
              'Roll Number': s.rollNumber,
            };
            templateSubjects.forEach((sub: string) => {
              row[sub] = '';
            });
            return row;
          })
        : [
            templateSubjects.reduce(
              (acc: Record<string, string>, sub: string) => {
                acc[sub] = '';
                return acc;
              },
              { 'Student Name': '', 'Roll Number': '' }
            ),
          ];

      const headers = Object.keys(rows[0] || { 'Student Name': '', 'Roll Number': '' });
      const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      const className = classes.find((c: any) => c.id === Number(classId))?.name || 'Class';
      link.download = `${className}_Result_Template.csv`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      toast.error('Could not build the template', err.message || 'Failed to download template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  }

  function processCSV() {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = parseCsv(String(reader.result || ''));
        if (data.length === 0) {
          setError('CSV is empty.');
          return;
        }

        const keys = Object.keys(data[0]);
        const rollCol = keys.find((k) => k.toLowerCase().includes('roll') || k.toLowerCase() === 'rollnumber');
        if (!rollCol) {
          setError("Could not find a column containing 'Roll' or 'Roll Number'. Please check your CSV format.");
          return;
        }

        const subjectCols = keys.filter((k) => k !== rollCol && k !== 'Student Name');
        const matchedSubjects: { name: string; subjectId: number }[] = [];
        const unmatchedCols: string[] = [];

        subjectCols.forEach((col) => {
          const matched = subjects.find(
            (s: any) => s.name.toLowerCase() === col.toLowerCase() || String(s.code || '').toLowerCase() === col.toLowerCase()
          );
          if (matched) matchedSubjects.push({ name: col, subjectId: matched.id });
          else unmatchedCols.push(col);
        });

        if (matchedSubjects.length === 0) {
          setError(`No valid subjects found. Unmatched columns: ${unmatchedCols.join(', ')}`);
          return;
        }

        const cleanData = data
          .map((row) => {
            const marks: Record<number, number> = {};
            matchedSubjects.forEach((sub) => {
              const val = parseFloat(row[sub.name]);
              if (!isNaN(val)) marks[sub.subjectId] = val;
            });
            return {
              rollNumber: row[rollCol],
              marks,
            };
          })
          .filter((r) => r.rollNumber && Object.keys(r.marks).length > 0);

        setParsedData(cleanData);
        setDetectedSubjects(matchedSubjects);
        setError(unmatchedCols.length > 0 ? `Warning: some columns were ignored: ${unmatchedCols.join(', ')}` : '');
      } catch (err: any) {
        setError(err.message || 'Failed to parse CSV');
      }
    };
    reader.readAsText(file);
  }

  async function submitResults() {
    if (!title || !classId || parsedData.length === 0) {
      setError('Please fill all required fields and process the CSV.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const payload = {
        title,
        type,
        classId: Number(classId),
        sectionId: sectionId ? Number(sectionId) : undefined,
        subjects: detectedSubjects.map((s) => ({
          subjectId: s.subjectId,
          name: s.name,
          maxMarks: Number(maxMarks),
        })),
        studentMarks: parsedData,
      };

      await api.post('/institution/batch-exams', payload);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to publish');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="page">
      <PageHead
        title="Exams"
        subtitle="Set the datesheet for a class, then hand marks over to subject teachers for review before results go out."
      >
        <div className="seg" role="group" aria-label="Exam sections">
          <button type="button" aria-pressed={tab === 'timetable'} onClick={() => setTab('timetable')}>
            Datesheet
          </button>
          <button type="button" aria-pressed={tab === 'publish'} onClick={() => setTab('publish')}>
            Publish results
          </button>
        </div>
      </PageHead>

      {tab === 'timetable' ? (
        <div className="split">
          <div className="stack">
            <section className="card">
              <div className="card-head">
                <div className="card-head-copy">
                  <h2 className="card-title">
                    <ClipboardList aria-hidden="true" />
                    Scheduled exams
                  </h2>
                  <p className="card-sub">
                    {loadingTimetable
                      ? 'Loading…'
                      : `${examGroups.length} ${examGroups.length === 1 ? 'exam' : 'exams'} · ${examRows.length} papers`}
                  </p>
                </div>
              </div>

              {loadingTimetable ? (
                <div className="card-pad">
                  <PageSkeleton rows={4} />
                </div>
              ) : examRows.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays />}
                  title="No exams scheduled yet"
                  text="Fill in the form beside this panel. Pick the books, and the dates lay themselves out one paper a day, skipping Sundays."
                />
              ) : (
                <div className="card-pad grid-cards">
                  {examGroups.map((group) => (
                    <article key={group.key} className="card card-hover">
                      <div className="card-pad stack" style={{ gap: 12 }}>
                        <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
                          <div className="stack" style={{ gap: 7, minWidth: 0 }}>
                            <b style={{ fontSize: '0.9375rem', fontWeight: 650 }}>{group.title}</b>
                            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                              <span className="chip chip-mute">{group.className}</span>
                              <span className="chip chip-brand">{TYPE_LABEL[group.type] || group.type}</span>
                            </div>
                          </div>
                          <span className="chip chip-info" style={{ flexShrink: 0 }}>
                            {group.subjectCount} {group.subjectCount === 1 ? 'book' : 'books'}
                          </span>
                        </div>

                        <div className="row" style={{ gap: 20 }}>
                          <span className="cell-stack">
                            <span className="secret-label">Starts</span>
                            <b>{formatExamDate(group.startDate)}</b>
                          </span>
                          <span className="cell-stack">
                            <span className="secret-label">Ends</span>
                            <b>{formatExamDate(group.endDate)}</b>
                          </span>
                        </div>

                        <p style={{ color: 'var(--ink-3)', fontSize: '0.75rem' }}>
                          {group.skippedSundays > 0
                            ? `${group.skippedSundays} Sunday${group.skippedSundays === 1 ? '' : 's'} skipped when laying out the papers.`
                            : 'One paper a day, no Sundays in the way.'}
                        </p>

                        <div className="row" style={{ gap: 8 }}>
                          <button type="button" className="btn btn-quiet btn-sm" onClick={() => fillEdit(group)}>
                            <Pencil />
                            Edit
                          </button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteGroup(group)}>
                            <Trash2 />
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {examRows.length > 0 && (
              <section className="card">
                <div className="card-head">
                  <div className="card-head-copy">
                    <h2 className="card-title">Paper by paper</h2>
                    <p className="card-sub">The datesheet exactly as students see it.</p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="tbl tbl-tight">
                    <thead>
                      <tr>
                        <th scope="col">Exam</th>
                        <th scope="col">Class</th>
                        <th scope="col">Subject</th>
                        <th scope="col">Paper date</th>
                        <th scope="col" style={{ textAlign: 'right' }}>Marks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {examRows.map((exam) => (
                        <tr key={exam.id}>
                          <td>
                            <span className="cell-stack">
                              <b>{exam.title}</b>
                              <span>{TYPE_LABEL[exam.type] || exam.type}</span>
                            </span>
                          </td>
                          <td>{exam.className}</td>
                          <td className="tbl-strong">{exam.subjectName}</td>
                          <td className="tbl-num">{formatExamDate(exam.date)}</td>
                          <td className="tbl-num">{exam.maxMarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          <aside className="card">
            <div className="card-head">
              <div className="card-head-copy">
                <h2 className="card-title">
                  <CalendarDays aria-hidden="true" />
                  {editingGroup ? 'Update exam' : 'New exam'}
                </h2>
                <p className="card-sub">
                  {editingGroup ? `Editing “${editingGroup.title}”.` : 'Papers are laid out one a day from the start date.'}
                </p>
              </div>
            </div>

            <form onSubmit={submitTimetable} className="card-pad stack" style={{ gap: 14 }}>
              <label className="field">
                <span className="label">Class</span>
                <select className="select" value={ttClassId} onChange={(e) => setTtClassId(e.target.value)} required>
                  <option value="">Select a class…</option>
                  {classes.map((classRow: any) => (
                    <option key={classRow.id} value={classRow.id}>{classRow.name}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="label">Exam type</span>
                <select className="select" value={ttType} onChange={(e) => setTtType(e.target.value as ExamType)} required>
                  <option value="MONTHLY">Monthly</option>
                  <option value="MID">Mid</option>
                  <option value="FINAL">Final</option>
                  <option value="PROMOTION">Promotion</option>
                </select>
              </label>

              <label className="field">
                <span className="label">Title</span>
                <input
                  className="input"
                  value={ttTitle}
                  onChange={(e) => setTtTitle(e.target.value)}
                  required
                  placeholder="e.g. Final Term 2026"
                />
              </label>

              <div className="form-grid form-grid-2">
                <label className="field">
                  <span className="label">Start date</span>
                  <input type="date" required className="input" value={ttDate} onChange={(e) => setTtDate(e.target.value)} />
                </label>
                <label className="field">
                  <span className="label">Marks per paper</span>
                  <input
                    type="number" min="1" step="0.01" required
                    className="input"
                    value={ttMaxMarks}
                    onChange={(e) => setTtMaxMarks(e.target.value)}
                  />
                </label>
              </div>

              <div className="field">
                <div className="row-between">
                  <span className="label">Books</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setTtSubjectIds(subjects.map((subject: any) => subject.id))}
                    disabled={subjects.length === 0}
                  >
                    Select all
                  </button>
                </div>
                <div
                  className="stack"
                  style={{
                    gap: 8,
                    maxHeight: 208,
                    overflowY: 'auto',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-md)',
                    padding: '12px 14px',
                    background: 'var(--sunken, #FAF9F6)',
                  }}
                >
                  {subjects.length === 0 ? (
                    <p style={{ color: 'var(--ink-3)', fontSize: '0.8125rem' }}>
                      No books yet — add subjects from Academics first.
                    </p>
                  ) : (
                    subjects.map((subject: any) => (
                      <label
                        key={subject.id}
                        className="row"
                        style={{ gap: 9, fontSize: '0.8125rem', cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          value={subject.id}
                          checked={ttSubjectIds.includes(subject.id)}
                          onChange={(e) => toggleTimetableSubject(subject.id, e.target.checked)}
                        />
                        {subject.name}
                      </label>
                    ))
                  )}
                </div>
                <span className="field-hint">
                  {selectedTimetableSubjects.length} selected — one paper each, in this order.
                </span>
              </div>

              <div className="alert alert-info" style={{ display: 'block' }}>
                <b style={{ fontSize: '0.8125rem' }}>
                  {startDate && endDate
                    ? `${formatDate(startDate)} → ${formatDate(endDate)}`
                    : 'Pick a start date and some books to see the run'}
                </b>
                <p style={{ marginTop: 4, fontSize: '0.75rem' }}>
                  {selectedTimetableSubjects.length} paper{selectedTimetableSubjects.length === 1 ? '' : 's'}. Sundays are never used
                  {preview.skippedSundays > 0
                    ? `, so ${preview.skippedSundays} Sunday${preview.skippedSundays === 1 ? '' : 's'} pushed the end date out.`
                    : '.'}
                </p>
                {preview.dates.length > 0 && (
                  <div className="stack" style={{ gap: 4, marginTop: 10 }}>
                    {selectedTimetableSubjects.map((subject: any, index: number) => {
                      const subjectDate = parseDateInput(preview.dates[index]);
                      return (
                        <div
                          key={subject.id}
                          className="row-between"
                          style={{ gap: 12, fontSize: '0.75rem' }}
                        >
                          <span style={{ fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {subject.name}
                          </span>
                          <span style={{ flexShrink: 0, opacity: 0.75 }}>
                            {subjectDate ? formatDate(subjectDate) : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {timetableError && (
                <div className="alert alert-warn">
                  <AlertTriangle aria-hidden="true" />
                  <div>{timetableError}</div>
                </div>
              )}

              <div className="row" style={{ gap: 10 }}>
                {editingGroup && (
                  <button type="button" className="btn btn-ghost" onClick={resetTimetableForm}>
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={savingTimetable || loadingMeta || subjects.length === 0}
                >
                  {savingTimetable ? 'Saving…' : editingGroup ? 'Update dates' : 'Create datesheet'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : success ? (
        <section className="card">
          <EmptyState
            icon={<CheckCircle2 />}
            title="Results are with the teachers"
            text="Subject teachers have six hours to review and edit their marks. Once every subject is published, the result becomes official."
            action={
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setSuccess(false);
                    setParsedData([]);
                    setDetectedSubjects([]);
                    setFile(null);
                  }}
                >
                  Upload another sheet
                </button>
              </>
            }
          />
        </section>
      ) : (
        <section className="card" style={{ maxWidth: 860 }}>
          <div className="card-head">
            <div className="card-head-copy">
              <h2 className="card-title">Publish a batch result</h2>
              <p className="card-sub">
                Describe the exam, then upload one CSV with every student&rsquo;s marks. Teachers review before anything reaches parents.
              </p>
            </div>
          </div>

          <div className="card-pad stack" style={{ gap: 20 }}>
            <div className="form-grid form-grid-2">
              <label className="field">
                <span className="label">Exam title</span>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Mid Term Exam 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="label">Max marks per subject</span>
                <input
                  type="number"
                  className="input"
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="label">Result type</span>
                <select className="select" value={type} onChange={(e) => setType(e.target.value as ExamType)}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="MID">Mid term</option>
                  <option value="FINAL">Final term</option>
                  <option value="PROMOTION">Promotion</option>
                </select>
                {type === 'PROMOTION' && (
                  <span className="field-hint">
                    Students are promoted automatically once every subject teacher has published.
                  </span>
                )}
              </label>
              <label className="field">
                <span className="label">Class</span>
                <select
                  className="select"
                  value={classId}
                  onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}
                >
                  <option value="">Select a class…</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="label">Section <span style={{ color: 'var(--ink-4)', fontWeight: 500 }}>· optional</span></span>
                <select
                  className="select"
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  disabled={!classId || availableSections.length === 0}
                >
                  <option value="">{availableSections.length > 0 ? 'Whole class' : 'No sections available'}</option>
                  {availableSections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </div>

            <div className="stack" style={{ gap: 12, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
              <div className="row-between" style={{ gap: 12, flexWrap: 'wrap' }}>
                <div className="stack" style={{ gap: 3 }}>
                  <b style={{ fontSize: '0.875rem', fontWeight: 650 }}>Marks sheet</b>
                  <span style={{ color: 'var(--ink-3)', fontSize: '0.75rem' }}>
                    Needs a “Roll Number” column; every other column must match a subject name or code.
                  </span>
                </div>
                {classId && (
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    onClick={downloadTemplate}
                    disabled={isDownloadingTemplate}
                  >
                    <Download />
                    {isDownloadingTemplate ? 'Preparing…' : 'Download template'}
                  </button>
                )}
              </div>

              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept=".csv"
                  className="input"
                  style={{ flex: '1 1 260px' }}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <button type="button" className="btn btn-quiet" onClick={processCSV} disabled={!file}>
                  <UploadCloud />
                  Check sheet
                </button>
              </div>
            </div>

            {error && (
              <div className="alert alert-warn">
                <AlertTriangle aria-hidden="true" />
                <div>{error}</div>
              </div>
            )}

            {parsedData.length > 0 && (
              <div className="card">
                <div className="card-pad stack" style={{ gap: 12 }}>
                  <div className="row-between" style={{ gap: 16, flexWrap: 'wrap' }}>
                    <div className="row" style={{ gap: 12 }}>
                      <span className="initials initials-accent" aria-hidden="true">
                        <FileSpreadsheet />
                      </span>
                      <div className="stack" style={{ gap: 3 }}>
                        <b style={{ fontSize: '0.875rem', fontWeight: 650 }}>Sheet looks good</b>
                        <span style={{ color: 'var(--ink-3)', fontSize: '0.75rem' }}>
                          {parsedData.length} students · {detectedSubjects.length} subjects matched
                        </span>
                      </div>
                    </div>
                    <button type="button" className="btn btn-accent" onClick={submitResults} disabled={uploading}>
                      {uploading ? 'Sending…' : 'Send to teachers'}
                    </button>
                  </div>

                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {detectedSubjects.map((s, i) => (
                      <span key={i} className="chip chip-info">{s.name}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
