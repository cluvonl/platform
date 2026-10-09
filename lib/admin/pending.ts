import 'server-only';
import {cookies} from 'next/headers';
import {invitationTokenSecret} from '@/lib/supabase/config';
import {openReceipts,sealReceipts} from '@/lib/pwa/receipts.mjs';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import type {AdminCommand} from './contracts';
type Scope={tenant:string;person:string};
const name='cluvo-admin-pending';
export async function adminPending(scope:Scope):Promise<Array<Scope&{key:string;command:string;at:number;input?:AdminCommand}>>{
 const surface=scope.tenant==='00000000-0000-4000-8000-000000000001'?'platform':'club';
 const client=await createSupabaseServerClient();const {data,error}=await client.schema('api').rpc('admin_pending_commands',{p_surface:surface,p_tenant:surface==='platform'?null:scope.tenant});
 if(error||!Array.isArray(data))return local(scope);
 return data.map(r=>({...scope,key:r.key,command:r.action,at:Date.parse(r.prepared_at),input:{surface,club:r.club??undefined,key:r.key,action:r.action,resourceId:r.resource_id,version:r.version,payload:r.payload}}));
}
async function local(scope:Scope){return openReceipts((await cookies()).get(name)?.value,invitationTokenSecret(),scope);}
export async function adminRemember(scope:Scope,key:string,command:string){const previous=await local(scope);await write([...previous.filter(r=>r.key!==key),{...scope,key,command,at:Date.now()}]);}
export async function adminForget(scope:Scope,key:string){await write((await local(scope)).filter(r=>r.key!==key));}
async function write(receipts:ReturnType<typeof openReceipts>){(await cookies()).set(name,receipts.length?sealReceipts(receipts,invitationTokenSecret()):'',{path:'/',httpOnly:true,sameSite:'lax',secure:process.env.APP_ENV!=='local',maxAge:receipts.length?86400:0});}
