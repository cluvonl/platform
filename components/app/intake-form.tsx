'use client';

import {useActionState} from 'react';
import {saveIntakeAction, type IntakeActionState} from '@/app/c/[club]/intake/actions';

type IntakeRecord = {profile_id: string; version: number; desired_minutes: number | null; answers: Record<string, unknown> | null};
const initialState: IntakeActionState = {status: 'idle'};
function answer(record: IntakeRecord, key: string) { const value = record.answers?.[key]; return typeof value === 'string' ? value : ''; }

export function IntakeForm({club, record, idempotencyKey}: {club: string; record: IntakeRecord; idempotencyKey: string}) {
  const [state, action, pending] = useActionState(saveIntakeAction, initialState);
  return (
    <form action={action} className="secure-form">
      <input type="hidden" name="club" value={club} /><input type="hidden" name="profileId" value={record.profile_id} />
      <input type="hidden" name="expectedVersion" value={record.version} /><input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label>Gewenste inzet in minuten per seizoen<input name="desiredMinutes" type="number" min="0" step="30" defaultValue={record.desired_minutes ?? ''} /></label>
      <label>Beschikbaarheid<textarea name="availability" rows={4} defaultValue={answer(record, 'availability')} placeholder="Bijvoorbeeld: zaterdagochtend en twee avonden per maand" /></label>
      <label>Voorkeuren en ervaring<textarea name="preferences" rows={4} defaultValue={answer(record, 'preferences')} placeholder="Taken die bij je passen of ervaring die je wilt inzetten" /></label>
      <label>Praktische beperkingen<textarea name="practicalLimitations" rows={4} defaultValue={answer(record, 'practical_limitations')} placeholder="Beschrijf alleen wat praktisch nodig is; geen diagnose of medisch bewijs" /></label>
      {state.message ? <p className={state.status === 'saved' ? 'secure-success' : 'auth-error'} role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p> : null}
      <button className="auth-primary" disabled={pending} type="submit">{pending ? 'Opslaan…' : 'Intake veilig opslaan'}</button>
    </form>
  );
}
