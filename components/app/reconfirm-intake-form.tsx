'use client';

import {useActionState, useState} from 'react';
import Link from 'next/link';
import {unstable_rethrow} from 'next/navigation';
import {reconfirmIntakeAction, type ReconfirmIntakeState} from '@/app/c/[club]/intake/herbevestigen/actions';
import type {IntakeReconfirmation} from '@/lib/data/intake-reconfirmation';
import {Field, Textarea} from '@/components/cluvo/ui';

const initialState: ReconfirmIntakeState = {status:'idle'};
export function ReconfirmIntakeForm({club, item, idempotencyKey}: {club: string; item: IntakeReconfirmation; idempotencyKey: string}) {
  const [baseline] = useState({itemVersion:item.item_version, profileVersion:item.profile_version, idempotencyKey, available:item.can_confirm});
  const [reviewed, setReviewed] = useState(false), [reason, setReason] = useState('');
  const [state, action, pending] = useActionState(async (previous: ReconfirmIntakeState, form: FormData) => {
    try {return await reconfirmIntakeAction(previous, form);}
    catch (error) {unstable_rethrow(error); return {status:'error' as const, message:'Er is geen bevestiging ontvangen. Je controle blijft staan; probeer hetzelfde verzoek opnieuw.'};}
  }, initialState);
  const intakeUrl = `/c/${encodeURIComponent(club)}/intake?profile=${encodeURIComponent(item.profile_id)}`;
  if (state.status === 'confirmed' || (!baseline.available && item.state === 'confirmed')) return <div className="stack">
    <p className="secure-success" role="status">{state.message ?? `Je intake is herbevestigd voor ${item.season_name}.`}</p>
    <Link className="btn secondary" href={intakeUrl}>Terug naar je intake</Link>
  </div>;
  if (!baseline.available) return <div className="stack"><p>Deze herbevestiging kan nu niet worden afgerond. Sla eerst je persoonlijke intake op of open de actuele seizoensaanvraag.</p><Link className="btn secondary" href={intakeUrl}>Open je intake</Link></div>;
  return <form action={action} className="stack">
    <input type="hidden" name="club" value={club} /><input type="hidden" name="itemId" value={item.item_id} />
    <input type="hidden" name="profileId" value={item.profile_id} />
    <input type="hidden" name="expectedItemVersion" value={baseline.itemVersion} />
    <input type="hidden" name="expectedProfileVersion" value={baseline.profileVersion} />
    <input type="hidden" name="idempotencyKey" value={baseline.idempotencyKey} />
    <fieldset disabled={pending} className="intake-fields stack">
      {!item.is_self ? <Field label="Reden of context van de hulp"><Textarea name="assistanceReason" maxLength={2_000} value={reason} onChange={(event)=>setReason(event.target.value)} required /></Field> : null}
      <label className="row"><input type="checkbox" name="reviewed" checked={reviewed} onChange={(event)=>setReviewed(event.target.checked)} required />Ik heb de opgeslagen intake gecontroleerd en bevestig deze voor {item.season_name}.</label>
      {state.message ? <p className="auth-error" role="alert">{state.message}</p> : null}
      <div className="row wrap"><button type="submit" className="btn primary" disabled={!reviewed || pending}>{pending ? 'Bevestigen…' : 'Intake herbevestigen'}</button><Link className="btn secondary" href={intakeUrl}>Antwoorden aanpassen</Link></div>
    </fieldset>
  </form>;
}
