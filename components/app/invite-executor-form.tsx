'use client';

import {useActionState} from 'react';
import {inviteExecutorAction, type InviteExecutorState} from '@/app/c/[club]/huishouden/actions';

const initialState: InviteExecutorState = {status: 'idle'};

export function InviteExecutorForm({club, householdId, idempotencyKey}: {club: string; householdId: string; idempotencyKey: string}) {
  const [state, action, pending] = useActionState(inviteExecutorAction, initialState);
  return (
    <form action={action} className="secure-form">
      <input type="hidden" name="club" value={club} />
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="secure-form-row">
        <label>Voornaam<input name="givenName" required maxLength={100} autoComplete="given-name" /></label>
        <label>Achternaam<input name="familyName" required maxLength={150} autoComplete="family-name" /></label>
      </div>
      <label>Persoonlijk e-mailadres<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      <label className="secure-check"><input name="canViewProgress" type="checkbox" /> Mag de gezamenlijke huishoudvoortgang zien</label>
      <label className="secure-check"><input name="canBookFor" type="checkbox" /> Mag na acceptatie voor dit huishouden boeken</label>
      {state.message ? <p className={state.status === 'sent' ? 'secure-success' : 'auth-error'} role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p> : null}
      <button className="auth-primary" disabled={pending || state.status === 'sent'} type="submit">{pending ? 'Veilig verzenden…' : state.status === 'sent' ? 'Uitnodiging verzonden' : 'Nodig extra uitvoerder uit'}</button>
    </form>
  );
}
