'use client';

import {useActionState, useState, type ReactNode} from 'react';
import Link from 'next/link';
import {Check} from 'lucide-react';
import {saveIntakeAction, type IntakeActionState} from '@/app/c/[club]/intake/actions';
import {Avatar, Badge, Btn, Button, CheckList, Field, Hint, Input, Modal, Panel, Textarea, Toggle} from '@/components/cluvo/ui';
import {AccountHelpBanner} from '@/components/app/help-provider';
import {intakeAnswerList, intakeHoursFromMinutes, intakeMinutesFromHours, intakeUnavailabilityDates} from '@/lib/domain/intake.mjs';
import {intakeSkills, intakeRoleInterests, intakeAvailability, intakeTraining} from '@/lib/domain/intake-options';

export type IntakeRecord = {profile_id: string; household_context_id: string; version: number; status: string; desired_minutes: number | null; answers: Record<string, unknown> | null};
export type IntakeHousehold = {household_id: string; label: string};
const initialState: IntakeActionState = {status: 'idle'};
const steps = ['Over jou', 'Talenten', 'Beschikbaarheid', 'Afronden'];
const text = (value: unknown) => typeof value === 'string' ? value : '';
const extraOptions = (options: string[], selected: string[]) => [...new Set([...options, ...selected])];
function ChoiceField({label, children}: {label: string; children: ReactNode}) {
  return <div className="field" role="group" aria-label={label}><span>{label}</span>{children}</div>;
}

export function IntakeForm({club, name, assisted, record, categories, household, idempotencyKey}: {
  club: string; name: string; assisted: boolean; record: IntakeRecord; categories: string[]; household: IntakeHousehold | null; idempotencyKey: string;
}) {
  const answers = record.answers ?? {};
  // A focus/refresh may update server props while this draft is still being
  // edited. Only our own confirmed save may advance the draft's baseline.
  const [baseline] = useState({version: record.version, idempotencyKey});
  const [step, setStep] = useState(0), [houseOpen, setHouseOpen] = useState(false), [validation, setValidation] = useState('');
  const [experience, setExperience] = useState(text(answers.experience));
  const [assistanceReason, setAssistanceReason] = useState('');
  const [preferences, setPreferences] = useState(intakeAnswerList(answers.preferences, categories));
  const [skills, setSkills] = useState(intakeAnswerList(answers.skills, intakeSkills));
  const [interests, setInterests] = useState(intakeAnswerList(answers.fixed_role_interest, intakeRoleInterests));
  const [availability, setAvailability] = useState(intakeAnswerList(answers.availability, intakeAvailability));
  const [training, setTraining] = useState(intakeAnswerList(answers.training_needs, intakeTraining));
  const [buddy, setBuddy] = useState(answers.buddy_requested === true);
  const [reserve, setReserve] = useState(answers.reserve_willing === true);
  const [limitations, setLimitations] = useState(text(answers.practical_limitations));
  const [monthlyHours, setMonthlyHours] = useState(intakeHoursFromMinutes(answers.desired_monthly_minutes));
  const [unavailable, setUnavailable] = useState(Array.isArray(answers.unavailability) ? answers.unavailability.join(', ') : text(answers.unavailability));
  const [state, action, pending] = useActionState(async (previous: IntakeActionState, form: FormData): Promise<IntakeActionState> => {
    try { return await saveIntakeAction(previous, form); }
    catch { return {...previous, status: 'error', message: 'Er is geen bevestiging van de opslag ontvangen. Je antwoorden blijven staan; probeer het opnieuw.'}; }
  }, initialState);
  const proceed = () => {
    if (step === 0 && assisted && !assistanceReason.trim()) {setValidation('Leg de reden of context van de hulp vast.'); return;}
    if (step === 2) {
      try {
        intakeMinutesFromHours(monthlyHours);
        try { intakeUnavailabilityDates(unavailable); }
        catch {if (typeof answers.unavailability !== 'string' || answers.unavailability !== unavailable) throw new Error('INVALID_UNAVAILABILITY');}
      }
      catch { setValidation('Gebruik een geldig aantal uren (bijvoorbeeld 2 of 1:30) en echte datums zoals 2026-10-10.'); return; }
    }
    setValidation(''); setStep(Math.min(3, step + 1));
  };
  return <>
    <div className="wizard">
      <div className="filterbar">
        <Avatar name={name} /><b>{name}</b>
        <Badge tone={record.status === 'draft' && state.status !== 'saved' ? 'amber' : 'green'}>{record.status === 'draft' && state.status !== 'saved' ? 'Nog in te vullen' : 'Intake opgeslagen'}</Badge>
        {household ? <Btn variant="secondary" onClick={() => setHouseOpen(true)}>Huishouddossier</Btn> : null}
      </div>
      <Panel>
        <form action={action} onSubmit={(event) => {if (step !== 3) {event.preventDefault(); proceed();}}}>
          <input type="hidden" name="club" value={club} /><input type="hidden" name="profileId" value={record.profile_id} />
          <input type="hidden" name="expectedVersion" value={state.version ?? baseline.version} /><input type="hidden" name="idempotencyKey" value={state.idempotencyKey ?? baseline.idempotencyKey} />
          <input type="hidden" name="experience" value={experience} /><input type="hidden" name="practicalLimitations" value={limitations} />
          <input type="hidden" name="assistanceReason" value={assistanceReason} />
          <input type="hidden" name="monthlyHours" value={monthlyHours} /><input type="hidden" name="unavailability" value={unavailable} />
          <input type="hidden" name="buddyRequested" value={String(buddy)} /><input type="hidden" name="reserveWilling" value={String(reserve)} />
          {Object.entries({preferences, skills, availability, trainingNeeds: training, fixedRoleInterest: interests}).flatMap(([key, values]) => values.map((value) => <input key={`${key}-${value}`} type="hidden" name={key} value={value} />))}
          <fieldset disabled={pending} className="intake-fields">
            <ol className="stepper" aria-label="Intakestappen">{steps.map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined}><span className={index === step ? 'active' : ''}>{index + 1}. {label}</span></li>)}</ol>
            {step === 0 ? <>
              <h2>Fijn dat je meedoet, {name.split(' ')[0]}.</h2>
              <p className="body-copy">Deze intake is van jou persoonlijk. Samen met de andere uitvoerders draag je bij aan het huishouden. Je kunt je antwoorden altijd aanpassen.</p>
              {assisted ? <Hint tone="amber">Je helpt {name} met een expliciete machtiging. Jouw account en de persoon namens wie je opslaat worden vastgelegd.</Hint> : null}
              {household ? <Hint>{household.label} · jouw persoonlijke dossiercontext</Hint> : null}
              <div className="form-grid">
                <Field label="Praktische ervaring"><Textarea maxLength={2_000} placeholder="Bijvoorbeeld: horeca, communicatie, techniek of organiseren" value={experience} onChange={(event) => setExperience(event.target.value)} /></Field>
                <Toggle label="Ik start graag samen met een ervaren maatje" checked={buddy} onChange={setBuddy} />
                {assisted ? <Field label="Reden of context van de hulp"><Textarea maxLength={2_000} value={assistanceReason} onChange={(event) => setAssistanceReason(event.target.value)} /></Field> : null}
              </div>
            </> : step === 1 ? <>
              <h2>Waar word jij blij van?</h2><p className="body-copy">Je voorkeuren helpen ons passende taken en functies te vinden.</p>
              <div className="stack">
                <ChoiceField label="Voorkeurstaken"><CheckList values={extraOptions(categories, preferences)} selected={preferences} onChange={setPreferences} /></ChoiceField>
                <ChoiceField label="Jouw talenten"><CheckList values={extraOptions(intakeSkills, skills)} selected={skills} onChange={setSkills} /></ChoiceField>
                <ChoiceField label="Interesse in een vaste functie"><CheckList values={extraOptions(intakeRoleInterests, interests)} selected={interests} onChange={setInterests} /></ChoiceField>
              </div>
            </> : step === 2 ? <>
              <h2>Wanneer past het bij jou?</h2><p className="body-copy">Voorkeuren helpen bij de planning. Een inschrijving is altijd een bewuste afspraak.</p>
              <div className="stack">
                <ChoiceField label="Beschikbaarheid"><CheckList values={extraOptions(intakeAvailability, availability)} selected={availability} onChange={setAvailability} /></ChoiceField>
                <Field label="Gewenste inzet per maand (uur)" hint="Bijvoorbeeld 2 of 1:30. Leeg betekent nog niet ingevuld."><Input inputMode="decimal" maxLength={20} value={monthlyHours} onChange={(event) => setMonthlyHours(event.target.value)} /></Field>
                <Field label="Wat lukt minder goed?" hint="Beschrijf praktische grenzen, geen diagnose of bewijsstukken."><Textarea maxLength={2_000} value={limitations} onChange={(event) => setLimitations(event.target.value)} /></Field>
                <Field label="Verhinderde datums" hint="Datums gescheiden door een komma, bijvoorbeeld 2026-10-10, 2026-10-17. Bestaande afspraken blijven staan."><Input maxLength={2_000} value={unavailable} onChange={(event) => setUnavailable(event.target.value)} /></Field>
                <ChoiceField label="Wat zou je willen leren?"><CheckList values={extraOptions(intakeTraining, training)} selected={training} onChange={setTraining} /></ChoiceField>
                <Toggle label="Je mag mij benaderen voor een last-minute plek" checked={reserve} onChange={setReserve} />
              </div>
            </> : <>
              <h2>Dit past bij jou.</h2><p className="body-copy">Controleer je voorkeuren. Je antwoorden zijn persoonlijk en geven geen nieuwe rechten of vrijstelling.</p>
              <div className="detail-meta">
                {Object.entries({'Praktische ervaring': experience || 'Nog geen', 'Voorkeuren': preferences.join(', ') || 'Nog geen', 'Talenten': skills.join(', ') || 'Nog geen', 'Vaste functie': interests.join(', ') || 'Nog geen', 'Beschikbaarheid': availability.join(', ') || 'In overleg', 'Gewenste maandinzet': monthlyHours ? `${monthlyHours} uur` : 'Nog niet ingevuld', 'Praktische grenzen': limitations || 'Geen opgegeven', 'Verhinderde datums': unavailable || 'Geen opgegeven', 'Leerwensen': training.join(', ') || 'Nog geen', 'Maatje': buddy ? 'Graag' : 'Niet gevraagd', 'Reservepool': reserve ? 'Ja, je mag mij benaderen' : 'Nee'}).map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}
              </div><Hint>Alleen de profielhouder en expliciet gemachtigde helpers hebben toegang tot deze antwoorden. Reservebereidheid is geen inschrijving.</Hint>
            </>}
            {validation ? <p className="auth-error" role="alert">{validation}</p> : null}
            {state.message ? <p className={state.status === 'saved' ? 'secure-success' : 'auth-error'} role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p> : null}
            <div className="modal-actions between"><Btn variant="secondary" disabled={step === 0 || pending} onClick={() => {setValidation(''); setStep(step - 1);}}>Vorige</Btn>
              {step < 3 ? <Btn disabled={pending} onClick={proceed}>Verder</Btn> : <Button className="btn primary" type="submit" disabled={pending}><Check size={17} />{pending ? 'Opslaan…' : 'Intake opslaan'}</Button>}
            </div>
          </fieldset>
        </form>
      </Panel>
    </div>
    {houseOpen && household ? <Modal open onClose={() => setHouseOpen(false)} title={household.label} description="Jouw persoonlijke dossiercontext">
      <AccountHelpBanner topicId="household.overview" />
      <p className="body-copy">De gezamenlijke seizoensstand en jouw dossierrechten staan in het overzicht. Een intake verandert het huishoudelijke urendoel niet.</p>
      <div className="modal-actions"><Btn variant="secondary" onClick={() => setHouseOpen(false)}>Sluiten</Btn><Link className="btn primary" href={`/c/${encodeURIComponent(club)}/overzicht?household=${household.household_id}`}>Bekijk huishoudvoortgang</Link></div>
    </Modal> : null}
  </>;
}
