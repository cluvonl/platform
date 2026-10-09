'use client';

import {useActionState, useState} from 'react';
import {unstable_rethrow} from 'next/navigation';
import {useRouter} from 'next/navigation';
import {checkSportlinkAction, saveSportlinkAction} from '@/app/c/[club]/beheer/sportlink/actions';
import {Button} from '@/components/cluvo/ui';
import type {SportlinkActionState} from '@/lib/sportlink/contracts';

type Scope = {club: string; connectionId: string; expectedVersion: number; idempotencyKey: string};
const initial: SportlinkActionState = {status: 'idle'};
function HiddenScope({scope}: {scope: Scope}) {
  return <><input type="hidden" name="club" value={scope.club} /><input type="hidden" name="connectionId" value={scope.connectionId} />
    <input type="hidden" name="expectedVersion" value={scope.expectedVersion} /><input type="hidden" name="idempotencyKey" value={scope.idempotencyKey} /></>;
}
function Result({state}: {state: SportlinkActionState}) {
  return state.message ? <p className={state.status === 'confirmed' && (!state.testCode || state.testCode === 'VERIFIED_READ_ACCESS') ? 'secure-success' : 'auth-error'}
    role={state.status === 'confirmed' ? 'status' : 'alert'} aria-live="polite">{state.message}</p> : null;
}
function Refresh({state}: {state: SportlinkActionState}) {
  const router = useRouter();
  return state.status === 'confirmed' || state.status === 'rejected' ? <Button type="button" className="btn secondary" onClick={() => router.refresh()}>Actuele koppeling bekijken</Button> : null;
}

export function SportlinkConfigureForm(props: Scope & {configured: boolean}) {
  // Freeze version/key for this attempt. A lost response retries the same semantic command.
  const [scope] = useState<Scope>({club: props.club, connectionId: props.connectionId, expectedVersion: props.expectedVersion, idempotencyKey: props.idempotencyKey});
  const [clientId, setClientId] = useState('');
  const [state, action, pending] = useActionState(async (previous: SportlinkActionState, formData: FormData) => {
    try {
      const result = await saveSportlinkAction(previous, formData);
      if (result.status === 'confirmed') setClientId('');
      return result;
    } catch (error) {unstable_rethrow(error); return {status: 'unknown', message: 'Je hebt nog geen bevestiging ontvangen. De invoer blijft op dit scherm staan; probeer dezelfde handeling opnieuw.'} as SportlinkActionState;}
  }, initial);
  return <form action={action} className="secure-form" onReset={(event) => event.preventDefault()}>
    <HiddenScope scope={scope} />
    <fieldset disabled={pending || state.status === 'confirmed'} className="intake-fields">
      <label htmlFor="sportlink-client-id">{props.configured ? 'Nieuwe Sportlink ClientID' : 'Sportlink ClientID'}
        <input id="sportlink-client-id" name="clientId" type="password" required minLength={6} maxLength={128} pattern="[A-Za-z0-9_-]{6,128}" autoComplete="off" spellCheck={false}
          aria-describedby="sportlink-client-id-help" value={clientId} onChange={(event) => setClientId(event.target.value)} /></label>
      <p id="sportlink-client-id-help" className="small-text">Gebruik de ClientID die Sportlink voor deze vereniging heeft uitgegeven. De opgeslagen waarde wordt hier niet teruggetoond.</p>
      <Result state={state} />
      <Button type="submit" className="btn primary" disabled={pending || state.status === 'confirmed'}>{pending ? 'Veilig opslaan…' : 'Koppeling opslaan'}</Button>
    </fieldset>
    <Refresh state={state} />
  </form>;
}

export function SportlinkTestForm(props: Scope) {
  const [scope] = useState<Scope>(props);
  const [state, action, pending] = useActionState(async (previous: SportlinkActionState, formData: FormData) => {
    try {return await checkSportlinkAction(previous, formData);}
    catch (error) {unstable_rethrow(error); return {status: 'unknown', message: 'De controle is nog niet bevestigd. Probeer dezelfde controle opnieuw.'} as SportlinkActionState;}
  }, initial);
  return <form action={action} className="secure-form">
    <HiddenScope scope={scope} />
    <p className="small-text">Controleer of Sportlink het wedstrijdprogramma voor deze vereniging kan leveren.</p>
    <Result state={state} />
    <Button type="submit" className="btn secondary" disabled={pending || state.status === 'confirmed'}>{pending ? 'Verbinding controleren…' : 'Verbinding controleren'}</Button>
    <Refresh state={state} />
  </form>;
}
