import React, { useEffect, useMemo, useState, useDeferredValue } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, API_ORIGIN, BASE_URL, getAuthToken } from '../utils/api';
import { Search, Plus, Eye, GraduationCap, Upload, Download, FileSpreadsheet, Trash2 } from 'lucide-react';
import PageSkeleton from '../components/PageSkeleton';
import Modal from '../ui/Modal';
import { EmptyState, ErrorNote, PageHead } from '../ui/Bits';
import ProfileRequestsPanel from '../components/ProfileRequestsPanel';
import { useConfirm, useToast } from '../ui/Feedback';

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatUniversalId(value?: string | null) {
  if (!value) return 'N/A';
  return value.includes('@') ? value.split('@')[0] : value;
}

function normalizeImageUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) return value;
  if (value.startsWith('/')) return `${API_ORIGIN}${value}`;
  return `${API_ORIGIN}/${value}`;
}

function initialsOf(name: string) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();
}

export default function Students() {
  const { selectedCampus } = useOutletContext<any>();
  const toast = useToast();
  const confirm = useConfirm();

  const [students, setStudents] = useState<any[]>([]);
  const [campuses, setCampuses] = useState<{ id: number; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [sections, setSections] = useState<{ id: number; name: string; classId: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [showProfile, setShowProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileTab, setProfileTab] = useState<'overview' | 'activity'>('overview');
  const [activityMonth, setActivityMonth] = useState(currentMonthValue());
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [attendanceRows, setAttendanceRows] = useState<any[]>([]);
  const [marksRows, setMarksRows] = useState<any[]>([]);
  const [batchExamRows, setBatchExamRows] = useState<any[]>([]);
  const [submissionRows, setSubmissionRows] = useState<any[]>([]);
  const [feeAccount, setFeeAccount] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: 'MALE',
    yearOfJoining: new Date().getFullYear(),
    campusId: '',
    classId: '',
    sectionId: '',
    classRollNumber: '',
    phone: '',
    age: 10,
  });
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        yearOfJoining: parseInt(formData.yearOfJoining as any),
        campusId: parseInt(formData.campusId as any),
        classId: parseInt(formData.classId as any),
        sectionId: parseInt(formData.sectionId as any),
        age: parseInt(formData.age as any)
      };
      await api.post('/institution/students', payload);
      const enrolled = `${formData.firstName} ${formData.lastName}`.trim();
      setShowAdd(false);
      const data = await api.get('/institution/students/picker');
      setStudents(data.students || []);
      toast.success('Student enrolled', `${enrolled || 'The student'} is now on the register.`);
    } catch(err: any) {
      toast.error('Could not enroll', err.message || 'Failed to enroll');
    } finally {
      setSaving(false);
    }
  }

  async function handleImportStudents(e: React.FormEvent) {
    e.preventDefault();
    setImportError('');
    if (!importFile) {
      setImportError('Please select a CSV file first.');
      return;
    }

    setImporting(true);
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Unauthorized');

      const formData = new FormData();
      formData.append('file', importFile);

      const response = await fetch(`${BASE_URL}/institution/students/import`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        // Ignore parse errors and fall back to generic message.
      }
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'CSV import failed');
      }

      // Refresh only the student cache. A full institution pull also requests
      // dashboards, settings, exams, roles, tickets and other unrelated data.
      if (window.electronAPI?.sync?.students) {
        await window.electronAPI.sync.students();
      }

      const campusQuery = selectedCampus?.id !== 'all' && selectedCampus?.id ? `&campusId=${selectedCampus.id}` : '';
      const studentData = await api.get(`/institution/students/picker?limit=100${campusQuery}`);
      setStudents(studentData.students || []);

      setShowImport(false);
      setImportFile(null);
      toast.success(
        'Import finished',
        `${payload?.imported || 0} ${payload?.imported === 1 ? 'student' : 'students'} added to the register.`,
      );
    } catch (err: any) {
      setImportError(err.message || 'Failed to import students.');
    } finally {
      setImporting(false);
    }
  }

  function handleDownloadTemplate() {
    const csv = [
      'firstName,lastName,gender,campus,class,section,yearOfJoining,classRollNumber,phone',
      'Ali,Ahmad,MALE,Main Campus,Class 1,A,2026,001,03001234567',
      'Sara,Khan,FEMALE,Main Campus,Class 1,,2026,002,03007654321',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'students-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }


  useEffect(() => {
    async function fetchMeta() {
      try {
        const [campusData, timetableData] = await Promise.all([
          api.get('/institution/campuses').catch(() => ({ campuses: [] })),
          api.get('/institution/timetable?metadata=true').catch(() => ({ allClasses: [], allSections: [] })),
        ]);
        setCampuses(campusData?.campuses || []);
        setClasses(timetableData?.allClasses || []);
        setSections(timetableData?.allSections || []);
      } catch (err) {}
    }
    fetchMeta();
  }, []);

  useEffect(() => {
    async function fetchStudents() {
      try {
        const campusQuery = selectedCampus?.id !== 'all' && selectedCampus?.id ? `&campusId=${selectedCampus.id}` : '';
        const searchQuery = deferredQuery.trim() ? `&q=${encodeURIComponent(deferredQuery.trim())}` : '';
        const studentData = await api.get(`/institution/students/picker?limit=100${campusQuery}${searchQuery}`);
        setStudents(studentData.students || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch students');
      } finally {
        setLoading(false);
      }
    }
    fetchStudents();
  }, [selectedCampus, deferredQuery]);

  const filteredSections = sections.filter((section) => String(section.classId) === String(formData.classId));
  const sectionsForFilter = filterClassId
    ? sections.filter((section) => String(section.classId) === String(filterClassId))
    : sections;
  const filteredStudents = students.filter((student) => {
    if (filterClassId) {
      const matchesClassId = String(student.classId || '') === String(filterClassId);
      const classObj = classes.find((row) => String(row.id) === String(filterClassId));
      const matchesClassName = Boolean(classObj?.name) && String(student.className || '') === String(classObj?.name);
      if (!matchesClassId && !matchesClassName) return false;
    }
    if (filterSectionId) {
      const matchesSectionId = String(student.sectionId || '') === String(filterSectionId);
      const sectionObj = sections.find((row) => String(row.id) === String(filterSectionId));
      const matchesSectionName = Boolean(sectionObj?.name) && String(student.sectionName || '') === String(sectionObj?.name);
      if (!matchesSectionId && !matchesSectionName) return false;
    }
    return true;
  });

  const filtering = Boolean(filterClassId || filterSectionId || deferredQuery.trim());

  function clearFilters() {
    setFilterClassId('');
    setFilterSectionId('');
    setQuery('');
  }

  async function openProfile(student: any) {
    setShowProfile(null);
    setProfileError('');
    setProfileTab('overview');
    setActivityMonth(currentMonthValue());
    setAttendanceRows([]);
    setMarksRows([]);
    setBatchExamRows([]);
    setLoadingProfile(true);

    try {
      const data = await api.get(`/institution/students/${student.id}`);
      if (!data?.student) {
        throw new Error('Student profile not found');
      }
      setShowProfile(data.student);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to load student profile');
      setShowProfile(student);
    } finally {
      setLoadingProfile(false);
    }
  }

  async function removeStudent(student: any) {
    if (!await confirm({ title: `Remove ${student.name}?`, body: 'The student login and institution records will be removed. This cannot be undone.', confirmLabel: 'Remove student', tone: 'danger' })) return;
    try {
      await api.delete(`/institution/students/${student.id}`);
      setStudents((current) => current.filter((item) => item.id !== student.id));
      if (showProfile?.id === student.id) setShowProfile(null);
      toast.success('Student removed');
    } catch (error: any) { toast.error('Could not remove student', error.message); }
  }

  useEffect(() => {
    if (!showProfile?.id || profileTab !== 'activity') return;

    let cancelled = false;
    async function loadActivity() {
      setActivityLoading(true);
      setActivityError('');
      try {
        const monthParam = encodeURIComponent(activityMonth);
        const [attendanceRes, marksRes, batchRes, submissionsRes, feesRes, analyticsRes] = await Promise.all([
          api.get(`/institution/students/${showProfile.id}/history?section=attendance&month=${monthParam}`).catch(() => ({ attendance: [] })),
          api.get(`/institution/students/${showProfile.id}/history?section=marks&month=${monthParam}`).catch(() => ({ marks: [] })),
          api.get(`/institution/students/${showProfile.id}/history?section=batchExams&month=${monthParam}`).catch(() => ({ batchExams: [] })),
          api.get(`/institution/students/${showProfile.id}/history?section=submissions&month=${monthParam}`).catch(() => ({ submissions: [] })),
          api.get(`/institution/students/${showProfile.id}/history?section=fees&month=${monthParam}`).catch(() => ({ feeAccount: null })),
          api.get(`/institution/students/${showProfile.id}/history?section=analytics&month=${monthParam}`).catch(() => ({ analytics: null })),
        ]);
        if (cancelled) return;
        setAttendanceRows(attendanceRes?.attendance || []);
        setMarksRows(marksRes?.marks || []);
        setBatchExamRows(batchRes?.batchExams || []);
        setSubmissionRows(submissionsRes?.submissions || []);
        setFeeAccount(feesRes?.feeAccount || null);
        setAnalytics(analyticsRes?.analytics || null);
      } catch (err: any) {
        if (!cancelled) setActivityError(err.message || 'Failed to load student activity');
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    }

    loadActivity();
    return () => {
      cancelled = true;
    };
  }, [showProfile?.id, profileTab, activityMonth]);

  const profileFields = useMemo(() => {
    if (!showProfile) return [];
    return [
      { label: 'Class', value: `${showProfile.className || 'N/A'}${showProfile.sectionName ? ` · ${showProfile.sectionName}` : ''}` },
      { label: 'Campus', value: showProfile.campusName || 'N/A' },
      { label: 'Class roll no.', value: showProfile.classRollNumber || 'N/A' },
      { label: 'Universal ID', value: formatUniversalId(showProfile.loginRollNumber) },
      { label: 'Father name', value: showProfile.fatherName || 'N/A' },
      { label: 'Gender', value: showProfile.gender || 'N/A' },
      { label: 'Year of joining', value: showProfile.yearOfJoining || 'N/A' },
      { label: 'Age', value: showProfile.age ?? 'N/A' },
      { label: 'Phone', value: showProfile.phone || 'N/A' },
      { label: 'Emergency contact', value: showProfile.emergencyContact || 'N/A' },
      { label: 'Parental WhatsApp', value: showProfile.parentalWhatsapp || 'N/A' },
    ];
  }, [showProfile]);

  const scopeLabel =
    selectedCampus?.id && selectedCampus.id !== 'all' ? selectedCampus.name : 'every campus';

  return (
    <div className="page">
      <PageHead
        title="Students"
        subtitle={`The register for ${scopeLabel}. Open a student to see their attendance, marks and promotion history.`}
      >
        <ProfileRequestsPanel kind="student" />
        <label className="search-field">
          <Search aria-hidden="true" />
          <input
            type="search"
            className="input"
            placeholder="Name or ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search students"
          />
        </label>
        <button type="button" className="btn btn-quiet" onClick={() => { setShowImport(true); setImportError(''); }}>
          <Upload />
          Import CSV
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus />
          Enroll student
        </button>
      </PageHead>

      {error && <ErrorNote message={error} />}

      {loading ? (
        <PageSkeleton rows={7} />
      ) : (
        <section className="card">
          <div className="card-head">
            <div className="card-head-copy">
              <h2 className="card-title">Register</h2>
              <p className="card-sub">
                {filtering
                  ? `${filteredStudents.length} of ${students.length} shown`
                  : `${students.length} ${students.length === 1 ? 'student' : 'students'}`}
              </p>
            </div>
            <div className="card-tools">
              <select
                className="select input-sm"
                aria-label="Filter by class"
                value={filterClassId}
                onChange={(e) => {
                  setFilterClassId(e.target.value);
                  setFilterSectionId('');
                }}
              >
                <option value="">All classes</option>
                {classes.map((classRow) => (
                  <option key={classRow.id} value={classRow.id}>{classRow.name}</option>
                ))}
              </select>
              <select
                className="select input-sm"
                aria-label="Filter by section"
                value={filterSectionId}
                onChange={(e) => setFilterSectionId(e.target.value)}
                disabled={!filterClassId}
              >
                <option value="">All sections</option>
                {sectionsForFilter.map((section) => (
                  <option key={section.id} value={section.id}>{section.name}</option>
                ))}
              </select>
              {filtering && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {students.length === 0 ? (
            <EmptyState
              icon={<GraduationCap />}
              title="No students enrolled yet"
              text="Enroll them one at a time, or bring a whole class over with a CSV import."
              action={
                <>
                  <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
                    <Plus />
                    Enroll a student
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={() => { setShowImport(true); setImportError(''); }}>
                    <Upload />
                    Import CSV
                  </button>
                </>
              }
            />
          ) : filteredStudents.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title="No student matches these filters"
              text="Loosen the class or section filter, or clear the search box."
              action={
                <button type="button" className="btn btn-quiet" onClick={clearFilters}>
                  Clear filters
                </button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Student ID</th>
                    <th scope="col">Name</th>
                    <th scope="col">Class</th>
                    <th scope="col">Section</th>
                    <th scope="col">Status</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(student => {
                    const enrolled = (student.status || 'Enrolled') === 'Enrolled';
                    return (
                      <tr key={student.id}>
                        <td className="mono" style={{ color: 'var(--ink-3)' }}>
                          {formatUniversalId(student.loginRollNumber) || student.id}
                        </td>
                        <td>
                          <div className="row">
                            <span className="initials" aria-hidden="true">{initialsOf(student.name)}</span>
                            <b className="tbl-strong">{student.name}</b>
                          </div>
                        </td>
                        <td>{student.className || 'N/A'}</td>
                        <td>{student.sectionName || 'Main'}</td>
                        <td>
                          <span className={`chip ${enrolled ? 'chip-ok' : 'chip-bad'}`}>
                            {student.status || 'Enrolled'}
                          </span>
                        </td>
                        <td>
                          <div className="tbl-actions">
                            <button
                              type="button"
                              onClick={() => openProfile(student)}
                              className="icon-btn"
                              aria-label={`Open ${student.name}'s profile`}
                              title="Open profile"
                            >
                              <Eye />
                            </button>
                            <button type="button" className="icon-btn" title="Remove student" aria-label={`Remove ${student.name}`} onClick={() => void removeStudent(student)}><Trash2 /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Enroll ------------------------------------------------------------ */}
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Enroll a student"
        description="Their login ID is generated from the class and roll number once they're saved."
        size="md"
        onSubmit={handleEnroll}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enrolling…' : 'Enroll student'}
            </button>
          </>
        }
      >
        <div className="form-grid form-grid-2">
          <label className="field">
            <span className="label">First name</span>
            <input required type="text" className="input" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
          </label>
          <label className="field">
            <span className="label">Last name</span>
            <input required type="text" className="input" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
          </label>
          <label className="field">
            <span className="label">Gender</span>
            <select className="select" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Age</span>
            <input required type="number" min={3} max={30} className="input" value={formData.age} onChange={e => setFormData({...formData, age: parseInt(e.target.value)})} />
          </label>
          <label className="field">
            <span className="label">Campus</span>
            <select required className="select" value={formData.campusId} onChange={e => setFormData({...formData, campusId: e.target.value})}>
              <option value="">Select campus…</option>
              {campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Class</span>
            <select required className="select" value={formData.classId} onChange={e => setFormData({...formData, classId: e.target.value, sectionId: ''})}>
              <option value="">Select class…</option>
              {classes.map(classRow => <option key={classRow.id} value={classRow.id}>{classRow.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Section</span>
            <select required className="select" value={formData.sectionId} onChange={e => setFormData({...formData, sectionId: e.target.value})} disabled={!formData.classId}>
              <option value="">{formData.classId ? 'Select section…' : 'Pick a class first'}</option>
              {filteredSections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Class roll number</span>
            <input required type="text" className="input" placeholder="e.g. 014" value={formData.classRollNumber} onChange={e => setFormData({...formData, classRollNumber: e.target.value})} />
          </label>
          <label className="field form-span-2">
            <span className="label">Phone <span style={{ color: 'var(--ink-4)', fontWeight: 500 }}>· optional</span></span>
            <input type="text" className="input" placeholder="03xx xxxxxxx" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </label>
        </div>
      </Modal>

      {/* Import ------------------------------------------------------------ */}
      <Modal
        open={showImport}
        onClose={() => { setShowImport(false); setImportFile(null); setImportError(''); }}
        title="Import students from CSV"
        description="Same format as the web app. One row per student — sections may be left blank."
        size="sm"
        onSubmit={handleImportStudents}
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setShowImport(false); setImportFile(null); setImportError(''); }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={importing}>
              {importing ? 'Importing…' : 'Import students'}
            </button>
          </>
        }
      >
        <div className="stack" style={{ gap: 12 }}>
          <label className="field">
            <span className="label">CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="input"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            />
            {importFile && (
              <span className="field-hint">
                <FileSpreadsheet className="w-3 h-3" aria-hidden="true" /> {importFile.name}
              </span>
            )}
          </label>

          <div className="row-between" style={{ gap: 12 }}>
            <p style={{ color: 'var(--ink-3)', fontSize: '0.75rem', maxWidth: '34ch' }}>
              Not sure about the columns? Start from the template and fill it in.
            </p>
            <button type="button" className="btn btn-quiet btn-sm" onClick={handleDownloadTemplate}>
              <Download />
              Template
            </button>
          </div>

          {importError && (
            <div className="alert alert-bad">
              <div>{importError}</div>
            </div>
          )}
        </div>
      </Modal>

      {/* Profile ----------------------------------------------------------- */}
      <Modal
        open={Boolean(showProfile)}
        onClose={() => setShowProfile(null)}
        title={showProfile?.name || 'Student profile'}
        description={showProfile ? formatUniversalId(showProfile.loginRollNumber) : undefined}
        size="lg"
        scrollBody
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setShowProfile(null)}>
            Close
          </button>
        }
      >
        {showProfile && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="seg" role="group" aria-label="Profile sections">
              <button type="button" aria-pressed={profileTab === 'overview'} onClick={() => setProfileTab('overview')}>
                Overview
              </button>
              <button type="button" aria-pressed={profileTab === 'activity'} onClick={() => setProfileTab('activity')}>
                Activity
              </button>
            </div>

            {loadingProfile ? (
              <div className="sk-panel">
                <div className="sk-line is-head" />
                <div className="sk-line" />
                <div className="sk-line" />
              </div>
            ) : (
              <>
                {profileError && (
                  <div className="alert alert-warn">
                    <div>{profileError}. Showing limited directory data.</div>
                  </div>
                )}

                {profileTab === 'overview' && (
                  <div className="stack" style={{ gap: 16 }}>
                    <div className="row" style={{ gap: 14 }}>
                      <span
                        className="initials"
                        style={{ width: 56, height: 56, fontSize: '1.125rem', overflow: 'hidden' }}
                        aria-hidden="true"
                      >
                        {normalizeImageUrl(showProfile.profilePictureUrl) ? (
                          <img
                            src={normalizeImageUrl(showProfile.profilePictureUrl)!}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          initialsOf(showProfile.name)
                        )}
                      </span>
                      <div className="stack" style={{ gap: 3 }}>
                        <b style={{ fontSize: '1.0625rem', fontWeight: 650 }}>{showProfile.name}</b>
                        <span className="mono" style={{ color: 'var(--ink-3)', fontSize: '0.75rem' }}>
                          {formatUniversalId(showProfile.loginRollNumber)}
                        </span>
                      </div>
                    </div>

                    <div className="grid-cards" style={{ gap: 10 }}>
                      {profileFields.map((field) => (
                        <div key={field.label} className="secret" style={{ display: 'block' }}>
                          <span className="secret-label" style={{ marginBottom: 4 }}>{field.label}</span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--ink)' }}>{field.value}</span>
                        </div>
                      ))}
                    </div>

                    {(showProfile.promotionHistory?.length ?? 0) > 0 && (
                      <div className="card">
                        <div className="card-head">
                          <div className="card-head-copy">
                            <h3 className="card-title">Promotion history</h3>
                          </div>
                        </div>
                        <div>
                          {showProfile.promotionHistory.map((row: any) => (
                            <div className="list-row" key={row.id}>
                              <span className="cell-stack" style={{ flex: '1 1 auto', minWidth: 0 }}>
                                <b>
                                  {row.fromClassName} → {row.toClassName}
                                </b>
                                <span>
                                  Roll {row.fromRollNumber || '—'} → {row.toRollNumber || '—'}
                                </span>
                              </span>
                              <span className="chip chip-brand">{row.status}</span>
                              <span style={{ color: 'var(--ink-4)', fontSize: '0.75rem' }}>
                                {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {profileTab === 'activity' && (
                  <div className="stack" style={{ gap: 14 }}>
                    <div className="row-between" style={{ gap: 12, flexWrap: 'wrap' }}>
                      <p style={{ color: 'var(--ink-2)', fontSize: '0.8125rem', maxWidth: '46ch' }}>
                        Attendance, test marks and term results for the month you choose.
                      </p>
                      <label className="field" style={{ minWidth: 0 }}>
                        <input
                          type="month"
                          className="input input-sm"
                          value={activityMonth}
                          max={currentMonthValue()}
                          onChange={(e) => setActivityMonth(e.target.value)}
                          aria-label="Activity month"
                        />
                      </label>
                    </div>

                    {activityLoading ? (
                      <div className="sk-panel">
                        <div className="sk-line is-head" />
                        <div className="sk-line" />
                        <div className="sk-line" />
                      </div>
                    ) : activityError ? (
                      <ErrorNote message={activityError} />
                    ) : (
                      <div className="stack" style={{ gap: 14 }}>
                        <div className="card">
                          <div className="card-head">
                            <div className="card-head-copy">
                              <h3 className="card-title">Attendance</h3>
                              <p className="card-sub">{attendanceRows.length} recorded days</p>
                            </div>
                          </div>
                          {attendanceRows.length === 0 ? (
                            <p className="card-pad" style={{ color: 'var(--ink-3)', fontSize: '0.8125rem' }}>
                              No attendance recorded this month.
                            </p>
                          ) : (
                            <div className="table-wrap" style={{ maxHeight: 240 }}>
                              <table className="tbl tbl-tight">
                                <thead>
                                  <tr>
                                    <th scope="col">Date</th>
                                    <th scope="col">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {attendanceRows.map((row) => (
                                    <tr key={row.id}>
                                      <td className="tbl-num">{row.date}</td>
                                      <td>
                                        <span
                                          className={`chip ${
                                            row.status === 'PRESENT'
                                              ? 'chip-ok'
                                              : row.status === 'ABSENT'
                                                ? 'chip-bad'
                                                : 'chip-warn'
                                          }`}
                                        >
                                          {row.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        <div className="card">
                          <div className="card-head">
                            <div className="card-head-copy">
                              <h3 className="card-title">Test results</h3>
                              <p className="card-sub">{marksRows.length} entries</p>
                            </div>
                          </div>
                          {marksRows.length === 0 ? (
                            <p className="card-pad" style={{ color: 'var(--ink-3)', fontSize: '0.8125rem' }}>
                              No test results this month.
                            </p>
                          ) : (
                            <div className="table-wrap" style={{ maxHeight: 240 }}>
                              <table className="tbl tbl-tight">
                                <thead>
                                  <tr>
                                    <th scope="col">Test</th>
                                    <th scope="col">Date</th>
                                    <th scope="col">Score</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {marksRows.map((row) => (
                                    <tr key={row.id}>
                                      <td className="tbl-strong">{row.testTitle}</td>
                                      <td className="tbl-num">{row.date}</td>
                                      <td className="tbl-num">
                                        {row.marksObtained}/{row.totalMarks}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        <div className="card">
                          <div className="card-head">
                            <div className="card-head-copy">
                              <h3 className="card-title">Term results</h3>
                              <p className="card-sub">{batchExamRows.length} published</p>
                            </div>
                          </div>
                          {batchExamRows.length === 0 ? (
                            <p className="card-pad" style={{ color: 'var(--ink-3)', fontSize: '0.8125rem' }}>
                              No published term results this month.
                            </p>
                          ) : (
                            <div className="card-pad grid-cards" style={{ gap: 10 }}>
                              {batchExamRows.map((exam) => (
                                <div key={exam.id} className="secret" style={{ display: 'block' }}>
                                  <b style={{ fontSize: '0.8125rem', fontWeight: 650 }}>{exam.title}</b>
                                  <p style={{ color: 'var(--ink-4)', fontSize: '0.6875rem', marginTop: 2 }}>
                                    {exam.createdAt ? new Date(exam.createdAt).toLocaleDateString() : ''}
                                  </p>
                                  <div className="row-between" style={{ marginTop: 8, fontSize: '0.8125rem' }}>
                                    <span style={{ color: 'var(--ink-2)' }}>
                                      {exam.totalObtained}/{exam.totalMax}
                                    </span>
                                    <b style={{ color: exam.percentage >= 50 ? 'var(--ok)' : 'var(--bad)' }}>
                                      {exam.percentage}%
                                    </b>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="card"><div className="card-head"><div className="card-head-copy"><h3 className="card-title">Assignment submissions</h3><p className="card-sub">{submissionRows.length} submitted this month</p></div></div>{submissionRows.length === 0 ? <p className="card-pad" style={{ color: 'var(--ink-3)', fontSize: '0.8125rem' }}>No assignment submissions this month.</p> : <div>{submissionRows.map((row) => <div className="list-row" key={row.id}><span className="cell-stack"><b>{row.assignmentTitle}</b><span>{row.createdAt ? new Date(row.createdAt).toLocaleString('en-PK') : ''}</span></span></div>)}</div>}</div>

                        <div className="card"><div className="card-head"><div className="card-head-copy"><h3 className="card-title">Fee account</h3><p className="card-sub">Monthly challan and payment status</p></div></div>{!feeAccount ? <p className="card-pad" style={{ color: 'var(--ink-3)', fontSize: '0.8125rem' }}>No challan was issued this month.</p> : <div className="card-pad form-grid"><div className="grid-cards"><div className="secret"><span className="secret-label">Status</span><b>{feeAccount.invoice.status}</b></div><div className="secret"><span className="secret-label">Total</span><b>PKR {Number(feeAccount.invoice.totalAmount).toLocaleString('en-PK')}</b></div><div className="secret"><span className="secret-label">Paid</span><b>PKR {Number(feeAccount.invoice.paidAmount).toLocaleString('en-PK')}</b></div></div><p className="field-hint">{feeAccount.payments?.length || 0} verified receipt(s) · {feeAccount.submissions?.length || 0} submitted proof(s)</p></div>}</div>

                        <div className="card"><div className="card-head"><div className="card-head-copy"><h3 className="card-title">Monthly analytics</h3><p className="card-sub">A quick activity summary</p></div></div><div className="card-pad grid-cards"><div className="secret"><span className="secret-label">Attendance records</span><b>{analytics?.attendances?.length || 0}</b></div><div className="secret"><span className="secret-label">Marked tests</span><b>{analytics?.marks?.length || 0}</b></div><div className="secret"><span className="secret-label">Submissions</span><b>{analytics?.submissions?.length || 0}</b></div></div></div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
