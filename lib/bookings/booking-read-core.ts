import {z} from 'zod';
import {dataSnapshot,decodeForm,parseRequest,parseResponse,rpcPlan,
  type ReadKind,type ReadRequest,type ReadDTOMap,type RpcName,type RpcArgs} from './booking-read-contracts';

export type Transport={schema(name:'api'):{rpc(name:RpcName,args:RpcArgs):PromiseLike<{data:unknown;error:unknown}>}};
export type Dependencies={
  requireWorkspace(club:string):Promise<{workspace:unknown;client:Transport}>;
  rethrow(error:unknown):void;
  redirectToLogin():never;
};
export type ReadState<K extends ReadKind=ReadKind>=
  |{status:'loaded';data:Readonly<ReadDTOMap[K]>}
  |{status:'unavailable';category:'invalid_input'|'forbidden'|'unverified_response'|'unavailable';message:string};
const unavailable=(category:'invalid_input'|'forbidden'|'unverified_response'|'unavailable'):ReadState<never>=>({
  status:'unavailable',category,message:'De gevraagde boekingsgegevens zijn niet beschikbaar.',
});
const workspaceSchema=z.object({tenant_id:z.string().uuid(),tenant_slug:z.string(),person_id:z.string().uuid()});
function workspace(raw:unknown,club:string) {
  const snapshot=dataSnapshot(raw);if(!snapshot.ok) return null;
  const checked=workspaceSchema.safeParse(snapshot.value);
  return checked.success&&checked.data.tenant_slug===club?checked.data:null;
}
// Postgrest response metadata is permitted at this transport boundary only;
// it is never copied into the public booking DTO.
const envelope=z.object({data:z.unknown(),error:z.unknown(),count:z.number().int().nullable().optional(),
  status:z.number().int().optional(),statusText:z.string().optional()}).strict();
const forbiddenError=z.object({code:z.literal('42501'),message:z.literal('FORBIDDEN')});

export async function executeReadRequest<K extends ReadKind>(kind:K,input:unknown,deps:Dependencies):Promise<ReadState<K>> {
  // Snapshot/validate before the first await: callers cannot replace resources
  // while Native/workspace verification or network transport is pending.
  const request=parseRequest(kind,input);
  if(!request.ok) return unavailable('invalid_input');
  return executeChecked(kind,request.request,deps);
}
export async function executeReadForm<K extends ReadKind>(kind:K,form:FormData,deps:Dependencies):Promise<ReadState<K>> {
  const request=decodeForm(kind,form);
  if(!request.ok) return unavailable('invalid_input');
  return executeChecked(kind,request.request,deps);
}
async function executeChecked<K extends ReadKind>(kind:K,request:Readonly<ReadRequest<K>>,deps:Dependencies):Promise<ReadState<K>> {
  try {
    const scope=await deps.requireWorkspace(request.club);
    const current=workspace(scope.workspace,request.club);
    if(!current) return unavailable('forbidden');
    const plan=rpcPlan(kind,request,current.tenant_id);
    // Exactly one read. SQL18 checks current Native/action rights itself.
    // Frozen review and outcomes never perform mutable head/capacity/source
    // or executor-choice preflight, and do not claim an idempotency record.
    const raw=await scope.client.schema('api').rpc(plan.name,plan.args);
    const snapshot=dataSnapshot(raw);
    if(!snapshot.ok) return unavailable('unverified_response');
    const result=envelope.safeParse(snapshot.value);
    if(!result.success) return unavailable('unverified_response');
    if(result.data.error!==null) {
      if(forbiddenError.safeParse(result.data.error).success) {
        // FORBIDDEN also covers Native loss. Existing current workspace gate
        // redirects a lost Native session, while valid action denial stays
        // unavailable. A role list is never substituted for action rights.
        const fresh=await deps.requireWorkspace(request.club);
        if(!workspace(fresh.workspace,request.club)) deps.redirectToLogin();
        return unavailable('forbidden');
      }
      return unavailable('unavailable');
    }
    const output=parseResponse(kind,request,result.data.data);
    return output.ok?{status:'loaded',data:output.value}:unavailable('unverified_response');
  } catch(error) {
    deps.rethrow(error); // Real Next redirect/notFound/request-time exceptions.
    return unavailable('unavailable');
  }
}
