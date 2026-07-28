import { useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import { FileText, FileX, Search, Award } from 'lucide-react';
import PageSkeleton from '../components/PageSkeleton';
import { EmptyState, ErrorNote, PageHead } from '../ui/Bits';

type Lens = 'all' | 'official' | 'effective' | 'draft';

const LENSES: { key: Lens; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'official', label: 'Official' },
  { key: 'effective', label: 'Effective' },
  { key: 'draft', label: 'Draft' },
];

export default function Results() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lens, setLens] = useState<Lens>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/institution/batch-exams');
        // The payload has been returned under both keys over time — accept either.
        setBatches(res?.batches || res?.batchExams || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load results');
        setBatches([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function stageOf(b: any): Lens {
    if (b.officialPublishedAt) return 'official';
    if (b.allSubjectsPublished) return 'effective';
    return 'draft';
  }

  const counts = useMemo(() => {
    const base = { all: batches.length, official: 0, effective: 0, draft: 0 };
    batches.forEach((b) => {
      base[stageOf(b)] += 1;
    });
    return base as Record<Lens, number>;
  }, [batches]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return batches.filter((b) => {
      if (lens !== 'all' && stageOf(b) !== lens) return false;
      if (!term) return true;
      return [b.title, b.className, b.sectionName, b.type].some((value) =>
        String(value || '').toLowerCase().includes(term),
      );
    });
  }, [batches, lens, query]);

  return (
    <div className="page">
      <PageHead
        title="Results"
        subtitle="Where every batch exam stands. Official means the result card has been signed off; effective means all subjects are in but the card is not sealed yet."
      >
        {batches.length > 0 && (
          <>
            <label className="search-field">
              <Search aria-hidden="true" />
              <input
                type="search"
                className="input"
                placeholder="Exam, class, type…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search results"
              />
            </label>
            <div className="seg" role="group" aria-label="Filter by stage">
              {LENSES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={lens === item.key}
                  onClick={() => setLens(item.key)}
                >
                  {item.label}
                  {counts[item.key] > 0 && <span> · {counts[item.key]}</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </PageHead>

      {error && <ErrorNote message={error} />}

      {loading ? (
        <PageSkeleton rows={6} />
      ) : batches.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FileX />}
            title="No batch exams yet"
            text="Once an exam is created and marks are entered, its publication status will show up here."
          />
        </div>
      ) : (
        <section className="card">
          <div className="card-head">
            <div className="card-head-copy">
              <h2 className="card-title">
                <Award aria-hidden="true" />
                Batch exams
              </h2>
              <p className="card-sub">
                {visible.length} of {batches.length} shown
              </p>
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title="Nothing in this view"
              text="No exam matches the current filter. Widen it to see everything again."
              action={
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => {
                    setLens('all');
                    setQuery('');
                  }}
                >
                  Reset filters
                </button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Exam</th>
                    <th scope="col">Class</th>
                    <th scope="col">Type</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((b) => {
                    const stage = stageOf(b);
                    const label =
                      stage === 'official'
                        ? 'Published · official'
                        : stage === 'effective'
                          ? 'Published · effective'
                          : 'Draft · waiting';
                    const tone =
                      stage === 'official' ? 'chip-ok' : stage === 'effective' ? 'chip-info' : 'chip-mute';

                    return (
                      <tr key={b.id}>
                        <td>
                          <div className="row">
                            <span className="initials" aria-hidden="true">
                              <FileText className="w-4 h-4" />
                            </span>
                            <b className="tbl-strong">{b.title}</b>
                          </div>
                        </td>
                        <td>
                          <span className="cell-stack">
                            <b>{b.className || '—'}</b>
                            {b.sectionName && <span>Section {b.sectionName}</span>}
                          </span>
                        </td>
                        <td>{b.type || '—'}</td>
                        <td>
                          <span className={`chip ${tone}`}>{label}</span>
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
    </div>
  );
}
