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
} from 'lucide-react';
import { api } from '../utils/api';

type ExamType = 'MONTHLY' | 'MID' | 'FINAL' | 'PROMOTION';

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

  const classes = metadata?.allClasses || [];
  const subjects = metadata?.allSubjects || [];
  const sections = metadata?.allSections || [];

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

      if (editingGroup) {
        await api.patch('/institution/exams', payload);
      } else {
        await api.post('/institution/exams', payload);
      }

      resetTimetableForm();
      await loadTimetable();
    } catch (err: any) {
      setTimetableError(err.message || 'Failed to save exam timetable');
    } finally {
      setSavingTimetable(false);
    }
  }

  async function deleteGroup(group: any) {
    if (!confirm(`Delete "${group.title}"?`)) return;
    try {
      await api.delete('/institution/exams', { examIds: group.examIds });
      if (editingGroup?.key === group.key) resetTimetableForm();
      await loadTimetable();
    } catch (err: any) {
      alert(err.message || 'Failed to delete exam');
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
      alert(err.message || 'Failed to download template');
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Exam Management</h1>
        <p className="text-slate-400 mt-1">Create institution exams and publish batch results like the web app.</p>
      </div>

      <div className="flex gap-2 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 w-fit">
        <button
          onClick={() => setTab('timetable')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'timetable' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Exam Timetable
        </button>
        <button
          onClick={() => setTab('publish')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'publish' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Publish Results
        </button>
      </div>

      {tab === 'timetable' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden h-fit">
            <div className="border-b border-slate-700/50 p-4 bg-slate-800/30">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-indigo-400" />
                {editingGroup ? 'Update Institution Exam' : 'Create Institution Exam'}
              </h2>
            </div>
            <div className="p-6">
              <form onSubmit={submitTimetable} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Class</label>
                  <select value={ttClassId} onChange={(e) => setTtClassId(e.target.value)} required className="w-full rounded-md border border-slate-700/50 px-3 py-2 text-sm bg-slate-900/50 text-white">
                    <option value="">Select class...</option>
                    {classes.map((classRow: any) => (
                      <option key={classRow.id} value={classRow.id}>{classRow.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Exam Type</label>
                  <select value={ttType} onChange={(e) => setTtType(e.target.value as ExamType)} required className="w-full rounded-md border border-slate-700/50 px-3 py-2 text-sm bg-slate-900/50 text-white">
                    <option value="MONTHLY">Monthly</option>
                    <option value="MID">Mid</option>
                    <option value="FINAL">Final</option>
                    <option value="PROMOTION">Promotion</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Title</label>
                  <input value={ttTitle} onChange={(e) => setTtTitle(e.target.value)} required placeholder="e.g. Final Term 2026" className="w-full rounded-md border border-slate-700/50 px-3 py-2 text-sm bg-slate-900/50 text-white" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Start Date</label>
                    <input type="date" required value={ttDate} onChange={(e) => setTtDate(e.target.value)} className="w-full rounded-md border border-slate-700/50 px-3 py-2 text-sm bg-slate-900/50 text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Total Marks</label>
                    <input type="number" min="1" step="0.01" required value={ttMaxMarks} onChange={(e) => setTtMaxMarks(e.target.value)} className="w-full rounded-md border border-slate-700/50 px-3 py-2 text-sm bg-slate-900/50 text-white" />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-slate-400">Books / Subjects</label>
                    <button type="button" className="text-xs font-medium text-indigo-300 hover:text-indigo-200" onClick={() => setTtSubjectIds(subjects.map((subject: any) => subject.id))}>
                      Select all
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto rounded-md border border-slate-700/50 p-3 space-y-2 bg-slate-900/50">
                    {subjects.length === 0 ? (
                      <p className="text-sm text-slate-500">Create subjects first from Academics.</p>
                    ) : (
                      subjects.map((subject: any) => (
                        <label key={subject.id} className="flex items-center gap-2 text-sm text-slate-200">
                          <input type="checkbox" value={subject.id} checked={ttSubjectIds.includes(subject.id)} onChange={(e) => toggleTimetableSubject(subject.id, e.target.checked)} className="rounded border-slate-300" />
                          {subject.name}
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-indigo-500/20 bg-indigo-500/10 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      {startDate && endDate ? `${formatDate(startDate)} to ${formatDate(endDate)}` : 'Select start date and subjects to calculate end date'}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      {selectedTimetableSubjects.length} subject{selectedTimetableSubjects.length === 1 ? '' : 's'} scheduled. Sundays are not used for exams
                      {preview.skippedSundays > 0 ? `, so ${preview.skippedSundays} Sunday${preview.skippedSundays === 1 ? '' : 's'} moved the end date forward.` : '.'}
                    </p>
                    {preview.dates.length > 0 && (
                      <div className="mt-3 grid gap-2">
                        {selectedTimetableSubjects.map((subject: any, index: number) => {
                          const subjectDate = parseDateInput(preview.dates[index]);
                          return (
                            <div key={subject.id} className="flex items-center justify-between gap-3 rounded-sm bg-slate-800/60 px-2 py-1.5 text-xs">
                              <span className="truncate font-medium text-slate-200">{subject.name}</span>
                              <span className="shrink-0 text-slate-400">{subjectDate ? formatDate(subjectDate) : '-'}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {timetableError && (
                  <div className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-200 border border-amber-500/20 flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                    <span className="mt-0.5">{timetableError}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  {editingGroup && (
                    <button type="button" onClick={resetTimetableForm} className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white">
                      Cancel Edit
                    </button>
                  )}
                  <button type="submit" disabled={savingTimetable || loadingMeta || subjects.length === 0} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-medium">
                    {savingTimetable ? 'Saving...' : editingGroup ? 'Update Exam Dates' : 'Create Exam Dates'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
            <div className="border-b border-slate-700/50 p-4 bg-slate-800/30">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-400" />
                Scheduled Exams
              </h2>
            </div>
            <div className="p-0">
              {loadingTimetable ? (
                <p className="p-8 text-sm text-slate-400">Loading scheduled exams...</p>
              ) : examRows.length === 0 ? (
                <p className="p-8 text-sm text-slate-400">No institution exams scheduled yet.</p>
              ) : (
                <div>
                  <div className="grid gap-4 border-b border-slate-700/50 p-5 xl:grid-cols-2">
                    {examGroups.map((group) => (
                      <div key={group.key} className="rounded-xl border border-slate-700/50 bg-slate-900/40 overflow-hidden flex flex-col">
                        <div className="bg-slate-800/50 p-4 border-b border-slate-700/50 flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white text-base">{group.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-medium bg-slate-700/50 border border-slate-600 px-2 py-0.5 rounded text-slate-300">{group.className}</span>
                              <span className="text-xs font-medium bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">{group.type}</span>
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full bg-slate-700/50 border border-slate-600 px-3 py-1 text-xs font-semibold text-indigo-200">
                            {group.subjectCount} books
                          </span>
                        </div>
                        <div className="p-4 flex-1">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">Start Date</p>
                              <p className="font-medium text-slate-100">{formatExamDate(group.startDate)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">End Date</p>
                              <p className="font-medium text-slate-100">{formatExamDate(group.endDate)}</p>
                            </div>
                          </div>
                          <p className="mt-4 text-xs text-slate-400 bg-slate-800/50 p-2 rounded border border-slate-700/50">
                            <span className="font-medium text-slate-300">Sundays skipped: {group.skippedSundays}.</span> End date is calculated from the selected books.
                          </p>
                        </div>
                        <div className="p-4 border-t border-slate-700/50 bg-slate-800/20 flex flex-wrap gap-2 mt-auto">
                          <button onClick={() => fillEdit(group)} className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800">
                            <Pencil className="h-3.5 w-3.5" />
                            Update exam
                          </button>
                          <button onClick={() => deleteGroup(group)} className="inline-flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20">
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete exam
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-x-auto p-1">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-800/30">
                        <tr className="border-b border-slate-700/50">
                          <th className="p-4 text-sm font-semibold text-slate-300">Exam</th>
                          <th className="p-4 text-sm font-semibold text-slate-300">Class</th>
                          <th className="p-4 text-sm font-semibold text-slate-300">Subject</th>
                          <th className="p-4 text-sm font-semibold text-slate-300">Subject Date</th>
                          <th className="p-4 text-sm font-semibold text-slate-300">End Date</th>
                          <th className="p-4 text-sm font-semibold text-slate-300 text-right">Marks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {examRows.map((exam) => (
                          <tr key={exam.id} className="hover:bg-slate-700/20 transition-colors">
                            <td className="p-4 text-slate-200 font-medium">
                              <p className="text-white">{exam.title}</p>
                              <p className="text-xs text-slate-500 font-normal">{exam.type}</p>
                            </td>
                            <td className="p-4 text-slate-400">{exam.className}</td>
                            <td className="p-4 text-slate-400">{exam.subjectName}</td>
                            <td className="p-4 text-slate-400">{formatExamDate(exam.date)}</td>
                            <td className="p-4 text-slate-400">{exam.endDate ? formatExamDate(exam.endDate) : '-'}</td>
                            <td className="p-4 text-right font-medium text-slate-200">{exam.maxMarks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : success ? (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-emerald-200">Results Uploaded Successfully</h2>
          <p className="text-emerald-100/80 max-w-md mx-auto mt-2">
            The batch results have been created. Subject teachers now have 6 hours to review, edit, and publish their subject marks.
          </p>
          <button
            onClick={() => {
              setSuccess(false);
              setParsedData([]);
              setDetectedSubjects([]);
              setFile(null);
            }}
            className="mt-4 px-4 py-2 rounded-xl border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/10"
          >
            Upload Another
          </button>
        </div>
      ) : (
        <div className="max-w-4xl bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
          <div className="border-b border-slate-700/50 p-4 bg-slate-800/30">
            <h2 className="text-lg font-bold text-white">Exam Details</h2>
            <p className="text-sm text-slate-400 mt-1">Enter exam details and upload the CSV sheet containing the marks.</p>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Exam Title *</label>
                <input type="text" className="w-full rounded-md border border-slate-700/50 px-3 py-2 text-sm bg-slate-900/50 text-white" placeholder="e.g. Mid Term Exam 2026" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Max Marks (Per Subject) *</label>
                <input type="number" className="w-full rounded-md border border-slate-700/50 px-3 py-2 text-sm bg-slate-900/50 text-white" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Result Type *</label>
                <select className="w-full rounded-md border border-slate-700/50 px-3 py-2 text-sm bg-slate-900/50 text-white" value={type} onChange={(e) => setType(e.target.value as ExamType)}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="MID">Mid Term</option>
                  <option value="FINAL">Final Term</option>
                  <option value="PROMOTION">Promotion</option>
                </select>
                {type === 'PROMOTION' && <p className="text-xs text-indigo-300">Students will be auto-promoted after every subject teacher publishes their results.</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Class *</label>
                <select className="w-full rounded-md border border-slate-700/50 px-3 py-2 text-sm bg-slate-900/50 text-white" value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}>
                  <option value="">Select a class...</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Section</label>
                <select className="w-full rounded-md border border-slate-700/50 px-3 py-2 text-sm bg-slate-900/50 text-white" value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId || availableSections.length === 0}>
                  <option value="">{availableSections.length > 0 ? 'Select a section...' : 'No sections available'}</option>
                  {availableSections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="border-t border-slate-700/50 pt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-400">CSV Upload</h3>
                {classId && (
                  <button type="button" onClick={downloadTemplate} disabled={isDownloadingTemplate} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-white hover:bg-slate-800 text-sm">
                    <Download className="h-4 w-4" />
                    {isDownloadingTemplate ? 'Preparing...' : 'Download CSV Template'}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-500/20 file:text-indigo-300 hover:file:bg-indigo-500/30" />
                <button type="button" onClick={processCSV} disabled={!file} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50">
                  <UploadCloud className="h-4 w-4" />
                  Process
                </button>
              </div>

              <p className="text-xs text-slate-500 mt-2">
                CSV must contain a column named "Roll Number". Other columns should exactly match subject names or codes.
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-200 border border-amber-500/20 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                <span className="mt-0.5">{error}</span>
              </div>
            )}

            {parsedData.length > 0 && (
              <div className="space-y-3 border border-slate-700/50 rounded-md p-4 bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-white">CSV Processed Successfully</h4>
                    <p className="text-sm text-slate-400">
                      Found {parsedData.length} students across {detectedSubjects.length} subjects.
                    </p>
                  </div>
                  <button type="button" onClick={submitResults} disabled={uploading} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50">
                    {uploading ? 'Uploading...' : 'Publish to Teachers'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  {detectedSubjects.map((s, i) => (
                    <span key={i} className="inline-flex items-center rounded-md bg-indigo-500/20 px-2 py-1 text-xs font-medium text-indigo-300">
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
