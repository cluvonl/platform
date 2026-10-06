'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {ClipboardCheck, LayoutDashboard, Search, Store, UserRound} from 'lucide-react';
import {SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, useSidebar} from '@/components/ui/sidebar';
import {Avatar, Badge, Input, Modal} from '@/components/cluvo/ui';

function navigationItems(canConfirmAttendance: boolean) {
  return [
    {path: 'overzicht', label: 'Overzicht', icon: LayoutDashboard, group: 'MIJN CLUB'},
    {path: 'taken', label: 'Takenmarkt', icon: Store, group: 'MIJN CLUB'},
    {path: 'intake', label: 'Mijn profiel en intake', icon: UserRound, group: 'MIJN CLUB'},
    ...(canConfirmAttendance ? [{path: 'beheer/presentie', label: 'Presentie', icon: ClipboardCheck, group: 'SAMEN ORGANISEREN'}] : []),
  ];
}

export function WorkspaceNavigation({base, canConfirmAttendance}: {base: string; canConfirmAttendance: boolean}) {
  const pathname = usePathname();
  const {setOpenMobile} = useSidebar();
  const items = navigationItems(canConfirmAttendance);
  return <>{Array.from(new Set(items.map(({group}) => group))).map((group) => <SidebarGroup key={group}>
    <SidebarGroupLabel>{group}</SidebarGroupLabel><SidebarMenu>{items.filter((item) => item.group === group).map(({path, label, icon: Icon}) => <SidebarMenuItem key={path}>
      <SidebarMenuButton className="nav-item" isActive={pathname === `${base}/${path}`} asChild tooltip={label}>
        <Link href={`${base}/${path}`} onClick={() => setOpenMobile(false)} aria-current={pathname === `${base}/${path}` ? 'page' : undefined}><Icon size={18} /><span>{label}</span></Link>
      </SidebarMenuButton>
    </SidebarMenuItem>)}</SidebarMenu>
  </SidebarGroup>)}</>;
}

export function WorkspaceTopbar({base, displayName, canConfirmAttendance}: {base: string; displayName: string; canConfirmAttendance: boolean}) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const items = navigationItems(canConfirmAttendance);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {event.preventDefault(); setSearchOpen(true);}
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return <>
    <header className="topbar"><div className="topbar-left"><SidebarTrigger /><span className="breadcrumb">Werkruimte <span>/</span> <b>{items.find(({path}) => pathname === `${base}/${path}`)?.label ?? 'Mijn club'}</b></span></div>
      <div className="topbar-right"><button className="top-search" type="button" aria-label="Zoeken in Cluvo" onClick={() => setSearchOpen(true)}><Search size={18} /><span>Zoeken in Cluvo</span><kbd>⌘ K</kbd></button><Badge tone="coral">STAGING</Badge><Link href={`${base}/intake`} aria-label="Mijn profiel"><Avatar name={displayName} /></Link></div>
    </header>
    <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Zoeken in Cluvo" description="Open een onderdeel van jouw werkruimte.">
      <label className="sr-only" htmlFor="workspace-search">Zoek een pagina</label><Input id="workspace-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Bijvoorbeeld: takenmarkt, intake…" />
      <div className="search-results">{items.filter(({label}) => label.toLocaleLowerCase('nl-NL').includes(query.toLocaleLowerCase('nl-NL'))).map(({path, label, icon: Icon}) => <Link key={path} href={`${base}/${path}`} onClick={() => setSearchOpen(false)}><Icon size={18} />{label}</Link>)}</div>
    </Modal>
  </>;
}
