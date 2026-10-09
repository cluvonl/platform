import {type NextRequest} from 'next/server';
import {clubRead} from '@/lib/admin/server';
import {rows,str} from '@/lib/admin/contracts';
import {calendarICS,csvCell as cell} from '@/lib/pwa/exports.mjs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{club:string}>}){
 const {club}=await params;const section=request.nextUrl.searchParams.get('section');
 if(section==='planning'&&request.nextUrl.searchParams.get('format')==='ics'){
  const season=request.nextUrl.searchParams.get('season');const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  if(!season)return new Response('Kies eerst een seizoen.',{status:400,headers});
  const query=request.nextUrl.searchParams;const filters=Object.fromEntries(['committee_id','team_id','category_id','queue','starts_on','ends_on'].filter(key=>query.has(key)).map(key=>[key,query.get(key)!]));
  const selection={season,limit:200,query:query.get('q')??'',status:query.get('status')??'',filters};
  const first=await clubRead(club,'planning',selection);const data=rows(first.read.rows);
  if(data.length===200&&rows((await clubRead(club,'planning',{...selection,offset:200})).read.rows).length)return new Response('Kies een kleinere kalenderperiode, commissie of categorie. Er worden geen afspraken afgekapt.',{status:413,headers});
  const current=await clubRead(club,'planning',selection);
  if(JSON.stringify(current.read.rows)!==JSON.stringify(first.read.rows))return new Response('De planning is tijdens het exporteren gewijzigd. Maak een nieuwe export.',{status:409,headers});
  return new Response(calendarICS(data.map(r=>({id:str(r.id),kind:'verenigingstaak',title:str(r.name),startsAt:str(r.starts_at),endsAt:str(r.ends_at),location:str(r.location)})),first.read.observed_at),{headers:{...headers,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="cluvo-planning.ics"'}});
 }
 if(!['reports','finance','report_teams','report_occupancy'].includes(section??''))return new Response('Dit exporttype is niet beschikbaar.',{status:400,headers:{'Cache-Control':'private, no-store'}});
 const season=request.nextUrl.searchParams.get('season');if(!season)return new Response('Kies eerst een seizoen.',{status:400,headers:{'Cache-Control':'private, no-store'}});
 const query=request.nextUrl.searchParams;const filters=Object.fromEntries(['committee_id','team_id','category_id','starts_on','ends_on'].filter(key=>query.has(key)).map(key=>[key,query.get(key)!]));
 const selection={season,limit:200,query:query.get('q')??'',status:query.get('status')??'',filters};
 const {read}=await clubRead(club,section!,selection);
 if(read.extras?.historical_measurement_available===false)return new Response('De historische teammeting is onbekend; er wordt geen lege stand geëxporteerd.',{status:409,headers:{'Cache-Control':'private, no-store'}});const exported=rows(read.rows);const total=read.extras?.total_rows;
 if(typeof total!=='number'||total>20000)return new Response('Deze export is te groot. Kies een kleinere periode of doelgroep.',{status:413,headers:{'Cache-Control':'private, no-store'}});
 for(let offset=200;offset<total;offset+=200){const page=await clubRead(club,section!,{...selection,offset});if(page.read.extras?.report_revision!==read.extras?.report_revision)return new Response('De standen zijn tijdens het exporteren gewijzigd. Maak een nieuwe export.',{status:409,headers:{'Cache-Control':'private, no-store'}});exported.push(...rows(page.read.rows));}
 if(exported.length!==total)return new Response('De export kon niet volledig worden gecontroleerd. Probeer opnieuw.',{status:409,headers:{'Cache-Control':'private, no-store'}});
 const householdColumns=['name','effective_target_minutes','confirmed_minutes','planned_minutes','review_minutes','confirmed_before_winter_minutes','winter_deficit_minutes','annual_state','winter_state'];const householdTitles=['Huishouden','Jaardoel (minuten)','Bevestigd (minuten)','Gepland (minuten)','Ter controle (minuten)','Bevestigd vóór winter (minuten)','Wintertekort (minuten)','Jaarstand','Winterstand'];
 const columns=section==='report_teams'?['name','member_count','goal_total','confirmed_count','planned_count','assigned_count']:section==='report_occupancy'?['name','starts_at','ends_at','total_places','free_places','reserved_places','booked_places','review_places','confirmed_places','no_show_places']:householdColumns;
 const titles=section==='report_teams'?['Team','Leden','Doelen (plaatsen)','Bevestigde tellingen','Geplande tellingen','Toegewezen leden']:section==='report_occupancy'?['Taak','Begin','Einde','Concrete plaatsen','Vrij op de markt','Teamreserveringen','Uitvoerder geboekt','Ter controle','Bevestigd','Niet verschenen']:householdTitles;
 const current=await clubRead(club,section!,selection);if(current.read.extras?.report_revision!==read.extras?.report_revision)return new Response('De standen zijn tijdens het exporteren gewijzigd. Maak een nieuwe export.',{status:409,headers:{'Cache-Control':'private, no-store'}});
 const body='\uFEFF'+[titles.map(cell).join(';'),...exported.map(row=>columns.map(c=>cell(row[c])).join(';'))].join('\r\n');
 return new Response(body,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="cluvo-${section}-${str(read.season_id)}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
