import Image from 'next/image';
import Link from 'next/link';
import {ChevronDown, LogOut, Settings} from 'lucide-react';
import {signOutAction} from '@/app/auth/actions';
import type {WorkspaceContext} from '@/lib/auth/workspace';
import {Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarProvider} from '@/components/ui/sidebar';
import {Avatar} from '@/components/cluvo/ui';
import {WorkspaceNavigation, WorkspaceTopbar} from './workspace-navigation';

export const workspaceRoleLabels: Record<string, string> = {
  member: 'Lid / uitvoerder', fixed_volunteer: 'Vaste vrijwilliger', committee_coordinator: 'Commissiecoördinator',
  volunteer_coordinator: 'Vrijwilligerscoördinator', volunteer_committee: 'Vrijwilligerscommissie', team_parent: 'Teamouder', board: 'Bestuur', finance: 'Financieel beheer',
};

export function SecureShell({workspace, seasonName, children}: {workspace: WorkspaceContext; seasonName: string | null; children: React.ReactNode}) {
  const base = `/c/${encodeURIComponent(workspace.tenant_slug)}`;
  const roleLabel = Array.from(new Set(workspace.roles.map(({role_key}) => workspaceRoleLabels[role_key] ?? role_key))).join(' · ') || 'Persoonlijke toegang';
  const canConfirmAttendance = workspace.roles.some(({role_key}) => ['committee_coordinator', 'volunteer_committee'].includes(role_key));
  return <SidebarProvider className="authenticated-cluvo" style={{'--sidebar-width': '244px'} as React.CSSProperties}>
    <Sidebar className="cluvo-sidebar">
      <SidebarHeader className="brand-area">
        <Image src="/brand/cluvo-logo.png" alt="Cluvo" width={152} height={55} priority className="brand-logo" />
        <span className="brand-caption">JOUW CLUB. SAMEN.</span>
        <Link href="/workspaces" className="club-switch"><span className="club-monogram">{workspace.tenant_name.slice(0, 1)}</span><span><b>{workspace.tenant_name}</b><small>{seasonName ? `Seizoen ${seasonName}` : 'Seizoen nog niet ingericht'}</small></span><ChevronDown size={16} /></Link>
      </SidebarHeader>
      <SidebarContent><WorkspaceNavigation base={base} canConfirmAttendance={canConfirmAttendance} /></SidebarContent>
      <SidebarFooter>
        <Link className="profile-link" href={`${base}/intake`}><Avatar name={workspace.display_name} /><span><b>{workspace.display_name}</b><small>{roleLabel}</small></span><Settings size={15} /></Link>
        <form action={signOutAction}><button type="submit" className="help-link"><LogOut size={17} /> Uitloggen</button></form>
      </SidebarFooter>
    </Sidebar>
    <div className="app-main">
      <WorkspaceTopbar base={base} displayName={workspace.display_name} canConfirmAttendance={canConfirmAttendance} />
      <main className="workspace">{children}</main>
      <footer className="app-footer"><span>Cluvo · Club Signal</span><span>Staging · persoonlijke werkruimte</span></footer>
    </div>
  </SidebarProvider>;
}
