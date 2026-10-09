import {AdminAuthorityGuard} from '@/components/admin/authority-guard';
import {adminAccessSignature} from '@/lib/admin/access-signature';
import {SecureShell} from '@/components/app/secure-shell';
import {requireWorkspace} from '@/lib/auth/workspace';
import {AccountHelpProvider} from '@/components/app/help-provider';
import {headers} from 'next/headers';
import {requireClubAdmin} from '@/lib/admin/server';
import type {ClubAdminAccess} from '@/lib/admin/contracts';
import type {WorkspaceContext} from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

export default async function ClubLayout({children, params}: {children: React.ReactNode; params: Promise<{club: string}>}) {
  const {club} = await params;
  const adminPath=(await headers()).get('x-cluvo-request-path')?.startsWith(`/c/${encodeURIComponent(club)}/beheer`)===true;
  let client:Awaited<ReturnType<typeof requireWorkspace>>['client'];let workspace:WorkspaceContext;let clubAdmin:ClubAdminAccess|undefined;
  if(adminPath){const ctx=await requireClubAdmin(club);client=ctx.client;clubAdmin=ctx.access;const own=await client.schema('api').from('my_workspaces').select('person_id,display_name,role_key,scope_kind,scope_id').eq('tenant_slug',club);workspace={tenant_id:ctx.access.tenant_id,tenant_slug:club,tenant_name:ctx.access.name,person_id:String(own.data?.[0]?.person_id??''),display_name:String(own.data?.[0]?.display_name??'Benoemde ondersteuning'),roles:(own.data??[]).map(r=>({role_key:String(r.role_key),scope_kind:String(r.scope_kind),scope_id:r.scope_id?String(r.scope_id):null}))};}
  else{const ctx=await requireWorkspace(club);client=ctx.client;workspace=ctx.workspace;const access=await client.schema('api').rpc('club_admin_access',{p_slug:club});if(!access.error&&access.data?.authorized===true)clubAdmin=access.data as ClubAdminAccess;}
  const [{data: claims}, seenResult, seasonResult, sportlinkResult] = await Promise.all([
    client.auth.getClaims(),
    client.schema('api').from('my_help_seen').select('topic_id'),
    client.schema('api').from('my_active_seasons').select('name').eq('tenant_id', workspace.tenant_id),
    client.schema('api').rpc('sportlink_connection_state', {p_tenant_id: workspace.tenant_id}),
  ]);
  const content=<AccountHelpProvider key={String(claims?.claims?.sub)} initialSeen={(seenResult.data ?? []).map(({topic_id}) => String(topic_id))} loaded={!seenResult.error}>
    <SecureShell workspace={workspace} clubAdmin={clubAdmin} seasonName={seasonResult.data?.length === 1 ? seasonResult.data[0].name : null} canManageSportlink={!sportlinkResult.error && sportlinkResult.data?.authorized === true}>
      {seenResult.error ? <p className="secure-notice" role="status">Je uitlegvoorkeuren kunnen nu niet worden geladen. Vernieuw de pagina om het opnieuw te proberen.</p> : null}
      {children}
    </SecureShell>
  </AccountHelpProvider>;
  return adminPath&&clubAdmin?<AdminAuthorityGuard key={`${claims?.claims?.sub}:${club}`} surface="club" club={club} signature={adminAccessSignature('club',clubAdmin)}>{content}</AdminAuthorityGuard>:content;
}
