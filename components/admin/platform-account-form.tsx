'use client';
import {useId,useState,useTransition} from 'react';
import {Button,Field} from '@/components/cluvo/ui';
import {platformAccountChoiceAction} from '@/lib/admin/actions';
import {AdminForm} from './admin-form';

type Choice={value:string;label:string};
export function PlatformAccountForm({action,tenant,values={},options={},initialAccount}:{action:'grant_staff'|'onboard_administrator'|'invite_administrator';tenant?:string;values?:Record<string,unknown>;options?:Record<string,Choice[]>;initialAccount?:Choice}){
 const id=useId();const [choice,setChoice]=useState<Choice|undefined>(initialAccount);const [message,setMessage]=useState('');const [pending,startTransition]=useTransition();
 return <div><section className="admin-form-panel"><h3>Persoonlijk account kiezen</h3><p>Zoek het exacte persoonlijke e-mailadres van de benoemde medewerker. Alleen een geverifieerd bestaand account kan worden geselecteerd.</p>
 <form onSubmit={event=>{event.preventDefault();const email=String(new FormData(event.currentTarget).get('account_email')??'');startTransition(async()=>{try{const result=await platformAccountChoiceAction({email,purpose:action==='grant_staff'?'staff':'initial_administrator',tenant});setChoice(result.choice);setMessage(result.message);}catch{setChoice(undefined);setMessage('Het account kon nu niet veilig worden gecontroleerd. Probeer de controle opnieuw.');}});}}>
 <Field label="Persoonlijk e-mailadres van de beheerder"><input id={id} name="account_email" type="email" autoComplete="off" required maxLength={254} disabled={pending} onChange={()=>{setChoice(undefined);setMessage('');}}/></Field>
 <Button type="submit" className="btn secondary" disabled={pending}>{pending?'Controleren…':'Geverifieerd account controleren'}</Button></form>{message&&<p role="status">{message}</p>}
 {initialAccount&&!choice&&<Button className="btn secondary" onClick={()=>{setChoice(initialAccount);setMessage('Mijn eigen geverifieerde account geselecteerd.');}}>Mijn eigen account kiezen</Button>}</section>
 {choice&&<AdminForm key={choice.value} surface="platform" action={action} values={{...values,auth_user_id:choice.value}} options={{...options,auth_user_id:[choice]}}/>}</div>;
}
