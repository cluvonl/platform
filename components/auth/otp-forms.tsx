'use client';

import {useActionState} from 'react';
import {type AuthActionState, requestOtpAction, verifyOtpAction} from '@/app/auth/actions';

const initialState: AuthActionState = {status: 'idle'};

function SubmitButton({children, pending}: {children: React.ReactNode; pending: boolean}) {
  return <button className="auth-primary" type="submit" disabled={pending}>{pending ? 'Even geduld…' : children}</button>;
}

export function RequestOtpForm() {
  const [state, action, pending] = useActionState(requestOtpAction, initialState);
  return (
    <form action={action} className="auth-form" noValidate>
      <label htmlFor="email">Persoonlijk e-mailadres</label>
      <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} aria-describedby={state.message ? 'login-message' : undefined} />
      {state.message ? <p id="login-message" className="auth-error" role="alert">{state.message}</p> : null}
      <SubmitButton pending={pending}>Stuur mijn inlogcode</SubmitButton>
    </form>
  );
}

export function VerifyOtpForm() {
  const [state, action, pending] = useActionState(verifyOtpAction, initialState);
  return (
    <form action={action} className="auth-form" noValidate>
      <label htmlFor="token">Eenmalige code</label>
      <input id="token" name="token" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required aria-describedby={state.message ? 'verify-message' : undefined} />
      {state.message ? <p id="verify-message" className="auth-error" role="alert">{state.message}</p> : null}
      <SubmitButton pending={pending}>Veilig inloggen</SubmitButton>
    </form>
  );
}
