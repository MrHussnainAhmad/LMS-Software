import { ToastBridge } from '@/components/ui/toaster';
import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Download, X } from 'lucide-react';
import Login from './views/Login';
import DashboardLayout from './views/DashboardLayout';
import ChangePassword from './views/ChangePassword';
import { WorkspaceProvider } from './components/WorkspaceProvider';
const Dashboard = React.lazy(() => import('./views/Dashboard'));
const Campuses = React.lazy(() => import('./views/CampusWorkspaces'));
const TeacherPerformance = React.lazy(() => import('./views/TeacherPerformance'));
const PromotionReview = React.lazy(() => import('./views/PromotionReview'));
const Staff = React.lazy(() => import('./views/Staff'));
const Students = React.lazy(() => import('./views/Students'));
const Attendance = React.lazy(() => import('./views/AttendanceEditor'));
const Results = React.lazy(() => import('./views/Results'));
const DailyDiary = React.lazy(() => import('./views/DailyDiary'));
const AutoPromotion = React.lazy(() => import('./views/AutoPromotion'));
const IdCard = React.lazy(() => import('./views/IdCard'));
const Leaves = React.lazy(() => import('./views/Leaves'));
const Timetable = React.lazy(() => import('./views/Timetable'));
const Admin = React.lazy(() => import('./views/Admin'));
const Exams = React.lazy(() => import('./views/Exams'));
const Announcements = React.lazy(() => import('./views/Announcements'));
const HelpDesk = React.lazy(() => import('./views/HelpDesk'));
const Settings = React.lazy(() => import('./views/Settings'));
const Admissions = React.lazy(() => import('./views/Admissions'));
const PublicWebsite = React.lazy(() => import('./views/PublicWebsite'));
const Fees = React.lazy(() => import('./views/Fees'));
const Academics = React.lazy(() => import('./views/Academics'));
const Courses = React.lazy(() => import('./views/Courses'));
const Holidays = React.lazy(() => import('./views/Holidays'));
const PublicEvents = React.lazy(() => import('./views/PublicEvents'));
import { AuthenticatedFiles } from './components/AuthenticatedFiles';
import { FeedbackProvider } from './ui/Feedback';

type UpdateInfo = {
  currentVersion: string;
  latestVersion: string;
};

export default function App() {
  const [bootChecked, setBootChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean>(Boolean(localStorage.getItem('nisaab_token')));
  const [passwordRequired, setPasswordRequired] = useState(localStorage.getItem('password_change_required') === '1');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let mounted = true;
    async function checkStartupState() {
      try {
        const startup = await window.electronAPI?.app?.startupState?.();
        if (startup?.shouldResetSession) {
          localStorage.removeItem('nisaab_token');
          localStorage.removeItem('nisaab_refresh_token');
          localStorage.removeItem('selected_campus_id');
        }
      } catch {
        // Ignore startup-state failures and continue boot.
      } finally {
        if (mounted) {
          setIsAuthed(Boolean(localStorage.getItem('nisaab_token')));
          setBootChecked(true);
        }
      }
    }
    checkStartupState();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function checkForUpdate() {
      try {
        const result = await window.electronAPI?.app?.checkUpdate?.();
        if (active && result?.updateAvailable && result.latestVersion) {
          setUpdateInfo({
            currentVersion: result.currentVersion,
            latestVersion: result.latestVersion,
          });
        }
      } catch {
        // Update availability must never block or interrupt app startup.
      }
    }
    checkForUpdate();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const refreshAuth = () => { setIsAuthed(Boolean(localStorage.getItem('nisaab_token'))); setPasswordRequired(localStorage.getItem('password_change_required') === '1'); };
    window.addEventListener('auth-changed', refreshAuth as EventListener);
    window.addEventListener('hashchange', refreshAuth);
    return () => {
      window.removeEventListener('auth-changed', refreshAuth as EventListener);
      window.removeEventListener('hashchange', refreshAuth);
    };
  }, []);

  const rootRedirect = useMemo(() => (isAuthed ? '/dashboard' : '/login'), [isAuthed]);

  if (!bootChecked) return null;

  return (
    <FeedbackProvider>
      <HashRouter>
      <AuthenticatedFiles /><ToastBridge />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/login" element={isAuthed ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/change-password" element={isAuthed ? <ChangePassword /> : <Navigate to="/login" replace />} />
          
          <Route element={isAuthed ? passwordRequired ? <Navigate to="/change-password" replace /> : <WorkspaceProvider><DashboardLayout /></WorkspaceProvider> : <Navigate to="/login" replace />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/campuses" element={<Campuses />} />
            <Route path="/staff/:id/performance" element={<TeacherPerformance />} />
            <Route path="/promotion/:id" element={<PromotionReview />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/students" element={<Students />} />
            <Route path="/academics" element={<Academics />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/admissions" element={<Admissions />} />
            <Route path="/fees" element={<Fees />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/results" element={<Results />} />
            
            <Route path="/diary" element={<DailyDiary />} />
            <Route path="/promotion" element={<AutoPromotion />} />
            <Route path="/id-card" element={<IdCard />} />
            <Route path="/leaves" element={<Leaves />} />
            <Route path="/timetable" element={<Timetable />} />
            
            <Route path="/admin" element={<Admin />} />
            <Route path="/exams" element={<Exams />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/helpdesk" element={<HelpDesk />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/public-website" element={<PublicWebsite />} />
            <Route path="/holidays" element={<Holidays />} />
            <Route path="/public-events" element={<PublicEvents />} />
          </Route>

          <Route path="*" element={<Navigate to={rootRedirect} replace />} />
        </Routes>
      </Suspense>

      {updateInfo && (
        <div className="update-notice" role="dialog" aria-labelledby="update-notice-title" aria-describedby="update-notice-description">
          <button type="button" className="update-notice-close" aria-label="Dismiss update" onClick={() => setUpdateInfo(null)}>
            <X size={16} />
          </button>
          <div className="update-notice-icon"><Download size={18} /></div>
          <div className="update-notice-copy">
            <p id="update-notice-title">A new version is available</p>
            <span id="update-notice-description">
              Nisaab360 {updateInfo.latestVersion} is ready. You’re currently using {updateInfo.currentVersion}.
            </span>
          </div>
          <div className="update-notice-actions">
            <button type="button" onClick={() => setUpdateInfo(null)}>Cancel</button>
            <button
              type="button"
              className="update-notice-primary"
              onClick={async () => {
                await window.electronAPI?.app?.openUpdate?.();
                setUpdateInfo(null);
              }}
            >
              Update
            </button>
          </div>
        </div>
      )}
      </HashRouter>
    </FeedbackProvider>
  );
}
