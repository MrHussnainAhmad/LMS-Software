import { liveFetch } from '../utils/live-fetch';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Lock,
  Download,
  AlertTriangle,
  Key,
  Users,
  BookOpen,
  Trash2,
  Plus,
  Copy,
  ShieldAlert,
  Globe2,
  ArrowRight,
} from 'lucide-react';
import { api, API_ORIGIN, BASE_URL, getAuthToken } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';
import Modal from '../ui/Modal';
import { PageHead } from '../ui/Bits';
import { useConfirm, useToast } from '../ui/Feedback';
import { IMAGE_FILE_ACCEPT, prepareImageUpload } from '../utils/upload-file';
import CourseStreamingSettings from '../components/CourseStreamingSettings';
import GoogleDriveBackupSettings from '../components/GoogleDriveBackupSettings';
import { PaymentAccountsSettings } from '@/components/PaymentAccountsSettings';
import { InstitutionRestoreRequests } from '@/components/InstitutionRestoreRequests';
import { CampusIdentity } from '../components/WorkspaceProvider';

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <details className="card" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="card-pad" style={{ cursor: 'pointer', fontWeight: 600 }}>{title}</summary>
    {open && <div className="card-pad">{children}</div>}
  </details>;
}

interface Profile {
  name: string;
  type: string;
  username: string;
  registrationNumber: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  country: string;
  logoKey?: string;
  signatureKey?: string;
  allowGraduatedStudentAccess: boolean;
}

interface Grade { letter: string; min: number; max: number }

interface Role {
  id: number;
  name: string;
  permissions: string[];
}

function normalizeImageUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) return value;
  if (value.startsWith('/')) return `${API_ORIGIN}${value}`;
  return `${API_ORIGIN}/${value}`;
}

export default function Settings() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Settings States
  const [gradAccess, setGradAccess] = useState(false);
  const [savingGrad, setSavingGrad] = useState(false);

  // Grading States
  const [passingPercentage, setPassingPercentage] = useState(40);
  const [grades, setGrades] = useState<Grade[]>([{ letter: 'A+', min: 90, max: 100 }, { letter: 'A', min: 80, max: 89 }]);
  const [savingGrades, setSavingGrades] = useState(false);

  // Password Reset States
  const [resetForm, setResetForm] = useState({ userType: 'STUDENT', identifier: '' });
  const [resetting, setResetting] = useState(false);
  /* A reset password is shown once, in a dialog the admin dismisses on purpose —
     never in a toast that can slide away while they reach for a pen. */
  const [resetResult, setResetResult] = useState<{ name: string; password: string } | null>(null);

  // Roles States
  const [roles, setRoles] = useState<Role[]>([]);
  // Upload States
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  // Staff roles UI state
  const PERMISSIONS = [
    { key: "students.read", label: "View student records" },
    { key: "students.manage", label: "Manage student records" },
    { key: "exams.read", label: "View exams and timetables" },
    { key: "exams.manage", label: "Create and manage exams" },
    { key: "marks.manage", label: "Enter and manage marks" },
    { key: "attendance.manage", label: "Manage attendance" },
    { key: "announcements.manage", label: "Send announcements" },
    { key: "staff.read", label: "View staff directory" },
    { key: "staff.manage", label: "Manage staff accounts" },
    { key: "settings.manage", label: "Manage institution settings" },
  ];
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', permissions: [] as string[] });
  const [savingRole, setSavingRole] = useState(false);

  // Danger zone
  const [showDelete, setShowDelete] = useState(false);
  const [deleteWord, setDeleteWord] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleFileUpload(file: File, type: 'logo' | 'signature') {
    const setUploading = type === 'logo' ? setUploadingLogo : setUploadingSignature;
    setUploading(true);
    try {
      const preparedFile = await prepareImageUpload(file, 2 * 1024 * 1024);
      const signature = await api.post('/upload/signature');
      const form = new FormData();
      form.append('file', preparedFile);
      form.append('api_key', signature.apiKey);
      form.append('timestamp', String(signature.timestamp));
      form.append('signature', signature.signature);
      if (!signature.folder) throw new Error('Upload folder is missing from the server response');
      form.append('folder', signature.folder);
      form.append('allowed_formats', signature.allowedFormats);
      const response = await liveFetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, { method: 'POST', body: form });
      const uploaded = await response.json();
      if (!response.ok || !uploaded.public_id) throw new Error(uploaded.error?.message || 'Cloudinary rejected the image');
      await api.post('/upload/complete', { publicId: uploaded.public_id, resourceType: uploaded.resource_type, imageOnly: true });
      await api.patch(`/institution/${type}`, { publicId: uploaded.public_id });
      setProfile((current) => current ? { ...current, [type === 'logo' ? 'logoKey' : 'signatureKey']: uploaded.secure_url } : current);
      toast.success(type === 'logo' ? 'Institution logo updated' : 'Principal signature updated');
    } catch (error: any) {
      toast.error(`Could not upload ${type}`, error.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleExport() {
    try {
      const token = getAuthToken();
      const response = await liveFetch(`${BASE_URL}/institution/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error('Failed to export institution data');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'institution_data_export.zip';
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded', 'institution_data_export.zip is in your downloads folder.');
    } catch (err: any) {
      toast.error('Export failed', err.message || 'Failed to export institution data');
    }
  }

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    setSavingRole(true);
    try {
      await api.post('/institution/roles', roleForm);
      const created = roleForm.name;
      setShowRoleModal(false);
      setRoleForm({ name: '', permissions: [] });
      fetchSettings();
      toast.success('Role created', `${created} can now be assigned to staff.`);
    } catch (err: any) {
      toast.error('Could not create the role', err.message || 'Failed to create role');
    } finally {
      setSavingRole(false);
    }
  }

  async function handleDeleteRole(id: number) {
    const role = roles.find((r) => r.id === id);
    const ok = await confirm({
      title: 'Delete this role?',
      body: `${role?.name || 'This role'} is removed. Staff who had it fall back to default permissions.`,
      confirmLabel: 'Delete role',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/institution/roles?id=${id}`);
      fetchSettings();
      toast.info('Role deleted');
    } catch (err: any) {
      toast.error('Could not delete the role', err.message || 'Failed to delete role');
    }
  }


  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const [res, gradingRes, rolesRes] = await Promise.all([
        api.get('/institution/settings'),
        api.get('/institution/settings/grading').catch(() => ({ scale: null })),
        api.get('/institution/roles').catch(() => ({ roles: [] }))
      ]);

      if (res.profile) {
        setProfile(res.profile);
        setGradAccess(res.profile.allowGraduatedStudentAccess);
      }
      if (gradingRes.scale) {
        setPassingPercentage(gradingRes.scale.passingPercentage);
        setGrades(gradingRes.scale.gradesJson);
      }
      if (rolesRes.roles) {
        setRoles(rolesRes.roles);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleGradAccess(checked: boolean) {
    setGradAccess(checked);
    setSavingGrad(true);
    try {
      await api.post('/institution/settings', { action: 'updateGraduatedAccess', allowGraduatedStudentAccess: checked });
      toast.success(checked ? 'Past students can sign in' : 'Past students are locked out');
    } catch (err: any) {
      toast.error('Could not change access', err.message || 'Failed to update access');
      setGradAccess(!checked);
    } finally { setSavingGrad(false); }
  }

  async function handleSaveGrades() {
    setSavingGrades(true);
    try {
      await api.put('/institution/settings/grading', { passingPercentage, gradesJson: grades });
      toast.success('Grading scale saved', `Pass mark ${passingPercentage}% · ${grades.length} grade bands.`);
    } catch (err: any) {
      toast.error('Could not save the grading scale', err.message || 'Failed to save grading scale');
    } finally { setSavingGrades(false); }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetForm.identifier) return;
    setResetting(true);
    try {
      const res = await api.post('/institution/reset-password', resetForm);
      setResetResult({ name: res.name, password: '1234567890' });
      setResetForm({...resetForm, identifier: ''});
    } catch (err: any) {
      toast.error('Could not reset the password', err.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteWord !== 'DELETE') return;
    setDeleting(true);
    try {
      await api.delete('/institution/account', { reason: "Deleted from Desktop App" });
      setShowDelete(false);
      toast.warn('Account deleted', 'The application will now close.');
      window.close(); // Attempt to close electron
    } catch (err: any) {
      toast.error('Could not delete the account', err.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.warn('Copy blocked', 'Select the text and copy it manually.');
    }
  }



  if (loading) {
    return (
      <div className="page">
        <PageSkeleton cards={2} rows={5} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHead
        title="Settings"
        subtitle="Your institution profile, fees, grading, staff roles and the things you only touch once."
      />

      <section className="card card-hover" role="button" tabIndex={0} onClick={() => navigate('/settings/public-website')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate('/settings/public-website'); }} style={{ cursor: 'pointer' }}>
        <div className="card-pad row-between" style={{ gap: 18 }}>
          <div className="row" style={{ gap: 14 }}>
            <span className="metric-icon" style={{ width: 42, height: 42 }}><Globe2 /></span>
            <span className="cell-stack"><b>Public website</b><span>Edit the institution homepage, programs, photographs, contact details, and public links.</span></span>
          </div>
          <ArrowRight style={{ width: 18, color: 'var(--ink-3)', flexShrink: 0 }} />
        </div>
      </section>

      <CampusIdentity />
      <SettingsSection title="Payment accounts"><PaymentAccountsSettings /></SettingsSection>
      <SettingsSection title="Restore requests"><InstitutionRestoreRequests /></SettingsSection>
      <SettingsSection title="Video streaming"><CourseStreamingSettings /></SettingsSection>

      <div className="cols-2">
        {/* ---------------------------------------------------------------- */}
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <div className="card-head-copy">
                <h2 className="card-title">
                  <Building2 aria-hidden="true" />
                  Institution profile
                </h2>
                <p className="card-sub">Printed on ID cards, report cards and vouchers.</p>
              </div>
            </div>
            {profile && (
              <div className="card-pad stack" style={{ gap: 18 }}>
                <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <label
                    title="Change logo"
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: 'var(--r-lg)',
                      border: '1px solid var(--line)',
                      background: 'var(--sunken, #FAF9F6)',
                      display: 'grid',
                      placeItems: 'center',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {profile.logoKey ? (
                      <img
                        src={normalizeImageUrl(profile.logoKey)!}
                        alt="Institution logo"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <Building2 style={{ width: 28, height: 28, color: 'var(--ink-4)' }} aria-hidden="true" />
                    )}
                    <input
                      type="file"
                      accept={IMAGE_FILE_ACCEPT}
                      style={{ display: 'none' }}
                      onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'logo')}
                      disabled={uploadingLogo}
                    />
                  </label>

                  <div className="stack" style={{ gap: 6, minWidth: 0, flex: '1 1 200px' }}>
                    <b style={{ fontSize: '1.0625rem', fontWeight: 650 }}>{profile.name}</b>
                    <span className="mono" style={{ color: 'var(--ink-3)', fontSize: '0.75rem' }}>
                      {profile.username}
                    </span>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <span className="chip chip-brand">{profile.type}</span>
                      <span className="chip chip-mute">Reg {profile.registrationNumber}</span>
                    </div>
                  </div>
                </div>

                <div className="grid-cards" style={{ gap: 10 }}>
                  <div className="secret" style={{ display: 'block' }}>
                    <span className="secret-label" style={{ marginBottom: 4 }}>Email</span>
                    <span style={{ fontSize: '0.8125rem' }}>{profile.contactEmail || '—'}</span>
                  </div>
                  <div className="secret" style={{ display: 'block' }}>
                    <span className="secret-label" style={{ marginBottom: 4 }}>Phone</span>
                    <span style={{ fontSize: '0.8125rem' }}>{profile.contactPhone || '—'}</span>
                  </div>
                  <div className="secret" style={{ display: 'block' }}>
                    <span className="secret-label" style={{ marginBottom: 4 }}>Location</span>
                    <span style={{ fontSize: '0.8125rem' }}>
                      {[profile.address, profile.city, profile.country].filter(Boolean).join(', ') || '—'}
                    </span>
                  </div>
                </div>

                <div className="stack" style={{ gap: 8 }}>
                  <span className="label">Principal signature</span>
                  <label
                    title="Upload signature"
                    style={{
                      height: 76,
                      width: 200,
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--line)',
                      background: '#fff',
                      display: 'grid',
                      placeItems: 'center',
                      overflow: 'hidden',
                      cursor: 'pointer',
                    }}
                  >
                    {profile.signatureKey ? (
                      <img
                        src={normalizeImageUrl(profile.signatureKey)!}
                        alt="Principal signature"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
                      />
                    ) : (
                      <span style={{ color: 'var(--ink-4)', fontSize: '0.75rem' }}>No signature yet</span>
                    )}
                    <input
                      type="file"
                      accept={IMAGE_FILE_ACCEPT}
                      style={{ display: 'none' }}
                      onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'signature')}
                      disabled={uploadingSignature}
                    />
                  </label>
                </div>
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-head-copy">
                <h2 className="card-title">
                  <BookOpen aria-hidden="true" />
                  Grading scale
                </h2>
                <p className="card-sub">Applied to every result card the moment marks are published.</p>
              </div>
            </div>
            <div className="card-pad stack" style={{ gap: 16 }}>
              <label className="field" style={{ maxWidth: 160 }}>
                <span className="label">Pass mark (%)</span>
                <input
                  type="number" min="0" max="100"
                  className="input"
                  value={passingPercentage}
                  onChange={e => setPassingPercentage(parseInt(e.target.value) || 0)}
                />
              </label>

              <div className="stack" style={{ gap: 8 }}>
                <span className="label">Grade bands</span>
                {(grades || []).map((grade, index) => (
                  <div className="row" key={index} style={{ gap: 8 }}>
                    <input
                      className="input input-sm"
                      style={{ width: 78 }}
                      placeholder="A+"
                      aria-label="Grade letter"
                      value={grade.letter}
                      onChange={e => setGrades(grades.map((g, i) => i === index ? { ...g, letter: e.target.value } : g))}
                    />
                    <input
                      className="input input-sm"
                      style={{ width: 76 }}
                      type="number"
                      placeholder="Min"
                      aria-label="Minimum percent"
                      value={grade.min}
                      onChange={e => setGrades(grades.map((g, i) => i === index ? { ...g, min: Number(e.target.value) } : g))}
                    />
                    <span style={{ color: 'var(--ink-4)' }}>–</span>
                    <input
                      className="input input-sm"
                      style={{ width: 76 }}
                      type="number"
                      placeholder="Max"
                      aria-label="Maximum percent"
                      value={grade.max}
                      onChange={e => setGrades(grades.map((g, i) => i === index ? { ...g, max: Number(e.target.value) } : g))}
                    />
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      aria-label={`Remove grade ${grade.letter || index + 1}`}
                      onClick={() => setGrades(grades.filter((_, i) => i !== index))}
                    >
                      <Trash2 />
                    </button>
                  </div>
                ))}
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setGrades([...grades, { letter: '', min: 0, max: 100 }])}
                  >
                    <Plus />
                    Add a band
                  </button>
                </div>
              </div>

              <div className="row">
                <button type="button" className="btn btn-primary" onClick={handleSaveGrades} disabled={savingGrades}>
                  {savingGrades ? 'Saving…' : 'Save grading scale'}
                </button>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-head-copy">
                <h2 className="card-title">
                  <Users aria-hidden="true" />
                  Staff roles
                </h2>
                <p className="card-sub">Decide what each kind of staff member can reach.</p>
              </div>
              <div className="card-tools">
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShowRoleModal(true)}>
                  <Plus />
                  New role
                </button>
              </div>
            </div>
            {!(roles && roles.length > 0) ? (
              <p className="card-pad" style={{ color: 'var(--ink-3)', fontSize: '0.8125rem' }}>
                No custom roles yet — staff use the default permissions for their designation.
              </p>
            ) : (
              <div>
                {roles.map(role => (
                  <div className="list-row" key={role.id}>
                    <span className="cell-stack" style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <b>{role.name}</b>
                      <span>
                        {role.permissions.length} {role.permissions.length === 1 ? 'permission' : 'permissions'}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      aria-label={`Delete ${role.name}`}
                      onClick={() => handleDeleteRole(role.id)}
                    >
                      <Trash2 />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ---------------------------------------------------------------- */}
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <div className="card-head-copy">
                <h2 className="card-title">
                  <Key aria-hidden="true" />
                  Reset someone&rsquo;s password
                </h2>
                <p className="card-sub">For the student or teacher standing at your desk who cannot sign in.</p>
              </div>
            </div>
            <form onSubmit={handlePasswordReset} className="card-pad stack" style={{ gap: 14 }}>
              <label className="field">
                <span className="label">Account type</span>
                <select
                  className="select"
                  value={resetForm.userType}
                  onChange={e => setResetForm({...resetForm, userType: e.target.value})}
                >
                  <option value="STUDENT">Student</option>
                  <option value="STAFF">Staff member</option>
                </select>
              </label>
              <label className="field">
                <span className="label">
                  {resetForm.userType === 'STUDENT' ? 'Student roll number' : 'Staff email address'}
                </span>
                <input
                  type={resetForm.userType === 'STUDENT' ? 'text' : 'email'} required
                  className="input"
                  value={resetForm.identifier}
                  onChange={e => setResetForm({...resetForm, identifier: e.target.value})}
                  placeholder={resetForm.userType === 'STUDENT' ? 'e.g. ROLL-123' : 'staff@school.com'}
                />
                <span className="field-hint">
                  They get a temporary password you read out once — it is not emailed.
                </span>
              </label>
              <button type="submit" className="btn btn-warn btn-block" disabled={resetting}>
                {resetting ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-head-copy">
                <h2 className="card-title">
                  <Lock aria-hidden="true" />
                  Past students
                </h2>
                <p className="card-sub">Graduated and left students, after their final term.</p>
              </div>
            </div>
            <label className="list-row" style={{ margin: 0, cursor: 'pointer', gap: 12 }}>
              <input
                type="checkbox"
                id="gradAccess"
                checked={gradAccess}
                onChange={e => handleToggleGradAccess(e.target.checked)}
                disabled={savingGrad}
              />
              <span className="cell-stack">
                <b>Let them keep signing in</b>
                <span>They can read their old results and attendance, but nothing new.</span>
              </span>
            </label>
          </section>
          <section className="card">
            <div className="card-head">
              <div className="card-head-copy">
                <h2 className="card-title">
                  <Lock aria-hidden="true" />
                  Your own password
                </h2>
              </div>
            </div>
            <p className="card-pad" style={{ color: 'var(--ink-3)', fontSize: '0.8125rem' }}>
              <button className="btn btn-quiet" onClick={() => navigate('/change-password')}>Change your password</button>
            </p>
          </section>

          <SettingsSection title="Google Drive backup"><GoogleDriveBackupSettings /></SettingsSection>

          <section className="card">
            <div className="card-head">
              <div className="card-head-copy">
                <h2 className="card-title">
                  <Download aria-hidden="true" />
                  Your data
                </h2>
                <p className="card-sub">Everything the institution holds, in one archive.</p>
              </div>
            </div>
            <div className="card-pad">
              <button type="button" className="btn btn-quiet btn-block" onClick={handleExport}>
                <Download />
                Download everything (.zip)
              </button>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-head-copy">
                <h2 className="card-title" style={{ color: 'var(--bad)' }}>
                  <ShieldAlert aria-hidden="true" />
                  Danger zone
                </h2>
              </div>
            </div>
            <div className="card-pad stack" style={{ gap: 14 }}>
              <div className="alert alert-bad">
                <AlertTriangle aria-hidden="true" />
                <div>
                  Deleting the institution destroys every student record, staff account and result. There is no undo and
                  no backup on our side — export your data first.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-danger btn-block"
                onClick={() => { setDeleteWord(''); setShowDelete(true); }}
              >
                <Trash2 />
                Delete institution account
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Role builder ------------------------------------------------------ */}
      <Modal
        open={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title="Create a staff role"
        description="Tick only what this role genuinely needs — it is easier to add later than to take away."
        size="md"
        scrollBody
        onSubmit={handleCreateRole}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setShowRoleModal(false)}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingRole || !roleForm.name || roleForm.permissions.length === 0}
            >
              {savingRole ? 'Creating…' : 'Create role'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <label className="field">
            <span className="label">Role name</span>
            <input
              required
              type="text"
              className="input"
              value={roleForm.name}
              onChange={e => setRoleForm({...roleForm, name: e.target.value})}
              placeholder="e.g. Senior Teacher"
            />
          </label>

          <div className="field">
            <div className="row-between">
              <span className="label">Permissions</span>
              <span style={{ color: 'var(--ink-4)', fontSize: '0.75rem' }}>
                {roleForm.permissions.length} of {PERMISSIONS.length}
              </span>
            </div>
            <div className="form-grid form-grid-2">
              {PERMISSIONS.map(p => (
                <label
                  key={p.key}
                  className="row"
                  style={{
                    gap: 9,
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-md)',
                    background: 'var(--sunken, #FAF9F6)',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    lineHeight: 1.4,
                  }}
                >
                  <input
                    type="checkbox"
                    style={{ marginTop: 2 }}
                    checked={roleForm.permissions.includes(p.key)}
                    onChange={(e) => {
                      const newPerms = e.target.checked
                        ? [...roleForm.permissions, p.key]
                        : roleForm.permissions.filter(k => k !== p.key);
                      setRoleForm({...roleForm, permissions: newPerms});
                    }}
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Reset reveal ------------------------------------------------------ */}
      <Modal
        open={Boolean(resetResult)}
        onClose={() => setResetResult(null)}
        title="Password reset"
        description={resetResult ? `${resetResult.name} can sign in with this temporary password.` : undefined}
        size="sm"
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setResetResult(null)}>
            Done
          </button>
        }
      >
        {resetResult && (
          <div className="stack" style={{ gap: 12 }}>
            <div className="secret">
              <div className="stack" style={{ gap: 3, minWidth: 0 }}>
                <span className="secret-label">Temporary password</span>
                <span className="mono">{resetResult.password}</span>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label="Copy password"
                onClick={() => copyValue(resetResult.password, 'Password')}
              >
                <Copy />
              </button>
            </div>
            <p className="prose-note">
              Ask them to change it the first time they sign in. Anyone who knows this password can read their records.
            </p>
          </div>
        )}
      </Modal>

      {/* Delete institution ----------------------------------------------- */}
      <Modal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title="Delete this institution?"
        description="Every student, teacher, mark and attendance record goes with it. This cannot be undone."
        size="sm"
        onSubmit={(e) => { e.preventDefault(); handleDeleteAccount(); }}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setShowDelete(false)}>
              Keep my institution
            </button>
            <button type="submit" className="btn btn-danger" disabled={deleteWord !== 'DELETE' || deleting}>
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </button>
          </>
        }
      >
        <div className="stack" style={{ gap: 12 }}>
          <div className="alert alert-bad">
            <AlertTriangle aria-hidden="true" />
            <div>The app will close as soon as the account is gone.</div>
          </div>
          <label className="field">
            <span className="label">Type DELETE to confirm</span>
            <input
              className="input mono"
              value={deleteWord}
              onChange={(e) => setDeleteWord(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
