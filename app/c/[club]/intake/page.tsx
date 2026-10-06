import {randomUUID} from 'node:crypto';
import {IntakeForm, type IntakeRecord, type IntakeHousehold} from '@/components/app/intake-form';
import {requireWorkspace} from '@/lib/auth/workspace';
import {AccountHelpBanner} from '@/components/app/help-provider';
import {Empty, PageTitle} from '@/components/cluvo/ui';
import {loadHouseholdDossier} from '@/lib/data/household';
import {loadIntakeReconfirmations} from '@/lib/data/intake-reconfirmation';
import Link from 'next/link';

type IntakeContext = {profile_id: string; person_id: string; household_context_id: string; display_name: string; is_self: boolean};

export default async function IntakePage({params, searchParams}: {
  params: Promise<{club: string}>; searchParams: Promise<{profile?: string}>;
}) {
  const [{club}, selection] = await Promise.all([params, searchParams]);
  const {client, workspace} = await requireWorkspace(club);
  const [intakeResult, categoryResult, householdResult, contextResult] = await Promise.all([
    client.schema('api').from('my_intake').select('profile_id,person_id,household_context_id,version,status,desired_minutes,annual_confirmed_at,answers')
      .eq('tenant_id', workspace.tenant_id).order('profile_id'),
    client.schema('api').from('intake_task_categories').select('name').eq('tenant_id', workspace.tenant_id).order('name'),
    client.schema('api').from('my_households').select('household_id,label').eq('tenant_id', workspace.tenant_id),
    client.schema('api').rpc('list_intake_contexts', {p_tenant_id: workspace.tenant_id}),
  ]);
  const contexts = (contextResult.data ?? []) as IntakeContext[];
  const profiles = ((intakeResult.data ?? []) as IntakeRecord[]).filter((profile) => contexts.some(({profile_id}) => profile_id === profile.profile_id));
  const intake = profiles.find(({profile_id}) => profile_id === (selection.profile ?? contexts[0]?.profile_id));
  const households = (householdResult.data ?? []) as IntakeHousehold[];
  const household = intake ? households.find(({household_id}) => household_id === intake.household_context_id) ?? null : null;
  const subject = contexts.find(({profile_id}) => profile_id === intake?.profile_id);
  const dossierResult = household ? await loadHouseholdDossier(client, workspace.tenant_id, household.household_id) : {data: null, error: null};
  const error = intakeResult.error ?? categoryResult.error ?? householdResult.error ?? contextResult.error;
  const reconfirmations = intake ? await loadIntakeReconfirmations(client, workspace.tenant_id, intake.profile_id) : {data: [], error: null};
  return <div className="page-enter">
    <PageTitle eyebrow="MIJN PROFIEL & HUISHOUDEN" title="Jouw talent. Jouw bijdrage." description="Samen vinden we een plek die past bij jouw leven." />
    <AccountHelpBanner topicId="page.intake" />
    {!error && intake && reconfirmations.error ? <p className="auth-error" role="alert">De seizoensaanvragen kunnen nu niet worden geladen. Open de pagina opnieuw.</p> : null}
    {!error && intake && reconfirmations.data.some(({state}) => state === 'open') ? <div className="filterbar">
      {reconfirmations.data.filter(({state}) => state === 'open').map((item) => <Link className="btn secondary" key={item.item_id} href={`/c/${encodeURIComponent(club)}/intake/herbevestigen?profile=${intake.profile_id}&item=${item.item_id}`}>Intake controleren voor {item.season_name}</Link>)}
    </div> : null}
    {error ? <p className="auth-error" role="alert">De intake kan nu niet worden geladen. Probeer de pagina opnieuw te openen.</p> : null}
    {!error && profiles.length > 1 ? <form method="get" className="workspace-selection">
      <label>Persoon en dossiercontext<select name="profile" defaultValue={intake?.profile_id ?? ''}>{contexts.map((context) => <option key={context.profile_id} value={context.profile_id}>{context.display_name} · {households.find(({household_id}) => household_id === context.household_context_id)?.label ?? 'Gemachtigde intakecontext'}</option>)}</select></label>
      <button type="submit" className="btn secondary">Open intake</button>
    </form> : null}
    {!error && !intake ? <Empty title={selection.profile ? 'Intake niet beschikbaar' : 'Nog geen intakeprofiel'} text={selection.profile ? 'Open een eigen dossiercontext waartoe je toegang hebt.' : 'Een bevoegde contactpersoon moet eerst een persoonlijk profiel in jouw huishoudcontext aanmaken.'} /> : null}
    {!error && intake && subject ? <IntakeForm key={intake.profile_id} club={club} name={subject.display_name} assisted={!subject.is_self} record={intake} categories={[...new Set((categoryResult.data ?? []).map(({name}) => name as string))]} household={household} dossier={dossierResult.data} dossierLoadFailed={Boolean(dossierResult.error)} invitationKey={randomUUID()} idempotencyKey={randomUUID()} /> : null}
  </div>;
}
