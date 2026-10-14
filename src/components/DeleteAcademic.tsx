import { useState } from 'react';
import { api } from '../utils/api';
import { useConfirm, useToast } from '../ui/Feedback';
export function DeleteAcademic({kind,id,name,onDeleted}:{kind:'subject'|'class'|'section';id:number;name:string;onDeleted:()=>Promise<void>}){
 const [busy,setBusy]=useState(false);const confirm=useConfirm();const toast=useToast();
 return <button className="btn btn-danger btn-sm" disabled={busy||Boolean(sessionStorage.getItem('campus_view'))} aria-label={`Delete ${kind} ${name}`} onClick={async()=>{
   if(!await confirm({title:`Delete ${kind} ${name}?`,body:'Items linked to students or other records cannot be deleted.',tone:'danger',confirmLabel:'Delete'}))return;
   setBusy(true);try{await api.delete(`/institution/academics?kind=${kind}&id=${id}`);await onDeleted();toast.success(`${kind} deleted`);}catch(cause:any){toast.error('Could not delete',cause.message);}finally{setBusy(false);}
 }}>Delete</button>;
}
