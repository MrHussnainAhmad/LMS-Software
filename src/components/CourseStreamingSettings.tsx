import { useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../utils/api';
import Modal from '../ui/Modal';
import { useToast } from '../ui/Feedback';

type Provider = 'BUNNY' | 'MUX';
type StreamingState = {
  scope: 'INSTITUTION' | 'STAFF';
  provider: Provider | null;
  configured: boolean;
};

export default function CourseStreamingSettings() {
  const toast = useToast();
  const [provider, setProvider] = useState<Provider>('BUNNY');
  const [state, setState] = useState<StreamingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    api.get('/course-streaming')
      .then((response: StreamingState) => {
        setState(response);
        if (response.provider) setProvider(response.provider);
      })
      .catch((error: Error) => toast.error('Streaming settings unavailable', error.message))
      .finally(() => setLoading(false));
  }, [toast]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const body = provider === 'BUNNY'
      ? {
          provider,
          libraryId: values.get('libraryId'),
          apiKey: values.get('apiKey'),
          cdnHostname: values.get('cdnHostname'),
          tokenAuthKey: values.get('tokenAuthKey'),
        }
      : { provider, tokenId: values.get('tokenId'), tokenSecret: values.get('tokenSecret') };
    setBusy(true);
    try {
      await api.put('/course-streaming', body);
      setState({ scope: 'INSTITUTION', provider, configured: true });
      toast.success('Course streaming connected', 'Courses are now available to teachers and students.');
      event.currentTarget.reset();
    } catch (error) {
      toast.error('Could not save streaming settings', error instanceof Error ? error.message : 'Check the credentials and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.delete('/course-streaming');
      setState({ scope: 'INSTITUTION', provider: null, configured: false });
      setConfirmRemove(false);
      toast.warn('Course streaming disabled', 'Existing course and lecture records were preserved.');
    } catch (error) {
      toast.error('Could not remove credentials', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="field-hint">Loading streaming settings…</p>;

  return <>
    <section className="card">
      <div className="card-head">
        <div className="card-head-copy">
          <h2 className="card-title"><ShieldCheck />Course streaming</h2>
          <p className="card-sub">Connect one Bunny Stream or Mux account. Institution credentials override teacher credentials.</p>
        </div>
        {state?.configured && <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => setConfirmRemove(true)}><Trash2 />Remove credentials</button>}
      </div>
      <form className="card-pad form-grid" onSubmit={save}>
        <div className={`alert ${state?.configured ? 'alert-ok' : 'alert-warn'}`}>
          <ShieldCheck />
          <div><b>{state?.configured ? `${state.provider === 'MUX' ? 'Mux' : 'Bunny Stream'} connected` : 'Streaming is not configured'}</b><p>Removing credentials disables Courses immediately without deleting course records.</p></div>
        </div>
        <label className="field"><span className="label">Streaming provider</span><select className="select" value={provider} onChange={(event) => setProvider(event.target.value as Provider)}><option value="BUNNY">Bunny Stream</option><option value="MUX">Mux</option></select></label>
        {provider === 'BUNNY' ? <div className="form-grid form-grid-2">
          <label className="field"><span className="label">Bunny Library ID</span><input required name="libraryId" className="input" /></label>
          <label className="field"><span className="label">Bunny API key</span><input required name="apiKey" type="password" className="input" placeholder={state?.configured ? 'Enter a new key to replace it' : 'API key'} /></label>
          <label className="field"><span className="label">Bunny CDN hostname</span><input required name="cdnHostname" className="input" placeholder="vz-xxxx.b-cdn.net" /></label>
          <label className="field"><span className="label">CDN token authentication key</span><input required name="tokenAuthKey" type="password" className="input" placeholder="Library security token key" /></label>
          <p className="prose-note" style={{ gridColumn: '1 / -1' }}>Enable token authentication and direct play in the Bunny video library before saving. These values protect playback while teachers upload without receiving the provider credentials.</p>
        </div> : <div className="form-grid form-grid-2">
          <p className="prose-note" style={{ gridColumn: '1 / -1' }}>Use a Mux Access Token, not the Environment ID or Environment Key. It needs Video Read/Write and System Write permissions for protected uploads and playback.</p>
          <label className="field"><span className="label">Mux Access Token ID</span><input required name="tokenId" className="input" /></label>
          <label className="field"><span className="label">Mux Access Token Secret</span><input required name="tokenSecret" type="password" className="input" placeholder={state?.configured ? 'Enter a new secret to replace it' : 'Access token secret'} /></label>
        </div>}
        <button className="btn btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>{busy ? 'Saving…' : 'Save course streaming'}</button>
      </form>
    </section>
    <Modal open={confirmRemove} onClose={() => !busy && setConfirmRemove(false)} title="Remove streaming credentials?" description="Teachers and students will immediately lose access to Courses. Existing courses and lectures will not be deleted." footer={<><button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirmRemove(false)}>Cancel</button><button type="button" className="btn btn-danger" disabled={busy} onClick={remove}>{busy ? 'Removing…' : 'Remove and disable Courses'}</button></>}><p className="prose-note">You can reconnect Bunny Stream or Mux later without recreating existing course records.</p></Modal>
  </>;
}
