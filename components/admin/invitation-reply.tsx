'use client';
import {useState,useTransition} from 'react';
import {useHydrated} from './use-hydrated';
import {replyToAdminInvitationAction} from '@/lib/admin/invitation-actions';

export function AdminInvitationReply({id,version}:{id:string;version:number}){
 const hydrated=useHydrated();const [message,setMessage]=useState('');const [uncertain,setUncertain]=useState<'accept'|'decline'|null>(null);const [pending,start]=useTransition();
 const reply=(decision:'accept'|'decline')=>start(async()=>{
  // The invitation ID is also this recipient's fixed command ID. A timeout
  // always retries the same offer/version/decision, including after reload.
  const result=await replyToAdminInvitationAction({id,version,decision});
  setMessage(result.message);setUncertain(result.state==='unknown'?decision:null);
 });
 return <div><div className="auth-actions"><button className="auth-submit" type="button" disabled={!hydrated||pending||uncertain==='decline'} onClick={()=>reply('accept')}>{pending?'Controleren…':uncertain==='accept'?'Dezelfde acceptatie controleren':'Deze rechten en eindtijd accepteren'}</button><button className="auth-secondary" type="button" disabled={!hydrated||pending||uncertain==='accept'} onClick={()=>reply('decline')}>{uncertain==='decline'?'Dezelfde weigering controleren':'Uitnodiging weigeren'}</button></div>{message&&<p role="status">{message}</p>}</div>;
}
