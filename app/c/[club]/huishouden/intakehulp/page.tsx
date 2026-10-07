import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {z} from 'zod';
import {requireWorkspace} from '@/lib/auth/workspace';
import {loadIntakeAssistanceContext} from '@/lib/data/intake-assistance';
import {GrantIntakeAssistanceForm, RevokeIntakeAssistanceForm} from '@/components/app/intake-assistance-forms';
import {Badge, Button, Empty, Hint, PageTitle, Panel} from '@/components/cluvo/ui';

export default async function IntakeAssistancePage({params, searchParams}: {params: Promise<{club: string}>; searchParams: Promise<{household?: string}>}) {
  const [{club}, selection] = await Promise.all([params, searchParams]);
  const {client, workspace} = await requireWorkspace(club);
  const household = z.string().uuid().safeParse(selection.household);
  const {data: context, error} = household.success ? await loadIntakeAssistanceContext(client, workspace.tenant_id, household.data) : {data:null, error:null};
  const moment = (value: string) => Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat('nl-NL', {dateStyle:'medium', timeStyle:'short', timeZone:context?.timezone ?? 'Europe/Amsterdam'}).format(new Date(value))
    : 'geen eindmoment vastgelegd';
  return <div className="page-enter"><PageTitle eyebrow="HUISHOUDDOSSIER" title="Intakehulp beheren" description={context ? `Expliciete hulp bij de persoonlijke intake in ${context.label}.` : 'Een machtiging hoort bij één persoon en één dossier.'} />
    {error ? <p className="auth-error" role="alert">De intakehulp kan nu niet worden geladen. Open de pagina opnieuw.</p> : !context ? <Empty title="Intakehulp niet beschikbaar" text="Deze dossieractie vraagt een actueel mandaat van de vrijwilligerscommissie." /> : <div className="stack">
      <div><Button asChild className="btn secondary"><Link href={`/c/${encodeURIComponent(club)}/huishouden?household=${context.household_id}`}>Terug naar dossier</Link></Button></div>
      <Hint>De hulpverlener mag uitsluitend de gekozen persoonlijke intake invullen en herbevestigen. De feitelijke handelende persoon en de reden blijven vastgelegd.</Hint>
      {context.can_grant ? <Panel title="Intakehulp verlenen"><div className="account-panel-content"><GrantIntakeAssistanceForm club={club} context={context} idempotencyKey={randomUUID()} baseTime={Date.parse(context.observed_at)} /></div></Panel> : null}
      <Panel title="Machtigingen"><div className="account-panel-content stack">{context.delegations.length ? context.delegations.map((delegation) => <section className="stack" key={delegation.delegation_id} aria-label={`Machtiging ${delegation.subject_name}`}>
        <div className="row between wrap"><div><b>{delegation.subject_name}</b><p className="small-text">Hulp van {delegation.helper_name || 'account zonder actuele persoonskoppeling'}</p></div><Badge tone={delegation.state === 'revoked' ? 'neutral' : delegation.state === 'expired' ? 'amber' : 'green'}>{{revoked:'Ingetrokken', expired:'Verlopen', scheduled:'Gepland', active:'Actief'}[delegation.state]}</Badge></div>
        <p className="small-text">Vanaf {moment(delegation.starts_at)}{delegation.ends_at ? ` tot ${moment(delegation.ends_at)}` : ''}{delegation.revoked_at ? ` · Ingetrokken op ${moment(delegation.revoked_at)}` : ''}</p>
        <RevokeIntakeAssistanceForm club={club} householdId={context.household_id} householdVersion={context.household_version} delegation={delegation} idempotencyKey={randomUUID()} />
      </section>) : <Empty title="Geen machtigingen voor intakehulp" text="Een persoonlijke intake blijft standaard afgeschermd voor andere accounts." />}</div></Panel>
    </div>}
  </div>;
}
