import 'server-only';

import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';

export type WorkspaceRole = {role_key: string; scope_kind: string; scope_id: string | null};
export type WorkspaceContext = {tenant_id: string; tenant_slug: string; tenant_name: string; person_id: string; display_name: string; roles: WorkspaceRole[]};
type WorkspaceRow = Omit<WorkspaceContext, 'roles'> & WorkspaceRole;

export async function requireWorkspace(tenantSlug: string): Promise<{client: Awaited<ReturnType<typeof createSupabaseServerClient>>; workspace: WorkspaceContext}> {
  const client = await createSupabaseServerClient();
  const {data: claimsData, error: claimsError} = await client.auth.getClaims();
  if (claimsError || typeof claimsData?.claims?.sub !== 'string') redirect('/login');

  const {data, error} = await client.schema('api').from('my_workspaces')
    .select('tenant_id,tenant_slug,tenant_name,person_id,display_name,role_key,scope_kind,scope_id')
    .eq('tenant_slug', tenantSlug);
  const rows = (data ?? []) as WorkspaceRow[];
  if (error || rows.length === 0) redirect('/login');
  const first = rows[0];
  return {client, workspace: {
    tenant_id: first.tenant_id,
    tenant_slug: first.tenant_slug,
    tenant_name: first.tenant_name,
    person_id: first.person_id,
    display_name: first.display_name,
    roles: rows.map(({role_key, scope_kind, scope_id}) => ({role_key, scope_kind, scope_id})),
  }};
}
