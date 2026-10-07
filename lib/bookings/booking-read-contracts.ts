import {z} from 'zod';

export const SQL18_SHA256='3cf6acfdfd54c210ea88acb89d5be699a6347a13cb6047ca499638908736aeb8';
export const PAYLOAD_LIMITS=Object.freeze({utf8Bytes:8_000_000,nodes:100_000,depth:12});
const uuid=z.string().uuid().transform(v=>v.toLowerCase());
const positive=z.number().int().positive().safe();
const minutes=z.number().int().nonnegative().max(2_147_483_647);
const plainText=z.string().refine(v=>v.isWellFormed()&&!v.includes('\u0000'));
const instructions=plainText.refine(v=>v.replace(/^ +| +$/g,'').length>0
  &&Array.from(v.replace(/^ +| +$/g,'')).length<=4000);
const hash=z.string().regex(/^[0-9a-f]{64}$/);
// PostgreSQL timestamptz carries microseconds. Do not lose those in Date's
// millisecond precision, or confuse equal instants with different UTC offsets.
export function timestampIdentity(value:string):bigint|null {
  const match=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.([0-9]{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if(!match) return null;
  const calendar=Date.parse(match[1]+'Z');
  if(!Number.isSafeInteger(calendar)||new Date(calendar).toISOString().slice(0,19)!==match[1]) return null;
  const milliseconds=Date.parse(match[1]+match[3]);
  return Number.isSafeInteger(milliseconds)?BigInt(milliseconds)*BigInt(1000)+BigInt((match[2]??'').padEnd(6,'0')):null;
}
export function timestampEquivalent(first:string,second:string):boolean {
  const a=timestampIdentity(first),b=timestampIdentity(second);
  return a!==null&&b!==null&&a===b;
}
const timestamp=z.string().datetime({offset:true}).refine(v=>timestampIdentity(v)!==null);
const timezone=plainText.refine(v=>{try {new Intl.DateTimeFormat('en',{timeZone:v});return true;} catch {return false;}});
const club=z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const routeSchema=z.enum(['online','phone','waitlist','transfer']);
export type Route=z.infer<typeof routeSchema>;
const base={club};
export const requestSchemas={
  targets:z.object({...base,shiftId:uuid}).strict(),
  management:z.object({...base,shiftId:uuid}).strict(),
  offerReview:z.object({...base,bookingOfferId:uuid}).strict(),
  onlineOutcome:z.object({...base,commandKey:uuid}).strict(),
  phoneOutcome:z.object({...base,commandKey:uuid}).strict(),
  waitlistOutcome:z.object({...base,commandKey:uuid}).strict(),
  transferOutcome:z.object({...base,commandKey:uuid}).strict(),
  myOffers:z.object({...base,shiftId:uuid,positionId:uuid}).strict(),
  offerOutcome:z.object({...base,bookingOfferId:uuid}).strict(),
  phoneSource:z.object({...base,shiftId:uuid,positionId:uuid}).strict(),
  waitlistSource:z.object({...base,waitlistOfferId:uuid}).strict(),
  transferSource:z.object({...base,transferRequestId:uuid}).strict(),
} as const;
export type ReadKind=keyof typeof requestSchemas;
export type ReadRequest<K extends ReadKind>=z.infer<(typeof requestSchemas)[K]>;
export const rpcNames={
  targets:'list_shift_booking_targets_v2',management:'get_shift_booking_management_v2',
  offerReview:'get_booking_offer_review_v2',onlineOutcome:'get_online_booking_outcome_v2',
  phoneOutcome:'get_phone_booking_outcome_v2',waitlistOutcome:'get_waitlist_booking_outcome_v2',
  transferOutcome:'get_transfer_booking_outcome_v2',myOffers:'list_my_shift_booking_offers_v2',
  offerOutcome:'get_booking_offer_outcome_v2',phoneSource:'get_assisted_shift_booking_source_v2',
  waitlistSource:'get_waitlist_booking_source_v2',transferSource:'get_transfer_booking_source_v2',
} as const;
export type RpcName=(typeof rpcNames)[ReadKind];
export type RpcArgs=Readonly<Record<string,string>>;
export type RpcInputMap={
  targets:{p_tenant_id:string;p_shift_id:string};management:{p_tenant_id:string;p_shift_id:string};
  offerReview:{p_tenant_id:string;p_booking_offer_id:string};
  onlineOutcome:{p_tenant_id:string;p_command_key:string};phoneOutcome:{p_tenant_id:string;p_command_key:string};
  waitlistOutcome:{p_tenant_id:string;p_command_key:string};transferOutcome:{p_tenant_id:string;p_command_key:string};
  myOffers:{p_tenant_id:string;p_shift_id:string;p_position_id:string};
  offerOutcome:{p_tenant_id:string;p_booking_offer_id:string};
  phoneSource:{p_tenant_id:string;p_shift_id:string;p_position_id:string};
  waitlistSource:{p_tenant_id:string;p_waitlist_offer_id:string};
  transferSource:{p_tenant_id:string;p_transfer_request_id:string};
};
export type RpcPlan<K extends ReadKind=ReadKind>=K extends ReadKind?
  Readonly<{name:(typeof rpcNames)[K];args:Readonly<RpcInputMap[K]>}>:never;

// Clone only JSON data descriptors, before schema traversal. This prevents a
// mutable input or accessor from changing a saved request while auth awaits.
// Runtime size caps reject the response, never truncate or imply empty data.
export function dataSnapshot(input:unknown):{ok:true;value:unknown}|{ok:false} {
  let bytes=0,nodes=0;
  const seen=new WeakSet<object>();
  const encoder=new TextEncoder();
  const visit=(value:unknown,depth:number):unknown=>{
    if(++nodes>PAYLOAD_LIMITS.nodes||depth>PAYLOAD_LIMITS.depth) throw new Error('BOUND');
    if(value===null||typeof value==='boolean') {bytes+=5;return value;}
    if(typeof value==='number') {
      if(!Number.isFinite(value)) throw new Error('DATA');bytes+=24;return value;
    }
    if(typeof value==='string') {
      if(value.length>PAYLOAD_LIMITS.utf8Bytes) throw new Error('BOUND');
      bytes+=encoder.encode(value).byteLength+2;
      if(bytes>PAYLOAD_LIMITS.utf8Bytes) throw new Error('BOUND');return value;
    }
    if(typeof value!=='object') throw new Error('DATA');
    const proto=Object.getPrototypeOf(value);
    if(!Array.isArray(value)&&proto!==Object.prototype&&proto!==null) throw new Error('DATA');
    if(seen.has(value)) throw new Error('DATA');seen.add(value);
    const descriptors=Object.getOwnPropertyDescriptors(value);
    const keys=Reflect.ownKeys(descriptors);
    if(keys.some(k=>typeof k!=='string')) throw new Error('DATA');
    for(const key of keys as string[]) {
      const d=descriptors[key];
      if(!('value' in d)||(!d.enumerable&&!(Array.isArray(value)&&key==='length'))) throw new Error('DATA');
      bytes+=encoder.encode(key).byteLength+4;
      if(bytes>PAYLOAD_LIMITS.utf8Bytes) throw new Error('BOUND');
    }
    if(Array.isArray(value)) {
      const length=descriptors.length.value as number;
      if(!Number.isSafeInteger(length)||length<0||length>PAYLOAD_LIMITS.nodes||keys.length!==length+1) throw new Error('DATA');
      const result=[];
      for(let i=0;i<length;i++) {
        if(!Object.hasOwn(descriptors,String(i))) throw new Error('DATA');
        result.push(visit(descriptors[String(i)].value,depth+1));
      }
      seen.delete(value);
      return result;
    }
    const result:Record<string,unknown>=Object.create(null);
    for(const key of keys as string[]) result[key]=visit(descriptors[key].value,depth+1);
    seen.delete(value);
    return result;
  };
  try {const value=visit(input,0);return bytes<=PAYLOAD_LIMITS.utf8Bytes?{ok:true,value}:{ok:false};}
  catch {return {ok:false};}
}
export function freezeData<T>(value:T):Readonly<T> {
  if(value!==null&&typeof value==='object') {
    for(const child of Object.values(value)) freezeData(child);
    Object.freeze(value);
  }
  return value;
}
export type ParsedRequest<K extends ReadKind>={ok:true;request:Readonly<ReadRequest<K>>}|{ok:false};
export function parseRequest<K extends ReadKind>(kind:K,input:unknown):ParsedRequest<K> {
  const snapshot=dataSnapshot(input);if(!snapshot.ok) return {ok:false};
  const parsed=requestSchemas[kind].safeParse(snapshot.value);
  return parsed.success?{ok:true,request:freezeData(parsed.data) as Readonly<ReadRequest<K>>}:{ok:false};
}
export function decodeForm<K extends ReadKind>(kind:K,form:FormData):ParsedRequest<K> {
  const fields=Object.keys(requestSchemas[kind].shape);
  const allowed=new Set(fields);
  const data:Record<string,string>=Object.create(null);
  try {
    for(const key of form.keys()) if(!key.startsWith('$ACTION_')&&!allowed.has(key)) return {ok:false};
    for(const key of fields) {
      const values=form.getAll(key);
      if(values.length!==1||typeof values[0]!=='string') return {ok:false};
      data[key]=values[0];
    }
    return parseRequest(kind,data);
  } catch {return {ok:false};}
}
export function rpcPlan<K extends ReadKind>(kind:K,request:Readonly<ReadRequest<K>>,tenantId:string):RpcPlan<K>;
export function rpcPlan(kind:ReadKind,request:Readonly<ReadRequest<ReadKind>>,tenantId:string):Readonly<{name:RpcName;args:RpcArgs}> {
  const checked=parseRequest(kind,request),tenant=uuid.safeParse(tenantId);
  if(!checked.ok||!tenant.success) throw new Error('INVALID_TYPED_READ');
  const r=checked.request;
  const args:Record<string,string>={p_tenant_id:tenant.data};
  if('shiftId' in r) args.p_shift_id=r.shiftId;
  if('positionId' in r) args.p_position_id=r.positionId;
  if('bookingOfferId' in r) args.p_booking_offer_id=r.bookingOfferId;
  if('commandKey' in r) args.p_command_key=r.commandKey;
  if('waitlistOfferId' in r) args.p_waitlist_offer_id=r.waitlistOfferId;
  if('transferRequestId' in r) args.p_transfer_request_id=r.transferRequestId;
  return freezeData({name:rpcNames[kind],args});
}

const contextRaw=z.object({household_label:plainText,season_name:plainText}).strict();
const contextsRaw=z.array(contextRaw).refine(rows=>new Set(rows.map(v=>JSON.stringify([v.household_label,v.season_name]))).size===rows.length);
const targetRaw=z.object({executor_person_id:uuid,display_name:plainText,obligation_id:uuid,
  readable_contexts:contextsRaw,context_complete:z.boolean()}).strict()
  .refine(v=>!v.context_complete||v.readable_contexts.length>0);
const targetsRaw=z.array(targetRaw).refine(rows=>{
  const tuples=new Set<string>();
  const labels=new Map<string,number>();
  const labelKey=(row:z.infer<typeof targetRaw>)=>row.executor_person_id+':'+
    JSON.stringify(row.readable_contexts.map(c=>JSON.stringify([c.household_label,c.season_name])).sort());
  for(const row of rows) {
    const key=row.executor_person_id+':'+row.obligation_id;
    if(tuples.has(key)) return false;tuples.add(key);
    const label=labelKey(row);labels.set(label,(labels.get(label)??0)+1);
  }
  return rows.every(row=>!row.context_complete||labels.get(labelKey(row))===1);
});
const projectContexts=(rows:z.infer<typeof contextsRaw>)=>rows.map(r=>({householdLabel:r.household_label,seasonName:r.season_name}));
const projectTarget=(r:z.infer<typeof targetRaw>)=>({executorPersonId:r.executor_person_id,displayName:r.display_name,
  obligationId:r.obligation_id,readableContexts:projectContexts(r.readable_contexts),contextComplete:r.context_complete});
const targets=targetsRaw.transform(rows=>rows.map(projectTarget));
const headRaw=z.object({contract_version_id:uuid,revision:positive,head_version:positive,contract_hash_hex:hash,
  instructions_text:instructions,source_matches_current:z.boolean()}).strict().refine(v=>v.revision===v.head_version);
const management=z.object({shift_id:uuid,shift_version:positive,title:plainText,committee_name:plainText.nullable(),
  tenant_timezone:timezone,can_publish:z.boolean(),inline_supported:z.boolean(),contract_head:headRaw.nullable()}).strict()
  .refine(v=>!v.can_publish||v.inline_supported)
  .transform(r=>({shiftId:r.shift_id,shiftVersion:r.shift_version,title:r.title,committeeName:r.committee_name,
    tenantTimezone:r.tenant_timezone,canPublish:r.can_publish,inlineSupported:r.inline_supported,
    contractHead:r.contract_head===null?null:{contractVersionId:r.contract_head.contract_version_id,
      revision:r.contract_head.revision,headVersion:r.contract_head.head_version,contractHashHex:r.contract_head.contract_hash_hex,
      instructionsText:r.contract_head.instructions_text,sourceMatchesCurrent:r.contract_head.source_matches_current}}));
const tupleRaw=z.object({shift_id:uuid,position_id:uuid,executor_person_id:uuid,obligation_id:uuid}).strict();
const agreementRaw=z.object({title:plainText,tenant_timezone:timezone,task_type_name:plainText,committee_name:plainText,
  category_name:plainText,location_name:plainText.nullable(),starts_at:timestamp,ends_at:timestamp,
  credit_minutes:minutes,cancellation_minutes:minutes,minimum_age:minutes.nullable(),qualification_name:plainText.nullable()}).strict()
  .refine(v=>{const start=timestampIdentity(v.starts_at),end=timestampIdentity(v.ends_at);
    return start!==null&&end!==null&&end>start;});
const review=z.object({booking_offer_id:uuid,route:routeSchema,contract_version_id:uuid,revision:positive,
  contract_hash_hex:hash,instructions_text:instructions,offered_at:timestamp,cancellation_deadline:timestamp,
  instructions_ack:z.literal(false),cancellation_ack:z.literal(false),target:tupleRaw,agreement:agreementRaw}).strict()
  .refine(r=>{const start=timestampIdentity(r.agreement.starts_at),deadline=timestampIdentity(r.cancellation_deadline);
    return start!==null&&deadline!==null&&Number.isSafeInteger(r.agreement.cancellation_minutes)
      &&r.agreement.cancellation_minutes>=0&&deadline===start-BigInt(r.agreement.cancellation_minutes)*BigInt(60_000_000);})
  .transform(r=>({offerId:r.booking_offer_id,route:r.route,contractVersionId:r.contract_version_id,revision:r.revision,
    contractHashHex:r.contract_hash_hex,instructionsText:r.instructions_text,offeredAt:r.offered_at,
    cancellationDeadline:r.cancellation_deadline,instructionsAck:r.instructions_ack,cancellationAck:r.cancellation_ack,
    target:{shiftId:r.target.shift_id,positionId:r.target.position_id,executorPersonId:r.target.executor_person_id,obligationId:r.target.obligation_id},
    agreement:{title:r.agreement.title,tenantTimezone:r.agreement.tenant_timezone,taskTypeName:r.agreement.task_type_name,
      committeeName:r.agreement.committee_name,categoryName:r.agreement.category_name,locationName:r.agreement.location_name,
      startsAt:r.agreement.starts_at,endsAt:r.agreement.ends_at,creditMinutes:r.agreement.credit_minutes,
      cancellationMinutes:r.agreement.cancellation_minutes,minimumAge:r.agreement.minimum_age,qualificationName:r.agreement.qualification_name}}));
const receiptFields={booking_id:uuid,booking_version:z.literal(1),acknowledgement_id:uuid,booking_offer_id:uuid,contract_version_id:uuid};
const receiptRaw=z.object(receiptFields).strict();
const phoneReceiptRaw=z.object({...receiptFields,assisted_action_id:uuid}).strict();
const bookingNowRaw=z.object({state:z.enum(['booked','reconfirmation_required','transfer_pending','performed_pending','confirmed','cancelled','transferred','no_show']),version:positive}).strict();
const undeterminedRaw=z.object({status:z.literal('undetermined')}).strict();
const makeOutcome=(receipt:typeof receiptRaw|typeof phoneReceiptRaw|z.ZodUnion<[typeof receiptRaw,typeof phoneReceiptRaw]>)=>z.union([
  undeterminedRaw,z.object({status:z.literal('observed_completed'),receipt,booking_now:bookingNowRaw}).strict(),
]).transform(r=>r.status==='undetermined'?{status:r.status}:{status:r.status,receipt:{bookingId:r.receipt.booking_id,
  bookingVersion:r.receipt.booking_version,acknowledgementId:r.receipt.acknowledgement_id,offerId:r.receipt.booking_offer_id,
  contractVersionId:r.receipt.contract_version_id,...('assisted_action_id' in r.receipt?{assistedActionId:r.receipt.assisted_action_id}:{})},
  bookingNow:{state:r.booking_now.state,version:r.booking_now.version}});
const outcome=makeOutcome(receiptRaw),phoneOutcome=makeOutcome(phoneReceiptRaw),offerOutcome=makeOutcome(z.union([receiptRaw,phoneReceiptRaw]));
const offers=z.array(z.object({booking_offer_id:uuid,route:routeSchema,offered_at:timestamp,title:plainText}).strict()).max(10)
  .refine(rows=>new Set(rows.map(r=>r.booking_offer_id)).size===rows.length)
  .transform(rows=>rows.map(r=>({offerId:r.booking_offer_id,route:r.route,offeredAt:r.offered_at,title:r.title})));
const phoneSource=z.object({route:z.literal('phone'),shift_id:uuid,position_id:uuid,shift_version:positive,
  tenant_timezone:timezone,source_open:z.boolean(),targets:targetsRaw}).strict().transform(r=>({route:r.route,
  shiftId:r.shift_id,positionId:r.position_id,shiftVersion:r.shift_version,tenantTimezone:r.tenant_timezone,
  sourceOpen:r.source_open,targets:r.targets.map(projectTarget)}));
const sourceTuple={shift_id:uuid,shift_version:positive,position_id:uuid,executor_person_id:uuid,obligation_id:uuid,
  expires_at:timestamp,source_open:z.boolean(),tenant_timezone:timezone,readable_contexts:contextsRaw};
const waitlistSource=z.object({route:z.literal('waitlist'),waitlist_offer_id:uuid,offer_version:positive,
  ...sourceTuple,offer_state:z.enum(['active','accepted','declined','expired','cancelled'])}).strict()
  .refine(r=>!r.source_open||r.offer_state==='active').transform(r=>({route:r.route,waitlistOfferId:r.waitlist_offer_id,
    offerVersion:r.offer_version,shiftId:r.shift_id,shiftVersion:r.shift_version,positionId:r.position_id,
    executorPersonId:r.executor_person_id,obligationId:r.obligation_id,offerState:r.offer_state,expiresAt:r.expires_at,
    sourceOpen:r.source_open,tenantTimezone:r.tenant_timezone,readableContexts:projectContexts(r.readable_contexts)}));
const transferSource=z.object({route:z.literal('transfer'),transfer_request_id:uuid,request_version:positive,
  ...sourceTuple,mode:z.enum(['takeover','mutual_swap']),request_state:z.enum(['open','accepted','withdrawn','expired','rejected'])}).strict()
  .refine(r=>!r.source_open||(r.mode==='takeover'&&r.request_state==='open')).transform(r=>({route:r.route,
    transferRequestId:r.transfer_request_id,requestVersion:r.request_version,mode:r.mode,shiftId:r.shift_id,shiftVersion:r.shift_version,
    positionId:r.position_id,executorPersonId:r.executor_person_id,obligationId:r.obligation_id,requestState:r.request_state,
    expiresAt:r.expires_at,sourceOpen:r.source_open,tenantTimezone:r.tenant_timezone,readableContexts:projectContexts(r.readable_contexts)}));
export const responseSchemas={targets,management,offerReview:review,onlineOutcome:outcome,phoneOutcome,
  waitlistOutcome:outcome,transferOutcome:outcome,myOffers:offers,offerOutcome,phoneSource,waitlistSource,transferSource} as const;
export type ReadDTOMap={[K in ReadKind]:z.infer<(typeof responseSchemas)[K]>};
export type TargetDTO=ReadDTOMap['targets'][number];
export type OutcomeDTO=ReadDTOMap['offerOutcome'];
export type OfferReviewDTO=ReadDTOMap['offerReview'];
export type ParsedResponse<K extends ReadKind>={ok:true;value:Readonly<ReadDTOMap[K]>}|{ok:false};
export function parseResponse<K extends ReadKind>(kind:K,request:Readonly<ReadRequest<K>>,input:unknown):ParsedResponse<K> {
  const req=parseRequest(kind,request),snapshot=dataSnapshot(input);
  if(!req.ok||!snapshot.ok) return {ok:false};
  const parsed=responseSchemas[kind].safeParse(snapshot.value);
  if(!parsed.success) return {ok:false};
  const v=parsed.data,r=req.request;
  if('shiftId' in v&&'shiftId' in r&&v.shiftId!==r.shiftId) return {ok:false};
  if('positionId' in v&&'positionId' in r&&v.positionId!==r.positionId) return {ok:false};
  if('offerId' in v&&'bookingOfferId' in r&&v.offerId!==r.bookingOfferId) return {ok:false};
  if('waitlistOfferId' in v&&'waitlistOfferId' in r&&v.waitlistOfferId!==r.waitlistOfferId) return {ok:false};
  if('transferRequestId' in v&&'transferRequestId' in r&&v.transferRequestId!==r.transferRequestId) return {ok:false};
  if('status' in v&&v.status==='observed_completed'&&'bookingOfferId' in r&&v.receipt.offerId!==r.bookingOfferId) return {ok:false};
  return {ok:true,value:freezeData(parsed.data) as Readonly<ReadDTOMap[K]>};
}
