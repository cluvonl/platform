import Link from 'next/link';
import {redirect} from 'next/navigation';
import {AuthShell} from '@/components/auth/auth-shell';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {signOutMobileAction} from '@/app/auth/actions';

export const dynamic = 'force-dynamic';
type WorkspaceRow = {tenant_id: string; tenant_slug: string; tenant_name: string; display_name: string; role_key: string};

export default async function MobileWorkspacesPage() {
  const client = await createSupabaseServerClient();
  const {data: claims, error: claimsError} = await client.auth.getClaims();
  if (claimsError || typeof claims?.claims?.sub !== 'string') redirect('/app/login');
  const {data, error} = await client.schema('api').from('my_workspaces')
    .select('tenant_id,tenant_slug,tenant_name,display_name,role_key').order('tenant_name').order('role_key');
  const workspaces = new Map<string, WorkspaceRow>();
  if (!error) for (const row of (data ?? []) as WorkspaceRow[]) workspaces.set(row.tenant_id, row);
  return <AuthShell eyebrow="Mijn vereniging" title="Kies jouw vereniging" intro="Je ziet alleen verenigingen waarvoor je account nu toegang heeft.">
    {error ? <p role="alert" className="auth-error">Je verenigingen kunnen nu niet veilig worden geladen. Probeer het opnieuw.</p> : null}
    {!error && workspaces.size === 0 ? <p role="alert" className="auth-error">Je hebt geen actieve verenigingswerkruimte. Neem contact op met de beheerder.</p> : null}
    <div className="workspace-list">{Array.from(workspaces.entries()).map(([id, workspace]) => <Link className="workspace-card" href={`/app/c/${encodeURIComponent(workspace.tenant_slug)}/home`} key={id} prefetch={false}><span className="workspace-monogram">{workspace.tenant_name.slice(0, 1).toUpperCase()}</span><span><strong>{workspace.tenant_name}</strong><small>Persoonlijke werkruimte</small></span><span aria-hidden="true">→</span></Link>)}</div>
    <form action={signOutMobileAction}><button className="auth-secondary" type="submit">Uitloggen</button></form>
  </AuthShell>;
}
