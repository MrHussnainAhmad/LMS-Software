import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowUpCircle, AlertTriangle, CheckCircle2, Layers } from 'lucide-react';
import { api } from '../utils/api';
import PageSkeleton from '../components/PageSkeleton';
import { EmptyState, ErrorNote, PageHead } from '../ui/Bits';
import { useConfirm, useToast } from '../ui/Feedback';

export default function AutoPromotion() {
  const toast = useToast();
  const confirm = useConfirm();

  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [promoting, setPromoting] = useState<number | null>(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchBatches();
  }, []);

  async function fetchBatches() {
    try {
      const data = await api.get('/institution/students/auto-promote');
      // Accept either shape the endpoint has used for the promotable list.
      setBatches(data.batches || data.classes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch promotion batches');
    } finally {
      setLoading(false);
    }
  }

  async function handlePromote(batchId: number, title?: string) {
    const ok = await confirm({
      title: 'Run promotion now?',
      body: `Every active student in ${title || 'this batch'} moves up a grade. This cannot be undone — make sure the final results are published first.`,
      confirmLabel: 'Yes, promote students',
      tone: 'danger',
    });
    if (!ok) return;

    setPromoting(batchId);
    setError('');
    setSuccess('');
    try {
      await api.post('/institution/students/auto-promote', { batchExamId: batchId });
      setSuccess('Auto-promotion executed successfully!');
      toast.success('Students promoted', `${title || 'The batch'} has moved to the next session.`);
      fetchBatches();
    } catch (err: any) {
      setError(err.message || 'Failed to execute auto-promotion');
    } finally {
      setPromoting(null);
    }
  }

  return (
    <div className="page">
      <PageHead
        title="Auto promotion"
        subtitle="Move a whole batch into the next academic session once its results are final."
      />

      <div className="alert alert-warn">
        <AlertTriangle aria-hidden="true" />
        <div>
          <b>This cannot be undone.</b> Promotion moves every active student in the batch to the next
          grade using your institution&rsquo;s configuration. Publish all final results before you run it —
          there is no rollback.
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      {success && (
        <div className="alert" style={{ background: 'var(--ok-soft)', borderColor: 'var(--ok)', color: 'var(--ok)' }}>
          <CheckCircle2 aria-hidden="true" />
          <div>{success}</div>
        </div>
      )}

      {loading ? (
        <PageSkeleton rows={4} />
      ) : batches.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ArrowUpCircle />}
            title="Nothing ready to promote"
            text="Promotion runs off PROMOTION-type batch exams. Create one under Exams and publish its subjects, and it will appear here."
          />
        </div>
      ) : (
        <div className="stack">
          <p className="section-rule">
            {batches.length} {batches.length === 1 ? 'batch' : 'batches'}
          </p>
          {batches.map((batch) => {
            const ready = Boolean(batch.allSubjectsPublished);
            const done = Boolean(batch.officialPublishedAt);
            const busy = promoting === batch.id;

            return (
              <article className="card" key={batch.id}>
                <div className="card-pad">
                  <div className="row-between" style={{ alignItems: 'flex-start', gap: 18 }}>
                    <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                      <div className="row">
                        <span className="initials initials-accent" aria-hidden="true">
                          <Layers className="w-4 h-4" />
                        </span>
                        <Link to={`/promotion/${batch.id}`} className="underline">Review results</Link><h3 style={{ fontSize: '0.9375rem', fontWeight: 650 }}>{batch.title}</h3>
                      </div>
                      <p style={{ color: 'var(--ink-2)', fontSize: '0.8125rem' }}>
                        {batch.className}
                        {batch.sectionName ? ` · Section ${batch.sectionName}` : ''}
                      </p>
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <span className="chip chip-mute">
                          {batch.subjectCount} {batch.subjectCount === 1 ? 'subject' : 'subjects'}
                        </span>
                        <span className={`chip ${ready ? 'chip-ok' : 'chip-warn'}`}>
                          {ready ? 'All results published' : 'Results still pending'}
                        </span>
                      </div>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      {done ? (
                        <span className="chip chip-ok">
                          <CheckCircle2 aria-hidden="true" />
                          Already promoted
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePromote(batch.id, batch.title)}
                          disabled={busy || !ready}
                          className="btn btn-accent"
                          title={ready ? undefined : 'Publish every subject result before promoting'}
                        >
                          <ArrowUpCircle />
                          {busy ? 'Promoting…' : 'Run promotion'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
