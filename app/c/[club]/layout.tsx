import {SecureShell} from '@/components/app/secure-shell';
import {requireWorkspace} from '@/lib/auth/workspace';
import {AccountHelpProvider} from '@/components/app/help-provider';

export const dynamic = 'force-dynamic';

export default async function ClubLayout({children, params}: {children: React.ReactNode; params: Promise<{club: string}>}) {
  const {club} = await params;
  const {client, workspace} = await requireWorkspace(club);
  const [{data: claims}, seenResult, seasonResult] = await Promise.all([
    client.auth.getClaims(),
    client.schema('api').from('my_help_seen').select('topic_id'),
    client.schema('api').from('my_active_seasons').select('name').eq('tenant_id', workspace.tenant_id),
  ]);
  return <AccountHelpProvider key={String(claims?.claims?.sub)} initialSeen={(seenResult.data ?? []).map(({topic_id}) => String(topic_id))} loaded={!seenResult.error}>
    <SecureShell workspace={workspace} seasonName={seasonResult.data?.length === 1 ? seasonResult.data[0].name : null}>
      {seenResult.error ? <p className="secure-notice" role="status">Je uitlegvoorkeuren kunnen nu niet worden geladen. Vernieuw de pagina om het opnieuw te proberen.</p> : null}
      {children}
    </SecureShell>
  </AccountHelpProvider>;
}
