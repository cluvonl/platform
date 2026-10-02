import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {InviteExecutorForm} from '@/components/app/invite-executor-form';
import {requireWorkspace} from '@/lib/auth/workspace';

type HouseholdRow = {household_id: string; label: string; can_view_progress: boolean; can_invite_executor: boolean};
type ProgressRow = {household_id: string; effective_target_minutes: number; confirmed_minutes: number; pending_minutes: number; planned_minutes: number; disputed_minutes: number; remaining_minutes: number};
function hours(minutes: number) { return new Intl.NumberFormat('nl-NL', {maximumFractionDigits: 1}).format(minutes / 60); }

export default async function OverviewPage({params}: {params: Promise<{club: string}>}) {
  const {club} = await params;
  const {client, workspace} = await requireWorkspace(club);
  const {data: householdData, error: householdError} = await client.schema('api').from('my_households')
    .select('household_id,label,can_view_progress,can_invite_executor')
    .eq('tenant_id', workspace.tenant_id);
  const households = (householdData ?? []) as HouseholdRow[];
  const household = households[0];
  const progressResult = household?.can_view_progress
    ? await client.schema('api').from('household_progress')
      .select('household_id,effective_target_minutes,confirmed_minutes,pending_minutes,planned_minutes,disputed_minutes,remaining_minutes')
      .eq('tenant_id', workspace.tenant_id)
      .eq('household_id', household.household_id)
      .limit(1)
    : {data: null, error: null};
  const balance = (progressResult.data?.[0] ?? null) as ProgressRow | null;
  const loadError = householdError ?? progressResult.error;
  return (
    <div className="secure-page page-enter">
      <p className="secure-eyebrow">PERSOONLIJK OVERZICHT</p><h1>Goedemiddag, {workspace.display_name.split(' ')[0]}.</h1>
      <p className="secure-lead">Je ziet hier uitsluitend de gegevens waarvoor jouw geverifieerde account expliciet toegang heeft.</p>
      {loadError ? <p className="auth-error" role="alert">Je dossierstand kan nu niet veilig worden geladen. Probeer het later opnieuw.</p> : null}
      {!loadError && household && !household.can_view_progress ? <p className="secure-notice">Je hebt wel toegang tot dit dossier, maar niet tot de gezamenlijke voortgang.</p> : null}
      {!loadError && household?.can_view_progress && !balance ? <p className="secure-notice">Voor dit dossier is nog geen actieve seizoensverplichting gekoppeld.</p> : null}
      {balance ? <div className="secure-stat-grid">
        <article><span>Bevestigd</span><strong>{hours(balance?.confirmed_minutes ?? 0)} uur</strong><small>Uit de onveranderlijke urenledger</small></article>
        <article><span>Gepland</span><strong>{hours(balance?.planned_minutes ?? 0)} uur</strong><small>Telt nog niet als uitgevoerd</small></article>
        <article><span>Te bevestigen</span><strong>{hours(balance?.pending_minutes ?? 0)} uur</strong><small>Eerst beoordelen</small></article>
        <article><span>Resterend</span><strong>{hours(balance?.remaining_minutes ?? 0)} uur</strong><small>Op bevestigd jaartotaal</small></article>
      </div> : null}
      <section className="secure-highlight"><div><p className="secure-eyebrow">JOUW HUISHOUDDOSSIER</p><h2>{household?.label ?? 'Nog geen dossier gekoppeld'}</h2><p>{balance ? `${hours(balance.confirmed_minutes)} van ${hours(balance.effective_target_minutes)} uur bevestigd.` : household ? 'Alleen expliciet toegekende dossiergegevens worden getoond.' : 'Een beheerder moet eerst een expliciete dossierkoppeling vastleggen.'}</p></div><Link href={`/c/${encodeURIComponent(club)}/intake`}>Mijn intake bekijken</Link></section>
      {household?.can_invite_executor ? <section className="secure-section"><p className="secure-eyebrow">EXPLICIETE TOEGANG</p><h2>Extra uitvoerder uitnodigen</h2><p>De ontvanger krijgt pas toegang na verificatie van het persoonlijke e-mailadres en actieve acceptatie. Een extra account maakt geen extra seizoensverplichting.</p><InviteExecutorForm club={club} householdId={household.household_id} idempotencyKey={randomUUID()} /></section> : null}
      {(balance?.disputed_minutes ?? 0) > 0 ? <p className="secure-notice">Er staat {hours(balance?.disputed_minutes ?? 0)} uur in beoordeling. Definitieve afrekening blijft geblokkeerd.</p> : null}
    </div>
  );
}
