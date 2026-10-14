import { useEffect } from 'react';
import { liveFetch } from '../utils/live-fetch';
import { API_ORIGIN } from '../utils/api';
import { useToast } from '../ui/Feedback';
// The reused editors contain authenticated attachment links. Fetch with the
// desktop credentials before opening them; never put credentials in a URL.
export function AuthenticatedFiles(){
 const toast=useToast();
 useEffect(()=>{
  const urls=new Set<string>();
  const listener=(event:MouseEvent)=>{
   const anchor=(event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement|null;
   if(!anchor)return;
   const href=anchor.getAttribute('href')||'';
   if(!href.startsWith('/api/'))return;
   event.preventDefault();
   void liveFetch(new URL(href,API_ORIGIN)).then(async response=>{
    if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error||'Could not open attachment');
    const url=URL.createObjectURL(await response.blob());urls.add(url);
    const link=document.createElement('a');link.href=url;
    link.download=anchor.download || response.headers.get('content-disposition')?.match(/filename="?([^";]+)/)?.[1] || href.split('/').pop() || 'attachment';
    document.body.append(link);link.click();link.remove();
   }).catch(cause=>toast.error('Could not download attachment',cause.message));
  };
  document.addEventListener('click',listener,true);
  return()=>{document.removeEventListener('click',listener,true);urls.forEach(url=>URL.revokeObjectURL(url));};
 },[toast]);return null;
}
