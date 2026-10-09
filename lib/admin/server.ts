import 'server-only';
import {redirect,notFound} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import type {AdminRead,ClubAdminAccess} from './contracts';
import {z} from 'zod';

export async function adminIdentity(){
 const client=await createSupabaseServerClient();const {data,error}=await client.auth.getClaims();
 if(error||typeof data?.claims?.sub!=='string')redirect('/login');
 return {client,actor:data.claims.sub};
}
export async function requireClubAdmin(club:string){
 const {client,actor}=await adminIdentity();const {data,error}=await client.schema('api').rpc('club_admin_access',{p_slug:club});
 if(error||data?.authorized!==true)notFound();
 return {client,actor,access:data as ClubAdminAccess};
}
export async function requirePlatform(){
 const {client,actor}=await adminIdentity();const {data,error}=await client.schema('api').rpc('platform_access');
 if(error||data?.authorized!==true)notFound();
 return {client,actor,permissions:z.array(z.object({key:z.string(),tenant_id:z.string().uuid().nullable()})).parse(data.permissions)};
}
export async function clubRead(club:string,section:string,selection:{season?:string;resource?:string;query?:string;status?:string;offset?:number;limit?:number;filters?:Record<string,string>}={}){
 const ctx=await requireClubAdmin(club);
 const season=selection.season?z.string().uuid().parse(selection.season):null;
 const resource=selection.resource?z.string().uuid().parse(selection.resource):null;
 const {data,error}=await ctx.client.schema('api').rpc('club_admin_read',{p_tenant:ctx.access.tenant_id,p_section:section,p_season:season,p_resource:resource,p_query:selection.query??'',p_status:selection.status??'',p_offset:selection.offset??0,p_limit:selection.limit??100,p_filters:selection.filters??{}});
 if(error?.code==='42501')notFound();
 if(error||!data)throw new Error('Dit beheeronderdeel kan nu niet veilig worden geladen. Vernieuw de pagina.');
 return {...ctx,read:data as AdminRead};
}
export async function platformRead(section:string,selection:{tenant?:string;query?:string;status?:string;actor?:string;after?:string;before?:string;resource?:string}={}){
 const ctx=await requirePlatform();const tenant=selection.tenant?z.string().uuid().parse(selection.tenant):null;
 const optionalId=(value?:string)=>value?z.string().uuid().parse(value):null;
 const optionalDate=(value?:string)=>value?z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(value):null;
 const {data,error}=await ctx.client.schema('api').rpc('platform_read',{p_section:section,p_tenant:tenant,p_query:selection.query??'',p_status:selection.status??'',p_actor:optionalId(selection.actor),p_after:optionalDate(selection.after),p_before:optionalDate(selection.before),p_resource:optionalId(selection.resource)});
 if(error?.code==='42501')notFound();if(error||!data)throw new Error('Dit platformonderdeel kan nu niet veilig worden geladen. Vernieuw de pagina.');
 return {...ctx,read:data as AdminRead};
}
