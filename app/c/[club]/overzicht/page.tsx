import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {CalendarDays, CheckCircle2, Clock, HeartHandshake, Plus} from 'lucide-react';
import {InviteExecutorForm} from '@/components/app/invite-executor-form';
import {requireWorkspace} from '@/lib/auth/workspace';
import {AccountHelpBanner} from '@/components/app/help-provider';
import {Avatar, Badge, Btn, PageTitle, Panel, Progress} from '@/components/cluvo/ui';

type HouseholdRow = {household_id: string; label: string; can_view_progress: boolean; can_invite_executor: boolean; version: number};
type ProgressRow = {
  effective_target_minutes: number; effective_winter_minutes: number;
  confirmed_minutes: number; pending_minutes: number; planned_minutes: number;
  remaining_minutes: number; winter_deficit_minutes: number;
  structurally_covered: boolean; annual_state: string; open_dispute_count: number | null;
};
function hours(minutes: number) {return new Intl.NumberFormat('nl-NL', {maximumFractionDigits: 1}).format(minutes / 60);}

export default async function OverviewPage({params, searchParams}: {
  params: Promise<{club: string}>; searchParams: Promise<{household?: string; season?: string}>;
}) {
  const [{club}, selection] = await Promise.all([params, searchParams]);
  const {client, workspace} = await requireWorkspace(club);
  const base = `/c/${encodeURIComponent(club)}`;
  const [householdResult, seasonResult, tenantResult] = await Promise.all([
    client.schema('api').from('my_households').select('household_id,label,can_view_progress,can_invite_executor,version').eq('tenant_id', workspace.tenant_id).order('label'),
    client.schema('api').from('my_active_seasons').select('season_id,name').eq('tenant_id', workspace.tenant_id).order('name'),
    client.schema('api').from('public_tenants').select('timezone').eq('tenant_id', workspace.tenant_id).single(),
  ]);
  const households = (householdResult.data ?? []) as HouseholdRow[];
  const seasons = seasonResult.data ?? [];
  // Only IDs from the actor's server-authorized results can become a selection.
  const household = selection.household ? households.find(({household_id}) => household_id === selection.household) : households[0];
  const season = selection.season ? seasons.find(({season_id}) => season_id === selection.season) : seasons.length === 1 ? seasons[0] : undefined;
  const progressResult = household?.can_view_progress && season
    ? await client.schema('api').from('my_household_season_progress')
      .select('effective_target_minutes,effective_winter_minutes,confirmed_minutes,pending_minutes,planned_minutes,remaining_minutes,winter_deficit_minutes,structurally_covered,annual_state,open_dispute_count')
      .eq('tenant_id', workspace.tenant_id).eq('household_id', household.household_id).eq('season_id', season.season_id).maybeSingle()
    : {data: null, error: null};
  const loadError = householdResult.error ?? seasonResult.error ?? tenantResult.error ?? progressResult.error;
  const balance = loadError ? null : progressResult.data as ProgressRow | null;
  const percent = balance ? balance.structurally_covered || balance.effective_target_minutes === 0 ? 100 : Math.min(100, Math.max(0, 100 * balance.confirmed_minutes / balance.effective_target_minutes)) : 0;
  const date = new Intl.DateTimeFormat('nl-NL', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tenantResult.data?.timezone ?? 'Europe/Amsterdam'}).format(new Date()).toUpperCase();
  const stats = balance ? [
    {label: 'Bevestigde inzet', value: balance.confirmed_minutes, detail: 'Samen door jouw huishouden', icon: Clock, tone: 'coral'},
    {label: 'Nog bij te dragen', value: balance.remaining_minutes, detail: `Van ${hours(balance.effective_target_minutes)} uur per seizoen`, icon: HeartHandshake, tone: 'violet'},
    {label: 'Al ingepland', value: balance.planned_minutes, detail: 'Nog niet als uitgevoerd geteld', icon: CalendarDays, tone: 'blue'},
    {label: 'Te bevestigen', value: balance.pending_minutes, detail: 'Wacht op de coördinator', icon: CheckCircle2, tone: 'green'},
  ] : [];
  return <div className="page-enter">
    <PageTitle eyebrow={date} title={`Fijn dat je er bent, ${workspace.display_name.split(' ')[0]}.`} description="Jouw inzet maakt het verschil. Wat past er deze week bij jou?" actions={<Btn asChild><Link href={`${base}/taken`}><Plus size={17} />Zoek een taak</Link></Btn>} />
    <AccountHelpBanner topicId="page.overzicht" />
    {(households.length > 1 || seasons.length > 1) ? <form className="workspace-selection" method="get">
      <label>Huishouddossier<select name="household" defaultValue={household?.household_id ?? ''}>{households.map((row) => <option key={row.household_id} value={row.household_id}>{row.label}</option>)}</select></label>
      <label>Seizoen<select name="season" defaultValue={season?.season_id ?? ''}><option value="" disabled>Kies een seizoen</option>{seasons.map((row) => <option key={row.season_id} value={row.season_id}>{row.name}</option>)}</select></label>
      <button type="submit" className="btn secondary">Toon overzicht</button>
    </form> : null}
    {loadError ? <p className="auth-error" role="alert">Je dossierstand kan nu niet worden geladen. Vernieuw de pagina om het opnieuw te proberen.</p> : null}
    {!loadError && !household ? <p className="secure-notice">Kies een gekoppeld huishouddossier. Staat jouw dossier er niet bij, neem dan contact op met de club.</p> : null}
    {!loadError && household && !household.can_view_progress ? <p className="secure-notice">Je hebt toegang tot dit dossier, maar niet tot de gezamenlijke voortgang.</p> : null}
    {!loadError && household?.can_view_progress && !balance ? <p className="secure-notice">{season ? 'Voor dit dossier is nog geen seizoensverplichting gekoppeld.' : seasons.length > 1 ? 'Kies het seizoen waarvan je de stand wilt bekijken.' : 'Er is nog geen actief seizoen ingericht.'}</p> : null}
    {balance ? <div className="stats-grid">{stats.map(({label, value, detail, icon: Icon, tone}) => <div className="stat" key={label}><div className="stat-top"><span>{label}</span><span className={`icon-tile ${tone}`}><Icon size={18} /></span></div><strong>{hours(value)} uur</strong><p>{detail}</p></div>)}</div> : null}
    <div className="dashboard-grid">
      <div className="dashboard-left">
        <section className="signal-card"><div className="signal-card-top"><Badge tone="dark">SAMEN MAKEN WE DE CLUB</Badge><HeartHandshake size={26} /></div>
          <div className="signal-content"><div><h2>Een paar uur van jou.<br />Een wereld voor de club.</h2><p>Vind een taak die past bij wat jij leuk vindt.</p><Btn asChild className="light"><Link href={`${base}/taken`}>Ontdek de takenmarkt</Link></Btn></div>
            {balance ? <div className="orbit-stat"><div className="ring" style={{'--value': percent} as React.CSSProperties}><div><strong>{hours(balance.confirmed_minutes)}<small>uur</small></strong><span>van {hours(balance.effective_target_minutes)} uur</span></div></div><span className="ring-note">Jouw huishouden</span></div> : null}
          </div>
        </section>
        {household?.can_invite_executor ? <Panel title="Extra uitvoerder uitnodigen" subtitle="De ontvanger bevestigt eerst de persoonlijke uitnodiging."><div className="account-panel-content"><p>Een extra account verandert het seizoensdoel van je huishouden niet.</p><InviteExecutorForm club={club} householdId={household.household_id} householdVersion={household.version} idempotencyKey={randomUUID()} /></div></Panel> : null}
      </div>
      <div className="dashboard-right">
        <Panel title="Jouw huishouden"><div className="household-compact">
          <AccountHelpBanner topicId="panel.household" />
          <div className="household-top"><Avatar name={household?.label ?? workspace.display_name} size="large" /><div><h3>{household?.label ?? 'Nog geen dossier gekoppeld'}</h3><p>{season ? `Seizoen ${season.name}` : 'Kies een actief seizoen'}</p></div></div>
          {balance ? <><div className="big-progress-label"><strong>{hours(balance.confirmed_minutes)} <span>/ {hours(balance.effective_target_minutes)} uur</span></strong><Badge tone={balance.remaining_minutes === 0 ? 'green' : 'coral'}>{balance.structurally_covered ? 'Voldaan via vaste inzet' : `${hours(balance.remaining_minutes)} uur te gaan`}</Badge></div><Progress value={percent} />
            <div className="progress-key"><span><i className="coral-bg" />Bevestigd {hours(balance.confirmed_minutes)}u</span><span><i className="blue-bg" />Gepland {hours(balance.planned_minutes)}u</span></div>
            <div className="winter-note"><CalendarDays size={17} /><span><b>Winterdoel: {hours(balance.effective_winter_minutes)} uur</b><small>{hours(balance.winter_deficit_minutes)} uur tot het winterdoel</small></span></div>
            {(balance.open_dispute_count ?? 0) > 0 ? <p className="secure-notice">Je stand wordt beoordeeld. Definitieve afrekening wacht op deze beoordeling.</p> : null}</> : null}
          <Btn asChild variant="secondary" className="full"><Link href={`${base}/intake`}>Mijn intake bekijken</Link></Btn>
          {household ? <Btn asChild variant="secondary" className="full"><Link href={`${base}/huishouden?household=${household.household_id}`}>Huishouddossier openen</Link></Btn> : null}
        </div></Panel>
        <Panel title="Samen aan de slag"><div className="community-note"><span className="community-spark">✳</span><h3>Jouw talent is welkom.</h3><p>Organiseren, koken of klussen? Vertel ons waar jij blij van wordt.</p><Btn asChild variant="secondary"><Link href={`${base}/intake`}>Mijn voorkeuren invullen</Link></Btn></div></Panel>
      </div>
    </div>
  </div>;
}
