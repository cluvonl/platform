import test from 'node:test';
import assert from 'node:assert/strict';
import {redirect,unstable_rethrow} from 'next/navigation.js';
import {loadBookingModules} from './helpers/booking-modules.mjs';
const modules=await loadBookingModules();
const {decodeForm,parseRequest,rpcPlan,parseCommandResponse,parseReadResponse,reviewMatchesOffer,commitMatchesReviewedOffer,frozenRetryForm}=modules['booking-contracts'];
const {executeCommand,executeRead}=modules['booking-server-core'];

// Synthetic protocol values only. No app/database/client/network access.
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const u={tenant:id(1),person:id(2),shift:id(3),position:id(4),executor:id(5),obligation:id(6),
  key:id(7),offer:id(8),contract:id(9),booking:id(10),ack:id(11),action:id(12),event:id(13),
  routeEvent:id(14),waitlist:id(15),transfer:id(16),committee:id(17),category:id(18),typeVersion:id(19)};
const hash='a'.repeat(64),club='synthetic-club';
const tuple={club,shiftId:u.shift,positionId:u.position,executorPersonId:u.executor,obligationId:u.obligation,expectedShiftVersion:2,idempotencyKey:u.key};
const consent={bookingOfferId:u.offer,instructionsAck:true,cancellationAck:true};
const requests={
  prepareOnline:tuple,preparePhone:tuple,
  prepareWaitlist:{club,waitlistOfferId:u.waitlist,expectedOfferVersion:3,expectedShiftVersion:2,idempotencyKey:u.key},
  prepareTransfer:{club,transferRequestId:u.transfer,expectedRequestVersion:4,idempotencyKey:u.key},
  commitOnline:{...tuple,...consent},commitPhone:{...tuple,...consent,reason:'  Praktische registratie  '},
  commitWaitlist:{club,waitlistOfferId:u.waitlist,expectedOfferVersion:3,expectedShiftVersion:2,idempotencyKey:u.key,...consent},
  commitTransfer:{club,transferRequestId:u.transfer,expectedRequestVersion:4,idempotencyKey:u.key,...consent},
  publish:{club,shiftId:u.shift,expectedShiftVersion:2,expectedContractVersion:0,instructionsText:'  Lees deze taak.  ',idempotencyKey:u.key},
  context:{club,shiftId:u.shift},executors:{club,shiftId:u.shift},acknowledgement:{club,bookingId:u.booking},
};
const prepareResult={instructions_text:'Lees deze taak.',contract_version_id:u.contract,contract_hash_hex:hash,
  offered_at:'2026-10-07T10:00:00+00:00',cancellation_deadline:'2027-03-01T10:00:00+00:00',instructions_ack:false,cancellation_ack:false};
const context={shift_id:u.shift,shift_version:2,title:'Taak',committee_name:'Commissie',category_name:'Categorie',location_name:null,
  starts_at:'2027-03-03T10:00:00+00:00',ends_at:'2027-03-03T11:00:00+00:00',credit_minutes:60,
  cancellation_deadline:prepareResult.cancellation_deadline,minimum_age:null,qualification_name:null,contract_ready:true,
  instruction:{contract_version_id:u.contract,revision:1,contract_hash_hex:hash,instructions_text:prepareResult.instructions_text},
  positions:[{position_id:u.position,ordinal:1,available:true}],instructions_ack:false,cancellation_ack:false};
const agreement={shift_version:2,type_version_id:u.typeVersion,title:'Taak',tenant_timezone:'Europe/Amsterdam',task_type_name:'Taaktype',
  committee_id:u.committee,committee_name:'Commissie',committee_active:true,category_id:u.category,category_name:'Categorie',
  starts_at:context.starts_at,ends_at:context.ends_at,location_id:null,location_name:null,location_active:null,
  credit_minutes:60,cancellation_minutes:2880,booking_opens_at:null,booking_closes_at:null,type_credit_minutes:60,
  type_category_id:u.category,category_committee_id:u.committee,type_active:true,minimum_age:null,
  qualification_type_id:null,qualification_name:null,min_qualified_count:0,buddy_allowed:false};
const acknowledgement={booking_id:u.booking,acknowledgement_id:u.ack,contract_version_id:u.contract,revision:1,
  contract_hash_hex:hash,instructions_text:prepareResult.instructions_text,actor_capacity:'self',executor_person_id:u.executor,
  obligation_id:u.obligation,accepted_at:'2026-10-07T10:00:01+00:00',instructions_ack:true,cancellation_ack:true,agreement};
function response(kind) {
  if(kind==='context') return structuredClone(context);
  if(kind==='executors') return [{executor_person_id:u.executor,display_name:'Synthetische persoon',obligation_id:u.obligation}];
  if(kind==='acknowledgement') return structuredClone(acknowledgement);
  if(kind.startsWith('prepare')) return [{ok:true,resource_id:u.offer,version:1,event_ids:[],result:{...prepareResult}}];
  if(kind==='publish') return [{ok:true,resource_id:u.contract,version:1,event_ids:[u.event],result:{shift_id:u.shift,ack_required:true}}];
  return [{ok:true,resource_id:u.booking,version:1,event_ids:kind==='commitWaitlist'||kind==='commitTransfer'?[u.event,u.routeEvent]:[u.event],
    result:{state:'booked',acknowledgement_id:u.ack,booking_offer_id:u.offer,contract_version_id:u.contract,
      ...(kind==='commitPhone'?{assisted_action_id:u.action}:{})}}];
}
function form(request) {const f=new FormData();for(const [key,value] of Object.entries(request)) f.append(key,value===true?'on':String(value));return f;}
function fake(kind,handler=async()=>({data:response(kind),error:null})) {
  const calls=[],gateCalls=[],paths=[];
  const client={schema(name){assert.equal(name,'api');return {async rpc(name,args){calls.push({name,args:structuredClone(args)});return handler(name,args);}};}};
  return {calls,gateCalls,paths,deps:{async requireWorkspace(slug){gateCalls.push(slug);return {client,
    workspace:{tenant_id:u.tenant,tenant_slug:club,person_id:u.person,roles:[{role_key:'UNTRUSTED_UI_ROLE'}],display_name:'unused'}};},
    rethrow:unstable_rethrow,redirectToLogin:()=>redirect('/login'),revalidatePath(path){paths.push(path);}}};
}
const tupleArgs={p_tenant_id:u.tenant,p_idempotency_key:u.key,p_shift_id:u.shift,p_position_id:u.position,
  p_executor_person_id:u.executor,p_obligation_id:u.obligation,p_expected_shift_version:2};
const waitArgs={p_tenant_id:u.tenant,p_idempotency_key:u.key,p_offer_id:u.waitlist,p_expected_offer_version:3,p_expected_shift_version:2};
const transferArgs={p_tenant_id:u.tenant,p_idempotency_key:u.key,p_transfer_request_id:u.transfer,p_expected_request_version:4};
const consentArgs={p_booking_offer_id:u.offer,p_instructions_ack:true,p_cancellation_ack:true};
// Literal external protocol expectations; not generated from the implementation.
const expected={
  prepareOnline:['prepare_shift_booking_offer_v2',tupleArgs],preparePhone:['prepare_assisted_booking_offer_v2',tupleArgs],
  prepareWaitlist:['prepare_waitlist_booking_offer_v2',waitArgs],prepareTransfer:['prepare_transfer_booking_offer_v2',transferArgs],
  commitOnline:['book_shift_v2',{...tupleArgs,...consentArgs}],
  commitPhone:['assisted_book_shift_by_phone_v2',{...tupleArgs,...consentArgs,p_reason:requests.commitPhone.reason}],
  commitWaitlist:['accept_waitlist_offer_v2',{...waitArgs,...consentArgs}],commitTransfer:['accept_booking_transfer_v2',{...transferArgs,...consentArgs}],
  publish:['publish_shift_booking_contract_v2',{p_tenant_id:u.tenant,p_idempotency_key:u.key,p_shift_id:u.shift,
    p_expected_shift_version:2,p_expected_contract_version:0,p_instructions_text:requests.publish.instructionsText}],
  context:['get_shift_booking_context_v2',{p_tenant_id:u.tenant,p_shift_id:u.shift}],
  executors:['list_authorised_shift_executors_v2',{p_tenant_id:u.tenant,p_shift_id:u.shift}],
  acknowledgement:['get_booking_acknowledgement_v2',{p_tenant_id:u.tenant,p_booking_id:u.booking}],
};
for(const kind of Object.keys(requests)) test(`validated ${kind} uses only its fixed SQL17 RPC and server tenant`,async()=>{
  const f=fake(kind);const isRead=['context','executors','acknowledgement'].includes(kind);
  const state=await (isRead?executeRead:executeCommand)(kind,form(requests[kind]),f.deps);
  assert.equal(state.status,isRead?'loaded':'confirmed');
  assert.deepEqual(f.calls,[{name:expected[kind][0],args:expected[kind][1]}]);
  assert.equal(f.gateCalls.length,1);
  assert.equal(f.paths.length,kind.startsWith('commit')?3:kind==='publish'?2:0);
  assert.equal(JSON.stringify(state).includes('UNTRUSTED_UI_ROLE'),false);
  assert.equal(JSON.stringify(state).includes('event_ids'),false);
  assert.equal(JSON.stringify(state).includes('p_tenant_id'),false);
});

test('sensitive duplicates, client authority fields, files and arbitrary RPC payloads never dispatch',async()=>{
  const bad=[];
  for(const key of ['club','shiftId','executorPersonId','idempotencyKey','instructionsAck']) {const f=form(requests.commitOnline);f.append(key,f.get(key));bad.push(f);}
  for(const key of ['actorId','sessionId','tenantId','rpc','operation','payload','role']) {const f=form(requests.commitOnline);f.append(key,'PRIVATE_UNTRUSTED_VALUE');bad.push(f);}
  const file=form(requests.commitOnline);file.set('shiftId',new Blob(['opaque']),'file.txt');bad.push(file);
  for(const input of bad) {const f=fake('commitOnline');const state=await executeCommand('commitOnline',input,f.deps);
    assert.equal(state.status,'invalid');assert.equal(f.calls.length,0);assert.equal(f.gateCalls.length,0);
    assert.equal(JSON.stringify(state).includes('PRIVATE_UNTRUSTED_VALUE'),false);}
});
test('only one literal on checkbox establishes consent; every false/coerced/missing form stays unsubmitted',async()=>{
  for(const field of ['instructionsAck','cancellationAck']) for(const value of [undefined,'','false','true','1','ON','on ']) {
    const input=form(requests.commitOnline);
    if(value===undefined) input.delete(field);
    else input.set(field,value);
    const f=fake('commitOnline');const state=await executeCommand('commitOnline',input,f.deps);
    assert.equal(state.status,'invalid');assert.equal(f.calls.length,0);
  }
});
test('framework fields are ignored, while domain duplicate validation remains intact',()=>{
  const f=form(requests.commitOnline);f.append('$ACTION_ID_synthetic','framework');f.append('$ACTION_REF_synthetic','framework');
  assert.equal(decodeForm('commitOnline',f).ok,true);
  f.append('bookingOfferId',u.offer);assert.equal(decodeForm('commitOnline',f).ok,false);
});
test('version codec refuses precision loss, coercion tricks and zero except first publication',()=>{
  for(const value of ['',' ','01','+1','-1','1.0','1e1','NaN','Infinity','9007199254740992','0']) {
    const f=form(requests.commitOnline);f.set('expectedShiftVersion',value);assert.equal(decodeForm('commitOnline',f).ok,false);
  }
  assert.equal(decodeForm('publish',form(requests.publish)).ok,true);
  const overflow=form(requests.publish);overflow.set('expectedContractVersion','9007199254740991');assert.equal(decodeForm('publish',overflow).ok,false);
});
test('text and UUID parsing are canonical once, while original reason and instructions remain exact',()=>{
  const p=parseRequest('commitPhone',{...requests.commitPhone,executorPersonId:u.executor.toUpperCase()});assert.equal(p.ok,true);
  assert.equal(p.request.reason,requests.commitPhone.reason);assert.ok(Object.isFrozen(p.request));
  const instruction=' '.repeat(2)+'🙂'.repeat(4000)+' '.repeat(2);
  assert.equal(parseRequest('publish',{...requests.publish,instructionsText:instruction}).ok,true);
  assert.equal(parseRequest('publish',{...requests.publish,instructionsText:'🙂'.repeat(4001)}).ok,false);
  assert.equal(parseRequest('publish',{...requests.publish,instructionsText:'   '}).ok,false);
  assert.equal(parseRequest('commitPhone',{...requests.commitPhone,reason:'🙂'.repeat(2001)}).ok,false);
  assert.equal(parseRequest('commitOnline',{...requests.commitOnline,actorId:u.person}).ok,false);
  assert.throws(()=>rpcPlan('commitOnline',{...requests.commitOnline,sessionId:u.person},u.tenant),/INVALID_TYPED_RPC_REQUEST/);
  assert.equal(parseRequest('publish',{...requests.publish,instructionsText:'text\u0000text'}).ok,false);
  assert.equal(parseRequest('commitPhone',{...requests.commitPhone,reason:'\ud800'}).ok,false);
});
test('zero/two receipts, false OK, malformed identifiers/version/events and private extra columns remain unknown',async()=>{
  const variants=[null,{},[],[...response('commitOnline'),...response('commitOnline')]];
  for(const change of [r=>r.ok=false,r=>r.resource_id='not-uuid',r=>r.version=2,r=>r.event_ids=[],
    r=>r.event_ids=['not-uuid'],r=>r.accepted_session_id=u.person,r=>r.result.private_token='PRIVATE_RESPONSE_VALUE']) {
    const rows=response('commitOnline');change(rows[0]);variants.push(rows);
  }
  for(const data of variants) {const f=fake('commitOnline',async()=>({data,error:null}));const state=await executeCommand('commitOnline',form(requests.commitOnline),f.deps);
    assert.equal(state.status,'unknown');assert.deepEqual(state.attempt,requests.commitOnline);assert.equal(f.paths.length,0);
    assert.equal(JSON.stringify(state).includes('PRIVATE_RESPONSE_VALUE'),false);}
});
test('prepare response must have false acknowledgements, valid hash/times and no event',()=>{
  for(const change of [r=>r.result.instructions_ack=true,r=>r.result.cancellation_ack=true,r=>r.result.contract_hash_hex='short',
    r=>r.result.offered_at='yesterday',r=>r.event_ids=[u.event],r=>r.result.contract_version_id='bad']) {
    const rows=response('prepareOnline');change(rows[0]);assert.equal(parseCommandResponse('prepareOnline',requests.prepareOnline,rows).ok,false);
  }
});
test('commit binds the asked offer and route-specific action/event contract',()=>{
  const foreign=response('commitOnline');foreign[0].result.booking_offer_id=id(99);
  assert.equal(parseCommandResponse('commitOnline',requests.commitOnline,foreign).ok,false);
  const missing=response('commitPhone');delete missing[0].result.assisted_action_id;
  assert.equal(parseCommandResponse('commitPhone',requests.commitPhone,missing).ok,false);
  const duplicated=response('commitTransfer');duplicated[0].event_ids=[u.event,u.event];
  assert.equal(parseCommandResponse('commitTransfer',requests.commitTransfer,duplicated).ok,false);
  assert.equal(parseCommandResponse('commitOnline',requests.commitOnline,response('commitPhone')).ok,false);
});
test('publish validates exact shift/revision and does not invent a receipt hash',()=>{
  const good=parseCommandResponse('publish',requests.publish,response('publish'));assert.equal(good.ok,true);
  assert.equal('contractHashHex' in good.value,false);
  for(const change of [r=>r.version=2,r=>r.result.shift_id=id(99),r=>r.result.ack_required=false,r=>r.result.contract_hash_hex=hash]) {
    const rows=response('publish');change(rows[0]);assert.equal(parseCommandResponse('publish',requests.publish,rows).ok,false);
  }
});
test('read codecs reject foreign context, private chooser fields, ambiguous tuples and stale composition',()=>{
  assert.equal(parseReadResponse('context',requests.context,{...context,shift_id:id(99)}).ok,false);
  assert.equal(parseReadResponse('context',requests.context,{...context,contract_ready:false}).ok,false);
  assert.equal(parseReadResponse('context',requests.context,{...context,positions:[context.positions[0],context.positions[0]]}).ok,false);
  assert.equal(parseReadResponse('context',requests.context,{...context,instructions_ack:true}).ok,false);
  const rows=response('executors');assert.equal(parseReadResponse('executors',requests.executors,[...rows,...rows]).ok,false);
  assert.equal(parseReadResponse('executors',requests.executors,[{...rows[0],household_label:'PRIVATE_DOSSIER_LABEL'}]).ok,false);
  assert.equal(parseReadResponse('executors',requests.executors,[]).ok,true);
  assert.equal(parseReadResponse('context',requests.context,{...context,tenant_timezone:'Europe/Amsterdam'}).ok,false);
});
test('historical ACK is authorized by RPC, strictly parsed and projected without private/provider/book-window data',()=>{
  const parsed=parseReadResponse('acknowledgement',requests.acknowledgement,acknowledgement);assert.equal(parsed.ok,true);
  const value=parsed.value;assert.equal(value.agreement.timezone,'Europe/Amsterdam');
  for(const key of ['type_version_id','qualification_type_id','booking_opens_at','type_category_id','committee_active','auth_user_id','session_id']) assert.equal(JSON.stringify(value).includes(key),false);
  assert.equal(parseReadResponse('acknowledgement',requests.acknowledgement,{...acknowledgement,booking_id:id(99)}).ok,false);
  assert.equal(parseReadResponse('acknowledgement',requests.acknowledgement,{...acknowledgement,agreement:{...agreement,type_requirements:{}}}).ok,false);
  assert.equal(parseReadResponse('acknowledgement',requests.acknowledgement,{...acknowledgement,actor_auth_user_id:u.person}).ok,false);
});
test('review compares the offered contract/text/deadline without pretending current context is frozen offer recovery',()=>{
  const p=parseCommandResponse('prepareOnline',requests.prepareOnline,response('prepareOnline'));assert.equal(p.ok,true);
  assert.equal(reviewMatchesOffer(context,p.value),true);
  assert.equal(reviewMatchesOffer({...context,cancellation_deadline:'2027-03-01T11:00:00+01:00'},p.value),true);
  assert.equal(reviewMatchesOffer({...context,instruction:{...context.instruction,contract_hash_hex:'b'.repeat(64)}},p.value),false);
  assert.equal(reviewMatchesOffer({...context,cancellation_deadline:'2027-03-02T10:00:00+00:00'},p.value),false);
});
test('confirmation presentation must match the stored reviewed offer and immutable contract, never a current head',()=>{
  const p=parseCommandResponse('prepareOnline',requests.prepareOnline,response('prepareOnline'));
  const c=parseCommandResponse('commitOnline',requests.commitOnline,response('commitOnline'));
  assert.equal(p.ok,true);assert.equal(c.ok,true);
  assert.equal(commitMatchesReviewedOffer(c.value,p.value),true);
  assert.equal(commitMatchesReviewedOffer({...c.value,contractVersionId:id(99)},p.value),false);
  assert.equal(commitMatchesReviewedOffer({...c.value,offerId:id(99)},p.value),false);
});
test('lost prepare and malformed completed commit retry preserve one exact key/payload and avoid mutable read preflights',async()=>{
  for(const kind of ['prepareOnline','commitOnline','commitPhone','commitWaitlist','commitTransfer','publish']) {
    let count=0;const f=fake(kind,async(name,args)=>{
      assert.equal(name,expected[kind][0]);assert.equal('p_actor_id' in args,false);
      if(count++===0) return {data:null,error:null};return {data:response(kind),error:null};
    });
    const first=await executeCommand(kind,form(requests[kind]),f.deps);assert.equal(first.status,'unknown');
    assert.ok(Object.isFrozen(first.attempt));
    const second=await executeCommand(kind,frozenRetryForm(kind,first.attempt),f.deps);assert.equal(second.status,'confirmed');
    assert.deepEqual(f.calls[0],f.calls[1]);assert.equal(f.calls.length,2);
    assert.equal(f.calls.some(c=>c.name.startsWith('get_')||c.name.startsWith('list_')),false);
  }
});
test('in-flight FormData editing cannot alter the frozen dispatched unknown attempt',async()=>{
  let reject,started;const entered=new Promise(resolve=>started=resolve);
  const f=fake('commitPhone',()=>{started();return new Promise((_resolve,rejecter)=>reject=rejecter);});
  const input=form(requests.commitPhone);const pending=executeCommand('commitPhone',input,f.deps);await entered;
  input.set('reason','Different reason');input.set('idempotencyKey',id(100));reject(new Error('PRIVATE_TRANSPORT_BODY'));
  const state=await pending;assert.equal(state.status,'unknown');assert.deepEqual(state.attempt,requests.commitPhone);
  assert.equal(JSON.stringify(state).includes('PRIVATE_TRANSPORT_BODY'),false);
});
test('known exact database failures are sanitized, while modified/unrecognized provider errors remain unknown',async()=>{
  for(const [error,status,category] of [
    [{code:'55000',message:'ACK_REQUIRED',details:'PRIVATE_DETAILS'},'rejected','ack_required'],
    [{code:'40001',message:'BOOKING_CONTRACT_STALE'},'rejected','stale'],
    [{code:'22000',message:'IDEMPOTENCY_CONFLICT'},'rejected','idempotency_conflict'],
    [{code:'42501',message:'FORBIDDEN PRIVATE_DETAILS'},'unknown',undefined],
    [{code:'UNRECOGNIZED',message:'PRIVATE_DETAILS'},'unknown',undefined],
  ]) {
    const f=fake('commitOnline',async()=>({data:null,error}));const state=await executeCommand('commitOnline',form(requests.commitOnline),f.deps);
    assert.equal(state.status,status);assert.equal(state.category,category);assert.equal(JSON.stringify(state).includes('PRIVATE_DETAILS'),false);
    assert.deepEqual(state.attempt,requests.commitOnline);assert.equal(f.paths.length,0);
  }
});
test('initial real Next redirect is rethrown and never converted to a lost-response state',async()=>{
  const f=fake('commitOnline');f.deps.requireWorkspace=async()=>redirect('/login');
  await assert.rejects(executeCommand('commitOnline',form(requests.commitOnline),f.deps),error=>error.digest?.startsWith('NEXT_REDIRECT;'));
  assert.equal(f.calls.length,0);
});
test('Native loss after a gate is detected by a fresh gate and real Next redirect, while action denial stays denied',async()=>{
  const f=fake('commitOnline',async()=>({data:null,error:{code:'42501',message:'FORBIDDEN'}}));
  const gate=f.deps.requireWorkspace;let count=0;f.deps.requireWorkspace=async slug=>count++===0?gate(slug):redirect('/login');
  await assert.rejects(executeCommand('commitOnline',form(requests.commitOnline),f.deps),error=>error.digest?.startsWith('NEXT_REDIRECT;'));
  assert.equal(f.calls.length,1);
  const denial=fake('commitOnline',async()=>({data:null,error:{code:'42501',message:'FORBIDDEN'}}));
  const state=await executeCommand('commitOnline',form(requests.commitOnline),denial.deps);
  assert.equal(state.status,'rejected');assert.equal(state.category,'forbidden');assert.equal(denial.gateCalls.length,2);
});
test('tenant slug/UUID/native person context is validated without browser roles as authority',async()=>{
  for(const workspace of [{tenant_id:u.tenant,tenant_slug:'other-club',person_id:u.person},
    {tenant_id:'invalid',tenant_slug:club,person_id:u.person},{tenant_id:u.tenant,tenant_slug:club,person_id:'invalid'}]) {
    const f=fake('commitOnline');f.deps.requireWorkspace=async()=>({workspace,client:{schema(){throw new Error('must not dispatch');}}});
    const state=await executeCommand('commitOnline',form(requests.commitOnline),f.deps);assert.equal(state.status,'rejected');assert.equal(f.calls.length,0);
  }
});
test('a validated successful mutation remains confirmed if application cache refresh fails',async()=>{
  const f=fake('commitOnline');f.deps.revalidatePath=()=>{throw new Error('PRIVATE_CACHE_FAILURE');};
  const state=await executeCommand('commitOnline',form(requests.commitOnline),f.deps);
  assert.equal(state.status,'confirmed');assert.equal(state.refreshPending,true);assert.equal(f.calls.length,1);
  assert.equal(JSON.stringify(state).includes('PRIVATE_CACHE_FAILURE'),false);
});
test('read errors never become an empty chooser or leak raw error objects; Native redirects still pass through',async()=>{
  const f=fake('executors',async()=>({data:[],error:{code:'UNKNOWN',message:'PRIVATE_READ_BODY'}}));
  const state=await executeRead('executors',form(requests.executors),f.deps);assert.equal(state.status,'unavailable');
  assert.equal('data' in state,false);assert.equal(JSON.stringify(state).includes('PRIVATE_READ_BODY'),false);
  f.deps.requireWorkspace=async()=>redirect('/login');
  await assert.rejects(executeRead('context',form(requests.context),f.deps),error=>error.digest?.startsWith('NEXT_REDIRECT;'));
});
