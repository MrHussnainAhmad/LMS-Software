import React, { useEffect, useState } from 'react';
import { Building2, Shield, Settings as SettingsIcon, CreditCard, Lock, Download, AlertTriangle, Key, Users, BookOpen, Trash2 } from 'lucide-react';
import { api, BASE_URL, getAuthToken } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';
import { createPortal } from 'react-dom';

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
  acceptFeeVouchers: boolean;
  feeVoucherOpenDay: number | null;
  feeVoucherLateDay: number | null;
  feeVoucherLateFee: number | null;
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
  if (value.startsWith('/')) return `https://nisaab360.app${value}`;
  return `https://nisaab360.app/${value}`;
}

export default function Settings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Settings States
  const [feeForm, setFeeForm] = useState({ acceptFeeVouchers: false, openDay: 1, lateDay: 10, lateFee: 500 });
  const [gradAccess, setGradAccess] = useState(false);
  const [savingFee, setSavingFee] = useState(false);
  const [savingGrad, setSavingGrad] = useState(false);

  // Grading States
  const [passingPercentage, setPassingPercentage] = useState(40);
  const [grades, setGrades] = useState<Grade[]>([{ letter: 'A+', min: 90, max: 100 }, { letter: 'A', min: 80, max: 89 }]);
  const [savingGrades, setSavingGrades] = useState(false);

  // Password Reset States
  const [resetForm, setResetForm] = useState({ userType: 'STUDENT', identifier: '' });
  const [resetting, setResetting] = useState(false);

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

  async function handleFileUpload(file: File, type: 'logo' | 'signature') {
    void file;
    void type;
    alert('Logo/signature upload is not wired yet in this desktop panel.');
  }

  async function handleExport() {
    try {
      const token = getAuthToken();
      const response = await fetch(`${BASE_URL}/institution/export`, {
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
    } catch (err: any) {
      alert(err.message || 'Failed to export institution data');
    }
  }

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    setSavingRole(true);
    try {
      await api.post('/institution/roles', roleForm);
      setShowRoleModal(false);
      setRoleForm({ name: '', permissions: [] });
      fetchSettings();
    } catch (err: any) {
      alert(err.message || 'Failed to create role');
    } finally {
      setSavingRole(false);
    }
  }

  async function handleDeleteRole(id: number) {
    if (!confirm('Delete this role?')) return;
    try {
      await api.delete(`/institution/roles?id=${id}`);
      fetchSettings();
    } catch (err: any) {
      alert(err.message || 'Failed to delete role');
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
        setFeeForm({
          acceptFeeVouchers: res.profile.acceptFeeVouchers,
          openDay: res.profile.feeVoucherOpenDay || 1,
          lateDay: res.profile.feeVoucherLateDay || 10,
          lateFee: res.profile.feeVoucherLateFee || 500
        });
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

  async function handleSaveFee(e: React.FormEvent) {
    e.preventDefault();
    setSavingFee(true);
    try {
      await api.post('/institution/settings', { action: 'updateFeeVouchers', ...feeForm });
      alert('Fee settings updated successfully');
    } catch (err: any) { alert(err.message || 'Failed to update fee settings'); } 
    finally { setSavingFee(false); }
  }

  async function handleToggleGradAccess(checked: boolean) {
    setGradAccess(checked);
    setSavingGrad(true);
    try {
      await api.post('/institution/settings', { action: 'updateGraduatedAccess', allowGraduatedStudentAccess: checked });
    } catch (err: any) {
      alert(err.message || 'Failed to update access');
      setGradAccess(!checked); 
    } finally { setSavingGrad(false); }
  }

  async function handleSaveGrades() {
    setSavingGrades(true);
    try {
      await api.put('/institution/settings/grading', { passingPercentage, gradesJson: grades });
      alert('Grading scale saved successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to save grading scale');
    } finally { setSavingGrades(false); }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetForm.identifier) return;
    setResetting(true);
    try {
      const res = await api.post('/institution/reset-password', resetForm);
      alert(`Password reset successfully for ${res.name}. New temporary password is: 1234567890`);
      setResetForm({...resetForm, identifier: ''});
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  }

  async function handleDeleteAccount() {
    const promptStr = prompt("Type 'DELETE' to confirm irreversible deletion of this institution and all data.");
    if (promptStr !== 'DELETE') return;
    try {
      await api.delete('/institution/account', { reason: "Deleted from Desktop App" });
      alert("Account deleted. The application will now exit.");
      window.close(); // Attempt to close electron
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
    }
  }

  if (loading) {
    return (
      <PageSkeleton cards={2} rows={5} />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your institution profile, academics, roles, and security.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column */}
        <div className="space-y-6">
          
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl">
            <div className="border-b border-slate-700/50 p-4 bg-slate-800/30">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" /> Institution Profile
              </h2>
            </div>
            {profile && (
              <div className="p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-700 relative flex items-center justify-center">
                        {profile.logoKey ? (
                          <img src={normalizeImageUrl(profile.logoKey)!} alt="Logo" className="settings-brand-image w-full h-full object-contain" />
                        ) : (
                          <Building2 className="w-10 h-10 text-slate-600" />
                        )}
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          <span className="text-xs font-medium text-white">{uploadingLogo ? '...' : 'Change'}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'logo')} disabled={uploadingLogo} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{profile.name}</h3>
                      <p className="text-sm text-slate-400 font-mono mt-1">{profile.username}</p>
                      <span className="inline-block mt-2 text-xs px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded-md border border-indigo-500/30">
                        {profile.type}
                      </span>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm text-slate-300">{profile.contactEmail}</p>
                    <p className="text-sm text-slate-300">{profile.contactPhone}</p>
                    <p className="text-xs text-slate-500 mt-2">Reg: {profile.registrationNumber}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700/50">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Location</label>
                    <p className="mt-1 text-sm text-slate-300">{profile.address}, {profile.city}, {profile.country}</p>
                  </div>
                  <div className="col-span-2 mt-2">
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Principal Signature</label>
                    <div className="relative group inline-block">
                      <div className="h-20 w-48 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden relative">
                        {profile.signatureKey ? (
                          <img src={normalizeImageUrl(profile.signatureKey)!} alt="Signature" className="settings-signature-image w-full h-full object-contain p-2 bg-white" />
                        ) : (
                          <span className="text-sm text-slate-600">No signature</span>
                        )}
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          <span className="text-xs font-medium text-white">{uploadingSignature ? '...' : 'Upload Signature'}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'signature')} disabled={uploadingSignature} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
            <div className="border-b border-slate-700/50 p-4 bg-slate-800/30">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-400" /> Fee & Finance Features
              </h2>
            </div>
            <div className="p-6">
              <form onSubmit={handleSaveFee} className="space-y-4">
                <div className="flex items-center gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                  <input
                    type="checkbox"
                    id="acceptFeeVouchers"
                    checked={feeForm.acceptFeeVouchers}
                    onChange={e => setFeeForm({...feeForm, acceptFeeVouchers: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
                  />
                  <div>
                    <label htmlFor="acceptFeeVouchers" className="font-medium text-white">Enable Automated Fee Vouchers</label>
                    <p className="text-sm text-slate-400">Generate monthly fee vouchers for all students automatically.</p>
                  </div>
                </div>

                {feeForm.acceptFeeVouchers && (
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Issue Day</label>
                      <input
                        type="number" min="1" max="28"
                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                        value={feeForm.openDay}
                        onChange={e => setFeeForm({...feeForm, openDay: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Due Day</label>
                      <input
                        type="number" min="1" max="28"
                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                        value={feeForm.lateDay}
                        onChange={e => setFeeForm({...feeForm, lateDay: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Late Fine</label>
                      <input
                        type="number" min="0"
                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                        value={feeForm.lateFee}
                        onChange={e => setFeeForm({...feeForm, lateFee: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                )}
                
                <div className="pt-2">
                  <button type="submit" disabled={savingFee} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors w-full sm:w-auto">
                    {savingFee ? 'Saving...' : 'Save Finance Settings'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
            <div className="border-b border-slate-700/50 p-4 bg-slate-800/30">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" /> Grading Scale
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Passing Percentage</label>
                <input
                  type="number" min="0" max="100"
                  className="w-32 bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                  value={passingPercentage}
                  onChange={e => setPassingPercentage(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-400">Grade Ranges</p>
                {grades.map((grade, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input className="w-24 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-1.5 text-white" placeholder="Grade" value={grade.letter} onChange={e => setGrades(grades.map((g, i) => i === index ? { ...g, letter: e.target.value } : g))} />
                    <input className="w-20 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-1.5 text-white" type="number" placeholder="Min" value={grade.min} onChange={e => setGrades(grades.map((g, i) => i === index ? { ...g, min: Number(e.target.value) } : g))} />
                    <span className="text-slate-500">-</span>
                    <input className="w-20 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-1.5 text-white" type="number" placeholder="Max" value={grade.max} onChange={e => setGrades(grades.map((g, i) => i === index ? { ...g, max: Number(e.target.value) } : g))} />
                    <button className="text-red-400 text-sm hover:text-red-300 ml-2" onClick={() => setGrades(grades.filter((_, i) => i !== index))}>Remove</button>
                  </div>
                ))}
                <button className="text-indigo-400 text-sm hover:text-indigo-300 font-medium mt-2 block" onClick={() => setGrades([...grades, { letter: '', min: 0, max: 100 }])}>
                  + Add Grade Range
                </button>
              </div>
              <button onClick={handleSaveGrades} disabled={savingGrades} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors">
                {savingGrades ? 'Saving...' : 'Save Grading Scale'}
              </button>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
            <div className="border-b border-slate-700/50 p-4 bg-slate-800/30 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" /> Staff Roles
              </h2>
              <button onClick={() => setShowRoleModal(true)} className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                + New Role
              </button>
            </div>
            <div className="p-6">
              {roles.length === 0 ? (
                <p className="text-slate-400 text-sm">No custom roles defined. Staff will use default permissions.</p>
              ) : (
                <div className="space-y-3">
                  {roles.map(role => (
                    <div key={role.id} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 group">
                      <div>
                        <h3 className="text-white font-medium">{role.name}</h3>
                        <p className="text-xs text-slate-400">{role.permissions.length} permissions</p>
                      </div>
                      <button onClick={() => handleDeleteRole(role.id)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Right Column */}
        <div className="space-y-6">
          
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
            <div className="border-b border-slate-700/50 p-4 bg-slate-800/30">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-400" /> Security Settings
              </h2>
            </div>
            <div className="p-6">
              <form className="space-y-4 opacity-50">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Current Password</label>
                  <input type="password" disabled className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">New Password</label>
                  <input type="password" disabled className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2" />
                </div>
                <button type="button" disabled className="bg-slate-700 text-white px-4 py-2 rounded-xl font-medium w-full sm:w-auto">
                  Update Password (Coming Soon)
                </button>
              </form>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
            <div className="border-b border-slate-700/50 p-4 bg-slate-800/30">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-400" /> User Password Reset
              </h2>
            </div>
            <div className="p-6">
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <p className="text-slate-400 text-sm">Force reset a student or staff member's password if they have forgotten it.</p>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">User Type</label>
                  <select 
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                    value={resetForm.userType} onChange={e => setResetForm({...resetForm, userType: e.target.value})}
                  >
                    <option value="STUDENT">Student</option>
                    <option value="STAFF">Staff Member</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    {resetForm.userType === 'STUDENT' ? 'Student Roll Number' : 'Staff Email Address'}
                  </label>
                  <input 
                    type={resetForm.userType === 'STUDENT' ? 'text' : 'email'} required
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white"
                    value={resetForm.identifier} onChange={e => setResetForm({...resetForm, identifier: e.target.value})}
                    placeholder={resetForm.userType === 'STUDENT' ? 'e.g. ROLL-123' : 'staff@school.com'}
                  />
                </div>
                <button type="submit" disabled={resetting} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-medium transition-colors w-full">
                  {resetting ? 'Resetting...' : 'Force Password Reset'}
                </button>
              </form>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
            <div className="border-b border-slate-700/50 p-4 bg-slate-800/30">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-400" /> Graduated Students Access
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="gradAccess"
                  checked={gradAccess}
                  onChange={e => handleToggleGradAccess(e.target.checked)}
                  disabled={savingGrad}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-indigo-500"
                />
                <div>
                  <label htmlFor="gradAccess" className="font-medium text-white">Allow Access</label>
                  <p className="text-sm text-slate-400">If enabled, students who have graduated or left can still login to view their past records.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
            <div className="border-b border-slate-700/50 p-4 bg-slate-800/30">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-indigo-400" /> Data Management
              </h2>
            </div>
            <div className="p-6">
              <button onClick={handleExport} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 w-full justify-center">
                <Download className="w-4 h-4" /> Download All Data (.zip)
              </button>
            </div>
          </div>

          <div className="bg-red-500/10 backdrop-blur-xl border border-red-500/30 rounded-2xl shadow-xl overflow-hidden">
            <div className="border-b border-red-500/30 p-4 bg-red-500/20">
              <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Danger Zone
              </h2>
            </div>
            <div className="p-6">
              <p className="text-red-300 text-sm mb-4">Deleting your institution account is permanent. All student records, staff data, and configurations will be irrecoverably destroyed.</p>
              <button onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 w-full justify-center">
                Delete Institution Account
              </button>
            </div>
          </div>

        </div>
      </div>

      {showRoleModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-700 bg-slate-900/50">
              <h3 className="text-lg font-bold text-white">Create Staff Role</h3>
            </div>
            <form onSubmit={handleCreateRole} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Role Name</label>
                <input required type="text" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white" value={roleForm.name} onChange={e => setRoleForm({...roleForm, name: e.target.value})} placeholder="e.g. Teacher" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">Permissions</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar">
                  {PERMISSIONS.map(p => (
                    <label key={p.key} className="flex items-start gap-2 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 cursor-pointer hover:border-indigo-500/50 transition-colors">
                      <input type="checkbox" className="mt-0.5 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
                        checked={roleForm.permissions.includes(p.key)}
                        onChange={(e) => {
                          const newPerms = e.target.checked
                            ? [...roleForm.permissions, p.key]
                            : roleForm.permissions.filter(k => k !== p.key);
                          setRoleForm({...roleForm, permissions: newPerms});
                        }}
                      />
                      <span className="text-sm text-slate-300 leading-tight">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowRoleModal(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={savingRole || !roleForm.name || roleForm.permissions.length === 0} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-xl font-medium transition-colors">
                  {savingRole ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
