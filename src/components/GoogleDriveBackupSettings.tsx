import { useState, useEffect } from 'react';
import { useToast, useConfirm } from '../ui/Feedback';
import { api } from '../utils/api';
import { CheckCircle2, HardDrive, Trash2, XCircle } from 'lucide-react';
import PageSkeleton from './PageSkeleton';

export default function GoogleDriveBackupSettings() {
  const toast = useToast();
  const confirm = useConfirm();
  
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fetchStatus = async () => {
    try {
      const data = await api.get('/institution/settings/google-drive');
      setStatus(data);
    } catch (err: any) {
      toast.error('Could not load Google Drive status', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Check if coming back from OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.get('googleDrive') === 'connected') {
      toast.success('Google Drive Connected');
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('googleDrive');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const data = await api.get('/institution/settings/google-drive/connect');
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    } catch (err: any) {
      toast.error('Could not connect Google Drive', err.message);
      setConnecting(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 14) {
      toast.error('Password too short', 'Backup password must be at least 14 characters.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords mismatch', 'The passwords you entered do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await api.put('/institution/settings/google-drive', { password });
      toast.success('Backup Password Saved');
      setPassword('');
      setConfirmPassword('');
      fetchStatus();
    } catch (err: any) {
      toast.error('Could not save password', err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: 'Disconnect Google Drive?',
      body: 'This will stop all future automatic nightly backups. Existing backup files in Google Drive will not be deleted.',
      confirmLabel: 'Disconnect',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete('/institution/settings/google-drive');
      toast.info('Google Drive disconnected');
      fetchStatus();
    } catch (err: any) {
      toast.error('Could not disconnect Google Drive', err.message);
    }
  };

  if (loading) {
    return <PageSkeleton cards={1} rows={0} />;
  }

  return (
    <section className="card">
      <div className="card-head">
        <div className="card-head-copy">
          <h2 className="card-title">
            <HardDrive aria-hidden="true" />
            Automated cloud backups
          </h2>
          <p className="card-sub">Securely store encrypted database snapshots to your own Google Drive nightly.</p>
        </div>
      </div>
      <div className="card-pad stack" style={{ gap: 18 }}>
        {status?.connected ? (
          <>
            <div className="alert alert-ok">
              <CheckCircle2 aria-hidden="true" />
              <div>
                <strong>Google Drive Connected</strong>
                <p>Automatic nightly backups are enabled.</p>
              </div>
            </div>

            <div className="form-grid form-grid-2">
              <div className="secret">
                <span className="secret-label">Folder path</span>
                <span className="mono">{status.folderName ? `Nisaab360/${status.folderName}` : 'N/A'}</span>
              </div>
              <div className="secret">
                <span className="secret-label">Backup file</span>
                <span className="mono">{status.backupFileName || 'N/A'}</span>
              </div>
              <div className="secret">
                <span className="secret-label">Last backup</span>
                <span className="mono">
                  {status.lastBackupAt ? new Date(status.lastBackupAt).toLocaleString() : 'Never'}
                </span>
              </div>
              {status.lastBackupError && (
                <div className="secret">
                  <span className="secret-label" style={{ color: 'var(--bad)' }}>Last error</span>
                  <span className="mono" style={{ color: 'var(--bad)' }}>{status.lastBackupError}</span>
                </div>
              )}
            </div>

            {status.passwordConfigured ? (
              <div className="alert">
                <div>
                  <strong>Backup password is set</strong>
                  <p>Your backups are encrypted. The password cannot be viewed or changed here for security reasons.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSavePassword} className="stack" style={{ gap: 14 }}>
                <div className="row" style={{ gap: 14 }}>
                  <label className="field" style={{ flex: 1 }}>
                    <span className="label">Encryption password (min 14 chars)</span>
                    <input
                      type="password"
                      required minLength={14}
                      className="input"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                  </label>
                  <label className="field" style={{ flex: 1 }}>
                    <span className="label">Confirm password</span>
                    <input
                      type="password"
                      required minLength={14}
                      className="input"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                    />
                  </label>
                </div>
                <button type="submit" disabled={savingPassword || !password || !confirmPassword} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                  {savingPassword ? 'Saving…' : 'Save encryption password'}
                </button>
              </form>
            )}

            <div style={{ marginTop: 8 }}>
              <button type="button" className="btn btn-danger btn-sm" onClick={handleDisconnect}>
                <Trash2 />
                Disconnect Google Drive
              </button>
            </div>
          </>
        ) : (
          <div className="stack" style={{ gap: 16 }}>
            <div className="alert">
              <XCircle aria-hidden="true" />
              <div>
                <strong>Google Drive Not Connected</strong>
                <p>Connect your account to enable automatic nightly backups.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start', backgroundColor: '#4285F4', borderColor: '#4285F4', color: '#fff' }}
            >
              <HardDrive />
              {connecting ? 'Connecting…' : 'Connect Google Drive'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
