'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {createSupabaseServerClient} from '@/lib/supabase/server';

export async function replyToAdminInvitationAction(input:{id:string;version:number;decision:'accept'|'decline'}):Promise<{state:'confirmed'|'rejected'|'unknown';message:string}>{
 const parsed=z.object({id:z.string().uuid(),version:z.number().int().positive(),decision:z.enum(['accept','decline'])}).strict().safeParse(input);
 if(!parsed.success)return {state:'rejected',message:'Controleer de actuele uitnodiging.'};
 const unknown={state:'unknown' as const,message:'De uitkomst is nog onbekend. Controleer dezelfde keuze; maak geen tweede benoeming.'};
 try{
  const client=await createSupabaseServerClient();
  const {data,error}=await client.schema('api').rpc('platform_command',{p_action:parsed.data.decision==='accept'?'accept_admin_invitation':'decline_admin_invitation',
   p_resource_id:parsed.data.id,p_expected_version:parsed.data.version,p_payload:{explicit_confirmation:true},p_idempotency_key:parsed.data.id});
  if(error){
   if(!/^[0-9A-Z]{5}$/.test(error.code??''))return unknown;
   return {state:'rejected',message:error.message==='INVITATION_EXPIRED'?'De acceptatietermijn is verlopen. Vraag de bevoegde beheerder om een actuele uitnodiging.':error.message==='INVITATION_AUTHORITY_ENDED'?'Het aangeboden mandaat is niet meer geldig. De beheerder moet het bereik en de actuele bevoegdheid opnieuw controleren.':'Deze uitnodiging kan niet meer met deze versie en keuze worden verwerkt. Vernieuw de pagina.'};
  }
  if(data?.ok!==true)return unknown;
  revalidatePath('/workspaces');revalidatePath('/platform','layout');
  return {state:'confirmed',message:parsed.data.decision==='accept'?'Je hebt het getoonde mandaat geaccepteerd. De werkruimte verschijnt zodra de vereniging actief is.':'Je hebt de uitnodiging geweigerd. Er zijn geen rechten toegekend.'};
 }catch{return unknown;}
}
