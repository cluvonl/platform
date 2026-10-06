'use client';

import {useActionState} from 'react';
import {bookShiftAction, type BookShiftState} from '@/app/c/[club]/diensten/actions';
import {Button} from '@/components/cluvo/ui';

const initialState: BookShiftState = {status: 'idle'};

export type ObligationOption = {id: string; label: string};

export function BookShiftForm({
  club,
  shiftId,
  positionId,
  shiftVersion,
  idempotencyKey,
  obligations,
}: {
  club: string;
  shiftId: string;
  positionId: string;
  shiftVersion: number;
  idempotencyKey: string;
  obligations: ObligationOption[];
}) {
  const [state, action, pending] = useActionState(bookShiftAction, initialState);
  return (
    <form action={action} className="shift-book-form">
      <input type="hidden" name="club" value={club} />
      <input type="hidden" name="shiftId" value={shiftId} />
      <input type="hidden" name="positionId" value={positionId} />
      <input type="hidden" name="shiftVersion" value={shiftVersion} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label>
        Huishouden waarvoor je helpt
        <select name="obligationId" required defaultValue={obligations[0]?.id ?? ''}>
          {obligations.length === 0 ? <option value="">Geen boekbare verplichting</option> : null}
          {obligations.map((obligation) => <option key={obligation.id} value={obligation.id}>{obligation.label}</option>)}
        </select>
      </label>
      {state.message ? <p className={state.status === 'booked' ? 'secure-success' : 'auth-error'} role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p> : null}
      <Button className="btn primary" type="submit" disabled={pending || obligations.length === 0 || state.status === 'booked'}>
        {pending ? 'Boeking controleren…' : state.status === 'booked' ? 'Geboekt' : 'Boek deze plek'}
      </Button>
    </form>
  );
}
