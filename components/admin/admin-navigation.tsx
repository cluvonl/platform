'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Building2,LayoutDashboard,Settings,Users,LogOut} from 'lucide-react';
import {SidebarGroup,SidebarGroupLabel,SidebarMenu,SidebarMenuItem,SidebarMenuButton,useSidebar,SidebarTrigger} from '@/components/ui/sidebar';
import {signOutAction} from '@/app/auth/actions';
export type AdminNavItem={path:string;label:string;group:string};
export function AdminNavigation({items}:{items:AdminNavItem[]}){const pathname=usePathname();const {setOpenMobile}=useSidebar();return <>{[...new Set(items.map(i=>i.group))].map(group=><SidebarGroup key={group}><SidebarGroupLabel>{group}</SidebarGroupLabel><SidebarMenu>{items.filter(i=>i.group===group).map((i,index)=><SidebarMenuItem key={i.path}><SidebarMenuButton className="nav-item" asChild isActive={pathname===i.path||pathname.startsWith(i.path+'/')}><Link prefetch={false} href={i.path} onClick={()=>setOpenMobile(false)}>{index===0?<LayoutDashboard size={18}/>:group==='ORGANISATIE'?<Users size={18}/>:group==='PLATFORM'?<Building2 size={18}/>:<Settings size={18}/>}<span>{i.label}</span></Link></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroup>)}</>;}
export function AdminTopbar(){return <header className="topbar"><div className="topbar-left"><SidebarTrigger/><span className="breadcrumb">Cluvo <span>/</span><b>Platformbeheer</b></span></div><div className="topbar-right"><Link href="/workspaces" className="text-link">Mijn werkruimtes</Link><span className="badge coral">STAGING</span><form action={signOutAction}><button className="help-link" type="submit"><LogOut size={17}/>Uitloggen</button></form></div></header>;}
