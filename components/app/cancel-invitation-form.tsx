'use client';

import {useActionState, useState} from 'react';
import {unstable_rethrow} from 'next/navigation';
import {cancelInvitationAction, type CancelInvitationState} from '@/app/c/[club]/huishouden/actions';
import {Button} from '@/components/cluvo/ui';

const initialState: CancelInvitationState = {status: 'idle'};

export function CancelInvitationForm({club, invitationId, version, canCancel}: {club: string; invitationId: string; version: number; canCancel: boolean}) {
  const [snapshot, setSnapshot] = useState<{version: number; key: string} | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [state, action, pending] = useActionState(async (previous: CancelInvitationState, form: FormData): Promise<CancelInvitationState> => {
    setAttempted(true);
    try {return await cancelInvitationAction(previous, form);}
    catch (error) {
      unstable_rethrow(error);
      return {status: 'error', message: 'Er is geen bevestiging van het intrekken ontvangen. Je keuze blijft staan; probeer dezelfde actie opnieuw.'};
    }
  }, initialState);
  if (state.status === 'cancelled') return <p className="secure-success" role="status">{state.message}</p>;
  if (!snapshot) return canCancel ? <Button className="btn secondary" type="button" onClick={() => setSnapshot({version, key: crypto.randomUUID()})}>Uitnodiging intrekken</Button> : null;
  return <form action={action} className="secure-form" aria-label="Uitnodiging intrekken" onReset={(event) => event.preventDefault()}>
    <input type="hidden" name="club" value={club} />
    <input type="hidden" name="invitationId" value={invitationId} />
    <input type="hidden" name="expectedVersion" value={snapshot.version} />
    <input type="hidden" name="idempotencyKey" value={snapshot.key} />
    <p>De persoonlijke uitnodigingslink vervalt zodra het intrekken is bevestigd.</p>
    {state.message ? <p className="auth-error" role="alert">{state.message}</p> : null}
    <div className="row wrap"><Button className="btn primary" disabled={pending} type="submit">{pending ? 'Intrekken…' : 'Bevestig intrekken'}</Button>{!attempted ? <Button className="btn secondary" type="button" onClick={() => setSnapshot(null)}>Laat staan</Button> : null}</div>
  </form>;
}
