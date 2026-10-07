'use client';

import {useActionState, useState} from 'react';
import {unstable_rethrow} from 'next/navigation';
import {updateAssistanceAction, type AssistanceState} from '@/app/c/[club]/huishouden/intakehulp/actions';
import type {IntakeAssistanceContext} from '@/lib/data/intake-assistance';
import {Button, Checkbox, Field, Hint, Textarea} from '@/components/cluvo/ui';

async function submit(previous: AssistanceState, form: FormData): Promise<AssistanceState> {
  try {return await updateAssistanceAction(previous, form);}
  catch (error) {unstable_rethrow(error); return {status:'error', message:'Er is geen bevestiging ontvangen. Je verzoek blijft staan; probeer hetzelfde verzoek opnieuw.'};}
}
const formatMoment = (value: string, timezone: string) => new Intl.DateTimeFormat('nl-NL', {dateStyle:'medium', timeStyle:'short', timeZone:timezone}).format(new Date(value));

export function GrantIntakeAssistanceForm({club, context, idempotencyKey, baseTime}: {club: string; context: IntakeAssistanceContext; idempotencyKey: string; baseTime: number}) {
  const [initial] = useState({householdVersion:context.household_version, idempotencyKey, baseTime, available:context.can_grant});
  const [state, action, pending] = useActionState(submit, {status:'idle'});
  const [profile, setProfile] = useState(''), [helper, setHelper] = useState(''), [days, setDays] = useState(30);
  const [reason, setReason] = useState(''), [reviewed, setReviewed] = useState(false);
  const endsAt = new Date(initial.baseTime + days * 86_400_000).toISOString();
  const samePerson = context.subjects.find(({profile_id}) => profile_id === profile)?.person_id === helper && helper !== '';
  const locked = pending || state.status === 'confirmed' || !initial.available;
  return <form action={action} className="stack intake-form" aria-label="Intakehulp verlenen">
    <input type="hidden" name="kind" value="grant" /><input type="hidden" name="club" value={club} />
    <input type="hidden" name="householdId" value={context.household_id} /><input type="hidden" name="expectedHouseholdVersion" value={initial.householdVersion} />
    <input type="hidden" name="idempotencyKey" value={initial.idempotencyKey} /><input type="hidden" name="endsAt" value={endsAt} />
    <Field label="Persoon die hulp krijgt"><select className="select border border-input px-3" name="profileId" required value={profile} onChange={(event) => setProfile(event.target.value)} disabled={locked}><option value="">Kies een persoon</option>{context.subjects.map((subject) => <option key={subject.profile_id} value={subject.profile_id}>{subject.display_name}</option>)}</select></Field>
    <Field label="Hulpverlener"><select className="select border border-input px-3" name="helperPersonId" required value={helper} onChange={(event) => setHelper(event.target.value)} disabled={locked}><option value="">Kies een hulpverlener</option>{context.helpers.map((person) => <option key={person.person_id} value={person.person_id}>{person.display_name}</option>)}</select></Field>
    <Field label="Duur van de hulp"><select className="select border border-input px-3" value={days} onChange={(event) => setDays(Number(event.target.value))} disabled={locked}><option value={7}>7 dagen</option><option value={30}>30 dagen</option><option value={90}>90 dagen</option></select></Field>
    <p className="small-text">Geldig tot {formatMoment(endsAt, context.timezone)}. Je kunt de machtiging eerder intrekken.</p>
    <Field label="Reden van de intakehulp"><Textarea name="reason" required maxLength={2_000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} disabled={locked} /></Field>
    <p className="small-text">Beschrijf de praktische hulp. Medische gegevens zijn niet nodig.</p>
    <label className="checkline"><Checkbox name="reviewed" required checked={reviewed} onCheckedChange={(value) => setReviewed(value === true)} disabled={locked} /><span>Ik heb de persoon, hulpverlener en periode gecontroleerd.</span></label>
    {samePerson ? <Hint>Voor de eigen persoonlijke intake is geen machtiging nodig. Kies een andere hulpverlener.</Hint> : null}
    {state.message ? <p role={state.status === 'error' ? 'alert' : 'status'} className={state.status === 'error' ? 'auth-error' : 'small-text'}>{state.message}</p> : null}
    <div><Button type="submit" className="btn primary" disabled={locked || samePerson}>{pending ? 'Machtiging vastleggen…' : state.status === 'confirmed' ? 'Machtiging vastgelegd' : 'Intakehulp verlenen'}</Button></div>
  </form>;
}

export function RevokeIntakeAssistanceForm({club, householdId, householdVersion, delegation, idempotencyKey}: {club: string; householdId: string; householdVersion: number; delegation: IntakeAssistanceContext['delegations'][number]; idempotencyKey: string}) {
  const [initial] = useState({householdVersion, delegationVersion:delegation.version, idempotencyKey, available:delegation.can_revoke});
  const [state, action, pending] = useActionState(submit, {status:'idle'});
  const [reason, setReason] = useState(''), [reviewed, setReviewed] = useState(false), [open, setOpen] = useState(false);
  const locked = pending || state.status === 'confirmed';
  if (!initial.available) return null;
  return <div className="stack">
    <div><Button type="button" className="btn secondary" onClick={() => setOpen(!open)}>{open ? 'Intrekken sluiten' : 'Intakehulp intrekken'}</Button></div>
    {open ? <form action={action} className="stack intake-form" aria-label={`Intakehulp intrekken voor ${delegation.subject_name}`}>
      <input type="hidden" name="kind" value="revoke" /><input type="hidden" name="club" value={club} />
      <input type="hidden" name="householdId" value={householdId} /><input type="hidden" name="delegationId" value={delegation.delegation_id} />
      <input type="hidden" name="expectedHouseholdVersion" value={initial.householdVersion} /><input type="hidden" name="expectedDelegationVersion" value={initial.delegationVersion} />
      <input type="hidden" name="idempotencyKey" value={initial.idempotencyKey} />
      <Field label="Reden voor intrekken"><Textarea name="reason" required maxLength={2_000} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} disabled={locked} /></Field>
      <label className="checkline"><Checkbox name="reviewed" required checked={reviewed} onCheckedChange={(value) => setReviewed(value === true)} disabled={locked} /><span>Ik trek deze machtiging voor intakehulp in.</span></label>
      {state.message ? <p role={state.status === 'error' ? 'alert' : 'status'} className={state.status === 'error' ? 'auth-error' : 'small-text'}>{state.message}</p> : null}
      <div><Button type="submit" className="btn primary" disabled={locked}>{pending ? 'Intrekken…' : state.status === 'confirmed' ? 'Machtiging ingetrokken' : 'Intrekken bevestigen'}</Button></div>
    </form> : null}
  </div>;
}
