'use client';

import {useActionState} from 'react';
import {confirmAttendanceAction, type AttendanceState} from '@/app/c/[club]/beheer/presentie/actions';

const initialState: AttendanceState = {status: 'idle'};

export function AttendanceForm({club, bookingId, bookingVersion, idempotencyKey, creditMinutes}: {club: string; bookingId: string; bookingVersion: number; idempotencyKey: string; creditMinutes: number}) {
  const [state, action, pending] = useActionState(confirmAttendanceAction, initialState);
  return (
    <form action={action} className="attendance-form">
      <input type="hidden" name="club" value={club} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="bookingVersion" value={bookingVersion} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label>Uitkomst<select name="result" defaultValue="present"><option value="present">Aanwezig — {creditMinutes} min</option><option value="partial">Gedeeltelijk</option><option value="no_show">Niet verschenen</option><option value="club_cancelled">Door club geannuleerd</option></select></label>
      <label>Toegekende minuten<input name="awardedMinutes" inputMode="numeric" type="number" min="0" max={creditMinutes} placeholder="Alleen bij gedeeltelijk/geannuleerd" /></label>
      <label>Reden<input name="reason" maxLength={500} placeholder="Verplicht bij gedeeltelijk/geannuleerd" /></label>
      {state.message ? <p className={state.status === 'confirmed' ? 'secure-success' : 'auth-error'} role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p> : null}
      <button className="auth-primary" type="submit" disabled={pending || state.status === 'confirmed'}>{pending ? 'Controleren…' : state.status === 'confirmed' ? 'Bevestigd' : 'Bevestig presentie'}</button>
    </form>
  );
}
