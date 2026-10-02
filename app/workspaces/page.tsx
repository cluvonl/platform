import Link from 'next/link';
import {redirect} from 'next/navigation';
import {AuthShell} from '@/components/auth/auth-shell';
import {createSupabaseServerClient} from '@/lib/supabase/server';

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
      {!error && workspaces.size === 0 ? <p className="auth-error" role="alert">Dit account heeft geen actieve verenigingswerkruimte. Neem contact op met de beheerder.</p> : null}
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
