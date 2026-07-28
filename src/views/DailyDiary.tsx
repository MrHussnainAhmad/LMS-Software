import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search, CalendarDays } from 'lucide-react';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';
import { EmptyState, ErrorNote, PageHead } from '../ui/Bits';

function initialsOf(name: string) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();
}

function humanDate(iso: string) {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function DailyDiary() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [classId, setClassId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadMeta() {
      setError('');
      try {
        const meta = await api.get('/institution/timetable?metadata=true');
        const allClasses = meta?.allClasses || meta?.classes || [];
        setClasses(allClasses);
        if (!classId && allClasses.length > 0) {
          setClassId(String(allClasses[0].id));
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load classes');
      }
    }
    loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadDiary() {
      if (!classId) return;
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/institution/diary?classId=${classId}&date=${date}`);
        setEntries(Array.isArray(res) ? res : (res?.entries || []));
      } catch (err: any) {
        setEntries([]);
        setError(err.message || 'Failed to load diary entries');
      } finally {
        setLoading(false);
      }
    }
    loadDiary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date]);

  const filteredEntries = useMemo(() => {
    const rows = Array.isArray(entries) ? entries : [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((e: any) => {
      const haystack = `${e.subjectName || ''} ${e.staffName || ''} ${e.content || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, query]);

  const today = new Date().toISOString().split('T')[0];
  const className = classes.find((c) => String(c.id) === classId)?.name;

  return (
    <div className="page">
      <PageHead
        title="Daily diary"
        subtitle={`What was taught and set as homework${className ? ` in ${className}` : ''} on ${humanDate(date)}.`}
      >
        <label className="search-field">
          <Search aria-hidden="true" />
          <input
            type="search"
            className="input"
            placeholder="Subject, teacher, content…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search diary entries"
          />
        </label>
        <label className="field" style={{ minWidth: 0 }}>
          <select
            className="select"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={classes.length === 0}
            aria-label="Class"
          >
            {classes.length === 0 ? <option value="">Loading classes…</option> : null}
            {classes.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ minWidth: 0 }}>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Diary date"
          />
        </label>
      </PageHead>

      {error && <ErrorNote message={error} />}

      {loading ? (
        <PageSkeleton rows={5} />
      ) : filteredEntries.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<BookOpen />}
            title={query.trim() ? 'Nothing matches that search' : 'No diary entries for this day'}
            text={
              query.trim()
                ? 'Try a different subject or teacher, or clear the search.'
                : 'Teachers write the diary at the end of each lesson. Check another date, or another class.'
            }
            action={
              query.trim() ? (
                <button type="button" className="btn btn-quiet" onClick={() => setQuery('')}>
                  Clear search
                </button>
              ) : date !== today ? (
                <button type="button" className="btn btn-quiet" onClick={() => setDate(today)}>
                  <CalendarDays />
                  Jump to today
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <section className="card">
          <div className="card-head">
            <div className="card-head-copy">
              <h2 className="card-title">
                <BookOpen aria-hidden="true" />
                {className || 'Entries'}
              </h2>
              <p className="card-sub">
                {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'} · {date}
              </p>
            </div>
          </div>

          <div>
            {filteredEntries.map((e: any) => (
              <div className="list-row" key={e.id} style={{ alignItems: 'flex-start' }}>
                <span className="initials initials-accent" aria-hidden="true">
                  {initialsOf(e.subjectName || 'Subject')}
                </span>
                <div className="stack" style={{ gap: 5, flex: '1 1 auto', minWidth: 0 }}>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <b style={{ fontSize: '0.875rem', fontWeight: 650 }}>{e.subjectName || 'Subject'}</b>
                    <span style={{ color: 'var(--ink-3)', fontSize: '0.75rem' }}>
                      {e.staffName || 'Unknown staff'}
                    </span>
                  </div>
                  <p className="prose-note">{e.content}</p>
                </div>
                <span style={{ color: 'var(--ink-4)', fontSize: '0.75rem', flexShrink: 0 }}>
                  {e.date || date}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
