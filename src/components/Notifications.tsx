import { useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api-client';
import Modal from '../ui/Modal';
import { ErrorNote } from '../ui/Bits';
type Item={id:number;title:string;message:string;isRead:boolean;createdAt:string};
export default function Notifications(){
 const [open,setOpen]=useState(false);const [items,setItems]=useState<Item[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function load(){setError('');setBusy(true);try{const data=await api.get<{notifications:Item[]}>('/api/me/notifications');setItems(data.notifications);}catch(cause:any){setError(cause.message);}finally{setBusy(false);}}
 async function mark(id?:number){setBusy(true);try{await api.patch(id?'/api/me/notifications':'/api/me/notifications/read-all',id?{notificationIds:[id]}:{});await load();}catch(cause:any){setError(cause.message);}finally{setBusy(false);}}
 return <><button className="icon-btn" aria-label="Notifications" onClick={()=>{setOpen(true);void load();}}><Bell/></button><Modal open={open} onClose={()=>setOpen(false)} title="Notifications"><div className="stack">{error&&<ErrorNote message={error}/>}<button className="btn btn-quiet" disabled={busy} onClick={()=>void mark()}>Mark all read</button>{!items.length&&<p>{busy?'Loading…':'No notifications.'}</p>}{items.map(item=><button key={item.id} disabled={busy||item.isRead} className="list-row" style={{textAlign:'left',opacity:item.isRead ? 0.7 : 1}} onClick={()=>void mark(item.id)}><span className="cell-stack"><b>{item.title}</b><span>{item.message}</span><small>{new Date(item.createdAt).toLocaleString()}</small></span></button>)}</div></Modal></>;
}
