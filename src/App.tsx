import { useEffect, useMemo, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Download, X } from 'lucide-react';
import Login from './views/Login';
import DashboardLayout from './views/DashboardLayout';
import Dashboard from './views/Dashboard';
import Campuses from './views/Campuses';
import Staff from './views/Staff';
import Students from './views/Students';
import Attendance from './views/Attendance';
import Results from './views/Results';

// New modules
import DailyDiary from './views/DailyDiary';
import AutoPromotion from './views/AutoPromotion';
import IdCard from './views/IdCard';
import Leaves from './views/Leaves';
import Timetable from './views/Timetable';
import Admin from './views/Admin';
import Exams from './views/Exams';
import Announcements from './views/Announcements';
import HelpDesk from './views/HelpDesk';
import Settings from './views/Settings';

type UpdateInfo = {
  currentVersion: string;
  latestVersion: string;
};

export default function App() {
  const [bootChecked, setBootChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean>(Boolean(localStorage.getItem('nisaab_token')));
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let mounted = true;
    async function checkStartupState() {
      try {
        const startup = await window.electronAPI?.app?.startupState?.();
        if (startup?.shouldResetSession) {
          localStorage.removeItem('nisaab_token');
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
    const refreshAuth = () => setIsAuthed(Boolean(localStorage.getItem('nisaab_token')));
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
    <HashRouter>
      <Routes>
        <Route path="/login" element={isAuthed ? <Navigate to="/dashboard" replace /> : <Login />} />
        
        <Route element={isAuthed ? <DashboardLayout /> : <Navigate to="/login" replace />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/campuses" element={<Campuses />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/students" element={<Students />} />
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
        </Route>

        <Route path="*" element={<Navigate to={rootRedirect} replace />} />
      </Routes>

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
  );
}
