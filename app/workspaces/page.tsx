import Link from 'next/link';
import {redirect} from 'next/navigation';
import {AuthShell} from '@/components/auth/auth-shell';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {AdminInvitationReply} from '@/components/admin/invitation-reply';
import {rows as adminRows,str,num,adminPermissionLabel} from '@/lib/admin/contracts';

export const dynamic = 'force-dynamic';

type WorkspaceRow = {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  display_name: string;
  role_key: string;
};

const roleLabels: Record<string, string> = {
  member: 'Lid / uitvoerder',
  fixed_volunteer: 'Vaste vrijwilliger',
  committee_coordinator: 'Commissiecoördinator',
  volunteer_coordinator: 'Vrijwilligerscoördinator',
  volunteer_committee: 'Vrijwilligerscommissie',
  team_parent: 'Teamouder',
  board: 'Bestuur',
  finance: 'Financieel beheer',
};

export default async function WorkspacesPage() {
  const client = await createSupabaseServerClient();
  const {data: claimsData, error: claimsError} = await client.auth.getClaims();
  if (claimsError || typeof claimsData?.claims?.sub !== 'string') redirect('/login');

  const {data, error} = await client.schema('api').from('my_workspaces')
    .select('tenant_id,tenant_slug,tenant_name,display_name,role_key')
    .order('tenant_name')
    .order('role_key');
  const rows = (data ?? []) as WorkspaceRow[];
  const platform=await client.schema('api').rpc('platform_access');
  const invitations=await client.schema('api').rpc('platform_read',{p_section:'personal_invitations'});
  const offers=invitations.error?[]:adminRows(invitations.data?.rows);
  const workspaces = new Map<string, {tenant_slug: string; tenant_name: string; display_name: string; roles: Set<string>}>();
  for (const row of rows) {
    const current = workspaces.get(row.tenant_id) ?? {
      tenant_slug: row.tenant_slug,
      tenant_name: row.tenant_name,
      display_name: row.display_name,
      roles: new Set<string>(),
    };
    current.roles.add(row.role_key);
    workspaces.set(row.tenant_id, current);
  }

  return (
    <AuthShell eyebrow="Jouw verenigingen" title="Kies een veilige werkruimte" intro="Je ziet alleen verenigingen en rollen die nu expliciet aan jouw account zijn toegekend.">
      {error ? <p className="auth-error" role="alert">De werkruimtes kunnen nu niet veilig worden geladen.</p> : null}
      {!error && workspaces.size === 0&&platform.data?.authorized!==true&&!offers.some(i=>i.state==='pending'&&!i.expired) ? <p className="auth-error" role="alert">Dit account heeft geen actieve verenigingswerkruimte. Neem contact op met de beheerder.</p> : null}
      {offers.length>0&&<section aria-label="Benoemde beheeruitnodigingen"><h2>Benoemde beheeruitnodigingen</h2><p>Een uitnodiging geeft nog geen rechten. Controleer vereniging, bereik, afzonderlijke rechten en einddatum voordat je accepteert.</p>{offers.map(i=><article className="auth-notice" key={str(i.id)}><h3>{str(i.tenant_name)}</h3><p>Bereik: {({tenant:'Vereniging',committee:'Benoemde commissie',household:'Benoemd huishouden'}as Record<string,string>)[str(i.scope_kind)]??str(i.scope_kind)} · {str(i.scope_name)}</p><p>Afzonderlijke rechten: {Array.isArray(i.permission_keys)?i.permission_keys.map(adminPermissionLabel).join(', '):'Onbekend'}</p><p>Mandaat tot: {new Date(str(i.ends_at)).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam'})}. Accepteren vóór: {new Date(str(i.expires_at)).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam'})}.</p>{i.state==='pending'&&!i.expired?<AdminInvitationReply id={str(i.id)} version={num(i.version)}/>:<p>Status: {i.expired&&i.state==='pending'?'Verlopen':({accepted:'Geaccepteerd',declined:'Geweigerd',cancelled:'Ingetrokken'}as Record<string,string>)[str(i.state)]??str(i.state)}</p>}</article>)}</section>}
      {!platform.error&&platform.data?.authorized===true?<Link className="workspace-card" href="/platform"><span className="workspace-monogram">C</span><span><strong>Platformbeheer</strong><small>Jouw expliciete platformrechten</small></span><span aria-hidden="true">→</span></Link>:null}
      {!error ? <div className="workspace-list">{Array.from(workspaces.entries()).map(([tenantId, workspace]) => (
        <Link className="workspace-card" href={`/c/${encodeURIComponent(workspace.tenant_slug)}/overzicht`} key={tenantId}>
          <span className="workspace-monogram">{workspace.tenant_name.slice(0, 1).toUpperCase()}</span>
          <span><strong>{workspace.tenant_name}</strong><small>{Array.from(workspace.roles).map((role) => roleLabels[role] ?? role).join(' · ')}</small></span>
          <span aria-hidden="true">→</span>
        </Link>
      ))}</div> : null}
      <Link className="auth-secondary" href="/login">Terug naar inloggen</Link>
    </AuthShell>
  );
}
