import Image from 'next/image';
import Link from 'next/link';
import {signOutAction} from '@/app/auth/actions';
import type {WorkspaceContext} from '@/lib/auth/workspace';

const roleLabels: Record<string, string> = {
  member: 'Lid / uitvoerder', fixed_volunteer: 'Vaste vrijwilliger', committee_coordinator: 'Commissiecoördinator',
  volunteer_coordinator: 'Vrijwilligerscoördinator', volunteer_committee: 'Vrijwilligerscommissie', team_parent: 'Teamouder', board: 'Bestuur', finance: 'Financieel beheer',
};

export function SecureShell({workspace, children}: {workspace: WorkspaceContext; children: React.ReactNode}) {
  const base = `/c/${encodeURIComponent(workspace.tenant_slug)}`;
  const canConfirmAttendance = workspace.roles.some(({role_key}) => ['committee_coordinator', 'volunteer_committee'].includes(role_key));
  return (
    <div className="secure-app">
      <aside className="secure-sidebar">
        <Image src="/brand/cluvo-logo.png" alt="Cluvo" width={150} height={64} priority />
        <div className="secure-club"><span>{workspace.tenant_name.slice(0, 1).toUpperCase()}</span><div><strong>{workspace.tenant_name}</strong><small>Veilige werkruimte</small></div></div>
        <nav aria-label="Persoonlijke navigatie"><Link href={`${base}/overzicht`}>Overzicht</Link><Link href={`${base}/diensten`}>Diensten</Link><Link href={`${base}/intake`}>Mijn intake</Link>{canConfirmAttendance ? <Link href={`${base}/beheer/presentie`}>Presentie</Link> : null}<Link href="/workspaces">Andere werkruimte</Link></nav>
        <div className="secure-profile"><strong>{workspace.display_name}</strong><small>{Array.from(new Set(workspace.roles.map(({role_key}) => roleLabels[role_key] ?? role_key))).join(' · ') || 'Persoonlijke toegang'}</small><form action={signOutAction}><button type="submit">Uitloggen</button></form></div>
      </aside>
      <div className="secure-main"><header className="secure-topbar"><span>Werkruimte / {workspace.tenant_name}</span><span className="secure-environment">LOKAAL / STAGING</span></header><main className="secure-workspace">{children}</main></div>
    </div>
  );
}
