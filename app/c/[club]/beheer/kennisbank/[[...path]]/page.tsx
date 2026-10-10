import {KnowledgeBank} from '@/components/knowledge/knowledge-bank';
import {knowledgeAuthority,knowledgePath} from '@/lib/knowledge/server';
export const dynamic='force-dynamic';
export const metadata={title:'Kennisbank verenigingsbeheer · Cluvo'};
export default async function Page({params,searchParams}:{params:Promise<{club:string;path?:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const [{club,path},query]=await Promise.all([params,searchParams]);
  const authority=await knowledgeAuthority('club',club);
  return <KnowledgeBank {...authority} {...knowledgePath(`/c/${encodeURIComponent(club)}/beheer/kennisbank`,path,authority.books)} query={query}/>;
}
