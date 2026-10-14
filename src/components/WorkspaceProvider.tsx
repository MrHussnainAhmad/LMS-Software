import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../utils/api';
import { api as liveApi } from '@/lib/api-client';
import { ErrorNote } from '../ui/Bits';
import { useToast } from '../ui/Feedback';

export type Campus = { id: number; name: string; address: string | null; workspaceId: number; workspaceName: string; loginEmail: string };
export type Workspace = { institutionId: number; homeInstitutionId: number; campusId: number; campusName: string; role: string; readOnly: boolean; isMainCampus: boolean; registrationNumber: string; needsOwner: boolean; campuses: Campus[]; canManageCampuses: boolean; plan: { id: string; name: string; campusLimit: number | null; campusDetail: string } };
const Context = createContext<{workspace: Workspace | null; reload: () => Promise<void>; switchCampus: (id: number | 'home') => Promise<void>}>({workspace:null,reload:async()=>{},switchCampus:async()=>{}});
export const useWorkspace = () => useContext(Context);
export function WorkspaceProvider({children}: {children: ReactNode}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const reload = useCallback(async () => { const data = await api.get('/institution/workspace'); setWorkspace(data); setError(''); setReady(true); }, []);
  useEffect(() => { void reload().catch(cause => { setError(cause.message); setReady(true); }); }, [reload]);
  const switchCampus = async (id: number | 'home') => {
    const result = await api.post('/institution/campus-view', id === 'home' ? { returnHome:true } : {campusId:id});
    if(result.readOnly) { sessionStorage.setItem('campus_view',result.campusViewToken); sessionStorage.setItem('campus_name',result.campusName); }
    else { sessionStorage.removeItem('campus_view'); sessionStorage.removeItem('campus_name'); }
    localStorage.removeItem('selected_campus_id');
    window.location.hash = '#/dashboard';
    window.location.reload();
  };
  if(!ready) return <div className="page" role="status">Opening your workspace…</div>;
  return <Context.Provider value={{workspace,reload,switchCampus}}>
    {error && <div className="alert alert-warn"><span>Workspace details are unavailable. Cached home-campus screens remain available. {error}</span><button className="btn btn-quiet" onClick={() => void reload().catch(cause=>setError(cause.message))}>Retry</button></div>}
    {workspace?.needsOwner ? <OwnerSetup onSaved={reload}/> : children}
  </Context.Provider>;
}
function OwnerSetup({onSaved}: {onSaved:()=>Promise<void>}) {
  const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.post('/institution/workspace', Object.fromEntries(new FormData(event.currentTarget))); await onSaved(); }
    catch(cause:any) { setError(cause.message); } finally {setBusy(false);}
  }
  return <div className="page" style={{maxWidth:640,margin:'auto'}}><h1>Institution owner details</h1><p>Complete your institution setup.</p>{error && <ErrorNote message={error}/>}<form className="card card-pad form-grid" onSubmit={submit}>
    <label className="field">Full name<input className="input" name="name" required maxLength={255}/></label>
    <label className="field">Gender<select name="gender" className="select" required><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></label>
    <label className="field">Email<input className="input" type="email" name="email" required maxLength={255}/></label>
    <label className="field">Contact number<input className="input" name="contactNumber" required maxLength={50}/></label><button className="btn btn-primary" disabled={busy}>Save owner details</button>
  </form></div>;
}
export function CampusIdentity() {
  const {workspace,reload} = useWorkspace(); const toast = useToast(); const [busy,setBusy] = useState(false);
  if(!workspace || workspace.isMainCampus || workspace.readOnly) return null;
  return <form className="card card-pad form-grid" onSubmit={async event=>{
    event.preventDefault(); const registrationNumber = new FormData(event.currentTarget).get('registrationNumber'); setBusy(true);
    try {await liveApi.patch('/api/institution/settings',{registrationNumber}); await reload(); toast.success('Campus identity saved');} catch(cause:any){toast.error('Could not save',cause.message);} finally {setBusy(false);}
  }}><label className="field">Campus registration number<input className="input" name="registrationNumber" defaultValue={workspace.registrationNumber} maxLength={100}/></label><button className="btn btn-primary" disabled={busy}>Save registration number</button></form>;
}
