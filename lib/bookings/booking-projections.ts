import {z} from 'zod';
import {executeReadRequest,type Dependencies as ReadDependencies,type ReadState} from './booking-read-core';
import {dataSnapshot,freezeData,timestampEquivalent,
  type Route,type TargetDTO,type ReadDTOMap,type OfferReviewDTO,type OutcomeDTO} from './booking-read-contracts';
import {executeRead as executeLegacyRead,type Dependencies as LegacyDependencies} from './booking-server-core';
import {parseRequest as parseLegacyRequest,type Request as LegacyRequest,type CommandKind,
  type ReadDTOMap as LegacyReadDTOMap,type OfferDTO} from './booking-contracts';

// Dependencies stay entirely server-side. This broader transport is compatible
// with the real SSR client and both fixed SQL17/18 read namespaces.
export type ProjectionDependencies=Omit<ReadDependencies,'requireWorkspace'>&{
  requireWorkspace(club:string):Promise<{workspace:unknown;client:{schema(name:'api'):{rpc(name:string,args:Readonly<Record<string,string|number|boolean>>):PromiseLike<{data:unknown;error:unknown}>}}}>;
};
type Context=LegacyReadDTOMap['context'];
type Choice={executorPersonId:string;obligationId:string;displayName:string;contexts:TargetDTO['readableContexts']};
export type InitialProjection=
  |{status:'unavailable';message:string}
  |{status:'contract_not_ready';route:Route;context:Context;message:string}
  |{status:'closed';route:Route;context:Context;source:ReadDTOMap['phoneSource'|'waitlistSource'|'transferSource']|null;message:string}
  |{status:'needs_label_context';route:Route;context:Context;message:string}
  |{status:'no_current_target';route:Route;context:Context;message:string}
  |{status:'ready';route:'online'|'phone';context:Context;positionId:string;choices:Choice[];initialSelection:null;
     labelCoverage:'complete'|'incomplete';tenantTimezone:string|null;expectedShiftVersion:number}
  |{status:'ready';route:'waitlist';context:Context;source:ReadDTOMap['waitlistSource'];choice:Choice;
     prepareBasis:{waitlistOfferId:string;expectedOfferVersion:number;expectedShiftVersion:number}}
  |{status:'ready';route:'transfer';context:Context;source:ReadDTOMap['transferSource'];choice:Choice;
     prepareBasis:{transferRequestId:string;expectedRequestVersion:number}};
const unavailable=():InitialProjection=>({status:'unavailable',message:'De gevraagde boekingsgegevens zijn niet beschikbaar.'});
const needsLabel=(route:Route,context:Context):InitialProjection=>({status:'needs_label_context',route,context,
  message:'De uitvoerder en de bijbehorende verplichting kunnen hier niet duidelijk worden getoond.'});
const common={club:z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)};
const initialSchemas={
  online:z.object({...common,shiftId:z.string().uuid(),positionId:z.string().uuid()}).strict(),
  phone:z.object({...common,shiftId:z.string().uuid(),positionId:z.string().uuid()}).strict(),
  waitlist:z.object({...common,waitlistOfferId:z.string().uuid()}).strict(),
  transfer:z.object({...common,transferRequestId:z.string().uuid()}).strict(),
} as const;
function safeInitial<K extends Route>(route:K,input:unknown) {
  const snapshot=dataSnapshot(input);if(!snapshot.ok) return null;
  const checked=initialSchemas[route].safeParse(snapshot.value);
  if(!checked.success) return null;
  // UUID case never changes a scope or actual tuple.
  return freezeData(Object.fromEntries(Object.entries(checked.data).map(([k,v])=>[k,k==='club'?v:v.toLowerCase()]))) as
    Readonly<z.infer<(typeof initialSchemas)[K]>>;
}
async function contextRead(club:string,shiftId:string,deps:ProjectionDependencies):Promise<Context|null> {
  const form=new FormData();form.set('club',club);form.set('shiftId',shiftId);
  const oldDeps:LegacyDependencies={...deps,revalidatePath:()=>{}};
  const value=await executeLegacyRead('context',form,oldDeps);
  return value.status==='loaded'?value.data:null;
}
function choices(rows:readonly TargetDTO[]):Choice[] {
  return rows.filter(row=>row.contextComplete&&row.displayName.trim().length>0
    &&row.readableContexts.length>0&&row.readableContexts.every(c=>c.householdLabel.trim().length>0&&c.seasonName.trim().length>0))
    .map(row=>({executorPersonId:row.executorPersonId,obligationId:row.obligationId,displayName:row.displayName,contexts:row.readableContexts}));
}
function notReady(route:Route,context:Context):InitialProjection {
  // SQL17's public context cannot distinguish no head from a stale/unsupported
  // activated head. It never grants a legacy write bypass or first-head version0.
  return {status:'contract_not_ready',route,context,message:'De instructies en afmeldafspraak zijn nog niet gereed voor een nieuwe inschrijving. Je eerdere verzoek kun je nog apart controleren.'};
}
function noTarget(route:Route,context:Context):InitialProjection {
  return {status:'no_current_target',route,context,message:'Er is momenteel geen uitvoerder en verplichting om voor deze taak te kiezen.'};
}
function closed(route:Route,context:Context,source:ReadDTOMap['phoneSource'|'waitlistSource'|'transferSource']|null):InitialProjection {
  return {status:'closed',route,context,source,message:'Dit aanbod is niet beschikbaar voor een nieuwe inschrijving. Je eerdere verzoek kun je nog apart controleren.'};
}
function positionPresent(context:Context,positionId:string) {return context.positions.find(p=>p.position_id===positionId);}

export async function composeOnlineInitial(input:unknown,deps:ProjectionDependencies):Promise<InitialProjection> {
  const req=safeInitial('online',input);if(!req) return unavailable();
  const context=await contextRead(req.club,req.shiftId,deps);
  if(!context||!positionPresent(context,req.positionId)) return unavailable();
  if(!context.contract_ready) return freezeData(notReady('online',context));
  if(!positionPresent(context,req.positionId)?.available) return freezeData(closed('online',context,null));
  const targets=await executeReadRequest('targets',{club:req.club,shiftId:req.shiftId},deps);
  if(targets.status!=='loaded') return unavailable();
  if(!targets.data.length) return freezeData(noTarget('online',context));
  const selection=choices(targets.data);
  if(!selection.length) return freezeData(needsLabel('online',context));
  // Online initial SQL17 context has no timezone. Retain the existing server
  // tenant timezone on the market card; frozen review supplies its real timezone.
  return freezeData({status:'ready',route:'online' as const,context,positionId:req.positionId,choices:selection,initialSelection:null,
    labelCoverage:selection.length===targets.data.length?'complete' as const:'incomplete' as const,tenantTimezone:null,expectedShiftVersion:context.shift_version});
}
export async function composePhoneInitial(input:unknown,deps:ProjectionDependencies):Promise<InitialProjection> {
  const req=safeInitial('phone',input);if(!req) return unavailable();
  const source=await executeReadRequest('phoneSource',req,deps);
  if(source.status!=='loaded') return unavailable();
  const context=await contextRead(req.club,source.data.shiftId,deps);
  if(!context||context.shift_version!==source.data.shiftVersion||!positionPresent(context,source.data.positionId)) return unavailable();
  if(!context.contract_ready) return freezeData(notReady('phone',context));
  if(!source.data.sourceOpen) return freezeData(closed('phone',context,source.data));
  if(!source.data.targets.length) return freezeData(noTarget('phone',context));
  const selection=choices(source.data.targets);
  if(!selection.length) return freezeData(needsLabel('phone',context));
  return freezeData({status:'ready',route:'phone' as const,context,positionId:source.data.positionId,choices:selection,initialSelection:null,
    labelCoverage:selection.length===source.data.targets.length?'complete' as const:'incomplete' as const,tenantTimezone:source.data.tenantTimezone,
    expectedShiftVersion:source.data.shiftVersion});
}
async function sourceChoice(club:string,source:ReadDTOMap['waitlistSource'|'transferSource'],deps:ProjectionDependencies):Promise<Choice|null> {
  const current=await executeReadRequest('targets',{club,shiftId:source.shiftId},deps);
  if(current.status!=='loaded') return null;
  const matches=choices(current.data).filter(row=>row.executorPersonId===source.executorPersonId&&row.obligationId===source.obligationId);
  if(matches.length!==1) return null;
  // The independent current reads can race a grant/context change. Do not label
  // a source using a different household projection from another snapshot.
  const signature=(contexts:Choice['contexts'])=>JSON.stringify(contexts.map(c=>JSON.stringify([c.householdLabel,c.seasonName])).sort());
  return signature(matches[0].contexts)===signature(source.readableContexts)?matches[0]:null;
}
export async function composeWaitlistInitial(input:unknown,deps:ProjectionDependencies):Promise<InitialProjection> {
  const req=safeInitial('waitlist',input);if(!req) return unavailable();
  const source=await executeReadRequest('waitlistSource',req,deps);if(source.status!=='loaded') return unavailable();
  const context=await contextRead(req.club,source.data.shiftId,deps);
  if(!context||context.shift_version!==source.data.shiftVersion||!positionPresent(context,source.data.positionId)) return unavailable();
  if(!source.data.sourceOpen) return freezeData(closed('waitlist',context,source.data));
  if(!context.contract_ready) return freezeData(notReady('waitlist',context));
  const choice=await sourceChoice(req.club,source.data,deps);
  if(!choice) return freezeData(needsLabel('waitlist',context));
  return freezeData({status:'ready',route:'waitlist' as const,context,source:source.data,choice,prepareBasis:{
    waitlistOfferId:source.data.waitlistOfferId,expectedOfferVersion:source.data.offerVersion,expectedShiftVersion:source.data.shiftVersion}});
}
export async function composeTransferInitial(input:unknown,deps:ProjectionDependencies):Promise<InitialProjection> {
  const req=safeInitial('transfer',input);if(!req) return unavailable();
  const source=await executeReadRequest('transferSource',req,deps);if(source.status!=='loaded') return unavailable();
  const context=await contextRead(req.club,source.data.shiftId,deps);
  if(!context||context.shift_version!==source.data.shiftVersion||!positionPresent(context,source.data.positionId)) return unavailable();
  if(!source.data.sourceOpen||source.data.mode!=='takeover') return freezeData(closed('transfer',context,source.data));
  if(!context.contract_ready) return freezeData(notReady('transfer',context));
  const choice=await sourceChoice(req.club,source.data,deps);
  if(!choice) return freezeData(needsLabel('transfer',context));
  return freezeData({status:'ready',route:'transfer' as const,context,source:source.data,choice,prepareBasis:{
    transferRequestId:source.data.transferRequestId,expectedRequestVersion:source.data.requestVersion}});
}

export async function loadFrozenReview(input:unknown,deps:ReadDependencies):Promise<ReadState<'offerReview'>> {
  return executeReadRequest('offerReview',input,deps);
}
export async function loadManagement(input:unknown,deps:ReadDependencies):Promise<ReadState<'management'>> {
  return executeReadRequest('management',input,deps);
}
export function publicationVersions(value:ReadDTOMap['management']):Readonly<{expectedShiftVersion:number;expectedContractVersion:number}> {
  return Object.freeze({expectedShiftVersion:value.shiftVersion,expectedContractVersion:value.contractHead?.revision??0});
}
const outcomeKind={online:'onlineOutcome',phone:'phoneOutcome',waitlist:'waitlistOutcome',transfer:'transferOutcome'} as const;
export async function loadOutcome(route:Route,input:unknown,deps:ReadDependencies):Promise<ReadState<'onlineOutcome'|'phoneOutcome'|'waitlistOutcome'|'transferOutcome'>> {
  return executeReadRequest(outcomeKind[route],input,deps);
}
export async function listMyOffers(input:unknown,deps:ReadDependencies):Promise<ReadState<'myOffers'>> {
  return executeReadRequest('myOffers',input,deps);
}
export async function loadOfferOutcome(input:unknown,deps:ReadDependencies):Promise<ReadState<'offerOutcome'>> {
  return executeReadRequest('offerOutcome',input,deps);
}

const prepareKind={online:'prepareOnline',phone:'preparePhone',waitlist:'prepareWaitlist',transfer:'prepareTransfer'} as const;
const commitKind={online:'commitOnline',phone:'commitPhone',waitlist:'commitWaitlist',transfer:'commitTransfer'} as const;
export function bindFrozenReview(route:Route,prepareInput:unknown,prepared:OfferDTO,review:OfferReviewDTO):boolean {
  const snapshot=dataSnapshot(prepareInput);if(!snapshot.ok) return false;
  const request=parseLegacyRequest(prepareKind[route],snapshot.value);
  if(!request.ok||review.route!==route||review.offerId!==prepared.offerId||review.contractVersionId!==prepared.contractVersionId
    ||review.contractHashHex!==prepared.contractHashHex||review.instructionsText!==prepared.instructionsText
    ||!timestampEquivalent(review.offeredAt,prepared.offeredAt)
    ||!timestampEquivalent(review.cancellationDeadline,prepared.cancellationDeadline)) return false;
  const tuple=request.request;
  if('shiftId' in tuple) return tuple.shiftId===review.target.shiftId&&tuple.positionId===review.target.positionId
    &&tuple.executorPersonId===review.target.executorPersonId&&tuple.obligationId===review.target.obligationId;
  // Waitlist/transfer prepare carries source IDs/versions, not a mutable target.
  // Ownership/route/offer binding is supplied by SQL18; no fresh source read.
  return true;
}
export type AttemptRecovery=
  |{status:'observed_completed';outcome:Extract<OutcomeDTO,{status:'observed_completed'}>}
  |{status:'undetermined';keepOriginalAttempt:true;mayCreateNewKey:false}
  |{status:'unavailable';keepOriginalAttempt:true;mayCreateNewKey:false};
export async function recoverSavedCommit(route:Route,input:unknown,deps:ReadDependencies):Promise<AttemptRecovery> {
  const snapshot=dataSnapshot(input);
  if(!snapshot.ok) return {status:'unavailable',keepOriginalAttempt:true,mayCreateNewKey:false};
  const saved=parseLegacyRequest(commitKind[route],snapshot.value);
  if(!saved.ok) return {status:'unavailable',keepOriginalAttempt:true,mayCreateNewKey:false};
  const result=await loadOutcome(route,{club:saved.request.club,commandKey:saved.request.idempotencyKey},deps);
  if(result.status!=='loaded') return {status:'unavailable',keepOriginalAttempt:true,mayCreateNewKey:false};
  if(result.data.status==='undetermined') return {status:'undetermined',keepOriginalAttempt:true,mayCreateNewKey:false};
  if(result.data.receipt.offerId!==saved.request.bookingOfferId) return {status:'unavailable',keepOriginalAttempt:true,mayCreateNewKey:false};
  return freezeData({status:'observed_completed',outcome:result.data});
}

// Explicit integration types: no old mutable Context is required to render an
// owned frozen agreement. Stable review-owner/action attempt state stays above
// RSC refresh/filtering. Neither this DTO nor client state is action authority.
export type FrozenOfferPanelProps={review:Readonly<OfferReviewDTO>;initialInstructionsAck:false;initialCancellationAck:false};
export function frozenPanelProps(review:OfferReviewDTO):Readonly<FrozenOfferPanelProps> {
  return freezeData({review,initialInstructionsAck:false,initialCancellationAck:false});
}
export type SavedCommitForRoute<R extends Route>=LegacyRequest<(typeof commitKind)[R]>;
export type SavedPrepareForRoute<R extends Route>=LegacyRequest<(typeof prepareKind)[R]>;
export type ExistingWriteKind=CommandKind;
// Deliberately no commit call, fresh-key generator, durable journal or absence
// inference here; future UI sends the original request via the old writeadapter.
