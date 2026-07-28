import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api, getSyncStatus } from '../utils/api';
import productLogo from '../../icon.png';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  GraduationCap, 
  ClipboardCheck, 
  FileText,
  BookOpen,
  ArrowUpCircle,
  IdCard,
  CalendarOff,
  CalendarDays,
  LogOut,
  Settings,
  Search,
  ChevronDown,
  CircleHelp
} from 'lucide-react';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [campuses, setCampuses] = useState<any[]>([]);
  const [selectedCampus, setSelectedCampus] = useState<any>({ id: 'all', name: 'All campuses' });
  const [showCampusDropdown, setShowCampusDropdown] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [staffResults, setStaffResults] = useState<any[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [campusQuery, setCampusQuery] = useState('');
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [browserOnline, setBrowserOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [campusMenuPos, setCampusMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const campusButtonRef = useRef<HTMLButtonElement>(null);
  const campusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchCampuses() {
      try {
        const data = await api.get('/institution/campuses');
        const rows = data?.campuses || [];
        setCampuses(rows);
        const stored = localStorage.getItem('selected_campus_id');
        if (stored && stored !== 'all') {
          const matched = rows.find((c: any) => String(c.id) === stored);
          if (matched) setSelectedCampus(matched);
        }
      } catch (err) {
        console.error(err);
        setCampuses([]);
      }
    }
    fetchCampuses();
  }, []);

  useEffect(() => {
    let active = true;
    async function refreshSyncStatus() {
      const status = await getSyncStatus();
      if (active) setSyncStatus(status);
    }
    refreshSyncStatus();
    const timer = setInterval(refreshSyncStatus, 2000);
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const effectiveOnline = Boolean(syncStatus?.online) && browserOnline;

  useEffect(() => {
    async function ensureSynced() {
      if (!window.electronAPI?.sync?.pull) return;
      const status = await getSyncStatus();
      if (!status?.lastFullPullAt) {
        try {
          await window.electronAPI.sync.pull();
        } catch (err) {
          console.error('Background sync failed:', err);
        }
      }
    }
    ensureSynced();
  }, []);

  useEffect(() => {
    setShowCampusDropdown(false);
    setCampusQuery('');
  }, [location.pathname]);

  useEffect(() => {
    if (!showCampusDropdown) {
      setCampusMenuPos(null);
      return;
    }

    function positionMenu() {
      const button = campusButtonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setCampusMenuPos({
        top: rect.bottom + 8,
        left: rect.right - 288,
        width: 288,
      });
    }

    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (campusButtonRef.current?.contains(target) || campusMenuRef.current?.contains(target)) return;
      setShowCampusDropdown(false);
      setCampusQuery('');
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [showCampusDropdown]);

  function selectCampus(campus: { id: number | string; name: string }) {
    setSelectedCampus(campus);
    localStorage.setItem('selected_campus_id', String(campus.id));
    setShowCampusDropdown(false);
    setCampusQuery('');
  }

  const handleLogout = () => {
    localStorage.removeItem('nisaab_token');
    window.electronAPI?.auth?.clearToken?.();
    window.dispatchEvent(new Event('auth-changed'));
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, group: 'Workspace' },
    { name: 'Admin', path: '/admin', icon: Settings, group: 'Institution' },
    { name: 'Campuses', path: '/campuses', icon: Building2, group: 'Institution' },
    { name: 'Staff', path: '/staff', icon: Users, group: 'Institution' },
    { name: 'Students', path: '/students', icon: GraduationCap, group: 'Institution' },
    { name: 'Daily Diary', path: '/diary', icon: BookOpen, group: 'Academics' },
    { name: 'Attendance', path: '/attendance', icon: ClipboardCheck, group: 'Academics' },
    { name: 'Exams', path: '/exams', icon: FileText, group: 'Academics' },
    { name: 'Results', path: '/results', icon: FileText, group: 'Academics' },
    { name: 'Auto Promotion', path: '/promotion', icon: ArrowUpCircle, group: 'Academics' },
    { name: 'ID Card', path: '/id-card', icon: IdCard, group: 'Operations' },
    { name: 'Leaves', path: '/leaves', icon: CalendarOff, group: 'Operations' },
    { name: 'Timetable', path: '/timetable', icon: CalendarDays, group: 'Operations' },
    { name: 'Announcements', path: '/announcements', icon: ClipboardCheck, group: 'Operations' },
    { name: 'HelpDesk', path: '/helpdesk', icon: Users, group: 'Operations' },
    { name: 'Settings', path: '/settings', icon: Settings, group: 'Operations' },
  ];
  const navigationGroups = ['Workspace', 'Institution', 'Academics', 'Operations'];
  const currentPage = navItems.find((item) => item.path === location.pathname)?.name || 'Workspace';
  const filteredCampuses = campuses.filter((campus) => campus.name?.toLowerCase().includes(campusQuery.toLowerCase()));

  useEffect(() => {
    if (!showSearch) return;
    const q = searchQuery.trim();
    if (!q) {
      setStudentResults([]);
      setStaffResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const campusParam = selectedCampus?.id && selectedCampus.id !== 'all' ? `&campusId=${selectedCampus.id}` : '';
        const [studentsRes, staffRes] = await Promise.all([
          api.get(`/institution/students/picker?q=${encodeURIComponent(q)}&limit=8${campusParam}`).catch(() => ({ students: [] })),
          api.get(`/institution/staff?q=${encodeURIComponent(q)}${campusParam}`).catch(() => ({ staff: [] })),
        ]);
        setStudentResults(studentsRes?.students || []);
        setStaffResults(staffRes?.staff || []);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery, showSearch, selectedCampus]);

  return (
    <div className="app-shell shell-v2 flex h-screen w-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="app-sidebar workspace-rail w-64 bg-slate-800/50 border-r border-slate-700/50 flex flex-col backdrop-blur-xl transition-all">
        {/* Header */}
        <div className="brand-lockup h-16 flex items-center px-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="brand-mark w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <img src={productLogo} alt="Nisaab360" />
            </div>
            <div className="brand-copy"><span className="font-semibold text-white tracking-wide">Nisaab360</span><small>Institution suite</small></div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="rail-navigation flex-1 py-5 px-3 space-y-5 overflow-y-auto custom-scrollbar">
          {navigationGroups.map((group) => (
            <div key={group} className="rail-group">
              <p className="nav-section px-3 mb-2 text-[10px] uppercase tracking-[.14em] font-semibold text-slate-500">{group}</p>
              <div className="space-y-1">
              {navItems.filter((item) => item.group === group).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                    isActive
                      ? 'is-active bg-indigo-500/10 text-indigo-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            );
              })}
              </div>
            </div>
          ))}
        </nav>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-slate-700/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors font-medium text-left"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="workspace-stage flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800/40 via-slate-900 to-slate-950">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-sky-500/10 blur-[100px] pointer-events-none" />
        <header className="workspace-topbar relative z-30">
          <div className="workspace-crumb"><span className="workspace-kicker">Nisaab360 / Institution</span><strong>{currentPage}</strong></div>
          <div className="workspace-actions flex items-center gap-2">
            {syncStatus && (
              <div className="hidden md:flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">
                <span className={`inline-block w-2 h-2 rounded-full ${effectiveOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span>{effectiveOnline ? 'Online' : 'Offline'}</span>
                {syncStatus.pendingCount > 0 && <span>· {syncStatus.pendingCount} pending</span>}
              </div>
            )}
            
            <button aria-label="Search" onClick={() => setShowSearch(true)} className="workspace-icon"><Search className="w-4 h-4" /></button>

            <button aria-label="Help" onClick={() => setShowHelp(true)} className="workspace-icon"><CircleHelp className="w-4 h-4" /></button>
            
            <div className="relative">
              <button
                ref={campusButtonRef}
                type="button"
                onClick={() => setShowCampusDropdown((open) => !open)}
                className="workspace-campus min-w-[140px] justify-between cursor-pointer"
              >
                {selectedCampus.name} <ChevronDown className="w-4 h-4" />
              </button>
              {showCampusDropdown && campusMenuPos && createPortal(
                <div
                  ref={campusMenuRef}
                  style={{ top: campusMenuPos.top, left: Math.max(12, campusMenuPos.left), width: campusMenuPos.width }}
                  className="fixed bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-[9999]"
                >
                  <div className="px-3 pb-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search campus..."
                      value={campusQuery}
                      onChange={(e) => setCampusQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => selectCampus({ id: 'all', name: 'All campuses' })}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${selectedCampus.id === 'all' ? 'text-indigo-600 font-medium' : 'text-slate-700'}`}
                  >
                    All campuses
                  </button>
                  <div className="max-h-72 overflow-y-auto custom-scrollbar">
                    {filteredCampuses.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCampus(c)}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${String(selectedCampus.id) === String(c.id) ? 'text-indigo-600 font-medium' : 'text-slate-700'}`}
                      >
                        {c.name}
                      </button>
                    ))}
                    {filteredCampuses.length === 0 && (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">No campuses found.</div>
                    )}
                  </div>
                </div>,
                document.body
              )}
            </div>
          </div>
        </header>
        
        <div className="app-scroll flex-1 overflow-y-auto relative z-0 custom-scrollbar">
          <div className="app-content p-8">
            <Outlet context={{ selectedCampus }} />
          </div>
        </div>
      </main>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="workspace-modal bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <CircleHelp className="w-6 h-6 text-indigo-400" /> Guide
            </h2>
            <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
              <p>Welcome to the <strong>Nisaab360 Institution Portal</strong>.</p>
              <ul className="list-disc pl-5 space-y-2 text-slate-400">
                <li><strong>Dashboard:</strong> View institution-wide or campus-specific statistics.</li>
                <li><strong>Campuses & Staff:</strong> Manage your institutional hierarchy and employees.</li>
                <li><strong>Search:</strong> Use the search bar in the header to quickly find students by ID or staff by name.</li>
                <li><strong>Filtering:</strong> Use the campus dropdown in the header to filter data across the application.</li>
              </ul>
              <p className="pt-4 border-t border-slate-800">For further assistance, please contact support.</p>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowHelp(false)} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl transition-colors font-medium">Close</button>
            </div>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-24" onClick={() => setShowSearch(false)}>
          <div className="workspace-modal w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search student ID, teacher name..."
                className="flex-1 bg-transparent border-none outline-none text-base text-slate-100"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button onClick={() => setShowSearch(false)} className="text-slate-500 hover:text-slate-200 text-sm">Close</button>
            </div>
            <div className="p-5 text-sm text-slate-400">
              {!searchQuery.trim() ? (
                <div>Type student universal ID or teacher name.</div>
              ) : searching ? (
                <div>Searching...</div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Students</div>
                    {studentResults.length === 0 ? (
                      <div className="text-slate-500">No students found.</div>
                    ) : (
                      <div className="space-y-2">
                        {studentResults.map((s: any) => (
                          <button
                            key={`stu-${s.id}`}
                            onClick={() => { setShowSearch(false); navigate('/students'); }}
                            className="w-full text-left rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2 hover:bg-slate-800"
                          >
                            <div className="text-slate-200 text-sm font-medium">{s.name}</div>
                            <div className="text-slate-500 text-xs">{s.loginRollNumber || s.classRollNumber} • {s.className} {s.sectionName ? `- ${s.sectionName}` : ''}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Teachers / Staff</div>
                    {staffResults.length === 0 ? (
                      <div className="text-slate-500">No staff found.</div>
                    ) : (
                      <div className="space-y-2">
                        {staffResults.slice(0, 8).map((s: any) => (
                          <button
                            key={`stf-${s.id}`}
                            onClick={() => { setShowSearch(false); navigate('/staff'); }}
                            className="w-full text-left rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2 hover:bg-slate-800"
                          >
                            <div className="text-slate-200 text-sm font-medium">{s.name}</div>
                            <div className="text-slate-500 text-xs">{s.email || ''}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
