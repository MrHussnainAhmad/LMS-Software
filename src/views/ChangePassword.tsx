import { useState, type FormEvent } from 'react';
import { api, removeAuthToken } from '../utils/api';
import { ErrorNote } from '../ui/Bits';
export default function ChangePassword() {
  const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setError('');
    if(form.get('newPassword') !== form.get('confirmPassword')) {setError('New passwords must match.');return;}
    setBusy(true);
    try { await api.post('/auth/change-password',{currentPassword:form.get('currentPassword'),newPassword:form.get('newPassword')});
      removeAuthToken(); await window.electronAPI?.auth.clearToken(); window.dispatchEvent(new Event('auth-changed')); window.location.hash='#/login';
    } catch(cause:any) {setError(cause.message);} finally {setBusy(false);}
  }
  return <main className="page" style={{maxWidth:560,margin:'auto'}}><h1>Update your password</h1><p>{localStorage.getItem('password_change_required') === '1' ? 'Replace your temporary password to open the institution workspace.' : 'Choose a new password. You will sign in again after updating it.'}</p>{error && <ErrorNote message={error}/>}
  <form onSubmit={submit} className="card card-pad form-grid"><label className="field">Current password<input type="password" name="currentPassword" className="input" required autoComplete="current-password"/></label><label className="field">New password<input type="password" name="newPassword" className="input" required minLength={8} autoComplete="new-password"/></label><label className="field">Confirm new password<input type="password" name="confirmPassword" className="input" required minLength={8} autoComplete="new-password"/></label><button className="btn btn-primary" disabled={busy}>{busy?'Updating…':'Update password and sign in again'}</button></form></main>;
}
