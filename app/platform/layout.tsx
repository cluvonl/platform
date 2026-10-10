import {AdminAuthorityGuard} from '@/components/admin/authority-guard';
import {adminAccessSignature} from '@/lib/admin/access-signature';
import Image from 'next/image';
import {Sidebar,SidebarContent,SidebarHeader,SidebarProvider} from '@/components/ui/sidebar';
import {AdminNavigation,AdminTopbar,type AdminNavItem} from '@/components/admin/admin-navigation';
import {AccountHelpProvider} from '@/components/app/help-provider';
import {requirePlatform} from '@/lib/admin/server';
import {platformSections,platformSectionPermission} from '@/lib/admin/contracts';
export const dynamic='force-dynamic';
export default async function PlatformLayout({children}:{children:React.ReactNode}){const {client,actor,permissions}=await requirePlatform();const seen=await client.schema('api').from('my_help_seen').select('topic_id');const items:AdminNavItem[]=platformSections.filter(([section])=>permissions.some(p=>p.key===platformSectionPermission[section]&&(!['staff','defaults'].includes(section)||p.tenant_id===null))).map(([section,label,group])=>({path:`/platform/${section}`,label,group}));
 items.push({path:'/platform/kennisbank',label:'Kennisbank',group:'HULP'});
 return <AdminAuthorityGuard key={actor} surface="platform" signature={adminAccessSignature('platform',{permissions})}><AccountHelpProvider key={actor} initialSeen={(seen.data??[]).map(r=>String(r.topic_id))} loaded={!seen.error}><SidebarProvider className="authenticated-cluvo cluvo-admin" style={{'--sidebar-width':'244px'} as React.CSSProperties}><Sidebar className="cluvo-sidebar"><SidebarHeader className="brand-area"><Image src="/brand/cluvo-logo.png" alt="Cluvo" width={152} height={55} priority className="brand-logo"/><span className="brand-caption">JOUW CLUB. SAMEN.</span><p className="admin-context-title">Platformbeheer</p></SidebarHeader><SidebarContent><AdminNavigation items={items}/></SidebarContent></Sidebar><div className="app-main"><AdminTopbar/><main className="workspace">{seen.error&&<p role="status">De uitlegvoorkeuren zijn nu niet beschikbaar.</p>}{children}</main><footer className="app-footer"><span>Cluvo · Club Signal</span><span>Staging · expliciete platformtoegang</span></footer></div></SidebarProvider></AccountHelpProvider></AdminAuthorityGuard>;
}
