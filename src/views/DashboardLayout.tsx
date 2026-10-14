import { useWorkspace } from '../components/WorkspaceProvider';
import Notifications from '../components/Notifications';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api, getSyncStatus, getAuthToken, runInitialSync } from '../utils/api';
import { createVisiblePoll } from '../utils/visible-poll';
import productLogo from '../../icon.png';
import CommandPalette, { type NavTarget } from '../ui/CommandPalette';
import Modal from '../ui/Modal';
import SyncLoader from '../ui/SyncLoader';
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
  CircleHelp,
  Check,
  Megaphone,
  LifeBuoy,
  PanelLeft,
  ShieldCheck,
  Award,
  ClipboardList,
  WalletCards,
  LibraryBig,
  Calendar,
  Ticket,
} from 'lucide-react';

const NAV_ITEMS: NavTarget[] = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, group: 'Workspace' },
  { name: 'Admins', path: '/admin', icon: ShieldCheck, group: 'Institution' },
  { name: 'Campuses', path: '/campuses', icon: Building2, group: 'Institution' },
  { name: 'Academics', path: '/academics', icon: LibraryBig, group: 'Institution' },
  { name: 'Courses', path: '/courses', icon: BookOpen, group: 'Institution' },
  { name: 'Staff', path: '/staff', icon: Users, group: 'Institution' },
  { name: 'Students', path: '/students', icon: GraduationCap, group: 'Institution' },
  { name: 'Auto Promotion', path: '/promotion', icon: ArrowUpCircle, group: 'Institution' },
  { name: 'ID Cards', path: '/id-card', icon: IdCard, group: 'Institution' },
  { name: 'Admissions', path: '/admissions', icon: ClipboardList, group: 'Institution' },
  { name: 'Fees', path: '/fees', icon: WalletCards, group: 'Institution' },
  { name: 'Daily Diary', path: '/diary', icon: BookOpen, group: 'Academics' },
  { name: 'Attendance', path: '/attendance', icon: ClipboardCheck, group: 'Academics' },
  { name: 'Exams', path: '/exams', icon: FileText, group: 'Academics' },
  { name: 'Results', path: '/results', icon: Award, group: 'Academics' },
  { name: 'Leaves', path: '/leaves', icon: CalendarOff, group: 'Operations' },
  { name: 'Timetable', path: '/timetable', icon: CalendarDays, group: 'Operations' },
  { name: 'Announcements', path: '/announcements', icon: Megaphone, group: 'Operations' },
  { name: 'Holidays', path: '/holidays', icon: Calendar, group: 'Operations' },
  { name: 'Public Events', path: '/public-events', icon: Ticket, group: 'Operations' },
  { name: 'Helpdesk', path: '/helpdesk', icon: LifeBuoy, group: 'Operations' },
  { name: 'Settings', path: '/settings', icon: Settings, group: 'Operations' },
];

const NAV_GROUPS = ['Workspace', 'Institution', 'Academics', 'Operations'];

/** `g` then a letter jumps straight to a screen — muscle memory beats clicking. */
const JUMP_KEYS: Record<string, string> = {
  d: '/dashboard',
  c: '/campuses',
  b: '/academics',
  o: '/courses',
  f: '/staff',
  s: '/students',
  m: '/admissions',
  v: '/fees',
  y: '/diary',
  a: '/attendance',
  e: '/exams',
  r: '/results',
  p: '/promotion',
  i: '/id-card',
  l: '/leaves',
  t: '/timetable',
  n: '/announcements',
  w: '/holidays',
  u: '/public-events',
  h: '/helpdesk',
  ',': '/settings',
};

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { workspace, switchCampus } = useWorkspace();
  const [campusError, setCampusError] = useState('');
  const location = useLocation();

  const [campuses, setCampuses] = useState<any[]>([]);
  const [selectedCampus, setSelectedCampus] = useState<any>({ id: 'all', name: 'Your campus' });
  const [showCampusDropdown, setShowCampusDropdown] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [campusQuery, setCampusQuery] = useState('');
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [campusMenuPos, setCampusMenuPos] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const [railOpen, setRailOpen] = useState(false);
  const [admissionAttentionCount, setAdmissionAttentionCount] = useState(0);
  const campusButtonRef = useRef<HTMLButtonElement>(null);
  const campusMenuRef = useRef<HTMLDivElement>(null);
  const jumpArmedAt = useRef(0);
  const [overlayState, setOverlayState] = useState<'none' | 'startup' | 'onboarding' | 'manual'>('none');
  const [onboardingStep, setOnboardingStep] = useState(1);

  useEffect(() => {
    let active = true;
    async function refreshAdmissionAttention() {
      try {
        const result = await api.get('/institution/admissions/attention-count');
        if (active) setAdmissionAttentionCount(Number(result?.count || 0));
      } catch {
        if (active) setAdmissionAttentionCount(0);
      }
    }
    const poll = createVisiblePoll(refreshAdmissionAttention, { interval: 60_000, minRefreshGap: 5000 });
    let eventTimer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(eventTimer);
      eventTimer = setTimeout(() => { void poll.refresh(true); }, 250);
    };
    window.addEventListener('admissions:updated', refresh);
    return () => {
      active = false;
      poll.stop();
      clearTimeout(eventTimer);
      window.removeEventListener('admissions:updated', refresh);
    };
  }, []);

  useEffect(() => {
    if (!workspace) return;
    setCampuses(workspace.role === 'INSTITUTION' ? workspace.campuses.filter(c => c.name === c.workspaceName) : []);
    setSelectedCampus({ id: workspace.campusId, name: workspace.campusName });
  }, [workspace]);

  useEffect(() => {
    let active = true;
    async function refreshSyncStatus() {
      const status = await getSyncStatus();
      if (active) setSyncStatus(status);
    }
    refreshSyncStatus();
    const timer = setInterval(refreshSyncStatus, 10_000);
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
    async function performStartupSync() {
      const isOnboarded = localStorage.getItem('nisaab_onboarded');
      const token = getAuthToken();
      const syncOnStart = () => token ? runInitialSync(token) : Promise.resolve();
      
      if (!isOnboarded) {
        setOverlayState('onboarding');
        try {
           await syncOnStart();
        } catch (e) {}
      } else {
        setOverlayState('startup');
        try {
           await syncOnStart();
        } catch (e) {}
        setOverlayState('none');
      }
    }
    performStartupSync();
  }, []);

  useEffect(() => {
    setShowCampusDropdown(false);
    setCampusQuery('');
    setRailOpen(false);
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

  // Keyboard layer: ⌘K / Ctrl+K opens the palette, `?` opens the guide,
  // and `g` + letter jumps between screens.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowSearch(true);
        return;
      }

      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === '?') {
        event.preventDefault();
        setShowHelp(true);
        return;
      }

      if (event.key === 'g') {
        jumpArmedAt.current = Date.now();
        return;
      }

      if (jumpArmedAt.current && Date.now() - jumpArmedAt.current < 900) {
        const path = JUMP_KEYS[event.key.toLowerCase()];
        jumpArmedAt.current = 0;
        if (path) {
          event.preventDefault();
          navigate(path);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  async function selectCampus(campus: { id: number | string; name: string }) {
    setCampusError('');
    try { await switchCampus(campus.id === 'all' ? 'home' : Number(campus.id)); }
    catch (error: any) { setCampusError(error.message); }
    setShowCampusDropdown(false);
  }

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('nisaab_refresh_token');
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // Local sign-out must still complete while offline.
    }
    localStorage.removeItem('nisaab_token');
    localStorage.removeItem('nisaab_refresh_token');
    sessionStorage.removeItem('campus_view');
    sessionStorage.removeItem('campus_name');
    localStorage.removeItem('password_change_required');
    window.electronAPI?.auth?.clearToken?.();
    window.dispatchEvent(new Event('auth-changed'));
    navigate('/login');
  };

  const activeItem = NAV_ITEMS.find((item) => item.path === location.pathname);
  const currentPage = activeItem?.name || 'Workspace';
  const currentGroup = activeItem?.group || 'Institution';
  const filteredCampuses = useMemo(
    () => campuses.filter((campus) => campus.name?.toLowerCase().includes(campusQuery.toLowerCase())),
    [campuses, campusQuery],
  );

  const pendingCount = Number(syncStatus?.pendingCount || 0);

  return (
    <div className="app-shell">
      {railOpen && (
        <div className="rail-backdrop" role="presentation" onClick={() => setRailOpen(false)} />
      )}

      <aside className="rail" data-open={railOpen ? 'true' : undefined}>
        <div className="rail-brand">
          <span className="rail-mark">
            <img src={productLogo} alt="" className="w-5 h-5" />
          </span>
          <span className="rail-wordmark">
            <b>Nisaab360</b>
            <span>Institution suite</span>
          </span>
        </div>

        <nav className="rail-scroll" aria-label="Primary">
          {NAV_GROUPS.map((group) => (
            <div className="rail-group" key={group}>
              <p className="rail-label">{group}</p>
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={item.name}
                    className={({ isActive }) => `rail-link ${isActive ? 'is-active' : ''}`}
                  >
                    <Icon />
                    <span>{item.name}</span>
                    {item.path === '/admissions' && admissionAttentionCount > 0 && <span className="rail-badge" aria-label={`${admissionAttentionCount} new admission applications`}>{admissionAttentionCount > 99 ? '99+' : admissionAttentionCount}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="rail-foot">
          <div className="rail-user">
            <span className="rail-avatar" aria-hidden="true">
              AD
            </span>
            <span className="rail-user-copy">
              <b>Institution admin</b>
              <span>
                <i
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: effectiveOnline ? 'var(--ok)' : 'var(--warn)',
                    display: 'inline-block',
                  }}
                />
                {effectiveOnline ? 'Synced' : 'Working offline'}
              </span>
            </span>
          </div>
          <button type="button" className="rail-signout" onClick={handleLogout}>
            <LogOut />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn rail-toggle"
            aria-label="Toggle navigation"
            onClick={() => setRailOpen((open) => !open)}
          >
            <PanelLeft />
          </button>

          <div className="topbar-heading">
            <span className="topbar-kicker">{currentGroup}</span>
            <strong className="topbar-title">{currentPage}</strong>
          </div>

          <div className="topbar-actions">
            {syncStatus && (
              <button
                type="button"
                className={`sync-tag ${effectiveOnline ? 'is-live' : 'is-offline'}`}
                style={{ cursor: 'pointer', border: 'none', background: 'transparent' }}
                title={
                  effectiveOnline
                    ? 'Connected. Click to force sync.'
                    : 'Offline — changes are queued and will sync automatically'
                }
                onClick={async () => {
                  if (!effectiveOnline) return;
                  setOverlayState('manual');
                  try {
                    const p = window.electronAPI?.sync?.pull?.();
                    const timer = new Promise(r => setTimeout(r, 3000));
                    await Promise.all([p, timer]);
                    const st = await getSyncStatus();
                    setSyncStatus(st);
                    window.location.reload();
                  } catch (e) {
                    console.error('Manual sync failed', e);
                    setOverlayState('none');
                  }
                }}
              >
                <i aria-hidden="true" />
                <span>
                  {effectiveOnline ? 'Online (Click to sync)' : 'Offline'}
                  {pendingCount > 0 ? ` · ${pendingCount} queued` : ''}
                </span>
              </button>
            )}

            <button type="button" className="cmd-trigger" onClick={() => setShowSearch(true)}>
              <Search />
              <span>Search or jump to…</span>
              <kbd className="kbd">Ctrl K</kbd>
            </button>

            <div className="topbar-sep" aria-hidden="true" />

            <button
              ref={campusButtonRef}
              type="button"
              onClick={() => setShowCampusDropdown((open) => !open)}
              className={`campus-pill ${showCampusDropdown ? 'is-open' : ''}`}
              aria-expanded={showCampusDropdown}
              aria-haspopup="listbox"
            >
              <Building2 />
              <span>{selectedCampus.name}</span>
              <ChevronDown />
            </button>

            <button
              type="button"
              aria-label="Keyboard shortcuts and guide"
              className="icon-btn"
              onClick={() => setShowHelp(true)}
            >
              <CircleHelp />
            </button>
          </div>
          <Notifications />
        </header>

        <div className="canvas">
          {campusError && <div role="alert" className="alert alert-warn">{campusError}</div>}
          {sessionStorage.getItem('campus_view') && <div className="alert alert-warn"><span>Viewing {sessionStorage.getItem('campus_name')} read-only.</span><button className="btn btn-quiet" onClick={() => void selectCampus({id:'all',name:'Your campus'})}>Return to your campus</button></div>}
          <Outlet context={{ selectedCampus }} />
        </div>
      </main>

      {showCampusDropdown &&
        campusMenuPos &&
        createPortal(
          <div
            ref={campusMenuRef}
            style={{
              position: 'fixed',
              top: campusMenuPos.top,
              left: Math.max(12, campusMenuPos.left),
              width: campusMenuPos.width,
              zIndex: 120,
            }}
            className="menu"
            role="listbox"
          >
            <div style={{ padding: '4px 5px 8px' }}>
              <label className="search-field">
                <Search aria-hidden="true" />
                <input
                  autoFocus
                  type="text"
                  className="input input-sm"
                  placeholder="Filter campuses…"
                  value={campusQuery}
                  onChange={(e) => setCampusQuery(e.target.value)}
                  aria-label="Filter campuses"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => selectCampus({ id: 'all', name: 'Your campus' })}
              className={`menu-item ${selectedCampus.id === 'all' ? 'is-active' : ''}`}
              role="option"
              aria-selected={selectedCampus.id === 'all'}
            >
              <Building2 />
              <span>Your campus</span>
              {selectedCampus.id === 'all' && <Check />}
            </button>
            <div className="menu-sep" aria-hidden="true" />
            <div className="menu-scroll">
              {filteredCampuses.map((c) => {
                const on = String(selectedCampus.id) === String(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCampus(c)}
                    className={`menu-item ${on ? 'is-active' : ''}`}
                    role="option"
                    aria-selected={on}
                  >
                    <Building2 />
                    <span>{c.name}</span>
                    {on && <Check />}
                  </button>
                );
              })}
              {filteredCampuses.length === 0 && (
                <p className="menu-empty">
                  {campusQuery ? 'No campus matches that name.' : 'No campuses yet.'}
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}

      <CommandPalette
        open={showSearch}
        onClose={() => setShowSearch(false)}
        targets={NAV_ITEMS}
        onNavigate={(path) => navigate(path)}
        campusId={selectedCampus?.id}
      />

      <Modal
        open={showHelp}
        onClose={() => setShowHelp(false)}
        title="Working faster"
        description="A short tour of the workspace, plus every shortcut worth learning."
        size="md"
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setShowHelp(false)}>
            Got it
          </button>
        }
      >
        <div className="stack" style={{ gap: 18 }}>
          <section>
            <p className="section-rule" style={{ marginBottom: 10 }}>
              Shortcuts
            </p>
            <div className="stack" style={{ gap: 8 }}>
              {[
                ['Ctrl K', 'Open the command palette — jump to a page, student or staff member'],
                ['g then d', 'Dashboard'],
                ['g then s', 'Students'],
                ['g then f', 'Staff'],
                ['g then a', 'Attendance'],
                ['g then e', 'Exams'],
                ['g then t', 'Timetable'],
                ['?', 'Open this guide'],
                ['Esc', 'Close any dialog'],
              ].map(([keys, what]) => (
                <div className="row" key={keys}>
                  <span style={{ display: 'flex', gap: 4, minWidth: 92 }}>
                    {keys.split(' then ').map((k) => (
                      <kbd className="kbd" key={k}>
                        {k}
                      </kbd>
                    ))}
                  </span>
                  <span style={{ color: 'var(--ink-2)', fontSize: '0.8125rem' }}>{what}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="section-rule" style={{ marginBottom: 10 }}>
              How the workspace fits together
            </p>
            <div className="stack" style={{ gap: 9, color: 'var(--ink-2)', fontSize: '0.8125rem' }}>
              <p>
                <b style={{ color: 'var(--ink)' }}>Campus selector</b> — the pill in the header filters
                every screen that is campus-aware. Set it once and it follows you.
              </p>
              <p>
                <b style={{ color: 'var(--ink)' }}>Offline first</b> — the app keeps a local copy of your
                data. Edits made offline are queued and pushed the moment you reconnect; the header badge
                tells you how many are waiting.
              </p>
              <p>
                <b style={{ color: 'var(--ink)' }}>Institution → Academics → Operations</b> — the rail is
                ordered the way a term runs: set up people first, then teaching, then day-to-day admin.
              </p>
            </div>
          </section>
        </div>
      </Modal>

      {overlayState !== 'none' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: overlayState === 'onboarding' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {overlayState === 'onboarding' && (
            <div className="card stack" style={{ maxWidth: 500, padding: 32, gap: 24, textAlign: 'center', background: '#fff', borderRadius: 16 }}>
              <div>
                 <div style={{ display: 'inline-flex', padding: 16, background: 'var(--brand-50)', borderRadius: '50%', color: 'var(--brand-600)', marginBottom: 16 }}>
                    <LayoutDashboard size={40} />
                 </div>
                 <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px' }}>Welcome to Nisaab360</h2>
                 <p style={{ color: 'var(--ink-3)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
                   Your local workspace is ready. Let's get you set up.
                 </p>
              </div>
              <div className="stack" style={{ gap: 16, textAlign: 'left', minHeight: 120, justifyContent: 'center' }}>
                {onboardingStep === 1 && (
                  <div className="row" style={{ gap: 16, alignItems: 'center' }}>
                     <div style={{ padding: 12, background: 'var(--stone-100)', borderRadius: 12, color: 'var(--brand-600)' }}><Building2 size={32} /></div>
                     <div>
                       <b style={{ display: 'block', color: 'var(--ink-1)', fontSize: '1.125rem', marginBottom: 4 }}>1. Set up your campus</b>
                       <span style={{ fontSize: '0.9375rem', color: 'var(--ink-3)', lineHeight: 1.4, display: 'block' }}>Add your classrooms, subjects, and grading rules in Settings.</span>
                     </div>
                  </div>
                )}
                {onboardingStep === 2 && (
                  <div className="row" style={{ gap: 16, alignItems: 'center' }}>
                     <div style={{ padding: 12, background: 'var(--stone-100)', borderRadius: 12, color: 'var(--brand-600)' }}><Users size={32} /></div>
                     <div>
                       <b style={{ display: 'block', color: 'var(--ink-1)', fontSize: '1.125rem', marginBottom: 4 }}>2. Import staff & students</b>
                       <span style={{ fontSize: '0.9375rem', color: 'var(--ink-3)', lineHeight: 1.4, display: 'block' }}>Bring your people on board to start managing attendance and exams.</span>
                     </div>
                  </div>
                )}
                {onboardingStep === 3 && (
                  <div className="row" style={{ gap: 16, alignItems: 'center' }}>
                     <div style={{ padding: 12, background: 'var(--stone-100)', borderRadius: 12, color: 'var(--brand-600)' }}><CalendarDays size={32} /></div>
                     <div>
                       <b style={{ display: 'block', color: 'var(--ink-1)', fontSize: '1.125rem', marginBottom: 4 }}>3. Build the timetable</b>
                       <span style={{ fontSize: '0.9375rem', color: 'var(--ink-3)', lineHeight: 1.4, display: 'block' }}>Assign teachers to periods and keep everyone in sync automatically.</span>
                     </div>
                  </div>
                )}
              </div>
              <div className="row" style={{ gap: 8, justifyContent: 'center', marginBottom: 8 }}>
                {[1, 2, 3].map(step => (
                   <div key={step} style={{ width: 8, height: 8, borderRadius: '50%', background: onboardingStep === step ? 'var(--brand-500)' : 'var(--stone-200)' }} />
                ))}
              </div>
              <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} onClick={() => {
                if (onboardingStep < 3) {
                  setOnboardingStep(s => s + 1);
                } else {
                  localStorage.setItem('nisaab_onboarded', '1');
                  setOverlayState('none');
                }
              }}>
                {onboardingStep < 3 ? 'Next' : 'Get Started'}
              </button>
            </div>
          )}
          {(overlayState === 'startup' || overlayState === 'manual') && <SyncLoader />}
        </div>
      )}
    </div>
  );
}
