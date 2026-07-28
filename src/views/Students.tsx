import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { api, BASE_URL, getAuthToken } from '../utils/api';
import { Search, Plus, Eye, GraduationCap, X, Upload, Download } from 'lucide-react';
import PageSkeleton from '../components/PageSkeleton';

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
  if (value.startsWith('/')) return `https://nisaab360.app${value}`;
  return `https://nisaab360.app/${value}`;
}

export default function Students() {
  const { selectedCampus } = useOutletContext<any>();
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
      setShowAdd(false);
      const data = await api.get('/institution/students/picker');
      setStudents(data.students || []);
      alert('Student Enrolled Successfully!');
    } catch(err: any) {
      alert(err.message || 'Failed to enroll');
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

      // Refresh local SQLite/cache so imported students appear instantly in desktop views.
      if (window.electronAPI?.sync?.pull) {
        await window.electronAPI.sync.pull();
      }

      const campusQuery = selectedCampus?.id !== 'all' && selectedCampus?.id ? `&campusId=${selectedCampus.id}` : '';
      const studentData = await api.get(`/institution/students/picker?limit=100${campusQuery}`);
      setStudents(studentData.students || []);

      setShowImport(false);
      setImportFile(null);
      alert(`${payload?.imported || 0} students imported successfully.`);
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
    async function fetchStudents() {
      try {
        const campusQuery = selectedCampus?.id !== 'all' && selectedCampus?.id ? `&campusId=${selectedCampus.id}` : '';
        const [studentData, campusData, timetableData] = await Promise.all([
          api.get(`/institution/students/picker?limit=100${campusQuery}`),
          api.get('/institution/campuses').catch(() => ({ campuses: [] })),
          api.get('/institution/timetable?metadata=true').catch(() => ({ allClasses: [], allSections: [] })),
        ]);
        setStudents(studentData.students || []);
        setCampuses(campusData?.campuses || []);
        setClasses(timetableData?.allClasses || []);
        setSections(timetableData?.allSections || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch students');
      } finally {
        setLoading(false);
      }
    }
    fetchStudents();
  }, [selectedCampus]);

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

  useEffect(() => {
    if (!showProfile?.id || profileTab !== 'activity') return;

    let cancelled = false;
    async function loadActivity() {
      setActivityLoading(true);
      setActivityError('');
      try {
        const monthParam = encodeURIComponent(activityMonth);
        const [attendanceRes, marksRes, batchRes] = await Promise.all([
          api.get(`/institution/students/${showProfile.id}/history?section=attendance&month=${monthParam}`).catch(() => ({ attendance: [] })),
          api.get(`/institution/students/${showProfile.id}/history?section=marks&month=${monthParam}`).catch(() => ({ marks: [] })),
          api.get(`/institution/students/${showProfile.id}/history?section=batchExams&month=${monthParam}`).catch(() => ({ batchExams: [] })),
        ]);
        if (cancelled) return;
        setAttendanceRows(attendanceRes?.attendance || []);
        setMarksRows(marksRes?.marks || []);
        setBatchExamRows(batchRes?.batchExams || []);
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
      { label: 'Class', value: `${showProfile.className || 'N/A'}${showProfile.sectionName ? ` - ${showProfile.sectionName}` : ''}` },
      { label: 'Campus', value: showProfile.campusName || 'N/A' },
      { label: 'Class Roll No.', value: showProfile.classRollNumber || 'N/A' },
      { label: 'Universal ID', value: formatUniversalId(showProfile.loginRollNumber) },
      { label: 'Father Name', value: showProfile.fatherName || 'N/A' },
      { label: 'Gender', value: showProfile.gender || 'N/A' },
      { label: 'Year of Joining', value: showProfile.yearOfJoining || 'N/A' },
      { label: 'Age', value: showProfile.age ?? 'N/A' },
      { label: 'Phone', value: showProfile.phone || 'N/A' },
      { label: 'Emergency Contact', value: showProfile.emergencyContact || 'N/A' },
      { label: 'Parental Whatsapp', value: showProfile.parentalWhatsapp || 'N/A' },
    ];
  }, [showProfile]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Student Records</h1>
          <p className="text-slate-400 mt-1">Manage and view student information.</p>
        </div>
        <div className="flex gap-3">
          <div className="student-toolbar-filters">
            <select
              aria-label="Filter by class"
              value={filterClassId}
              onChange={(e) => {
                setFilterClassId(e.target.value);
                setFilterSectionId('');
              }}
            >
              <option value="">All Classes</option>
              {classes.map((classRow) => (
                <option key={classRow.id} value={classRow.id}>{classRow.name}</option>
              ))}
            </select>
            <select
              aria-label="Filter by section"
              value={filterSectionId}
              onChange={(e) => setFilterSectionId(e.target.value)}
              disabled={!filterClassId}
            >
              <option value="">All Sections</option>
              {sectionsForFilter.map((section) => (
                <option key={section.id} value={section.id}>{section.name}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search by name or ID..." 
              className="student-search bg-slate-800/50 border border-slate-700/50 text-slate-200 text-sm rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
            />
          </div>
          <button onClick={() => setShowAdd(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Enroll Student
          </button>
          <button onClick={() => { setShowImport(true); setImportError(''); }} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl">
          {error}
        </div>
      )}

      {showAdd && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Enroll New Student</h2>
          <form onSubmit={handleEnroll} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">First Name</label>
              <input required type="text" className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Last Name</label>
              <input required type="text" className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Gender</label>
              <select className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Age</label>
              <input required type="number" className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white" value={formData.age} onChange={e => setFormData({...formData, age: parseInt(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Campus</label>
              <select required className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white" value={formData.campusId} onChange={e => setFormData({...formData, campusId: e.target.value})}>
                <option value="">Select campus...</option>
                {campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Class</label>
              <select required className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white" value={formData.classId} onChange={e => setFormData({...formData, classId: e.target.value, sectionId: ''})}>
                <option value="">Select class...</option>
                {classes.map(classRow => <option key={classRow.id} value={classRow.id}>{classRow.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Section</label>
              <select required className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white" value={formData.sectionId} onChange={e => setFormData({...formData, sectionId: e.target.value})}>
                <option value="">Select section...</option>
                {filteredSections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Class Roll Number</label>
              <input required type="text" className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white" value={formData.classRollNumber} onChange={e => setFormData({...formData, classRollNumber: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Phone</label>
              <input type="text" className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="col-span-2 flex justify-end gap-3 mt-4">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-all">{saving ? 'Enrolling...' : 'Enroll Student'}</button>
            </div>
          </form>
        </div>
      )}

      {showImport && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl mb-6">
          <h2 className="text-xl font-bold text-white mb-2">Import Students from CSV</h2>
          <p className="text-slate-400 text-sm mb-4">
            Upload the same CSV format used in the webapp import.
          </p>
          <form onSubmit={handleImportStudents} className="space-y-4">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-500/20 file:text-indigo-200 hover:file:bg-indigo-500/30"
            />
            <div className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-900/30 px-3 py-2">
              <p className="text-xs text-slate-400">Need sample format? Download the same template used on webapp.</p>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700/40"
              >
                <Download className="h-3.5 w-3.5" />
                Download Template CSV
              </button>
            </div>
            {importError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {importError}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowImport(false); setImportFile(null); setImportError(''); }}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={importing}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-all disabled:opacity-60"
              >
                {importing ? 'Importing...' : 'Import Students'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showProfile && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Student Profile</h2>
              <button type="button" onClick={() => setShowProfile(null)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 pt-4 border-b border-slate-200">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setProfileTab('overview')}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium ${profileTab === 'overview' ? 'bg-indigo-50 text-indigo-700 border border-b-white border-indigo-200' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setProfileTab('activity')}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium ${profileTab === 'activity' ? 'bg-indigo-50 text-indigo-700 border border-b-white border-indigo-200' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Activity
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingProfile ? (
                <div className="py-16 text-center text-slate-500">Loading profile...</div>
              ) : (
                <>
                  {profileError && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {profileError}. Showing limited directory data.
                    </div>
                  )}

                  {profileTab === 'overview' && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
                        <div className="student-profile-photo w-20 h-20 bg-indigo-100 rounded-full overflow-hidden flex items-center justify-center text-indigo-600 text-3xl font-bold shrink-0">
                          {normalizeImageUrl(showProfile.profilePictureUrl) ? (
                            <img src={normalizeImageUrl(showProfile.profilePictureUrl)!} alt={showProfile.name} className="w-full h-full object-cover" />
                          ) : (
                            showProfile.name ? showProfile.name.charAt(0) : '?'
                          )}
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-slate-900">{showProfile.name}</h3>
                          <p className="text-slate-500 font-mono mt-1">{formatUniversalId(showProfile.loginRollNumber)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {profileFields.map((field) => (
                          <div key={field.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{field.label}</p>
                            <p className="mt-1 text-slate-900">{field.value}</p>
                          </div>
                        ))}
                      </div>

                      {(showProfile.promotionHistory?.length ?? 0) > 0 && (
                        <div className="rounded-2xl border border-slate-200 overflow-hidden">
                          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <h4 className="font-semibold text-slate-900">Promotion History</h4>
                          </div>
                          <div className="divide-y divide-slate-200">
                            {showProfile.promotionHistory.map((row: any) => (
                              <div key={row.id} className="px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
                                <div className="text-slate-700">
                                  <strong>{row.fromClassName}</strong>
                                  <span className="text-slate-500"> · Roll {row.fromRollNumber || '—'} → </span>
                                  <strong>{row.toClassName}</strong>
                                  <span className="text-slate-500"> · Roll {row.toRollNumber || '—'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="rounded bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-800">{row.status}</span>
                                  <span className="text-xs text-slate-500">{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : ''}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {profileTab === 'activity' && (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div>
                          <h4 className="font-semibold text-slate-900">Student activity</h4>
                          <p className="text-sm text-slate-500">Attendance, results, and term results for the selected month.</p>
                        </div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          Month
                          <input
                            type="month"
                            value={activityMonth}
                            max={currentMonthValue()}
                            onChange={(e) => setActivityMonth(e.target.value)}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                          />
                        </label>
                      </div>

                      {activityLoading ? (
                        <div className="py-10 text-center text-slate-500">Loading activity...</div>
                      ) : activityError ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{activityError}</div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-slate-900">Recent Attendance</div>
                            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                              {attendanceRows.length === 0 ? (
                                <p className="text-sm text-slate-500">No attendance records this month.</p>
                              ) : attendanceRows.map((row) => (
                                <div key={row.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                  <span className="text-slate-700">{row.date}</span>
                                  <span className="font-medium text-slate-900">{row.status}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-slate-900">Recent Results</div>
                            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                              {marksRows.length === 0 ? (
                                <p className="text-sm text-slate-500">No test results this month.</p>
                              ) : marksRows.map((row) => (
                                <div key={row.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                  <div className="font-medium text-slate-900">{row.testTitle}</div>
                                  <div className="mt-1 flex items-center justify-between text-slate-600">
                                    <span>{row.date}</span>
                                    <span>{row.marksObtained}/{row.totalMarks}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 overflow-hidden lg:col-span-2">
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-slate-900">Term Results</div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                              {batchExamRows.length === 0 ? (
                                <p className="text-sm text-slate-500">No published term results this month.</p>
                              ) : batchExamRows.map((exam) => (
                                <div key={exam.id} className="rounded-xl border border-slate-200 p-4">
                                  <div className="font-semibold text-slate-900">{exam.title}</div>
                                  <div className="text-xs text-slate-500 mt-1">{exam.createdAt ? new Date(exam.createdAt).toLocaleDateString() : ''}</div>
                                  <div className="mt-3 flex items-center justify-between text-sm">
                                    <span>{exam.totalObtained}/{exam.totalMax}</span>
                                    <span className={`font-bold ${exam.percentage >= 50 ? 'text-emerald-600' : 'text-red-600'}`}>{exam.percentage}%</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
              <button type="button" onClick={() => setShowProfile(null)} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {loading ? (
        <PageSkeleton rows={7} />
      ) : filteredStudents.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center">
          <GraduationCap className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white">No Students Found</h3>
          <p className="text-slate-400 mt-2">No student matches selected class/section filters.</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/30">
                  <th className="p-4 text-sm font-semibold text-slate-300">Student ID</th>
                  <th className="p-4 text-sm font-semibold text-slate-300">Name</th>
                  <th className="p-4 text-sm font-semibold text-slate-300">Class</th>
                  <th className="p-4 text-sm font-semibold text-slate-300">Section</th>
                  <th className="p-4 text-sm font-semibold text-slate-300">Status</th>
                  <th className="p-4 text-sm font-semibold text-slate-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredStudents.map(student => (
                  <tr key={student.id} className="hover:bg-slate-700/20 transition-colors group">
                    <td className="p-4 text-slate-400 text-sm font-mono">{formatUniversalId(student.loginRollNumber) || student.id}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-sky-400 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                          {student.name ? student.name.split(' ').map((n: string) => n[0]).join('') : '?'}
                        </div>
                        <span className="font-medium text-slate-200">{student.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-400 text-sm">{student.className || 'N/A'}</td>
                    <td className="p-4 text-slate-400 text-sm">{student.sectionName || 'Main'}</td>
                    <td className="p-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                        (student.status || 'Enrolled') === 'Enrolled' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {student.status || 'Enrolled'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button type="button" onClick={() => openProfile(student)} className="text-slate-400 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors">
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
