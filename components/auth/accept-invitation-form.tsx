'use client';

import {useActionState, useState} from 'react';
import {unstable_rethrow} from 'next/navigation';
import {acceptInvitationAction, type AcceptInvitationState} from '@/app/invite/accept/actions';

const initialState: AcceptInvitationState = {status: 'idle'};

export function AcceptInvitationForm({expectedVersion, idempotencyKey}: {expectedVersion: number; idempotencyKey: string}) {
  const [snapshot] = useState({expectedVersion, idempotencyKey});
  const [state, action, pending] = useActionState(async (previous: AcceptInvitationState, form: FormData): Promise<AcceptInvitationState> => {
    try {return await acceptInvitationAction(previous, form);}
    catch (error) {
      unstable_rethrow(error);
      return {status: 'error', message: 'Er is geen bevestiging van de acceptatie ontvangen. Je keuze blijft staan; probeer dezelfde acceptatie opnieuw.'};
    }
  }, initialState);
  return (
    <form action={action} className="auth-form" onReset={(event) => event.preventDefault()}>
      <input type="hidden" name="expectedVersion" value={snapshot.expectedVersion} />
      <input type="hidden" name="idempotencyKey" value={snapshot.idempotencyKey} />
      {state.message ? <p className="auth-error" role="alert">{state.message}</p> : null}
      <button className="auth-primary" disabled={pending} type="submit">{pending ? 'Uitnodiging controleren…' : 'Uitnodiging veilig accepteren'}</button>
    </form>
  );
}
