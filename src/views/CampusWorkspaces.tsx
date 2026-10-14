import { useState, type FormEvent } from 'react';
import { api } from '../utils/api';
import { useWorkspace, type Campus } from '../components/WorkspaceProvider';
import { PageHead, ErrorNote } from '../ui/Bits';
export default function CampusWorkspaces() {
  const {workspace,reload,switchCampus} = useWorkspace();
  const [existing,setExisting] = useState<Campus | null>(null);
  const [credentials,setCredentials] = useState<{loginEmail:string;defaultPassword:string}|null>(null);
  const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  if(!workspace) return <div className="page"><ErrorNote message="Connect to the server to manage campus workspaces."/></div>;
  const canAdd = workspace.canManageCampuses && !workspace.readOnly && workspace.plan.campusLimit !== null && workspace.campuses.length < workspace.plan.campusLimit;
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form=event.currentTarget;setBusy(true);setError('');
    try {const data = await api.post('/institution/campuses',{...Object.fromEntries(new FormData(form)),...(existing ? {existingCampusId:existing.id} : {})}); setCredentials(data);setExisting(null);form.reset();await reload();}
    catch(cause:any){setError(cause.message);}finally{setBusy(false);}
  }
  return <div className="page"><PageHead title="Campus workspaces" subtitle={`${workspace.plan.name}: ${workspace.plan.campusDetail}`}/>{error&&<ErrorNote message={error}/>}
    {credentials && <section className="alert alert-ok"><div><b>Campus login created</b><p>Email: {credentials.loginEmail}</p><p>Temporary password: <code>{credentials.defaultPassword}</code></p><p>The campus must change this password on first login.</p><button className="btn btn-quiet" onClick={()=>setCredentials(null)}>Dismiss credentials</button></div></section>}
    <section className="card card-pad stack">{workspace.campuses.map(campus=><article className="list-row" key={campus.id}><div className="cell-stack"><b>{campus.name}</b><span>{campus.address}</span><span>{campus.name===campus.workspaceName?campus.loginEmail:'Login not set up'}</span></div>
      {campus.name===campus.workspaceName && workspace.role==='INSTITUTION' && <button className="btn btn-quiet" disabled={busy} onClick={()=>void switchCampus(campus.id).catch(cause=>setError(cause.message))}>{campus.workspaceId===workspace.homeInstitutionId?'Your campus':'View read-only'}</button>}
      {campus.name!==campus.workspaceName && workspace.canManageCampuses && !workspace.readOnly && <button className="btn btn-quiet" onClick={()=>setExisting(campus)}>Set up login</button>}
    </article>)}</section>
    {(canAdd || existing) && <form key={existing?.id||'new'} className="card card-pad form-grid" onSubmit={submit}><h2>{existing?'Set up campus login':'Add campus'}</h2>
      <label className="field">Campus name<input className="input" name="name" defaultValue={existing?.name} readOnly={Boolean(existing)} required minLength={2} maxLength={255}/></label>
      <label className="field">Address<input className="input" name="address" defaultValue={existing?.address||''} required minLength={2} maxLength={2000}/></label>
      <label className="field">Login email<input className="input" name="loginEmail" type="email" required maxLength={255}/></label>
      <label className="field">Registration number<input className="input" name="registrationNumber" maxLength={100}/></label><button className="btn btn-primary" disabled={busy}>Create campus login</button>{existing&&<button type="button" className="btn btn-quiet" onClick={()=>setExisting(null)}>Cancel</button>}</form>}
    {!canAdd && !existing && <p>Campus creation is subject to your plan and primary-account access. Contact the platform team for additional capacity.</p>}
  </div>;
}
