'use client';

import {useActionState} from 'react';
import {acceptInvitationAction, type AcceptInvitationState} from '@/app/invite/accept/actions';

const initialState: AcceptInvitationState = {status: 'idle'};

export function AcceptInvitationForm() {
  const [state, action, pending] = useActionState(acceptInvitationAction, initialState);
  return (
    <form action={action} className="auth-form">
      {state.message ? <p className="auth-error" role="alert">{state.message}</p> : null}
      <button className="auth-primary" disabled={pending} type="submit">{pending ? 'Uitnodiging controleren…' : 'Uitnodiging veilig accepteren'}</button>
    </form>
  );
}
