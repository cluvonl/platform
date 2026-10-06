'use client';

import {useActionState, useState} from 'react';
import {unstable_rethrow} from 'next/navigation';
import {inviteExecutorAction, type InviteExecutorState} from '@/app/c/[club]/huishouden/actions';
import {Button} from '@/components/cluvo/ui';

const initialState: InviteExecutorState = {status: 'idle'};

export function InviteExecutorForm({club, householdId, householdVersion, idempotencyKey}: {club: string; householdId: string; householdVersion: number; idempotencyKey: string}) {
  const [retryKey] = useState(idempotencyKey);
  const [expectedHouseholdVersion] = useState(householdVersion);
  const [givenName, setGivenName] = useState(''), [familyName, setFamilyName] = useState(''), [email, setEmail] = useState('');
  const [canViewProgress, setCanViewProgress] = useState(false), [canBookFor, setCanBookFor] = useState(false);
  const [state, action, pending] = useActionState(async (previous: InviteExecutorState, form: FormData): Promise<InviteExecutorState> => {
    try {return await inviteExecutorAction(previous, form);}
    catch (error) {unstable_rethrow(error); return {status: 'error', message: 'Er is geen bevestiging van de uitnodiging ontvangen. Je invoer blijft staan; probeer dezelfde uitnodiging opnieuw.'};}
  }, initialState);
  return (
    <form action={action} className="secure-form" onReset={(event) => event.preventDefault()}>
      <input type="hidden" name="club" value={club} />
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="idempotencyKey" value={retryKey} />
      <input type="hidden" name="expectedHouseholdVersion" value={expectedHouseholdVersion} />
      <fieldset disabled={pending || state.status === 'sent'} className="intake-fields">
      <div className="secure-form-row">
        <label>Voornaam<input name="givenName" required maxLength={100} autoComplete="given-name" value={givenName} onChange={(event) => setGivenName(event.target.value)} /></label>
        <label>Achternaam<input name="familyName" required maxLength={150} autoComplete="family-name" value={familyName} onChange={(event) => setFamilyName(event.target.value)} /></label>
      </div>
      <label>Persoonlijk e-mailadres<input name="email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label className="secure-check"><input name="canViewProgress" type="checkbox" checked={canViewProgress} onChange={(event) => setCanViewProgress(event.target.checked)} /> Mag de gezamenlijke huishoudvoortgang zien</label>
      <label className="secure-check"><input name="canBookFor" type="checkbox" checked={canBookFor} onChange={(event) => setCanBookFor(event.target.checked)} /> Mag na acceptatie voor dit huishouden boeken</label>
      {state.message ? <p className={state.status === 'sent' ? 'secure-success' : 'auth-error'} role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p> : null}
      <Button className="btn primary" disabled={pending || state.status === 'sent'} type="submit">{pending ? 'Verzenden…' : state.status === 'sent' ? 'Uitnodiging verzonden' : 'Nodig extra uitvoerder uit'}</Button>
      </fieldset>
    </form>
  );
}
