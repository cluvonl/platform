import test from 'node:test';
import assert from 'node:assert/strict';
import {redirect,unstable_rethrow} from 'next/navigation.js';
import {loadBookingModules} from './helpers/booking-modules.mjs';
const modules=await loadBookingModules();
const {parseRequest,decodeForm,rpcPlan,parseResponse,dataSnapshot,PAYLOAD_LIMITS,timestampIdentity,timestampEquivalent}=modules['booking-read-contracts'];
const {executeReadRequest,executeReadForm}=modules['booking-read-core'];
const {composeOnlineInitial,composePhoneInitial,composeWaitlistInitial,composeTransferInitial,loadFrozenReview,loadManagement,publicationVersions,recoverSavedCommit,listMyOffers,loadOfferOutcome,bindFrozenReview,frozenPanelProps}=modules['booking-projections'];
const {executeCommand}=modules['booking-server-core'];
const {frozenRetryForm}=modules['booking-contracts'];

// Declared synthetic protocol data only; no actual Auth/session/account values.
const id=n=>`70000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const u={tenant:id(1),actorPerson:id(2),shift:id(3),position:id(4),executor:id(5),obligation:id(6),key:id(7),
  offer:id(8),contract:id(9),booking:id(10),ack:id(11),action:id(12),waitlist:id(13),transfer:id(14),event:id(15)};
const club='synthetic-club',hash='b'.repeat(64),clone=v=>structuredClone(v);
const contextPairs=[{household_label:'Leesbaar gekoppeld huishouden',season_name:'Seizoen 2027'}];
const target={executor_person_id:u.executor,display_name:'Synthetische uitvoerder',obligation_id:u.obligation,
  readable_contexts:contextPairs,context_complete:true};
const tuple={shift_id:u.shift,position_id:u.position,executor_person_id:u.executor,obligation_id:u.obligation};
const agreement={title:'Taak',tenant_timezone:'Europe/Amsterdam',task_type_name:'Kantinedienst',committee_name:'Commissie',
  category_name:'Categorie',location_name:null,starts_at:'2027-03-03T10:00:00+00:00',ends_at:'2027-03-03T11:00:00+00:00',
  credit_minutes:60,cancellation_minutes:2880,minimum_age:null,qualification_name:null};
const review={booking_offer_id:u.offer,route:'online',contract_version_id:u.contract,revision:1,contract_hash_hex:hash,
  instructions_text:'  Lees deze taak.  ',offered_at:'2026-10-07T10:00:00+00:00',
  cancellation_deadline:'2027-03-01T10:00:00+00:00',instructions_ack:false,cancellation_ack:false,target:tuple,agreement};
const receipt={booking_id:u.booking,booking_version:1,acknowledgement_id:u.ack,booking_offer_id:u.offer,contract_version_id:u.contract};
const outcome={status:'observed_completed',receipt,booking_now:{state:'booked',version:1}};
const management={shift_id:u.shift,shift_version:2,title:'Taak',committee_name:'Commissie',tenant_timezone:'Europe/Amsterdam',
  can_publish:true,inline_supported:true,contract_head:{contract_version_id:u.contract,revision:1,head_version:1,
    contract_hash_hex:hash,instructions_text:review.instructions_text,source_matches_current:true}};
const commonSource={...tuple,shift_version:2,expires_at:'2027-03-02T10:00:00+00:00',source_open:true,
  tenant_timezone:'Europe/Amsterdam',readable_contexts:contextPairs};
const phoneSource={route:'phone',shift_id:u.shift,position_id:u.position,shift_version:2,tenant_timezone:'Europe/Amsterdam',source_open:true,targets:[target]};
const waitlistSource={route:'waitlist',waitlist_offer_id:u.waitlist,offer_version:3,...commonSource,offer_state:'active'};
const transferSource={route:'transfer',transfer_request_id:u.transfer,request_version:4,...commonSource,mode:'takeover',request_state:'open'};
const context={shift_id:u.shift,shift_version:2,title:'Taak',committee_name:'Commissie',category_name:'Categorie',location_name:null,
  starts_at:agreement.starts_at,ends_at:agreement.ends_at,credit_minutes:60,cancellation_deadline:review.cancellation_deadline,
  minimum_age:null,qualification_name:null,contract_ready:true,instruction:{contract_version_id:u.contract,revision:1,
    contract_hash_hex:hash,instructions_text:review.instructions_text},positions:[{position_id:u.position,ordinal:1,available:true}],
  instructions_ack:false,cancellation_ack:false};
const req={targets:{club,shiftId:u.shift},management:{club,shiftId:u.shift},offerReview:{club,bookingOfferId:u.offer},
  onlineOutcome:{club,commandKey:u.key},phoneOutcome:{club,commandKey:u.key},waitlistOutcome:{club,commandKey:u.key},transferOutcome:{club,commandKey:u.key},
  myOffers:{club,shiftId:u.shift,positionId:u.position},offerOutcome:{club,bookingOfferId:u.offer},phoneSource:{club,shiftId:u.shift,positionId:u.position},
  waitlistSource:{club,waitlistOfferId:u.waitlist},transferSource:{club,transferRequestId:u.transfer}};
const tenantShift={p_tenant_id:u.tenant,p_shift_id:u.shift},tenantOffer={p_tenant_id:u.tenant,p_booking_offer_id:u.offer},tenantKey={p_tenant_id:u.tenant,p_command_key:u.key};
const expected={targets:['list_shift_booking_targets_v2',tenantShift],management:['get_shift_booking_management_v2',tenantShift],
  offerReview:['get_booking_offer_review_v2',tenantOffer],onlineOutcome:['get_online_booking_outcome_v2',tenantKey],
  phoneOutcome:['get_phone_booking_outcome_v2',tenantKey],waitlistOutcome:['get_waitlist_booking_outcome_v2',tenantKey],transferOutcome:['get_transfer_booking_outcome_v2',tenantKey],
  myOffers:['list_my_shift_booking_offers_v2',{...tenantShift,p_position_id:u.position}],offerOutcome:['get_booking_offer_outcome_v2',tenantOffer],
  phoneSource:['get_assisted_shift_booking_source_v2',{...tenantShift,p_position_id:u.position}],
  waitlistSource:['get_waitlist_booking_source_v2',{p_tenant_id:u.tenant,p_waitlist_offer_id:u.waitlist}],
  transferSource:['get_transfer_booking_source_v2',{p_tenant_id:u.tenant,p_transfer_request_id:u.transfer}]};
function response(kind) {
  if(kind==='targets') return clone([target]);
  if(kind==='management') return clone(management);
  if(kind==='offerReview') return clone(review);
  if(kind==='myOffers') return [{booking_offer_id:u.offer,route:'online',offered_at:review.offered_at,title:'Taak'}];
  if(kind==='phoneSource') return clone(phoneSource);
  if(kind==='waitlistSource') return clone(waitlistSource);
  if(kind==='transferSource') return clone(transferSource);
  if(kind==='phoneOutcome') return {...clone(outcome),receipt:{...receipt,assisted_action_id:u.action}};
  return clone(outcome);
}
function form(v) {const f=new FormData();for(const [k,value] of Object.entries(v)) f.append(k,value===true?'on':String(value));return f;}
const byRpc=Object.fromEntries(Object.entries(expected).map(([k,[name]])=>[name,k]));
function fake(handler=async name=>({data:name==='get_shift_booking_context_v2'?clone(context):response(byRpc[name]),error:null})) {
  const calls=[],gates=[];
  const client={schema(name){assert.equal(name,'api');return {async rpc(name,args) {calls.push({name,args:clone(args)});return handler(name,args);}};}};
  const deps={async requireWorkspace(slug){gates.push(slug);return {client,workspace:{tenant_id:u.tenant,tenant_slug:club,
    person_id:u.actorPerson,display_name:'Synthetische actor',roles:[{role_key:'UNTRUSTED_UI_ROLE',scope_kind:'tenant',scope_id:null}]}};},
    rethrow:unstable_rethrow,redirectToLogin:()=>redirect('/login'),revalidatePath:()=>{}};
  return {deps,calls,gates,client};
}
for(const kind of Object.keys(req)) test(`SQL18 ${kind}: exact fixed RPC/server tenant and exact decoded public DTO`,async()=>{
  const f=fake();const state=await executeReadForm(kind,form(req[kind]),f.deps);
  assert.equal(state.status,'loaded');assert.deepEqual(f.calls,[{name:expected[kind][0],args:expected[kind][1]}]);
  assert.deepEqual(f.gates,[club]);
  assert.equal(JSON.stringify(state).includes('UNTRUSTED_UI_ROLE'),false);
  assert.equal(JSON.stringify(state).includes('p_tenant_id'),false);
  assert.ok(Object.isFrozen(state.data));
});
test('direct typed RPC planner refuses malformed server tenant or extra authority and normalizes UUID once',()=>{
  assert.deepEqual(rpcPlan('offerReview',req.offerReview,u.tenant),{name:'get_booking_offer_review_v2',args:tenantOffer});
  assert.throws(()=>rpcPlan('offerReview',req.offerReview,'not-a-tenant'),/INVALID_TYPED_READ/);
  assert.throws(()=>rpcPlan('offerReview',{...req.offerReview,tenantId:u.tenant},u.tenant),/INVALID_TYPED_READ/);
  const synthetic='AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
  assert.equal(parseRequest('offerReview',{club,bookingOfferId:synthetic}).request.bookingOfferId,synthetic.toLowerCase());
});
test('every request rejects supplied actor, tenant, role, arbitrary RPC/key body before Native gate',async()=>{
  for(const kind of Object.keys(req)) for(const key of ['actorId','sessionId','tenantId','roles','rpc','operation','payload']) {
    const f=fake();const state=await executeReadRequest(kind,{...req[kind],[key]:'SYNTHETIC_PRIVATE_SENTINEL'},f.deps);
    assert.equal(state.status,'unavailable');assert.equal(state.category,'invalid_input');assert.equal(f.gates.length,0);assert.equal(f.calls.length,0);
    assert.equal(JSON.stringify(state).includes('SYNTHETIC_PRIVATE_SENTINEL'),false);
  }
});
test('read FormData duplicate/resource/File/private fields are refused; framework prefix remains ignored',async()=>{
  for(const kind of Object.keys(req)) for(const key of Object.keys(req[kind])) {
    const bad=form(req[kind]);bad.append(key,bad.get(key));const f=fake();
    assert.equal((await executeReadForm(kind,bad,f.deps)).category,'invalid_input');assert.equal(f.calls.length,0);
  }
  const bad=form(req.offerReview);bad.set('bookingOfferId',new Blob(['synthetic']),'a.txt');assert.equal(decodeForm('offerReview',bad).ok,false);
  const valid=form(req.offerReview);valid.append('$ACTION_ID_synthetic','ignored');assert.equal(decodeForm('offerReview',valid).ok,true);
});
test('JSON descriptors deny accessors/symbols/custom prototypes/cycles/undefined without invoking getters',async()=>{
  let reads=0;const getter={...req.offerReview};Object.defineProperty(getter,'bookingOfferId',{enumerable:true,get(){reads++;return u.offer;}});
  const cyclic={...req.offerReview};cyclic.cycle=cyclic;
  const symbol={...req.offerReview,[Symbol('private')]:true};
  for(const value of [getter,cyclic,symbol,new Date(),Object.assign(Object.create({secret:true}),req.offerReview),{...req.offerReview,x:undefined}]) {
    const f=fake();assert.equal((await executeReadRequest('offerReview',value,f.deps)).status,'unavailable');assert.equal(f.calls.length,0);
  }
  assert.equal(reads,0);
  const raw=clone(review);Object.defineProperty(raw.agreement,'title',{enumerable:true,get(){reads++;return 'private';}});
  assert.equal(parseResponse('offerReview',req.offerReview,raw).ok,false);assert.equal(reads,0);
});
test('runtime byte/depth/node caps fail closed without truncating into an empty or completed result',()=>{
  assert.equal(dataSnapshot({x:'a'.repeat(PAYLOAD_LIMITS.utf8Bytes)}).ok,false);
  let nested=null;for(let i=0;i<15;i++) nested={nested};assert.equal(dataSnapshot(nested).ok,false);
  assert.equal(dataSnapshot(Array(PAYLOAD_LIMITS.nodes+1).fill(null)).ok,false);
  assert.equal(dataSnapshot(Object.assign([1],{hidden:true})).ok,false);
  assert.equal(dataSnapshot([,]).ok,false);
});
test('request is copied/frozen before auth awaits and later caller mutation cannot change RPC resource',async()=>{
  let release;const wait=new Promise(r=>{release=r;});const f=fake();const old=f.deps.requireWorkspace;
  f.deps.requireWorkspace=async slug=>{await wait;return old(slug);};
  const input={...req.offerReview};const pending=executeReadRequest('offerReview',input,f.deps);
  input.bookingOfferId=id(999);release();assert.equal((await pending).status,'loaded');
  assert.equal(f.calls[0].args.p_booking_offer_id,u.offer);
});
test('all twelve outputs reject private unknown top-level fields instead of silently stripping them',()=>{
  for(const kind of Object.keys(req)) {
    const raw=response(kind);if(Array.isArray(raw)) raw[0].private_email='SYNTHETIC_PRIVATE_SENTINEL';else raw.private_email='SYNTHETIC_PRIVATE_SENTINEL';
    assert.equal(parseResponse(kind,req[kind],raw).ok,false,kind);
  }
});
test('exact nested allowlists reject assessed household/ID, source original actor/reason and raw receipts',()=>{
  const variants=[];
  const r=clone(review);r.agreement.contact_email='synthetic';variants.push(['offerReview',r]);
  const t=clone([target]);t[0].readable_contexts[0].household_id=id(999);variants.push(['targets',t]);
  const m=clone(management);m.contract_head.audit_events=[];variants.push(['management',m]);
  const o=clone(outcome);o.receipt.command_record_id=id(999);variants.push(['onlineOutcome',o]);
  const n=clone(outcome);n.booking_now.actor_auth_user_id=id(999);variants.push(['offerOutcome',n]);
  const p=clone(phoneSource);p.targets[0].assessed_household_label='private';variants.push(['phoneSource',p]);
  const tr=clone(transferSource);tr.origin_booking_id=id(999);variants.push(['transferSource',tr]);
  const w=clone(waitlistSource);w.queue_rank=1;variants.push(['waitlistSource',w]);
  for(const [kind,value] of variants) assert.equal(parseResponse(kind,req[kind],value).ok,false,kind);
});
test('safe integer versions/int32 minutes/hash/date/timezone and temporal invariants are enforced',()=>{
  for(const version of [0,-1,1.5,'1',Number.MAX_SAFE_INTEGER+1,NaN]) {
    const raw=clone(management);raw.shift_version=version;assert.equal(parseResponse('management',req.management,raw).ok,false);
  }
  for(const v of [-1,1.5,'60',2_147_483_648,Infinity]) for(const field of ['credit_minutes','cancellation_minutes']) {
    const raw=clone(review);raw.agreement[field]=v;assert.equal(parseResponse('offerReview',req.offerReview,raw).ok,false);
  }
  for(const [path,value] of [['hash','B'.repeat(64)],['hash','a'.repeat(63)],['time','not-a-date'],['time','2027-01-01T10:00:00'],['zone','Unknown/Private']]) {
    const raw=clone(review);if(path==='hash') raw.contract_hash_hex=value;else if(path==='time') raw.offered_at=value;else raw.agreement.tenant_timezone=value;
    assert.equal(parseResponse('offerReview',req.offerReview,raw).ok,false);
  }
  const reversed=clone(review);reversed.agreement.ends_at=reversed.agreement.starts_at;assert.equal(parseResponse('offerReview',req.offerReview,reversed).ok,false);
  const wrongDeadline=clone(review);wrongDeadline.cancellation_deadline=wrongDeadline.agreement.starts_at;assert.equal(parseResponse('offerReview',req.offerReview,wrongDeadline).ok,false);
  const max=clone(review);max.agreement.credit_minutes=2_147_483_647;assert.equal(parseResponse('offerReview',req.offerReview,max).ok,true);
});
test('frozen text preserves original spaces and Unicode; NUL/unpaired surrogates/4001 content chars are refused',()=>{
  const good=clone(review);good.instructions_text='  '+'🙂'.repeat(4000)+'  ';
  const decoded=parseResponse('offerReview',req.offerReview,good);assert.equal(decoded.ok,true);assert.equal(decoded.value.instructionsText,good.instructions_text);
  for(const value of ['  ','🙂'.repeat(4001),'abc\u0000def','\ud800']) {
    const bad=clone(review);bad.instructions_text=value;assert.equal(parseResponse('offerReview',req.offerReview,bad).ok,false);
  }
});
test('resource binding rejects foreign management/source/review/offer outcome responses',()=>{
  for(const [kind,key] of [['management','shift_id'],['offerReview','booking_offer_id'],['phoneSource','position_id'],['waitlistSource','waitlist_offer_id'],['transferSource','transfer_request_id']]) {
    const raw=response(kind);raw[key]=id(999);assert.equal(parseResponse(kind,req[kind],raw).ok,false);
  }
  const raw=clone(outcome);raw.receipt.booking_offer_id=id(999);assert.equal(parseResponse('offerOutcome',req.offerOutcome,raw).ok,false);
});
test('duplicate targets/contexts and false completeness claims for indistinguishable obligations are refused',()=>{
  const duplicate=clone([target,target]);assert.equal(parseResponse('targets',req.targets,duplicate).ok,false);
  const contexts=clone([target]);contexts[0].readable_contexts.push(clone(contextPairs[0]));assert.equal(parseResponse('targets',req.targets,contexts).ok,false);
  const empty=clone([target]);empty[0].readable_contexts=[];assert.equal(parseResponse('targets',req.targets,empty).ok,false);
  const ambiguous=clone([target,{...target,obligation_id:id(999)}]);assert.equal(parseResponse('targets',req.targets,ambiguous).ok,false);
  ambiguous.forEach(r=>{r.context_complete=false;});assert.equal(parseResponse('targets',req.targets,ambiguous).ok,true);
});
test('initial source-open state is internally consistent, closed expired and mutual-swap remain real values',()=>{
  const w=clone(waitlistSource);w.offer_state='accepted';assert.equal(parseResponse('waitlistSource',req.waitlistSource,w).ok,false);
  w.source_open=false;assert.equal(parseResponse('waitlistSource',req.waitlistSource,w).ok,true);
  const tr=clone(transferSource);tr.mode='mutual_swap';assert.equal(parseResponse('transferSource',req.transferSource,tr).ok,false);
  tr.source_open=false;assert.equal(parseResponse('transferSource',req.transferSource,tr).ok,true);
});
test('phone outcome requires its assisted action; other namespaces reject a phone-specific action',()=>{
  assert.equal(parseResponse('phoneOutcome',req.phoneOutcome,clone(outcome)).ok,false);
  const phone={...clone(outcome),receipt:{...receipt,assisted_action_id:u.action}};
  for(const kind of ['onlineOutcome','waitlistOutcome','transferOutcome']) assert.equal(parseResponse(kind,req[kind],phone).ok,false);
  assert.equal(parseResponse('offerOutcome',req.offerOutcome,phone).ok,true);
});
test('original completion is distinct from current cancelled/transferred booking version',()=>{
  for(const state of ['booked','reconfirmation_required','transfer_pending','performed_pending','confirmed','cancelled','transferred','no_show']) {
    const raw=clone(outcome);raw.booking_now={state,version:4};const decoded=parseResponse('onlineOutcome',req.onlineOutcome,raw);
    assert.equal(decoded.ok,true);assert.equal(decoded.value.receipt.bookingVersion,1);assert.equal(decoded.value.bookingNow.version,4);assert.equal(decoded.value.bookingNow.state,state);
  }
  const invalid=clone(outcome);invalid.receipt.booking_version=4;assert.equal(parseResponse('onlineOutcome',req.onlineOutcome,invalid).ok,false);
});
test('undetermined is exact and never silently accepts failed/missing/no_commit/processing semantics',()=>{
  for(const kind of ['onlineOutcome','phoneOutcome','waitlistOutcome','transferOutcome','offerOutcome']) {
    assert.deepEqual(parseResponse(kind,req[kind],{status:'undetermined'}).value,{status:'undetermined'});
    for(const raw of [{status:'failed'},{status:'missing'},{status:'no_commit'},{status:'processing'},{status:'undetermined',mayCreateNewKey:true},null])
      assert.equal(parseResponse(kind,req[kind],raw).ok,false);
  }
});
test('offer correlation is bounded to ten unique own offers, with an empty array still a loaded correlation',()=>{
  assert.deepEqual(parseResponse('myOffers',req.myOffers,[]).value,[]);
  const base=response('myOffers')[0];assert.equal(parseResponse('myOffers',req.myOffers,[base,base]).ok,false);
  const ten=Array.from({length:10},(_,n)=>({...base,booking_offer_id:id(100+n)}));assert.equal(parseResponse('myOffers',req.myOffers,ten).ok,true);
  ten.push({...base,booking_offer_id:id(200)});assert.equal(parseResponse('myOffers',req.myOffers,ten).ok,false);
});
test('actual Native Next redirect is rethrown; arbitrary auth/transport errors return fixed safe unavailability',async()=>{
  const native=fake();native.deps.requireWorkspace=async()=>redirect('/login');
  await assert.rejects(()=>executeReadRequest('offerReview',req.offerReview,native.deps),e=>typeof e.digest==='string'&&e.digest.startsWith('NEXT_REDIRECT'));
  assert.equal(native.calls.length,0);
  const bad=fake(async()=>{throw new Error('SYNTHETIC_PRIVATE_SENTINEL');});
  const state=await executeReadRequest('offerReview',req.offerReview,bad.deps);assert.equal(state.category,'unavailable');
  assert.equal(JSON.stringify(state).includes('SYNTHETIC_PRIVATE_SENTINEL'),false);
});
test('FORBIDDEN rechecks only Native workspace, preserves action denial and never exports raw errors',async()=>{
  const f=fake(async()=>({data:null,error:{code:'42501',message:'FORBIDDEN',details:'SYNTHETIC_PRIVATE_SENTINEL'}}));
  const state=await executeReadRequest('offerReview',req.offerReview,f.deps);assert.equal(state.category,'forbidden');assert.equal(f.gates.length,2);assert.equal(f.calls.length,1);
  assert.equal(JSON.stringify(state).includes('SYNTHETIC_PRIVATE_SENTINEL'),false);
  const native=fake(async()=>({data:null,error:{code:'42501',message:'FORBIDDEN'}}));const old=native.deps.requireWorkspace;let gates=0;
  native.deps.requireWorkspace=async slug=>++gates===1?old(slug):redirect('/login');
  await assert.rejects(()=>executeReadRequest('offerReview',req.offerReview,native.deps),e=>e.digest?.startsWith('NEXT_REDIRECT'));
});
test('forged or mismatched workspace never dispatches; role lists do not authorize any action',async()=>{
  for(const workspace of [{tenant_id:u.tenant,tenant_slug:'other-club',person_id:u.actorPerson},
    {tenant_id:'bad',tenant_slug:club,person_id:u.actorPerson},{tenant_id:u.tenant,tenant_slug:club,person_id:'bad'}]) {
    const f=fake();f.deps.requireWorkspace=async()=>({workspace,client:f.client});
    assert.equal((await executeReadRequest('offerReview',req.offerReview,f.deps)).category,'forbidden');assert.equal(f.calls.length,0);
  }
});
test('actual Supabase transport metadata is accepted but never projected; invalid/getter metadata remains safe',async()=>{
  const f=fake(async()=>({data:clone(review),error:null,count:null,status:200,statusText:'OK'}));
  const state=await executeReadRequest('offerReview',req.offerReview,f.deps);assert.equal(state.status,'loaded');assert.equal('statusText' in state.data,false);
  let getter=0;const raw={data:clone(review),error:null};Object.defineProperty(raw,'status',{enumerable:true,get(){getter++;return 200;}});
  const bad=fake(async()=>raw);assert.equal((await executeReadRequest('offerReview',req.offerReview,bad.deps)).category,'unverified_response');assert.equal(getter,0);
});

test('online initial composes existing detail plus labelled explicit choices; one tuple is still unselected',async()=>{
  const f=fake();const value=await composeOnlineInitial(req.phoneSource,f.deps);
  assert.equal(value.status,'ready');assert.equal(value.route,'online');assert.equal(value.initialSelection,null);assert.equal(value.expectedShiftVersion,2);
  assert.equal(value.tenantTimezone,null);assert.equal(value.choices[0].contexts[0].householdLabel,contextPairs[0].household_label);
  assert.deepEqual(f.calls.map(c=>c.name),['get_shift_booking_context_v2','list_shift_booking_targets_v2']);
  assert.ok(Object.isFrozen(value.choices[0].contexts));
});
test('phone initial first checks actual phone source and binds its version/detail/labels',async()=>{
  const f=fake();const value=await composePhoneInitial(req.phoneSource,f.deps);
  assert.equal(value.status,'ready');assert.equal(value.route,'phone');assert.equal(value.tenantTimezone,'Europe/Amsterdam');assert.equal(value.initialSelection,null);
  assert.deepEqual(f.calls.map(c=>c.name),['get_assisted_shift_booking_source_v2','get_shift_booking_context_v2']);
  const mismatch=fake(async name=>({data:name==='get_shift_booking_context_v2'?{...clone(context),shift_version:3}:response(byRpc[name]),error:null}));
  assert.equal((await composePhoneInitial(req.phoneSource,mismatch.deps)).status,'unavailable');
});
test('waitlist initial preserves exact source versions and fixed executor, without queue/private source projection',async()=>{
  const f=fake();const value=await composeWaitlistInitial(req.waitlistSource,f.deps);
  assert.equal(value.status,'ready');assert.equal(value.route,'waitlist');assert.equal(value.choice.executorPersonId,u.executor);
  assert.deepEqual(value.prepareBasis,{waitlistOfferId:u.waitlist,expectedOfferVersion:3,expectedShiftVersion:2});
  assert.deepEqual(f.calls.map(c=>c.name),['get_waitlist_booking_source_v2','get_shift_booking_context_v2','list_shift_booking_targets_v2']);
});
test('transfer initial preserves takeover source/version/replacementtuple without original executor or reason',async()=>{
  const f=fake();const value=await composeTransferInitial(req.transferSource,f.deps);
  assert.equal(value.status,'ready');assert.equal(value.route,'transfer');assert.deepEqual(value.prepareBasis,{transferRequestId:u.transfer,expectedRequestVersion:4});
  assert.deepEqual(f.calls.map(c=>c.name),['get_transfer_booking_source_v2','get_shift_booking_context_v2','list_shift_booking_targets_v2']);
  assert.equal(JSON.stringify(value).includes('origin_booking'),false);
});
test('book-only/incomplete labels remain explicitly open with no assessed-household or UUID fallback',async()=>{
  for(const [compose,input] of [[composeOnlineInitial,req.phoneSource],[composePhoneInitial,req.phoneSource],[composeWaitlistInitial,req.waitlistSource],[composeTransferInitial,req.transferSource]]) {
    const f=fake(async name=>{
      if(name==='get_shift_booking_context_v2') return {data:clone(context),error:null};
      const data=response(byRpc[name]);
      if(name==='list_shift_booking_targets_v2') {data[0].readable_contexts=[];data[0].context_complete=false;}
      if(name==='get_assisted_shift_booking_source_v2') {data.targets[0].readable_contexts=[];data.targets[0].context_complete=false;}
      return {data,error:null};
    });
    const value=await compose(input,f.deps);assert.equal(value.status,'needs_label_context');assert.equal('choices' in value,false);assert.equal('choice' in value,false);
    assert.equal(JSON.stringify(value).includes(u.obligation),false);
  }
});
test('partial label coverage can expose only genuinely complete tuples and marks remaining mandate gap',async()=>{
  const missing={...clone(target),executor_person_id:id(200),obligation_id:id(201),readable_contexts:[],context_complete:false};
  const f=fake(async name=>({data:name==='get_shift_booking_context_v2'?clone(context):[clone(target),missing],error:null}));
  const value=await composeOnlineInitial(req.phoneSource,f.deps);assert.equal(value.status,'ready');assert.equal(value.labelCoverage,'incomplete');assert.equal(value.choices.length,1);
  assert.equal(JSON.stringify(value).includes(id(201)),false);
});
test('no currently authorised targets is separate from a label mandate gap, and never auto-selects an executor',async()=>{
  for(const [compose,input] of [[composeOnlineInitial,req.phoneSource],[composePhoneInitial,req.phoneSource]]) {
    const f=fake(async name=>({data:name==='get_shift_booking_context_v2'?clone(context):name==='get_assisted_shift_booking_source_v2'
      ?{...clone(phoneSource),targets:[]}:[],error:null}));
    const value=await compose(input,f.deps);assert.equal(value.status,'no_current_target');assert.equal('choices' in value,false);
  }
});
test('a changed household context between source/chooser cannot silently label a fixed target',async()=>{
  const f=fake(async name=>({data:name==='get_shift_booking_context_v2'?clone(context):name==='list_shift_booking_targets_v2'
    ?[{...clone(target),readable_contexts:[{household_label:'Changed',season_name:'Changed'}]}]:response(byRpc[name]),error:null}));
  assert.equal((await composeTransferInitial(req.transferSource,f.deps)).status,'needs_label_context');
});
test('unready context never infers absent/legacy head or bypasses activation guards',async()=>{
  const legacy={...clone(context),contract_ready:false,instruction:null,positions:[{position_id:u.position,ordinal:1,available:false}]};
  const f=fake(async name=>{assert.equal(name,'get_shift_booking_context_v2');return {data:legacy,error:null};});
  const value=await composeOnlineInitial(req.phoneSource,f.deps);assert.equal(value.status,'contract_not_ready');assert.equal(f.calls.length,1);
});
test('closed sources and mutual swap are explicit; no initial chooser can reopen them',async()=>{
  for(const [compose,input,sourceKind] of [[composePhoneInitial,req.phoneSource,'phoneSource'],[composeWaitlistInitial,req.waitlistSource,'waitlistSource'],[composeTransferInitial,req.transferSource,'transferSource']]) {
    const f=fake(async name=>{
      if(name==='get_shift_booking_context_v2') return {data:clone(context),error:null};
      assert.equal(name,expected[sourceKind][0]);const data=response(sourceKind);data.source_open=false;
      if(sourceKind==='waitlistSource') data.offer_state='accepted';if(sourceKind==='transferSource') data.mode='mutual_swap';return {data,error:null};
    });
    const value=await compose(input,f.deps);assert.equal(value.status,'closed');assert.equal(f.calls.length,2);
  }
});
test('owned frozen review directly loads immutable detail even when every mutable preflight would fail',async()=>{
  const f=fake(async name=>{assert.equal(name,'get_booking_offer_review_v2');return {data:clone(review),error:null};});
  const value=await loadFrozenReview(req.offerReview,f.deps);assert.equal(value.status,'loaded');assert.equal(f.calls.length,1);
  const props=frozenPanelProps(value.data);assert.equal(props.initialInstructionsAck,false);assert.equal(props.initialCancellationAck,false);assert.equal(props.review.agreement.tenantTimezone,'Europe/Amsterdam');
});
const prepared={offerId:u.offer,contractVersionId:u.contract,contractHashHex:hash,instructionsText:review.instructions_text,
  offeredAt:review.offered_at,cancellationDeadline:review.cancellation_deadline,instructionsAck:false,cancellationAck:false};
const savedTuple={club,shiftId:u.shift,positionId:u.position,executorPersonId:u.executor,obligationId:u.obligation,expectedShiftVersion:2,idempotencyKey:u.key};
const consents={bookingOfferId:u.offer,instructionsAck:true,cancellationAck:true};
const savedCommits={online:{...savedTuple,...consents},phone:{...savedTuple,...consents,reason:'  Praktische registratie  '},
  waitlist:{club,waitlistOfferId:u.waitlist,expectedOfferVersion:3,expectedShiftVersion:2,idempotencyKey:u.key,...consents},
  transfer:{club,transferRequestId:u.transfer,expectedRequestVersion:4,idempotencyKey:u.key,...consents}};
test('frozen review binder checks own route/offer/hash/text/tuple without fetching current eligibility or context',()=>{
  const decoded=parseResponse('offerReview',req.offerReview,review).value;
  assert.equal(bindFrozenReview('online',savedTuple,prepared,decoded),true);
  assert.equal(bindFrozenReview('phone',savedTuple,prepared,decoded),false);
  assert.equal(bindFrozenReview('online',{...savedTuple,executorPersonId:id(999)},prepared,decoded),false);
  assert.equal(bindFrozenReview('online',savedTuple,{...prepared,contractHashHex:'a'.repeat(64)},decoded),false);
  assert.equal(bindFrozenReview('online',savedTuple,{...prepared,instructionsText:'changed'},decoded),false);
  for(const route of ['waitlist','transfer']) {
    const prepare=clone(savedCommits[route]);delete prepare.bookingOfferId;delete prepare.instructionsAck;delete prepare.cancellationAck;
    const actual=parseResponse('offerReview',req.offerReview,{...clone(review),route}).value;
    assert.equal(bindFrozenReview(route,prepare,prepared,actual),true);
  }
});
test('prepare vs UTC historical detail binds equal offset instants exactly, including six microsecond digits',()=>{
  const raw=clone(review);raw.offered_at='2026-10-07T10:00:00.123456+00:00';
  const frozen=parseResponse('offerReview',req.offerReview,raw).value;
  const saved={...prepared,offeredAt:'2026-10-07T12:00:00.123456+02:00',cancellationDeadline:'2027-03-01T12:00:00.000000+02:00'};
  assert.equal(bindFrozenReview('online',savedTuple,saved,frozen),true);
  assert.equal(timestampEquivalent(saved.offeredAt,frozen.offeredAt),true);
  assert.equal(timestampIdentity('1969-12-31T23:59:59.999999Z'),-1n);
  assert.equal(timestampEquivalent('2027-03-01T10:00:00Z','2027-03-01T10:00:00.000000+00:00'),true);
  assert.equal(bindFrozenReview('online',savedTuple,{...saved,offeredAt:'2026-10-07T12:00:00.123457+02:00'},frozen),false);
  assert.equal(timestampIdentity('not-a-date'),null);
  assert.equal(timestampIdentity('2027-02-30T10:00:00Z'),null);
});
test('microsecond deadline and interval are exact: one-microsecond mismatch rejected, valid submillisecond SQL interval retained',()=>{
  const good=clone(review);good.agreement.starts_at='2027-03-03T10:00:00.123456Z';good.agreement.ends_at='2027-03-03T10:00:00.123457Z';
  good.cancellation_deadline='2027-03-01T10:00:00.123456Z';assert.equal(parseResponse('offerReview',req.offerReview,good).ok,true);
  const bad=clone(good);bad.cancellation_deadline='2027-03-01T10:00:00.123457Z';assert.equal(parseResponse('offerReview',req.offerReview,bad).ok,false);
  const reverse=clone(good);reverse.agreement.ends_at='2027-03-03T10:00:00.123455Z';assert.equal(parseResponse('offerReview',req.offerReview,reverse).ok,false);
  const greaterPrecision=clone(good);greaterPrecision.offered_at='2026-10-07T10:00:00.1234567Z';assert.equal(parseResponse('offerReview',req.offerReview,greaterPrecision).ok,false);
});
for(const route of ['online','phone','waitlist','transfer']) test(`${route} saved commit recovery uses only exact route/key outcome; closed current source/head/capacity irrelevant`,async()=>{
  const kind=route+'Outcome';const f=fake(async name=>{assert.equal(name,expected[kind][0]);const data=response(kind);data.booking_now={state:'cancelled',version:4};return {data,error:null};});
  const value=await recoverSavedCommit(route,savedCommits[route],f.deps);assert.equal(value.status,'observed_completed');
  assert.deepEqual(f.calls,[{name:expected[kind][0],args:tenantKey}]);assert.equal(value.outcome.receipt.bookingVersion,1);assert.equal(value.outcome.bookingNow.version,4);
});
test('undetermined or later denial never authorizes a new commit key and retains original attempted request semantics',async()=>{
  for(const route of ['online','phone','waitlist','transfer']) {
    const unknown=fake(async()=>({data:{status:'undetermined'},error:null}));
    assert.deepEqual(await recoverSavedCommit(route,savedCommits[route],unknown.deps),{status:'undetermined',keepOriginalAttempt:true,mayCreateNewKey:false});
    const denied=fake(async()=>({data:null,error:{code:'42501',message:'FORBIDDEN'}}));
    assert.deepEqual(await recoverSavedCommit(route,savedCommits[route],denied.deps),{status:'unavailable',keepOriginalAttempt:true,mayCreateNewKey:false});
  }
});
test('completed recovery bound to a different offer and changed/false ACKs fail closed without mutation',async()=>{
  const wrong=fake(async()=>({data:{...clone(outcome),receipt:{...receipt,booking_offer_id:id(999)}},error:null}));
  assert.equal((await recoverSavedCommit('online',savedCommits.online,wrong.deps)).status,'unavailable');
  const bad=fake();assert.equal((await recoverSavedCommit('online',{...savedCommits.online,instructionsAck:false},bad.deps)).status,'unavailable');assert.equal(bad.calls.length,0);
});
test('correlation list empty/by-offer undetermined is returned literally, with no inferred absence or new key',async()=>{
  const f=fake(async name=>({data:name==='list_my_shift_booking_offers_v2'?[]:{status:'undetermined'},error:null}));
  assert.deepEqual(await listMyOffers(req.myOffers,f.deps),{status:'loaded',data:[]});
  assert.deepEqual(await loadOfferOutcome(req.offerOutcome,f.deps),{status:'loaded',data:{status:'undetermined'}});
  assert.deepEqual(f.calls.map(c=>c.name),['list_my_shift_booking_offers_v2','get_booking_offer_outcome_v2']);
});
test('manager projection retains stale head and exact expected revision, first publish alone uses zero',async()=>{
  const stale={...clone(management),can_publish:false,contract_head:{...management.contract_head,revision:3,head_version:3,source_matches_current:false}};
  const f=fake(async name=>{assert.equal(name,'get_shift_booking_management_v2');return {data:stale,error:null};});
  const value=await loadManagement(req.management,f.deps);assert.equal(value.status,'loaded');
  assert.deepEqual(publicationVersions(value.data),{expectedShiftVersion:2,expectedContractVersion:3});assert.equal(value.data.contractHead.sourceMatchesCurrent,false);
  const initial=parseResponse('management',req.management,{...clone(management),contract_head:null}).value;
  assert.deepEqual(publicationVersions(initial),{expectedShiftVersion:2,expectedContractVersion:0});
  const invalid=clone(management);invalid.contract_head.head_version=2;assert.equal(parseResponse('management',req.management,invalid).ok,false);
});
test('actual old writeadapter retry remains direct, exact tuple/key/two ACKs/phone reason after outcome undetermined',async()=>{
  const check=fake(async()=>({data:{status:'undetermined'},error:null}));await recoverSavedCommit('phone',savedCommits.phone,check.deps);
  const f=fake(async(name,args)=>{
    assert.equal(name,'assisted_book_shift_by_phone_v2');assert.equal(args.p_idempotency_key,u.key);assert.equal(args.p_executor_person_id,u.executor);
    assert.equal(args.p_expected_shift_version,2);assert.equal(args.p_reason,savedCommits.phone.reason);assert.equal(args.p_instructions_ack,true);assert.equal(args.p_cancellation_ack,true);
    return {data:[{ok:true,resource_id:u.booking,version:1,event_ids:[u.event],result:{state:'booked',acknowledgement_id:u.ack,booking_offer_id:u.offer,
      contract_version_id:u.contract,assisted_action_id:u.action}}],error:null};
  });
  const frozen=frozenRetryForm('commitPhone',savedCommits.phone);const result=await executeCommand('commitPhone',frozen,f.deps);
  assert.equal(result.status,'confirmed');assert.equal(f.calls.length,1);assert.deepEqual(result.attempt,savedCommits.phone);
});
