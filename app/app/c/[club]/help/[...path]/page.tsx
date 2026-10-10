import {KnowledgeBank} from '@/components/knowledge/knowledge-bank';
import {knowledgePath} from '@/lib/knowledge/server';
import {books} from '@/lib/knowledge/catalog.mjs';
import {readableBooks,type KnowledgeContext} from '@/lib/knowledge/model.mjs';
import {loadMobileSnapshot} from '@/lib/pwa/server';
import {MobileShell} from '@/components/mobile/shell';
import {ContextSelection} from '@/components/mobile/context-selection';
export const dynamic='force-dynamic';
export const metadata={title:'Kennisbank · Cluvo'};
export default async function Page({params,searchParams}:{params:Promise<{club:string;path:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const [{club,path},query]=await Promise.all([params,searchParams]);
  const snapshot=await loadMobileSnapshot(club,{household:typeof query.household==='string'?query.household:undefined,season:typeof query.season==='string'?query.season:undefined});
  const context:KnowledgeContext={environment:'personal',member:true,permissions:[]};
  const allowed=readableBooks(books,context);
  return <MobileShell snapshot={snapshot}><ContextSelection snapshot={snapshot}/><KnowledgeBank context={context} books={allowed} label={snapshot.workspace.tenant_name} {...knowledgePath(`/app/c/${encodeURIComponent(club)}/help`,path,allowed)} query={query}/></MobileShell>;
}
