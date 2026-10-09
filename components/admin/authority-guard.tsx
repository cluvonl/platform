'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {adminAccessStatusAction} from '@/lib/admin/actions';

export function AdminAuthorityGuard({surface,club,signature,children}:{surface:'club'|'platform';club?:string;signature:string;children:React.ReactNode}){
 const router=useRouter();const [observed,setObserved]=useState<string|null>(signature);const [serverSnapshot,setServerSnapshot]=useState(signature);const [checking,setChecking]=useState(false);
 if(serverSnapshot!==signature){setServerSnapshot(signature);setObserved(signature);}
 useEffect(()=>{let alive=true,running=false;const check=async()=>{if(running)return;running=true;setChecking(true);try{const result=await adminAccessStatusAction({surface,club});if(!alive)return;setObserved(result.signature??null);if(result.signature!==signature)router.refresh();}catch{if(alive)setObserved(null);}finally{running=false;if(alive)setChecking(false);}};const visible=()=>{if(document.visibilityState==='visible')void check();};
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void check();},15000);window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
 },[surface,club,signature,router]);
 if(observed!==signature)return <section className="secure-empty" role="status"><h1>Beheertoegang opnieuw controleren</h1><p>Je toegang is gewijzigd of kon niet worden bevestigd. De eerdere beheercontext is gesloten.</p><button className="btn secondary" disabled={checking} onClick={()=>window.location.reload()}>Actuele toegang laden</button></section>;
 return children;
}
