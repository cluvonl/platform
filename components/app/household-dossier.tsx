'use client';

import {useState} from 'react';
import Link from 'next/link';
import type {HouseholdDossier} from '@/lib/data/household';
import {Avatar, Badge, Btn, Empty, Hint, Progress} from '@/components/cluvo/ui';
import {AccountHelpBanner} from './help-provider';
import {InviteExecutorForm} from './invite-executor-form';
import {CancelInvitationForm} from './cancel-invitation-form';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';

const tabs = ['Overzicht', 'Personen', 'Afspraken', 'Historie'];
const historyLabels: Record<string, string> = {
  'household.invitation_created': 'Persoonlijke uitnodiging klaargezet',
  'household.invitation_accepted': 'Uitnodiging geaccepteerd',
  'household.invitation_cancelled': 'Persoonlijke uitnodiging ingetrokken',
  'household.split_applied': 'Beoordeelde dossierwijziging verwerkt',
  'booking.created': 'Taak geboekt', 'attendance.confirmed': 'Uitvoering beoordeeld',
  'booking.cancelled': 'Taak afgemeld', 'booking.transferred': 'Taak overgenomen',
};
const deliveryLabels: Record<string, string> = {pending: 'Klaargezet', sent: 'Verzonden', delivery_failed: 'Verzending mislukt', accepted: 'Geaccepteerd', cancelled: 'Ingetrokken'};
const hours = (minutes: number) => new Intl.NumberFormat('nl-NL', {maximumFractionDigits: 1}).format(minutes / 60);

export function HouseholdDossierTabs({club, dossier, invitationKey, canManageIntakeAssistance = false}: {club: string; dossier: HouseholdDossier; invitationKey: string; canManageIntakeAssistance?: boolean}) {
  const [tab, setTab] = useState(0), [inviteOpen, setInviteOpen] = useState(false);
  const household = dossier.household;
  const season = dossier.seasons.find(({season_id}) => season_id === dossier.selected_season_id);
  return <Tabs value={String(tab)} onValueChange={(value) => setTab(Number(value))}>
    <TabsList className="segments" aria-label="Huishouddossier">{tabs.map((label, index) => <TabsTrigger value={String(index)} key={label}>{label}</TabsTrigger>)}</TabsList>
    <TabsContent value={String(tab)} aria-label={tabs[tab]} className="stack household-dossier-content">
      {tab === 0 ? <>
        <AccountHelpBanner topicId="household.overview" />
        {dossier.seasons.length > 1 ? <form method="get" className="workspace-selection"><input type="hidden" name="household" value={household.household_id} /><label>Seizoen<select name="season" defaultValue={dossier.selected_season_id ?? ''}><option disabled value="">Kies een seizoen</option>{dossier.seasons.map((item) => <option value={item.season_id} key={item.season_id}>{item.name}</option>)}</select></label><button className="btn secondary" type="submit">Toon dossier</button></form> : null}
        {season ? <p className="small-text">Seizoen {season.name}</p> : null}
        {!household.can_view_progress ? <Hint>Je hebt toegang tot dit dossier. Gezamenlijke voortgang vraagt een afzonderlijk dossierrecht.</Hint> : dossier.balances.length === 0 ? <Empty title={season ? 'Nog geen seizoensverplichting' : 'Kies een seizoen'} text={season ? 'Aan dit dossier is voor dit seizoen nog geen verplichting gekoppeld.' : 'De dossierstand hoort bij één gekozen seizoen.'} /> : dossier.balances.map((balance, index) => <section className="stack" key={balance.obligation_id} aria-label={dossier.balances.length > 1 ? `Verplichting ${index + 1}` : 'Seizoensstand'}>
          {dossier.balances.length > 1 ? <h3>Verplichting {index + 1}</h3> : null}
          <div className="three-grid">{[['Bevestigd', balance.confirmed_minutes, 'Uitgevoerd dit seizoen'], ['Gepland', balance.planned_minutes, 'Nog te doen'], ['Resterend', balance.remaining_minutes, `Van ${hours(balance.effective_target_minutes)} uur`]].map(([label, minutes, detail]) => <div className="stat" key={label}><span>{label}</span><strong>{hours(minutes as number)} uur</strong><p>{detail}</p></div>)}</div>
          <Progress value={balance.structurally_covered || balance.effective_target_minutes === 0 ? 100 : Math.min(100, Math.max(0, 100 * balance.confirmed_minutes / balance.effective_target_minutes))} />
          <div className="row wrap"><Badge tone={balance.remaining_minutes === 0 ? 'green' : 'coral'}>{balance.structurally_covered ? 'Voldaan via vaste inzet' : `${hours(balance.remaining_minutes)} uur te gaan`}</Badge><span className="small-text">Te bevestigen: {hours(balance.pending_minutes)} uur · Wintertekort: {hours(balance.winter_deficit_minutes)} uur</span></div>
          {(balance.open_dispute_count ?? 0) > 0 ? <Hint tone="amber">De stand wordt beoordeeld. Definitieve afrekening wacht op deze beoordeling.</Hint> : null}
        </section>)}
        <Hint>Een dossierverwijzing geeft geen toegang. Iedere uitvoerder gebruikt een eigen geverifieerd account en expliciete rechten.</Hint>
        {household.can_invite_executor ? <div><Btn variant="secondary" onClick={() => setInviteOpen(!inviteOpen)}>{inviteOpen ? 'Uitnodiging sluiten' : 'Persoon uitnodigen'}</Btn></div> : null}
        {inviteOpen && household.can_invite_executor ? <InviteExecutorForm club={club} householdId={household.household_id} householdVersion={household.version} idempotencyKey={invitationKey} /> : null}
      </> : tab === 1 ? <>
        <AccountHelpBanner topicId="household.people" />
        {canManageIntakeAssistance ? <div><Link className="btn secondary" href={`/c/${encodeURIComponent(club)}/huishouden/intakehulp?household=${household.household_id}`}>Intakehulp beheren</Link></div> : null}
        {dossier.people.length ? dossier.people.map((person) => <div className="row between wrap" key={`${person.person_id}-${person.kind}`}><div className="row"><Avatar name={person.display_name} /><div><b>{person.display_name}</b><p className="small-text">{person.is_self ? 'Jouw persoonlijke profiel' : 'Expliciet toegestane dossierkoppeling'} · {person.verified ? 'Identiteit gekoppeld' : 'Nog geen geverifieerde koppeling'}</p></div></div>{person.profile_id ? <Link className="btn secondary" href={`/c/${encodeURIComponent(club)}/intake?profile=${person.profile_id}`}>{person.intake_status === 'draft' ? 'Intake invullen' : 'Intake bekijken'}</Link> : <Badge>Persoonlijke intake afgeschermd</Badge>}</div>) : <Empty title="Geen zichtbare persoonskoppelingen" text="Persoonlijke gegevens vragen een expliciet recht." />}
        {dossier.invitations.map((invitation) => <div className="stack" key={invitation.invitation_id}><div className="row between wrap"><div><b>{invitation.display_name}</b><p className="small-text">Persoonlijke uitnodiging</p></div><Badge tone={invitation.delivery_status === 'accepted' ? 'green' : invitation.delivery_status === 'delivery_failed' || invitation.expired ? 'amber' : 'neutral'}>{invitation.expired && !['accepted', 'cancelled'].includes(invitation.delivery_status) ? 'Verlopen' : deliveryLabels[invitation.delivery_status] ?? 'Onbekende verzendstatus'}</Badge></div><CancelInvitationForm club={club} invitationId={invitation.invitation_id} version={invitation.version} canCancel={invitation.can_cancel} /></div>)}
        <Hint>Alleen personen binnen jouw rechten worden getoond. Een gedeeld dossier opent geen persoonlijke antwoorden van een andere ouder.</Hint>
      </> : tab === 2 ? <>
        <AccountHelpBanner topicId="household.agreements" />
        <div className="detail-meta"><div><span>Persoonlijke intakes</span><b>{household.separated_parents ? 'Gescheiden ouders · onafhankelijke intakes' : 'Eigen antwoorden per uitvoerder'}</b></div><div><span>Dossierstatus</span><b>{{active: 'Actief', preparing: 'In voorbereiding', review_hold: 'In beoordeling', archived: 'Gearchiveerd'}[household.status] ?? household.status}</b></div><div><span>Gezamenlijke voortgang bekijken</span><b>{household.can_view_progress ? 'Toegestaan' : 'Niet verleend'}</b></div><div><span>Extra uitvoerder uitnodigen</span><b>{household.can_invite_executor ? 'Toegestaan' : 'Niet verleend'}</b></div></div>
        {dossier.balances.map((balance) => <div className="detail-meta" key={balance.obligation_id}><div><span>Jaarverplichting</span><b>{hours(balance.effective_target_minutes)} uur</b></div><div><span>Winterdoel</span><b>{hours(balance.effective_winter_minutes)} uur</b></div><div><span>Structurele dekking</span><b>{balance.structurally_covered ? 'Voldaan via vaste inzet' : 'Geen volledige dekking'}</b></div></div>)}
        <Hint>Een extra account of tweede intake maakt geen tweede verplichting. Een wijziging van afspraken vraagt een formeel besluit van de vereniging.</Hint>
      </> : <>
        <AccountHelpBanner topicId="household.history" />
        {dossier.history.length ? <div className="timeline">{dossier.history.map((event) => <div className="timeline-item" key={event.event_id}><b>{historyLabels[event.action] ?? 'Dossieractie verwerkt'}</b><small>{event.actor_is_self ? 'Jouw account' : 'Bevoegde dossieractie'} · {new Intl.DateTimeFormat('nl-NL', {dateStyle: 'medium', timeStyle: 'short', timeZone: dossier.timezone}).format(new Date(event.occurred_at))}</small></div>)}</div> : <Empty title="Nog geen zichtbare dossierhistorie" text="Hier komen uitsluitend dossieracties binnen jouw rechten." />}
      </>}
    </TabsContent>
  </Tabs>;
}
