import Image from 'next/image';
import Link from 'next/link';
import {ChevronDown, LogOut, Settings} from 'lucide-react';
import {signOutAction} from '@/app/auth/actions';
import type {WorkspaceContext} from '@/lib/auth/workspace';
import {Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarProvider} from '@/components/ui/sidebar';
import {Avatar} from '@/components/cluvo/ui';
import {WorkspaceNavigation, WorkspaceTopbar} from './workspace-navigation';
import {AdminNavigation} from '@/components/admin/admin-navigation';
import {clubSections,clubSectionAllowed,type ClubAdminAccess} from '@/lib/admin/contracts';

export const workspaceRoleLabels: Record<string, string> = {
  member: 'Lid / uitvoerder', fixed_volunteer: 'Vaste vrijwilliger', committee_coordinator: 'Commissiecoördinator',
  volunteer_coordinator: 'Vrijwilligerscoördinator', volunteer_committee: 'Vrijwilligerscommissie', team_parent: 'Teamouder', board: 'Bestuur', finance: 'Financieel beheer',
};

export function SecureShell({workspace, seasonName, canManageSportlink = false, clubAdmin, children}: {workspace: WorkspaceContext; seasonName: string | null; canManageSportlink?: boolean;clubAdmin?:ClubAdminAccess; children: React.ReactNode}) {
  const base = `/c/${encodeURIComponent(workspace.tenant_slug)}`;
  const clubLogo=typeof clubAdmin?.branding?.logo_path==='string'&&(/^(?:\/brand\/|data:image\/webp;base64,)/.test(clubAdmin.branding.logo_path))?clubAdmin.branding.logo_path:null;
  const clubAccent=typeof clubAdmin?.branding?.primary_color==='string'&&/^#[0-9a-fA-F]{6}$/.test(clubAdmin.branding.primary_color)?clubAdmin.branding.primary_color:undefined;
  const roleLabel = Array.from(new Set(workspace.roles.map(({role_key}) => workspaceRoleLabels[role_key] ?? role_key))).join(' · ') || 'Persoonlijke toegang';
  const canConfirmAttendance = workspace.roles.some(({role_key}) => ['committee_coordinator', 'volunteer_committee'].includes(role_key));
  return <SidebarProvider className="authenticated-cluvo" style={{'--sidebar-width': '244px'} as React.CSSProperties}>
    <Sidebar className="cluvo-sidebar">
      <SidebarHeader className="brand-area">
        <Image src="/brand/cluvo-logo.png" alt="Cluvo" width={152} height={55} priority className="brand-logo" />
        <span className="brand-caption">JOUW CLUB. SAMEN.</span>
        <Link href="/workspaces" className="club-switch"><span className="club-monogram" style={{borderColor:clubAccent}}>{clubLogo?<Image src={clubLogo} alt={`Logo ${workspace.tenant_name}`} width={32} height={32} unoptimized style={{objectFit:'contain'}}/>:workspace.tenant_name.slice(0, 1)}</span><span><b>{workspace.tenant_name}</b><small>{seasonName ? `Seizoen ${seasonName}` : 'Seizoen nog niet ingericht'}</small></span><ChevronDown size={16} /></Link>
      </SidebarHeader>
      <SidebarContent><WorkspaceNavigation base={base} canConfirmAttendance={canConfirmAttendance} canManageSportlink={canManageSportlink} />{clubAdmin&&<AdminNavigation items={[...clubSections.filter(([section])=>clubSectionAllowed(clubAdmin,section)).map(([section,label,group])=>({path:`${base}/beheer/${section}`,label,group})),{path:`${base}/beheer/kennisbank`,label:'Kennisbank beheer',group:'HULP'}]}/>}</SidebarContent>
      <SidebarFooter>
        <Link className="profile-link" href={`${base}/intake`}><Avatar name={workspace.display_name} /><span><b>{workspace.display_name}</b><small>{roleLabel}</small></span><Settings size={15} /></Link>
        <form action={signOutAction}><button type="submit" className="help-link"><LogOut size={17} /> Uitloggen</button></form>
      </SidebarFooter>
    </Sidebar>
    <div className="app-main">
      <WorkspaceTopbar base={base} displayName={workspace.display_name} canConfirmAttendance={canConfirmAttendance} canManageSportlink={canManageSportlink} />
      <main className="workspace">{children}</main>
      <footer className="app-footer"><span>Cluvo · Club Signal</span><span>Staging · persoonlijke werkruimte</span></footer>
    </div>
  </SidebarProvider>;
}
