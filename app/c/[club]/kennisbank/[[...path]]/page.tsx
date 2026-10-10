import {KnowledgeBank} from '@/components/knowledge/knowledge-bank';
import {knowledgeAuthority,knowledgePath} from '@/lib/knowledge/server';
export const dynamic='force-dynamic';
export const metadata={title:'Kennisbank · Cluvo'};
export default async function Page({params,searchParams}:{params:Promise<{club:string;path?:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const [{club,path},query]=await Promise.all([params,searchParams]);
  const authority=await knowledgeAuthority('personal',club);
  const base=`/c/${encodeURIComponent(club)}/kennisbank`;
  const selected=knowledgePath(base,path,authority.books);
  const roleLinks=[...(authority.clubAdmin?[{title:'Kennisbank verenigingsbeheer',href:`/c/${encodeURIComponent(club)}/beheer/kennisbank`}]:[]),...(authority.platformAdmin?[{title:'Kennisbank platformbeheer',href:'/platform/kennisbank'}]:[])];
  return <KnowledgeBank {...authority} {...selected} query={query} roleLinks={roleLinks}/>;
}
