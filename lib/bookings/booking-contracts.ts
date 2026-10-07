import {z} from 'zod';

// Exact proven migration17 input/output boundary. This module has no credentials,
// client, session, actor, database access or Next server imports.
export const SQL17_SHA256 = '27246ea5c22cf11ec1831ac34536807e39b69be2d56da6575f5f9f2d4b7db298';
const uuid = z.string().uuid().transform(value => value.toLowerCase());
const positive = z.number().int().positive().safe();
const nonnegative = z.number().int().nonnegative().safe();
const timestamp = z.string().datetime({offset:true});
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const club = z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
// SQL counts Unicode code points and retains the exact original text in the
// command payload/hash. Validate without trim/normalization during retries.
const text = (limit:number,trimmedLimit=false) => z.string().refine(value => {
  const trimmed=value.replace(/^ +| +$/g,''); // PostgreSQL btrim(text)'s ASCII space.
  return !value.includes('\u0000') && value.isWellFormed() && trimmed.length>0
    && Array.from(trimmedLimit?trimmed:value).length<=limit;
});
const common = {club};
const keyed = {...common, idempotencyKey:uuid};
const tuple = {shiftId:uuid, positionId:uuid, executorPersonId:uuid, obligationId:uuid, expectedShiftVersion:positive};
const waitlist = {waitlistOfferId:uuid, expectedOfferVersion:positive, expectedShiftVersion:positive};
const transfer = {transferRequestId:uuid, expectedRequestVersion:positive};
const consent = {bookingOfferId:uuid, instructionsAck:z.literal(true), cancellationAck:z.literal(true)};

export const requestSchemas = {
  prepareOnline:z.object({...keyed,...tuple}).strict(),
  preparePhone:z.object({...keyed,...tuple}).strict(),
  prepareWaitlist:z.object({...keyed,...waitlist}).strict(),
  prepareTransfer:z.object({...keyed,...transfer}).strict(),
  commitOnline:z.object({...keyed,...tuple,...consent}).strict(),
  commitPhone:z.object({...keyed,...tuple,...consent,reason:text(2000)}).strict(),
  commitWaitlist:z.object({...keyed,...waitlist,...consent}).strict(),
  commitTransfer:z.object({...keyed,...transfer,...consent}).strict(),
  publish:z.object({...keyed,shiftId:uuid,expectedShiftVersion:positive,
    expectedContractVersion:nonnegative.max(Number.MAX_SAFE_INTEGER-1),instructionsText:text(4000,true)}).strict(),
  context:z.object({...common,shiftId:uuid}).strict(),
  executors:z.object({...common,shiftId:uuid}).strict(),
  acknowledgement:z.object({...common,bookingId:uuid}).strict(),
} as const;
export type Kind = keyof typeof requestSchemas;
export type CommandKind = Exclude<Kind,'context'|'executors'|'acknowledgement'>;
export type ReadKind = Exclude<Kind,CommandKind>;
export type Request<K extends Kind> = z.infer<(typeof requestSchemas)[K]>;
export type CommandRequest = Request<CommandKind>;

export const rpcNames = {
  prepareOnline:'prepare_shift_booking_offer_v2', preparePhone:'prepare_assisted_booking_offer_v2',
  prepareWaitlist:'prepare_waitlist_booking_offer_v2', prepareTransfer:'prepare_transfer_booking_offer_v2',
  commitOnline:'book_shift_v2', commitPhone:'assisted_book_shift_by_phone_v2',
  commitWaitlist:'accept_waitlist_offer_v2', commitTransfer:'accept_booking_transfer_v2',
  publish:'publish_shift_booking_contract_v2', context:'get_shift_booking_context_v2',
  executors:'list_authorised_shift_executors_v2', acknowledgement:'get_booking_acknowledgement_v2',
} as const;
export type RpcName = (typeof rpcNames)[Kind];
export type RpcArgs = Readonly<Record<string,string|number|boolean>>;
type TenantArgs={p_tenant_id:string};
type KeyArgs=TenantArgs & {p_idempotency_key:string};
type TupleArgs=KeyArgs & {p_shift_id:string;p_position_id:string;p_executor_person_id:string;p_obligation_id:string;p_expected_shift_version:number};
type WaitArgs=KeyArgs & {p_offer_id:string;p_expected_offer_version:number;p_expected_shift_version:number};
type TransferArgs=KeyArgs & {p_transfer_request_id:string;p_expected_request_version:number};
type ConsentArgs={p_booking_offer_id:string;p_instructions_ack:true;p_cancellation_ack:true};
export type RpcInputMap={
  prepareOnline:TupleArgs;preparePhone:TupleArgs;prepareWaitlist:WaitArgs;prepareTransfer:TransferArgs;
  commitOnline:TupleArgs & ConsentArgs;commitPhone:TupleArgs & ConsentArgs & {p_reason:string};
  commitWaitlist:WaitArgs & ConsentArgs;commitTransfer:TransferArgs & ConsentArgs;
  publish:KeyArgs & {p_shift_id:string;p_expected_shift_version:number;p_expected_contract_version:number;p_instructions_text:string};
  context:TenantArgs & {p_shift_id:string};executors:TenantArgs & {p_shift_id:string};acknowledgement:TenantArgs & {p_booking_id:string};
};
export type RpcPlan<K extends Kind=Kind>=K extends Kind?Readonly<{name:(typeof rpcNames)[K];args:Readonly<RpcInputMap[K]>}>:never;

// A fixed server entrypoint chooses Kind; FormData never chooses an RPCname.
const fieldNames:Record<Kind,readonly string[]> = {
  prepareOnline:['club','shiftId','positionId','executorPersonId','obligationId','expectedShiftVersion','idempotencyKey'],
  preparePhone:['club','shiftId','positionId','executorPersonId','obligationId','expectedShiftVersion','idempotencyKey'],
  prepareWaitlist:['club','waitlistOfferId','expectedOfferVersion','expectedShiftVersion','idempotencyKey'],
  prepareTransfer:['club','transferRequestId','expectedRequestVersion','idempotencyKey'],
  commitOnline:['club','shiftId','positionId','executorPersonId','obligationId','expectedShiftVersion','bookingOfferId','instructionsAck','cancellationAck','idempotencyKey'],
  commitPhone:['club','shiftId','positionId','executorPersonId','obligationId','expectedShiftVersion','bookingOfferId','instructionsAck','cancellationAck','reason','idempotencyKey'],
  commitWaitlist:['club','waitlistOfferId','expectedOfferVersion','expectedShiftVersion','bookingOfferId','instructionsAck','cancellationAck','idempotencyKey'],
  commitTransfer:['club','transferRequestId','expectedRequestVersion','bookingOfferId','instructionsAck','cancellationAck','idempotencyKey'],
  publish:['club','shiftId','expectedShiftVersion','expectedContractVersion','instructionsText','idempotencyKey'],
  context:['club','shiftId'],executors:['club','shiftId'],acknowledgement:['club','bookingId'],
};
const versionFields = new Set(['expectedShiftVersion','expectedOfferVersion','expectedRequestVersion','expectedContractVersion']);
const ackFields = new Set(['instructionsAck','cancellationAck']);
export type InvalidInput = {ok:false;category:'invalid_input';fields:string[]};
export type Parsed<K extends Kind> = {ok:true;request:Readonly<Request<K>>}|InvalidInput;

export function parseRequest<K extends Kind>(kind:K,input:unknown):Parsed<K> {
  const parsed=requestSchemas[kind].safeParse(input);
  if(!parsed.success) return {ok:false,category:'invalid_input',fields:[...new Set(parsed.error.issues
    .map(issue=>typeof issue.path[0]==='string' && fieldNames[kind].includes(issue.path[0])?issue.path[0]:'form'))]};
  return {ok:true,request:Object.freeze(parsed.data) as Readonly<Request<K>>};
}
export function decodeForm<K extends Kind>(kind:K,form:FormData):Parsed<K> {
  const allowed=new Set(fieldNames[kind]);
  const invalid=new Set<string>();
  for(const key of form.keys()) {
    // React adds only this reserved prefix; it is never interpreted as domain data.
    if(key.startsWith('$ACTION_')) continue;
    if(!allowed.has(key)) invalid.add('form');
  }
  const input:Record<string,unknown>={};
  for(const key of allowed) {
    const values=form.getAll(key);
    if(values.length!==1 || typeof values[0]!=='string') {invalid.add(key);continue;}
    const value=values[0];
    if(ackFields.has(key)) {
      if(value!=='on') invalid.add(key);
      else input[key]=true;
    } else if(versionFields.has(key)) {
      // No whitespace, signs, exponent, decimal, empty coercion or precision loss.
      if(!/^(?:0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(Number(value))) invalid.add(key);
      else input[key]=Number(value);
    } else input[key]=value;
  }
  if(invalid.size) return {ok:false,category:'invalid_input',fields:[...invalid]};
  return parseRequest(kind,input);
}

export function rpcPlan<K extends Kind>(kind:K,request:Readonly<Request<K>>,tenantId:string):RpcPlan<K>;
export function rpcPlan(kind:Kind,request:Readonly<Request<Kind>>,tenantId:string):Readonly<{name:RpcName;args:RpcArgs}> {
  // Even internal direct callers cannot sneak extra actor/session/RPC-body fields.
  const checked=parseRequest(kind,request);
  const tenant=uuid.safeParse(tenantId);
  if(!checked.ok || !tenant.success) throw new Error('INVALID_TYPED_RPC_REQUEST');
  const r=checked.request as CommandRequest & {shiftId?:string;bookingId?:string};
  let args:Record<string,string|number|boolean>={p_tenant_id:tenant.data};
  if('idempotencyKey' in r) args.p_idempotency_key=r.idempotencyKey;
  if('positionId' in r) args={...args,p_shift_id:r.shiftId,p_position_id:r.positionId,
    p_executor_person_id:r.executorPersonId,p_obligation_id:r.obligationId,p_expected_shift_version:r.expectedShiftVersion};
  else if('waitlistOfferId' in r) args={...args,p_offer_id:r.waitlistOfferId,
    p_expected_offer_version:r.expectedOfferVersion,p_expected_shift_version:r.expectedShiftVersion};
  else if('transferRequestId' in r) args={...args,p_transfer_request_id:r.transferRequestId,p_expected_request_version:r.expectedRequestVersion};
  else if(kind==='publish') {
    const p=checked.request as Request<'publish'>;
    args={...args,p_shift_id:p.shiftId,p_expected_shift_version:p.expectedShiftVersion,
      p_expected_contract_version:p.expectedContractVersion,p_instructions_text:p.instructionsText};
  } else if(kind==='acknowledgement') args.p_booking_id=(checked.request as Request<'acknowledgement'>).bookingId;
  else args.p_shift_id=(checked.request as Request<'context'>).shiftId;
  if('bookingOfferId' in r) args={...args,p_booking_offer_id:r.bookingOfferId,
    p_instructions_ack:r.instructionsAck,p_cancellation_ack:r.cancellationAck};
  if('reason' in r) args.p_reason=r.reason;
  return Object.freeze({name:rpcNames[kind],args:Object.freeze(args)});
}

// The retry button derives FormData from the stored attempt, not fresh RSC
// props/current selections or a newly generated key. No normalization of text.
export function frozenRetryForm<K extends CommandKind>(kind:K,attempt:Readonly<Request<K>>):FormData {
  const checked=parseRequest(kind,attempt);
  if(!checked.ok) throw new Error('INVALID_FROZEN_ATTEMPT');
  const form=new FormData();
  for(const [field,value] of Object.entries(checked.request)) form.append(field,value===true?'on':String(value));
  return form;
}

const instructionSchema=z.object({contract_version_id:uuid,revision:positive,
  contract_hash_hex:hash,instructions_text:text(4000,true)}).strict();
const positionSchema=z.object({position_id:uuid,ordinal:positive,available:z.boolean()}).strict();
const contextSchema=z.object({shift_id:uuid,shift_version:positive,title:z.string().min(1),
  committee_name:z.string().nullable(),category_name:z.string().nullable(),location_name:z.string().nullable(),
  starts_at:timestamp,ends_at:timestamp,credit_minutes:nonnegative,cancellation_deadline:timestamp,
  minimum_age:nonnegative.nullable(),qualification_name:z.string().nullable(),contract_ready:z.boolean(),
  instruction:instructionSchema.nullable(),positions:z.array(positionSchema),instructions_ack:z.literal(false),cancellation_ack:z.literal(false),
}).strict().superRefine((value,ctx)=>{
  if(value.contract_ready!==(value.instruction!==null)) ctx.addIssue({code:'custom',message:'CONTRACT_READY_MISMATCH'});
  if(Date.parse(value.ends_at)<=Date.parse(value.starts_at)) ctx.addIssue({code:'custom',message:'TIME_INTERVAL_INVALID'});
  if(new Set(value.positions.map(p=>p.position_id)).size!==value.positions.length) ctx.addIssue({code:'custom',message:'POSITION_DUPLICATE'});
  if(new Set(value.positions.map(p=>p.ordinal)).size!==value.positions.length) ctx.addIssue({code:'custom',message:'ORDINAL_DUPLICATE'});
  if(!value.contract_ready && value.positions.some(p=>p.available)) ctx.addIssue({code:'custom',message:'UNREADY_POSITION_AVAILABLE'});
});
const executorsSchema=z.array(z.object({executor_person_id:uuid,display_name:z.string().min(1),obligation_id:uuid}).strict())
  .refine(rows=>new Set(rows.map(r=>r.executor_person_id+':'+r.obligation_id)).size===rows.length);

// get_booking_acknowledgement_v2 returns the frozen SQL source minus
// type_requirements. Validate that exact allowlist before projecting a small DTO.
const agreementSchema=z.object({shift_version:positive,type_version_id:uuid,title:z.string().min(1),tenant_timezone:z.string().min(1),
  task_type_name:z.string(),committee_id:uuid,committee_name:z.string(),committee_active:z.literal(true),
  category_id:uuid,category_name:z.string(),starts_at:timestamp,ends_at:timestamp,
  location_id:uuid.nullable(),location_name:z.string().nullable(),location_active:z.boolean().nullable(),
  credit_minutes:nonnegative,cancellation_minutes:nonnegative,booking_opens_at:timestamp.nullable(),booking_closes_at:timestamp.nullable(),
  type_credit_minutes:nonnegative,type_category_id:uuid,category_committee_id:uuid,type_active:z.literal(true),
  minimum_age:nonnegative.nullable(),qualification_type_id:uuid.nullable(),qualification_name:z.string().nullable(),
  min_qualified_count:z.literal(0),buddy_allowed:z.literal(false),
}).strict().refine(value=>Date.parse(value.ends_at)>Date.parse(value.starts_at)
  && value.credit_minutes===value.type_credit_minutes && value.category_id===value.type_category_id
  && value.committee_id===value.category_committee_id);
const acknowledgementSchema=z.object({booking_id:uuid,acknowledgement_id:uuid,contract_version_id:uuid,
  revision:positive,contract_hash_hex:hash,instructions_text:text(4000,true),
  actor_capacity:z.enum(['self','delegated_book_shift','phone_assistance']),executor_person_id:uuid,obligation_id:uuid,
  accepted_at:timestamp,instructions_ack:z.literal(true),cancellation_ack:z.literal(true),agreement:agreementSchema,
}).strict();
const prepareResult=z.object({instructions_text:text(4000,true),contract_version_id:uuid,contract_hash_hex:hash,
  offered_at:timestamp,cancellation_deadline:timestamp,instructions_ack:z.literal(false),cancellation_ack:z.literal(false)}).strict();
const commitResult=z.object({state:z.literal('booked'),acknowledgement_id:uuid,booking_offer_id:uuid,contract_version_id:uuid}).strict();
const phoneResult=commitResult.extend({assisted_action_id:uuid}).strict();
const publishResult=z.object({shift_id:uuid,ack_required:z.literal(true)}).strict();
const receipt=<T extends z.ZodTypeAny,V extends z.ZodTypeAny>(result:T,count:number,version:V) => z.array(z.object({
  ok:z.literal(true),resource_id:uuid,version,event_ids:z.array(uuid).length(count).refine(values=>new Set(values).size===values.length),result,
}).strict()).length(1);

export type OfferDTO = {offerId:string;contractVersionId:string;contractHashHex:string;instructionsText:string;
  offeredAt:string;cancellationDeadline:string;instructionsAck:false;cancellationAck:false};
export type CommitDTO = {bookingId:string;bookingVersion:1;acknowledgementId:string;offerId:string;contractVersionId:string;assistedActionId?:string};
export type PublishDTO = {contractVersionId:string;revision:number;shiftId:string;ackRequired:true};
export type ContextDTO = z.infer<typeof contextSchema>;
export type ExecutorsDTO = z.infer<typeof executorsSchema>;
export type AcknowledgementDTO = {bookingId:string;acknowledgementId:string;contractVersionId:string;revision:number;
  contractHashHex:string;instructionsText:string;actorCapacity:'self'|'delegated_book_shift'|'phone_assistance';
  executorPersonId:string;obligationId:string;acceptedAt:string;instructionsAck:true;cancellationAck:true;
  agreement:{title:string;timezone:string;taskTypeName:string;committeeName:string;categoryName:string;locationName:string|null;
    startsAt:string;endsAt:string;creditMinutes:number;cancellationMinutes:number;minimumAge:number|null;qualificationName:string|null}};
export type CommandDTO = OfferDTO|CommitDTO|PublishDTO;
export type ReadDTO = ContextDTO|ExecutorsDTO|AcknowledgementDTO;
export type CommandDTOMap={prepareOnline:OfferDTO;preparePhone:OfferDTO;prepareWaitlist:OfferDTO;prepareTransfer:OfferDTO;
  commitOnline:CommitDTO;commitPhone:CommitDTO & {assistedActionId:string};commitWaitlist:CommitDTO;commitTransfer:CommitDTO;publish:PublishDTO};
export type ReadDTOMap={context:ContextDTO;executors:ExecutorsDTO;acknowledgement:AcknowledgementDTO};
export type ParsedResponse<T> = {ok:true;value:T}|{ok:false;category:'unverified_response'};

export function parseCommandResponse<K extends CommandKind>(kind:K,request:Readonly<Request<K>>,data:unknown):ParsedResponse<CommandDTOMap[K]>;
export function parseCommandResponse(kind:CommandKind,request:Readonly<Request<CommandKind>>,data:unknown):ParsedResponse<CommandDTO> {
  if(kind.startsWith('prepare')) {
    const parsed=receipt(prepareResult,0,z.literal(1)).safeParse(data);
    if(!parsed.success) return {ok:false,category:'unverified_response'};
    const row=parsed.data[0],p=row.result;
    return {ok:true,value:{offerId:row.resource_id,contractVersionId:p.contract_version_id,contractHashHex:p.contract_hash_hex,
      instructionsText:p.instructions_text,offeredAt:p.offered_at,cancellationDeadline:p.cancellation_deadline,instructionsAck:false,cancellationAck:false}};
  }
  if(kind==='publish') {
    const r=request as Request<'publish'>;
    const parsed=receipt(publishResult,1,z.literal(r.expectedContractVersion+1)).safeParse(data);
    if(!parsed.success || parsed.data[0].result.shift_id!==r.shiftId) return {ok:false,category:'unverified_response'};
    const row=parsed.data[0];
    return {ok:true,value:{contractVersionId:row.resource_id,revision:row.version,
      shiftId:row.result.shift_id,ackRequired:true}};
  }
  const count=kind==='commitWaitlist'||kind==='commitTransfer'?2:1;
  const parsed=receipt(kind==='commitPhone'?phoneResult:commitResult,count,z.literal(1)).safeParse(data);
  if(!parsed.success) return {ok:false,category:'unverified_response'};
  const row=parsed.data[0],p=row.result;
  if(p.booking_offer_id!==(request as Request<'commitOnline'>).bookingOfferId) return {ok:false,category:'unverified_response'};
  return {ok:true,value:{bookingId:row.resource_id,bookingVersion:1,acknowledgementId:p.acknowledgement_id,
    offerId:p.booking_offer_id,contractVersionId:p.contract_version_id,
    ...(kind==='commitPhone'?{assistedActionId:(p as z.infer<typeof phoneResult>).assisted_action_id}:{})}};
}
export function parseReadResponse<K extends ReadKind>(kind:K,request:Readonly<Request<K>>,data:unknown):ParsedResponse<ReadDTOMap[K]>;
export function parseReadResponse(kind:ReadKind,request:Readonly<Request<ReadKind>>,data:unknown):ParsedResponse<ReadDTO> {
  if(kind==='context') {
    const parsed=contextSchema.safeParse(data);
    if(!parsed.success || parsed.data.shift_id!==(request as Request<'context'>).shiftId) return {ok:false,category:'unverified_response'};
    return {ok:true,value:parsed.data};
  }
  if(kind==='executors') {
    const parsed=executorsSchema.safeParse(data);
    return parsed.success?{ok:true,value:parsed.data}:{ok:false,category:'unverified_response'};
  }
  const parsed=acknowledgementSchema.safeParse(data);
  if(!parsed.success || parsed.data.booking_id!==(request as Request<'acknowledgement'>).bookingId) return {ok:false,category:'unverified_response'};
  const p=parsed.data,a=p.agreement;
  return {ok:true,value:{bookingId:p.booking_id,acknowledgementId:p.acknowledgement_id,contractVersionId:p.contract_version_id,
    revision:p.revision,contractHashHex:p.contract_hash_hex,instructionsText:p.instructions_text,actorCapacity:p.actor_capacity,
    executorPersonId:p.executor_person_id,obligationId:p.obligation_id,acceptedAt:p.accepted_at,instructionsAck:true,cancellationAck:true,
    agreement:{title:a.title,timezone:a.tenant_timezone,taskTypeName:a.task_type_name,committeeName:a.committee_name,
      categoryName:a.category_name,locationName:a.location_name,startsAt:a.starts_at,endsAt:a.ends_at,creditMinutes:a.credit_minutes,
      cancellationMinutes:a.cancellation_minutes,minimumAge:a.minimum_age,qualificationName:a.qualification_name}}};
}

// This protects a UI composition; it grants no authority and makes no RPC call.
// A successful retry intentionally does not compare the *current* context/head.
export function reviewMatchesOffer(context:ContextDTO,offer:OfferDTO):boolean {
  return context.contract_ready && context.instruction!==null
    && context.instruction.contract_version_id===offer.contractVersionId
    && context.instruction.contract_hash_hex===offer.contractHashHex
    && context.instruction.instructions_text===offer.instructionsText
    && Date.parse(context.cancellation_deadline)===Date.parse(offer.cancellationDeadline);
}
export function commitMatchesReviewedOffer(receipt:CommitDTO,offer:OfferDTO):boolean {
  return receipt.offerId===offer.offerId && receipt.contractVersionId===offer.contractVersionId;
}
