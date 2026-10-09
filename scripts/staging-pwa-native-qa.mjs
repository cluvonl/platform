// Separate PWA owner; original native QA remains unchanged.
// Actual provider-issued Bearer API proofs against the fixed staging project.
// All identities, tokens, canaries and RPC payloads remain private in memory.
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {NativeQaSession} from './staging-pwa-native-qa-session.mjs';
import {createStagingNativeQaProvider,retryStagingNativeQaProviderCleanup} from './staging-pwa-native-qa-provider.mjs';
import {nativeQaFixtureIds} from './staging-pwa-native-qa-fixture.mjs';
import {nativeQaBookingRpc,validateNativeQaBookingReadback,validateNativeQaBookingRace,validateNativeQaBookingReplay,validateNativeQaBookingConflict} from './staging-pwa-native-qa-booking.mjs';

class QaError extends Error{constructor(code){super(code);this.code=code;}}
const need=(condition,code)=>{if(!condition)throw new QaError(code);};
const LIMITS={email_sent:false,personal_account_changed:false,provider_services_verified:false,o08_restore_accepted:false,v1_ready:false,production_enabled:false};
const successful=response=>{need(response&&response.error===null,'STAGING_NATIVE_QA_API_FAILED');return response.data;};
const one=response=>{const rows=successful(response);need(Array.isArray(rows)&&rows.length===1,'STAGING_NATIVE_QA_API_SHAPE_UNVERIFIED');return rows[0];};
const denied=response=>need(response?.error?.code==='42501'&&response.error.message==='FORBIDDEN','STAGING_NATIVE_QA_AUTHORIZATION_NEGATIVE_FAILED');
const commandArgs=(tenant,action,resource,version,payload,key=randomUUID())=>({p_tenant_id:tenant,p_action:action,p_resource_id:resource,p_expected_version:version,p_payload:payload,p_idempotency_key:key});
const saveArgs=(tenant,profile,canary,version=1)=>commandArgs(tenant,'save_profile',profile,version,{experience:canary,preferences:[],talents:[],availability:[],monthly_minutes:120,boundaries:canary,reserve:false,buddy:false});
const snapshotArgs=(tenant,season=null,household=null)=>({p_tenant_id:tenant,p_season_id:season,p_household_id:household});
async function prepare(api,args){
 const value=successful(await api.rpc('pwa_prepare_command',{p_tenant_id:args.p_tenant_id,p_idempotency_key:args.p_idempotency_key,
  p_action:args.p_action,p_resource_id:args.p_resource_id,p_expected_version:args.p_expected_version,
  p_request_hash_hex:createHash('sha256').update(JSON.stringify(args)).digest('hex')}));
 need(value?.ok===true&&value.idempotency_key===args.p_idempotency_key&&value.state==='pending','STAGING_PWA_NATIVE_QA_PREPARE_UNPROVED');
 const pending=successful(await api.rpc('pwa_pending_commands',{p_tenant_id:args.p_tenant_id}));
 need(Array.isArray(pending)&&pending.some(row=>row.idempotency_key===args.p_idempotency_key&&row.action===args.p_action),'STAGING_PWA_NATIVE_QA_PENDING_UNPROVED');
}
async function status(api,args,wanted,resource){
 const value=successful(await api.rpc('pwa_command_status',{p_tenant_id:args.p_tenant_id,p_idempotency_key:args.p_idempotency_key}));
 need(value?.status===wanted&&(wanted!=='confirmed'||value.receipt?.resource_id===resource),'STAGING_PWA_NATIVE_QA_STATUS_UNPROVED');
 return value;
}
async function noExternalDelivery(provider,fixture){
 for(const [slot,tenant] of [['a',fixture.tenantA],['b',fixture.tenantA],['b',fixture.tenantB]])await provider.withActor(slot,async({client})=>{
  one(await client.schema('api').rpc('pwa_command',commandArgs(tenant,'save_preferences',tenant,0,{email:false,push:false,inbox:true,reminders:false,team:false,news:false})));
 });
}

async function privacy(provider,fixture){
 const canaries=[0,1,2].map(()=>randomBytes(18).toString('hex'));
 await provider.withActor('a',async({client})=>one(await client.schema('api').rpc('pwa_command',saveArgs(fixture.tenantA,fixture.intakeA,canaries[0]))));
 await provider.withActor('b',async({client})=>{
  one(await client.schema('api').rpc('pwa_command',saveArgs(fixture.tenantA,fixture.intakeB,canaries[1])));
  one(await client.schema('api').rpc('pwa_command',saveArgs(fixture.tenantB,fixture.intakeBForeign,canaries[2])));
 });
 await provider.withActor('a',async({client})=>{
  const api=client.schema('api');
  for(const schema of ['app','internal']){
   const response=await client.schema(schema).from('persons').select('id').limit(1);
   need(response.error?.code==='PGRST106','STAGING_NATIVE_QA_PRIVATE_SCHEMA_EXPOSED');
  }
  const rows=successful(await api.from('my_intake').select('tenant_id,profile_id,answers'));
  need(Array.isArray(rows)&&rows.length===1&&rows[0].tenant_id===fixture.tenantA&&rows[0].profile_id===fixture.intakeA
   &&rows[0].answers?.experience===canaries[0]&&!canaries.slice(1).some(value=>JSON.stringify(rows).includes(value)),'STAGING_NATIVE_QA_PRIVATE_INTAKE_LEAK');
  const scopes=successful(await api.rpc('list_intake_contexts',{p_tenant_id:fixture.tenantA}));
  need(Array.isArray(scopes)&&scopes.length===1&&scopes[0].profile_id===fixture.intakeA&&scopes[0].person_id===fixture.personA
   &&scopes[0].household_context_id===fixture.householdA&&scopes[0].is_self===true,'STAGING_NATIVE_QA_INTAKE_CONTEXT_UNVERIFIED');
  const workspaces=successful(await api.from('my_workspaces').select('tenant_id'));
  need(Array.isArray(workspaces)&&workspaces.length===1&&workspaces[0].tenant_id===fixture.tenantA,'STAGING_NATIVE_QA_TENANT_LEAK');
  const mobile=successful(await api.rpc('pwa_snapshot',snapshotArgs(fixture.tenantA)));
  need(mobile?.context?.person_id===fixture.personA&&mobile?.context?.tenant_id===fixture.tenantA,'STAGING_PWA_NATIVE_QA_CONTEXT_UNPROVED');
  need(![fixture.tenantB,fixture.personBForeign,fixture.teamB,'pwa-minor-contact-canary@example.test',...canaries.slice(1)].some(value=>JSON.stringify(mobile).includes(value)),'STAGING_PWA_NATIVE_QA_SNAPSHOT_PRIVATE_LEAK');
  need(Array.isArray(mobile.teams)&&mobile.teams.length===1&&mobile.teams[0].id===fixture.teamA&&mobile.teams[0].members.some(row=>row.person_id===fixture.personA),'STAGING_PWA_NATIVE_QA_TEAM_POSITIVE_CONTROL_FAILED');
  need(!canaries.some(value=>JSON.stringify({teams:mobile.teams,progress:mobile.team_progress}).includes(value)),'STAGING_PWA_NATIVE_QA_TEAM_ANSWERS_LEAK');
  denied(await api.rpc('pwa_snapshot',snapshotArgs(fixture.tenantB)));
  denied(await api.rpc('pwa_snapshot',snapshotArgs(fixture.tenantA,fixture.seasonB)));
  denied(await api.rpc('pwa_snapshot',snapshotArgs(fixture.tenantA,null,fixture.householdB)));
  const dossier=successful(await api.rpc('get_household_dossier',{p_tenant_id:fixture.tenantA,p_household_id:fixture.householdA}));
  const text=JSON.stringify(dossier);
  need(dossier&&Array.isArray(dossier.people)&&dossier.people.length===1&&dossier.people[0].person_id===fixture.personA&&dossier.people[0].is_self===true
   &&![fixture.personB,fixture.intakeB,'intake_code_hash','auth_user_id',...canaries].some(value=>text.includes(value)),'STAGING_NATIVE_QA_HOUSEHOLD_PRIVATE_LEAK');
  denied(await api.rpc('list_intake_contexts',{p_tenant_id:fixture.tenantB}));
  denied(await api.rpc('get_household_dossier',{p_tenant_id:fixture.tenantB,p_household_id:fixture.householdB}));
  denied(await api.rpc('pwa_command',saveArgs(fixture.tenantA,fixture.intakeB,'synthetic-refused',2)));
  denied(await api.rpc('pwa_command',saveArgs(fixture.tenantB,fixture.intakeBForeign,'synthetic-refused',2)));
 });
 await provider.withActor('b',async({client})=>{
  const minor=successful(await client.schema('api').rpc('pwa_snapshot',snapshotArgs(fixture.tenantB)));
  need(minor?.context?.person_id===fixture.personBForeign&&Array.isArray(minor.teams)&&minor.teams.some(row=>row.id===fixture.teamB&&row.members.some(member=>member.person_id===fixture.personBForeign)),'STAGING_PWA_NATIVE_QA_MINOR_POSITIVE_CONTROL_FAILED');
  need(!['pwa-minor-contact-canary@example.test',canaries[0],canaries[1],fixture.teamA].some(value=>JSON.stringify(minor).includes(value)),'STAGING_PWA_NATIVE_QA_MINOR_CONTACT_LEAK');
  const rows=successful(await client.schema('api').from('my_intake').select('tenant_id,profile_id,answers'));
  need(Array.isArray(rows)&&rows.length===2
   &&rows.filter(row=>row.profile_id===fixture.intakeB&&row.tenant_id===fixture.tenantA&&row.answers?.experience===canaries[1]).length===1
   &&rows.filter(row=>row.profile_id===fixture.intakeBForeign&&row.tenant_id===fixture.tenantB&&row.answers?.experience===canaries[2]).length===1
   &&!JSON.stringify(rows).includes(canaries[0]),'STAGING_NATIVE_QA_OTHER_PARENT_LEAK');
 });
 return Object.freeze({own_intake_read_write:true,same_household_private_answers_hidden:true,foreign_tenant_read_write_refused:true,
  household_dossier_private_fields_hidden:true,pwa_dispatcher_profile_write:true,pwa_snapshot_crossperson_and_club_hidden:true,minor_contacts_hidden_with_team_positive_control:true,team_private_answers_hidden:true,private_api_schemas_refused:true,provider_bearer_api_used:true});
}

async function race(owner,provider,run){
 validateNativeQaBookingReadback(await owner.setupBooking(),'empty');
 const fixture=nativeQaFixtureIds(run);
 await provider.withActor('a',async({client})=>need(successful(await client.schema('api').rpc('get_household_dossier',{
  p_tenant_id:fixture.tenantA,p_household_id:fixture.householdRaceB}))===null,'STAGING_NATIVE_QA_OTHER_HOUSEHOLD_LEAK'));
 await provider.withActor('b',async({client})=>{
  const own=successful(await client.schema('api').rpc('get_household_dossier',{p_tenant_id:fixture.tenantA,p_household_id:fixture.householdRaceB}));
  need(own&&Array.isArray(own.people)&&own.people.length===1&&own.people[0].person_id===fixture.personB,'STAGING_NATIVE_QA_OTHER_HOUSEHOLD_POSITIVE_CONTROL_FAILED');
 });
 for(const slot of ['a','b'])await provider.withActor(slot,async({client})=>prepare(client.schema('api'),nativeQaBookingRpc(run,slot.toUpperCase())));
 await provider.withActor('a',async({client})=>status(client.schema('api'),nativeQaBookingRpc(run,'B'),'rejected'));
 await owner.holdLastPosition();let released=false;
 const calls=['a','b'].map(slot=>provider.withActor(slot,async({client})=>await client.schema('api').rpc('pwa_command',nativeQaBookingRpc(run,slot.toUpperCase()))));
 // Attach rejection handlers before probing the barrier; all private responses
 // are retained and drained even if the overlap check or release fails.
 const finished=Promise.allSettled(calls);
 try{
  const deadline=Date.now()+5000;let count=0;
  while(Date.now()<deadline){count=(await owner.countBlocked()).blocked_contenders;if(count===2)break;await new Promise(resolve=>setTimeout(resolve,100));}
  need(count===2,'STAGING_NATIVE_QA_ACTUAL_OVERLAP_UNPROVED');
  await owner.releaseHolder();released=true;
  const outcomes=await finished;
  need(outcomes.every(value=>value.status==='fulfilled'),'STAGING_NATIVE_QA_RACE_NETWORK_FAILED');
  const responses=outcomes.map(value=>value.value);
  const summary=validateNativeQaBookingRace(responses.map(response=>response.error===null
   ?{ok:true,code:null,sqlstate:null}:{ok:false,code:response.error.message,sqlstate:response.error.code}));
  const winner=responses.findIndex(response=>response.error===null),original=one(responses[winner]);
  await provider.withActor(winner===0?'b':'a',async({client})=>{
   const args=nativeQaBookingRpc(run,winner===0?'B':'A');
   const resolved=successful(await client.schema('api').rpc('pwa_resolve_command_intent',{p_tenant_id:fixture.tenantA,p_idempotency_key:args.p_idempotency_key}));
   need(resolved?.status==='rejected','STAGING_PWA_NATIVE_QA_REJECTED_INTENT_UNPROVED');
  });
  validateNativeQaBookingReadback(await owner.bookingReadback());
  await provider.withActor(winner===0?'a':'b',async({client})=>{
   const args=nativeQaBookingRpc(run,winner===0?'A':'B');
   validateNativeQaBookingReplay(original,one(await client.schema('api').rpc('pwa_command',args)));
   const conflict=await client.schema('api').rpc('pwa_command',{...args,p_expected_version:2});
   validateNativeQaBookingConflict({code:conflict.error?.message,sqlstate:conflict.error?.code});
  });
  const winnerSlot=winner===0?'a':'b',loserSlot=winner===0?'b':'a';
  await provider.withActor(winnerSlot,async({client})=>{
   const api=client.schema('api'),args=nativeQaBookingRpc(run,winner===0?'A':'B');
   await status(api,args,'confirmed',original.resource_id);
   const prepared=one(await api.rpc('pwa_command',commandArgs(fixture.tenantA,'prepare_booking',original.resource_id,1,{prepared:true})));
   need(prepared.ok===true&&prepared.resource_id===original.resource_id&&prepared.version===2,'STAGING_PWA_NATIVE_QA_PREPARED_BOOKING_UNPROVED');
   const view=successful(await api.rpc('pwa_snapshot',snapshotArgs(fixture.tenantA,fixture.seasonA)));
   need(view.bookings.some(row=>row.id===original.resource_id&&row.version===2&&typeof row.prepared_at==='string'&&row.instructions==='Cluvo QA public staging instructions'),'STAGING_PWA_NATIVE_QA_BOOKING_SNAPSHOT_UNPROVED');
  });
  await provider.withActor(loserSlot,async({client})=>{
   const api=client.schema('api'),args=nativeQaBookingRpc(run,winner===0?'B':'A');
   await status(api,args,'rejected');
   const resolved=successful(await api.rpc('pwa_resolve_command_intent',{p_tenant_id:fixture.tenantA,p_idempotency_key:args.p_idempotency_key}));
   need(resolved?.status==='rejected','STAGING_PWA_NATIVE_QA_REJECTED_INTENT_UNPROVED');
   denied(await api.rpc('pwa_command',commandArgs(fixture.tenantA,'prepare_booking',original.resource_id,2,{prepared:true})));
   await status(api,nativeQaBookingRpc(run,winner===0?'A':'B'),'rejected');
  });
  validateNativeQaBookingReadback(await owner.bookingReadback(),'prepared');
  return {...summary,actual_blocked_contenders:2,other_household_hidden_with_positive_control:true,idempotent_retry_same_booking:true,changed_retry_refused:true,pwa_prepare_and_status_confirmed:true,cross_actor_status_hidden:true,booking_preparation_readback:true,external_delivery_outbox:0,confirmed_minutes:0};
 }finally{
  if(!released)try{await owner.releaseHolder();}catch{}
  await finished;
 }
}

async function logout(provider,fixture){
 const liveToken=async({accessToken})=>{
  let claims;try{claims=JSON.parse(Buffer.from(accessToken.split('.')[1],'base64url').toString('utf8'));}catch{throw new QaError('STAGING_NATIVE_QA_REVOCATION_EXPIRY_UNPROVED');}
  need(Number.isSafeInteger(claims.exp)&&claims.exp>Math.floor(Date.now()/1000),'STAGING_NATIVE_QA_REVOCATION_EXPIRY_UNPROVED');
 };
 await provider.withActor('a',liveToken);
 await provider.revokeSession('a');
 await provider.withActor('a',async({client})=>{
  const rows=successful(await client.schema('api').from('my_intake').select('profile_id'));
  need(Array.isArray(rows)&&rows.length===0,'STAGING_NATIVE_QA_REVOKED_SESSION_READ_ALLOWED');
  denied(await client.schema('api').rpc('pwa_command',saveArgs(fixture.tenantA,fixture.intakeA,'synthetic-refused',2)));
  denied(await client.schema('api').rpc('pwa_snapshot',snapshotArgs(fixture.tenantA)));
  denied(await client.schema('api').rpc('pwa_pending_commands',{p_tenant_id:fixture.tenantA}));
 });
 await provider.withActor('a',liveToken);
 await provider.withActor('b',async({client})=>{
  const rows=successful(await client.schema('api').from('my_intake').select('profile_id'));
  need(Array.isArray(rows)&&rows.length===2,'STAGING_NATIVE_QA_LOGOUT_POSITIVE_CONTROL_FAILED');
 });
 return {revoked_old_bearer_read_empty:true,revoked_old_bearer_command_refused:true,other_native_session_still_active:true};
}

// Shared command sequence. The hosted entrypoint supplies only the concrete
// source-bound database owner and the actual provider-issued Bearer clients.
// Local tests may execute this sequence against an owned disposable database;
// that does not register hosted authority or claim provider authentication.
export async function runPwaNativeQaApiChecks(owner,provider,run){
 const fixture=nativeQaFixtureIds(run);
 await noExternalDelivery(provider,fixture);
 return {privacy:await privacy(provider,fixture),last_position:await race(owner,provider,run),logout:await logout(provider,fixture)};
}

export async function stagingNativeQa(environment){
 const report={scope:'STAGING_PWA_NATIVE_BEARER_API_QA_V1',observed_at:new Date().toISOString(),passed:false,
  app_fixture_mutations_performed:false,private_values_exported:false,...LIMITS};
 let owner,provider,records,fixtureAttempted=false,primary,closed=false;
 try{
  owner=await NativeQaSession.connect(environment);
  report.source_sha=environment.RELEASE_SHA;report.workflow_run_id=environment.GITHUB_RUN_ID;
  provider=await createStagingNativeQaProvider(owner,environment);records=provider.privateProviderRecords();
  fixtureAttempted=true;report.app_fixture_mutations_performed=true;
  report.fixture=await owner.setupFixture(records);
  Object.assign(report,await runPwaNativeQaApiChecks(owner,provider,environment.GITHUB_RUN_ID));
  report.automation=await owner.scopedAutomationProof();
  report.native_session_proven=true;report.passed=true;
 }catch(error){
  primary=/^[A-Z][A-Z0-9_]{1,79}$/.test(error?.code??'')?error.code:'STAGING_NATIVE_QA_UNAVAILABLE';
  if(error?.code==='STAGING_NATIVE_QA_PROVIDER_CLEANUP_REQUIRED')try{report.provider=await retryStagingNativeQaProviderCleanup(error);}
  catch{primary='STAGING_NATIVE_QA_PROVIDER_CLEANUP_UNPROVED';}
 }
 finally{
  if(fixtureAttempted&&records){
   try{report.teardown=await owner.teardown();}
   catch{
    // Cleanup has its own fresh fixed preflight, exact source/run/provider
    // ownership and idempotent audited archive operation. No mutation replay.
    try{await owner?.close();owner=await NativeQaSession.connect(environment);report.teardown=await owner.teardown(records);}
    catch{primary='STAGING_NATIVE_QA_SCOPE_CLEANUP_UNPROVED';}
   }
  }
  if(provider)try{
   report.provider=await provider.cleanup();
   need(report.provider.cleanup_complete===true&&report.provider.created_users===2&&report.provider.soft_deleted_users===2
    &&report.provider.globally_revoked_sessions===2,'STAGING_NATIVE_QA_PROVIDER_CLEANUP_UNPROVED');
  }catch{primary='STAGING_NATIVE_QA_PROVIDER_CLEANUP_UNPROVED';}
  if(owner)try{await owner.close();closed=true;}catch{primary='STAGING_NATIVE_QA_CONNECTION_CLOSE_UNPROVED';}
  if(report.passed)try{
   const cleanup=report.teardown;
   need(cleanup?.scope==='STAGING_NATIVE_QA_TEARDOWN_V1'&&['archived','already_archived'].includes(cleanup.status)
    &&cleanup.qa_scopes_archived===2&&cleanup.active_qa_memberships===0&&cleanup.active_qa_grants===0
    &&cleanup.retained_answer_revisions===3&&cleanup.retained_bookings===1&&cleanup.retained_ledger_entries===0
    &&cleanup.teardown_audits===1&&cleanup.histories_preserved===true,'STAGING_NATIVE_QA_SCOPE_CLEANUP_UNPROVED');
  }catch{primary='STAGING_NATIVE_QA_SCOPE_CLEANUP_UNPROVED';}
 }
 return {...report,passed:report.passed&&!primary,returned_session_closed:closed,...(primary?{error:primary}:{}),...LIMITS};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  need(process.argv.length===2,'STAGING_NATIVE_QA_ARGUMENTS_UNEXPECTED');
  const report=await stagingNativeQa(process.env);
  await writeFile('staging-pwa-native-qa.json',JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({scope:report.scope,passed:report.passed,...(report.error?{error:report.error}:{}),...LIMITS}));
  process.exitCode=report.passed?0:1;
 }catch{console.log('STAGING_NATIVE_QA_REPORT_UNAVAILABLE');process.exitCode=1;}
}
