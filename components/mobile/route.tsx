import {loadMobileSnapshot} from '@/lib/pwa/server';
import {MobileScreenView} from './screens';
import {MobileShell} from './shell';
import {ContextSelection} from './context-selection';
import type {MobileScreen} from './types';
import {KnowledgeBank} from '@/components/knowledge/knowledge-bank';
import {HelpContact} from './screens';
import {books} from '@/lib/knowledge/catalog.mjs';
import {readableBooks, type KnowledgeContext} from '@/lib/knowledge/model.mjs';
import {Heading} from './primitives';
import Link from 'next/link';

export type MobileRouteProps = {params: Promise<{club: string}>; searchParams: Promise<Record<string, string | string[] | undefined>>};
export async function MobileRoutePage({screen, params, searchParams}: MobileRouteProps & {screen: MobileScreen}) {
  const [{club}, selection] = await Promise.all([params, searchParams]);
  const snapshot = await loadMobileSnapshot(club, {household: typeof selection.household === 'string' ? selection.household : undefined, season: typeof selection.season === 'string' ? selection.season : undefined});
  if (screen === 'help') {
    if (selection.view === 'request') return <MobileShell snapshot={snapshot}><ContextSelection snapshot={snapshot}/><Heading title="Vraag het je vereniging" subtitle="Stel je praktische vraag en volg het antwoord bij Ons huishouden."/><HelpContact snapshot={snapshot}/><Link className="text-link" href={`/app/c/${encodeURIComponent(club)}/help?${new URLSearchParams({...snapshot.household?{household:snapshot.household.id}:{},...snapshot.season?{season:snapshot.season.id}:{}})}`}>Naar de kennisbank</Link></MobileShell>;
    const context:KnowledgeContext={environment:'personal',member:true,permissions:[]};
    const roleLinks=[...(snapshot.adminAccess?.club?[{title:'Kennisbank verenigingsbeheer',href:`/c/${encodeURIComponent(club)}/beheer/kennisbank`}]:[]),...(snapshot.adminAccess?.platform?[{title:'Kennisbank platformbeheer',href:'/platform/kennisbank'}]:[])];
    return <MobileShell snapshot={snapshot}><ContextSelection snapshot={snapshot}/><KnowledgeBank base={`/app/c/${encodeURIComponent(club)}/help`} label={snapshot.workspace.tenant_name} context={context} books={readableBooks(books,context)} query={selection} roleLinks={roleLinks}/><HelpContact snapshot={snapshot}/></MobileShell>;
  }
  return <MobileShell snapshot={snapshot}><ContextSelection snapshot={snapshot} /><MobileScreenView snapshot={snapshot} screen={screen} /></MobileShell>;
}
