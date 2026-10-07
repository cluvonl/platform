import {z} from 'zod';
import {decodeForm,parseReadResponse,rpcPlan,parseCommandResponse,
  type CommandKind,type CommandRequest,type CommandDTOMap,type ReadKind,type ReadDTOMap,type Request,type RpcName,type RpcArgs} from './booking-contracts';

// Server-only orchestration, separately injected for meaningful fake-RPC tests.
// The real Next bridge below is the only production entrypoint. Dependencies
// are never supplied by a client/action argument or serialized to a browser.
export type Transport={schema(name:'api'):{rpc(name:RpcName,args:RpcArgs):PromiseLike<{data:unknown;error:unknown}>}};
export type Dependencies={
  requireWorkspace(club:string):Promise<{workspace:unknown;client:Transport}>;
  rethrow(error:unknown):void;
  redirectToLogin():never;
  revalidatePath(path:string):void;
};
const workspaceSchema=z.object({tenant_id:z.string().uuid(),tenant_slug:z.string(),person_id:z.string().uuid()});
const contextError=z.object({code:z.string(),message:z.string()});
export type Rejection='ack_required'|'stale'|'unavailable'|'unsupported'|'forbidden'|'invalid_input'|'idempotency_conflict';
export type CommandState<K extends CommandKind=CommandKind>=
  |{status:'invalid';category:'invalid_input';message:string;fields:string[]}
  |{status:'unknown';message:string;attempt:Readonly<Request<K>>}
  |{status:'rejected';category:Rejection;message:string;attempt:Readonly<Request<K>>}
  |{status:'confirmed';message:string;attempt:Readonly<Request<K>>;receipt:CommandDTOMap[K];refreshPending:boolean};
export type ReadState<K extends ReadKind=ReadKind>={status:'loaded';data:ReadDTOMap[K]}|{status:'unavailable';message:string};

const messages:Record<Rejection,string>={
  ack_required:'Bevestig dat je de instructies en de afmeldafspraak hebt gelezen.',
  stale:'De taak of het aanbod is gewijzigd. Bekijk het actuele aanbod voordat je een nieuw verzoek doet.',
  unavailable:'Deze plek of dit specifieke aanbod is niet meer beschikbaar.',
  unsupported:'Voor deze taak of verwerking is aanvullende afhandeling nodig.',
  forbidden:'Je hebt voor dit verzoek geen actuele bevoegdheid.',
  invalid_input:'Het verzoek is niet geldig. Controleer de gekozen gegevens.',
  idempotency_conflict:'Wijzig je vorige verzoek niet. Controleer eerst de bestaande uitkomst.',
};
const errors:Readonly<Record<string,Rejection>>=Object.freeze({
  '55000:ACK_REQUIRED':'ack_required',
  '40001:STALE_VERSION':'stale','40001:BOOKING_CONTRACT_STALE':'stale',
  'P0001:CAPACITY_FULL':'unavailable','P0001:POSITION_UNAVAILABLE':'unavailable',
  'P0001:OFFER_EXPIRED':'unavailable','P0001:TRANSFER_NOT_OPEN':'unavailable',
  '23P01:PERSON_OVERLAP':'unavailable','55000:OFFER_ALREADY_USED':'unavailable',
  '55000:BOOKING_CONTRACT_REQUIRED':'unsupported','55000:SHIFT_NOT_BOOKABLE':'unavailable',
  '55000:TASK_REQUIREMENTS_NOT_SUPPORTED':'unsupported','55000:READ_COMMITTED_REQUIRED':'unsupported',
  '42501:FORBIDDEN':'forbidden','42501:NOT_ELIGIBLE':'forbidden',
  '22023:INVALID_COMMAND':'invalid_input','22000:IDEMPOTENCY_CONFLICT':'idempotency_conflict',
});
const unknown=(attempt:Readonly<CommandRequest>):CommandState=>({status:'unknown',
  message:'Nog geen bevestiging ontvangen. Controleer hetzelfde verzoek opnieuw.',attempt});

function checkedWorkspace(raw:unknown,club:string) {
  const parsed=workspaceSchema.safeParse(raw);
  return parsed.success && parsed.data.tenant_slug===club?parsed.data:null;
}
export function executeCommand<K extends CommandKind>(kind:K,form:FormData,deps:Dependencies):Promise<CommandState<K>>;
export async function executeCommand(kind:CommandKind,form:FormData,deps:Dependencies):Promise<CommandState> {
  const parsed=decodeForm(kind,form);
  if(!parsed.ok) return {status:'invalid',category:'invalid_input',message:messages.invalid_input,fields:parsed.fields};
  const attempt=parsed.request;
  let scope:Awaited<ReturnType<Dependencies['requireWorkspace']>>;
  let response:{data:unknown;error:unknown};
  try {
    scope=await deps.requireWorkspace(attempt.club);
    const workspace=checkedWorkspace(scope.workspace,attempt.club);
    if(!workspace) return {status:'rejected',category:'forbidden',message:messages.forbidden,attempt};
    // No preflight head, capacity, chooser, current offer, or eligibility read.
    // The DB command always reauthorizes and can replay an already filled place.
    const plan=rpcPlan(kind,attempt,workspace.tenant_id);
    response=await scope.client.schema('api').rpc(plan.name,plan.args);
    if(response.error) {
      const error=contextError.safeParse(response.error);
      const category=error.success?errors[error.data.code+':'+error.data.message]:undefined;
      if(!category) return unknown(attempt);
      if(category==='forbidden') {
        // SQL uses FORBIDDEN for both action scope and Native loss. Rechecking
        // my_workspaces through the existing gate lets Native loss redirect;
        // it does not convert a role/eligibility failure into a fake login error.
        const fresh=await deps.requireWorkspace(attempt.club);
        if(!checkedWorkspace(fresh.workspace,attempt.club)) deps.redirectToLogin();
      }
      return {status:'rejected',category,message:messages[category],attempt};
    }
  } catch(error) {
    deps.rethrow(error); // Next redirect/notFound/request-time errors first.
    return unknown(attempt);
  }
  const receipt=parseCommandResponse(kind,attempt,response.data);
  if(!receipt.ok) return unknown(attempt); // Includes ok:false and unparsed/null.
  let refreshPending=false;
  const paths=kind.startsWith('commit')?['diensten','taken','overzicht']:kind==='publish'?['diensten','taken']:[];
  try {
    for(const path of paths) deps.revalidatePath(`/c/${encodeURIComponent(attempt.club)}/${path}`);
  } catch(error) {
    deps.rethrow(error);
    refreshPending=true; // A confirmed RPC is still confirmed if refresh fails.
  }
  return {status:'confirmed',message:kind.startsWith('prepare')
    ?'De instructies en de afmeldafspraak zijn aangeboden. Er is geen plek gereserveerd.'
    :kind==='publish'?'De instructieversie is gepubliceerd.'
      :'De inschrijving is bevestigd. Uren tellen pas na bevestigde uitvoering.',
    attempt,receipt:receipt.value,refreshPending};
}

export function executeRead<K extends ReadKind>(kind:K,form:FormData,deps:Dependencies):Promise<ReadState<K>>;
export async function executeRead(kind:ReadKind,form:FormData,deps:Dependencies):Promise<ReadState> {
  const parsed=decodeForm(kind,form);
  const unavailable:ReadState={status:'unavailable',message:'De gevraagde boekingsgegevens zijn niet beschikbaar.'};
  if(!parsed.ok) return unavailable;
  try {
    const scope=await deps.requireWorkspace(parsed.request.club);
    const workspace=checkedWorkspace(scope.workspace,parsed.request.club);
    if(!workspace) return unavailable;
    const plan=rpcPlan(kind,parsed.request,workspace.tenant_id);
    const response=await scope.client.schema('api').rpc(plan.name,plan.args);
    if(response.error) {
      const error=contextError.safeParse(response.error);
      if(error.success && error.data.code==='42501' && error.data.message==='FORBIDDEN') {
        const fresh=await deps.requireWorkspace(parsed.request.club);
        if(!checkedWorkspace(fresh.workspace,parsed.request.club)) deps.redirectToLogin();
      }
      return unavailable;
    }
    const output=parseReadResponse(kind,parsed.request,response.data);
    return output.ok?{status:'loaded',data:output.value}:unavailable;
  } catch(error) {
    deps.rethrow(error);
    return unavailable;
  }
}
