import {z} from 'zod';
import {requireWorkspace} from '@/lib/auth/workspace';

const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};
const record=z.object({id:z.string().uuid(),tenant_id:z.string().uuid(),obligation_id:z.string().uuid(),season_id:z.string().uuid(),booking_id:z.string().uuid().nullable(),attendance_decision_id:z.string().uuid().nullable(),entry_kind:z.enum(['award','reversal','replacement']),minutes_delta:z.number().int(),performed_at:z.string(),posted_at:z.string(),reverses_entry_id:z.string().uuid().nullable(),correction_reason:z.string().nullable(),evidence_kind:z.literal('canonical_ledger_record')}).strict();
export async function GET(_request:Request,{params}:{params:Promise<{club:string;entry:string}>}) {
  const {club,entry}=await params;
  if(!z.string().uuid().safeParse(entry).success)return new Response('Controleer de bevestiging.',{status:400,headers});
  const {client,workspace}=await requireWorkspace(club,'/app/login');
  const result=await client.schema('api').rpc('pwa_ledger_entry',{p_tenant_id:workspace.tenant_id,p_entry_id:entry});
  const parsed=record.safeParse(result.data);
  if(result.error||!parsed.success||parsed.data.id!==entry||parsed.data.tenant_id!==workspace.tenant_id)return new Response('Deze bevestiging is niet beschikbaar binnen je toegang.',{status:404,headers});
  return new Response(JSON.stringify(parsed.data,null,2)+'\n',{headers:{...headers,'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="cluvo-urenbevestiging.json"'}});
}
