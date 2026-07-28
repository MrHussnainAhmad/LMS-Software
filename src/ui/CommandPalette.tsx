import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CornerDownLeft, GraduationCap, Search, UserRound } from 'lucide-react';
import { api } from '../utils/api';

/* ------------------------------------------------------------------ *
 * Command palette. Jumps to any page, or straight to a student /
 * staff member. Search hits the same endpoints the shell always used.
 * ------------------------------------------------------------------ */

export type NavTarget = {
  name: string;
  path: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
};

type Row =
  | { kind: 'nav'; key: string; label: string; hint: string; path: string; icon: React.ReactNode }
  | { kind: 'person'; key: string; label: string; hint: string; path: string; icon: React.ReactNode };

type Props = {
  open: boolean;
  onClose: () => void;
  targets: NavTarget[];
  onNavigate: (path: string) => void;
  /** Scopes people lookups to the campus selected in the topbar. */
  campusId?: number | string;
};

export default function CommandPalette({ open, onClose, targets, onNavigate, campusId }: Props) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [people, setPeople] = useState<Row[]>([]);
  const [searching, setSearching] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setPeople([]);
      setCursor(0);
    }
  }, [open]);

  // Debounced people lookup — identical endpoints to the previous global search.
  useEffect(() => {
    const term = query.trim();
    if (!open || term.length < 2) {
      setPeople([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const handle = window.setTimeout(async () => {
      try {
        const campusParam = campusId && campusId !== 'all' ? `&campusId=${campusId}` : '';
        const [studentRes, staffRes] = await Promise.all([
          api
            .get(`/institution/students/picker?q=${encodeURIComponent(term)}&limit=8${campusParam}`)
            .catch(() => null),
          api.get(`/institution/staff?q=${encodeURIComponent(term)}${campusParam}`).catch(() => null),
        ]);
        if (!active) return;
        const students = (studentRes?.students || []).slice(0, 6).map((s: any) => ({
          kind: 'person' as const,
          key: `student-${s.id}`,
          label: s.name || 'Unnamed student',
          hint:
            [
              s.loginRollNumber || s.classRollNumber,
              s.className,
              s.sectionName ? `Section ${s.sectionName}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Student',
          path: '/students',
          icon: <GraduationCap />,
        }));
        const staff = (staffRes?.staff || []).slice(0, 5).map((s: any) => ({
          kind: 'person' as const,
          key: `staff-${s.id}`,
          label: s.name || 'Unnamed staff',
          hint: [s.roleName || s.role, s.email].filter(Boolean).join(' · ') || 'Staff',
          path: '/staff',
          icon: <UserRound />,
        }));
        setPeople([...students, ...staff]);
      } finally {
        if (active) setSearching(false);
      }
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [query, open, campusId]);

  const term = query.trim().toLowerCase();
  const navRows: Row[] = useMemo(
    () =>
      targets
        .filter((t) => !term || t.name.toLowerCase().includes(term) || t.group.toLowerCase().includes(term))
        .map((t) => {
          const Icon = t.icon;
          return {
            kind: 'nav' as const,
            key: `nav-${t.path}`,
            label: t.name,
            hint: t.group,
            path: t.path,
            icon: <Icon />,
          };
        }),
    [targets, term]
  );

  // Memoised so the keyboard listener below isn't torn down and rebuilt on every render.
  const rows: Row[] = useMemo(() => [...navRows, ...people], [navRows, people]);
  const safeCursor = rows.length ? Math.min(cursor, rows.length - 1) : 0;

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((c) => (rows.length ? (c + 1) % rows.length : 0));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((c) => (rows.length ? (c - 1 + rows.length) % rows.length : 0));
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const row = rows[safeCursor];
        if (row) {
          onNavigate(row.path);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, rows, safeCursor, onClose, onNavigate]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('.cmdk-item.is-active')
      ?.scrollIntoView({ block: 'nearest' });
  }, [safeCursor, rows.length]);

  if (!open) return null;

  let lastGroup = '';

  return createPortal(
    <div
      className="cmdk-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="cmdk-field">
          <Search aria-hidden="true" />
          <input
            autoFocus
            className="cmdk-input"
            placeholder="Jump to a page, student or staff member…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search the workspace"
          />
          {searching && <span className="chip chip-mute">Searching…</span>}
        </div>

        <div className="cmdk-list" ref={listRef}>
          {rows.length === 0 ? (
            <p className="cmdk-empty">
              {term.length >= 2 ? `Nothing matches “${query.trim()}”.` : 'Type to search.'}
            </p>
          ) : (
            rows.map((row, index) => {
              const group = row.kind === 'nav' ? 'Navigate' : 'People';
              const showLabel = group !== lastGroup;
              lastGroup = group;
              return (
                <div key={row.key}>
                  {showLabel && <div className="cmdk-group-label">{group}</div>}
                  <button
                    type="button"
                    className={`cmdk-item ${index === safeCursor ? 'is-active' : ''}`}
                    onMouseMove={() => setCursor(index)}
                    onClick={() => {
                      onNavigate(row.path);
                      onClose();
                    }}
                  >
                    {row.icon}
                    <span className="cmdk-item-copy">
                      <b>{row.label}</b>
                      <span>{row.hint}</span>
                    </span>
                    {index === safeCursor && <CornerDownLeft className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="cmdk-foot">
          <span>
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd> move
          </span>
          <span>
            <kbd className="kbd">↵</kbd> open
          </span>
          <span>
            <kbd className="kbd">esc</kbd> close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
