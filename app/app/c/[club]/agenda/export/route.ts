import {z} from 'zod';
import {loadMobileSnapshot} from '@/lib/pwa/server';
import {calendarICS} from '@/lib/pwa/exports.mjs';

const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request,{params}:{params:Promise<{club:string}>}) {
  const {club}=await params,query=new URL(request.url).searchParams;
  for(const key of ['household','season','event'])if(query.has(key)&&!z.string().uuid().safeParse(query.get(key)).success)return new Response('Controleer de selectie.',{status:400,headers});
  const snapshot=await loadMobileSnapshot(club,{household:query.get('household')??undefined,season:query.get('season')??undefined});
  const events=query.has('event')?snapshot.agenda.filter(event=>event.id===query.get('event')):snapshot.agenda;
  if(query.has('event')&&!events.length)return new Response('Deze afspraak is niet beschikbaar binnen je toegang.',{status:404,headers});
  return new Response(calendarICS(events,snapshot.readAt),{headers:{...headers,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="cluvo-agenda.ics"'}});
}
