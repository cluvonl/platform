import {KnowledgeBank} from '@/components/knowledge/knowledge-bank';
import {knowledgeAuthority,knowledgePath} from '@/lib/knowledge/server';
export const dynamic='force-dynamic';
export const metadata={title:'Kennisbank platformbeheer · Cluvo'};
export default async function Page({params,searchParams}:{params:Promise<{path?:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const [{path},query]=await Promise.all([params,searchParams]);
  const authority=await knowledgeAuthority('platform');
  return <KnowledgeBank {...authority} {...knowledgePath('/platform/kennisbank',path,authority.books)} query={query}/>;
}
