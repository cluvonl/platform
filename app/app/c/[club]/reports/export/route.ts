import {z} from 'zod';
import {loadMobileSnapshot} from '@/lib/pwa/server';
import {householdCSV} from '@/lib/pwa/exports.mjs';

const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request,{params}:{params:Promise<{club:string}>}) {
  const {club}=await params,query=new URL(request.url).searchParams;
  for(const key of ['household','season'])if(query.has(key)&&!z.string().uuid().safeParse(query.get(key)).success)return new Response('Controleer de selectie.',{status:400,headers});
  const snapshot=await loadMobileSnapshot(club,{household:query.get('household')??undefined,season:query.get('season')??undefined});
  if(!snapshot.capabilities.reports?.available)return new Response('Je hebt geen toegang tot dit overzicht.',{status:403,headers});
  return new Response(householdCSV(snapshot.reports,snapshot.season?.name),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="cluvo-huishoudoverzicht.csv"'}});
}
